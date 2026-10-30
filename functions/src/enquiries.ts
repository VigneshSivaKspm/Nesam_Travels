// Customer Multicity itinerary enquiry & office quote lifecycle.
// Server-authoritative validation, idempotent submission, customer ownership and quote acceptance.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';
import { approved, inIndia, text } from './shared';
import { bookingWindowFrom, parsePickupInstant, pickupWindowProblem } from './domain/advanceBooking';
import { GeoPlace } from './domain/types';

export interface MulticityStop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

function cleanPlace(v: any, label: string): GeoPlace {
  if (!v || typeof v !== 'object') {
    throw new HttpsError('invalid-argument', `Please provide a valid ${label}.`);
  }
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!inIndia(lat, lng)) {
    throw new HttpsError('invalid-argument', `The ${label} coordinates must be inside India.`);
  }
  const name = text(v.name || v.address, 120);
  if (!name) {
    throw new HttpsError('invalid-argument', `Please specify the name of the ${label}.`);
  }
  return {
    id: text(v.id, 80) || 'pin',
    name,
    address: text(v.address || v.name, 250),
    lat,
    lng,
    type: v.type === 'airport' ? 'airport' : 'other',
  };
}

function areDuplicateStops(a: { lat: number; lng: number; name: string }, b: { lat: number; lng: number; name: string }): boolean {
  if (a.name.trim().toLowerCase() === b.name.trim().toLowerCase()) return true;
  return Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lng - b.lng) < 0.001;
}

/**
 * Submits a customer Multicity / tour itinerary enquiry for travel desk review.
 * Server validates stops, coordinates, duplicate consecutive stops, and scheduling window.
 */
export const submitMulticityEnquiry = onCall({ timeoutSeconds: 60 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in is required to request a quote.');

  const input = request.data ?? {};
  const submissionId = text(input.submissionId, 100);
  if (!submissionId) {
    throw new HttpsError('invalid-argument', 'Missing submission ID.');
  }

  // Idempotency check: customer retrying with the same submission ID gets the same enquiry
  const existingSnap = await db.collection('enquiries')
    .where('submissionId', '==', submissionId)
    .where('customerId', '==', uid)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    const data = existingDoc.data();
    return {
      id: existingDoc.id,
      code: data.code || existingDoc.id,
      status: data.status || 'New',
      message: 'Your itinerary quote request has been received.',
    };
  }

  // Customer verification
  const customerDoc = await db.doc(`customers/${uid}`).get();
  if (!customerDoc.exists || !approved(customerDoc.data()!.status)) {
    throw new HttpsError('permission-denied', 'Your customer account is not active.');
  }
  const customerData = customerDoc.data()!;

  // Validate endpoints
  const pickup = cleanPlace(input.pickup, 'pickup location');
  const drop = cleanPlace(input.drop, 'final destination');

  // Validate intermediate stops (1 to 10 stops)
  const rawStops = Array.isArray(input.stops) ? input.stops : [];
  if (rawStops.length > 10) {
    throw new HttpsError('invalid-argument', 'A maximum of 10 intermediate stops can be added per itinerary enquiry.');
  }

  const stops: MulticityStop[] = rawStops.map((s: any, idx: number) => {
    const p = cleanPlace(s, `intermediate stop #${idx + 1}`);
    return {
      id: text(s.id, 80) || `stop-${idx + 1}`,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
    };
  });

  // Verify consecutive duplicate stops
  const fullItinerary = [pickup, ...stops, drop];
  for (let i = 0; i < fullItinerary.length - 1; i++) {
    if (areDuplicateStops(fullItinerary[i], fullItinerary[i + 1])) {
      throw new HttpsError(
        'invalid-argument',
        `Stop "${fullItinerary[i + 1].name}" is a consecutive duplicate of "${fullItinerary[i].name}". Please remove or change the duplicate stop.`
      );
    }
  }

  // Schedule validation
  const now = new Date();
  const scheduled = parsePickupInstant(input.scheduledAt);
  const opsSnap = await db.doc('settings/operations').get();
  const window = bookingWindowFrom(opsSnap.data());
  const scheduleErr = pickupWindowProblem(scheduled, now, window);
  if (scheduleErr || !scheduled) {
    throw new HttpsError('invalid-argument', scheduleErr || 'Select a valid departure date and time.');
  }

  let tripEndAt: Date | null = null;
  if (input.tripEndAt) {
    tripEndAt = parsePickupInstant(input.tripEndAt);
    if (!tripEndAt || tripEndAt.getTime() < scheduled.getTime()) {
      throw new HttpsError('invalid-argument', 'The trip end date cannot be earlier than the departure date.');
    }
  }

  // Vehicle category validation
  const categoryId = text(input.categoryId, 80);
  let categoryName = 'Sedan';
  if (categoryId) {
    const catDoc = await db.doc(`vehicle_categories/${categoryId}`).get();
    if (catDoc.exists) {
      categoryName = catDoc.data()?.name || categoryName;
    }
  }

  const notes = text(input.notes, 500);
  const passengerName = text(input.passengerName || customerData.name, 100);
  const passengerPhone = text(input.passengerPhone || customerData.phone, 20);
  const source = text(input.source || 'peopletaxi_web', 50);

  // Generate unique NSM-QT-######
  for (let attempt = 0; attempt < 5; attempt++) {
    const num = String(Math.floor(100000 + Math.random() * 900000));
    const code = `NSM-QT-${num}`;
    const ref = db.doc(`enquiries/${code}`);

    const ok = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;

      const record = {
        code,
        status: 'New',
        customerId: uid,
        customerName: passengerName,
        phone: passengerPhone,
        whatsapp: customerData.whatsapp || passengerPhone,
        pickup: pickup.name,
        drop: drop.name,
        pickupPoint: pickup,
        dropPoint: drop,
        stops,
        itinerary: fullItinerary,
        serviceId: 'multicity',
        service: 'Multicity',
        tripType: 'Multicity',
        categoryId: categoryId || 'cat-sedan',
        vehicle: categoryName,
        pickupAt: Timestamp.fromDate(scheduled),
        tripEndAt: tripEndAt ? Timestamp.fromDate(tripEndAt) : null,
        note: notes,
        source,
        submissionId,
        history: [
          {
            status: 'New',
            note: `Multicity tour enquiry submitted online via ${source}. ${stops.length} intermediate stops included.`,
            at: Timestamp.now(),
            byName: passengerName || 'Customer',
          },
        ],
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
        createdByName: passengerName || 'Customer',
      };

      tx.set(ref, record);
      return true;
    });

    if (ok) {
      return {
        id: code,
        code,
        status: 'New',
        message: 'Your itinerary enquiry has been submitted. Our travel desk will calculate your upfront package quote and notify you shortly.',
      };
    }
  }

  throw new HttpsError('internal', 'Unable to generate enquiry reference. Please try again.');
});

/**
 * Customer accepts an official office quote for their enquiry.
 * Binds strictly to the customer ID, quote existence, and estimate value.
 */
export const acceptEnquiryQuote = onCall({ timeoutSeconds: 60 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const input = request.data ?? {};
  const enquiryId = text(input.enquiryId, 60);
  if (!enquiryId) throw new HttpsError('invalid-argument', 'Missing enquiry ID.');

  const expectedEstimate = typeof input.expectedEstimate === 'number' ? input.expectedEstimate : null;
  const ref = db.doc(`enquiries/${enquiryId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Enquiry quote not found.');

    const data = snap.data()!;
    if (data.customerId !== uid) {
      throw new HttpsError('permission-denied', 'You do not have permission to view or accept this quote.');
    }

    if (data.status === 'Converted') {
      throw new HttpsError('failed-precondition', `This quote has already been converted to booking ${data.convertedBookingId || ''}.`);
    }

    if (['Closed', 'Expired'].includes(data.status)) {
      throw new HttpsError('failed-precondition', 'This quote is no longer active.');
    }

    const estimate = typeof data.estimate === 'number' ? data.estimate : null;
    if (estimate == null || estimate <= 0) {
      throw new HttpsError('failed-precondition', 'Our travel desk has not finalised a quote for this itinerary yet.');
    }

    if (data.validUntil && data.validUntil.toMillis() < Date.now()) {
      tx.update(ref, { status: 'Expired' });
      throw new HttpsError('failed-precondition', 'This quote has expired. Please contact support to refresh your quote.');
    }

    if (expectedEstimate != null && Math.abs(expectedEstimate - estimate) > 1) {
      throw new HttpsError('failed-precondition', 'The quote estimate has changed. Please review the updated fare before accepting.');
    }

    const custSnap = await tx.get(db.doc(`customers/${uid}`));
    const custName = custSnap.data()?.name || 'Customer';

    tx.update(ref, {
      status: 'Customer accepted',
      acceptedAt: FieldValue.serverTimestamp(),
      customerAcceptedEstimate: estimate,
      history: FieldValue.arrayUnion({
        status: 'Customer accepted',
        note: `Customer accepted the upfront quote of ₹${estimate.toLocaleString('en-IN')}. Ready for vehicle dispatch and booking creation.`,
        at: Timestamp.now(),
        byName: custName,
      }),
    });

    return {
      id: enquiryId,
      code: data.code || enquiryId,
      status: 'Customer accepted',
      message: 'Quote accepted successfully! Our travel desk is assigning your vehicle and will confirm your booking.',
    };
  });
});

/**
 * Retrieves enquiries submitted by the authenticated customer.
 */
export const getCustomerEnquiries = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const snap = await db.collection('enquiries')
    .where('customerId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      code: data.code || d.id,
      status: data.status,
      pickup: data.pickup,
      drop: data.drop,
      stops: data.stops || [],
      vehicle: data.vehicle,
      pickupAt: data.pickupAt?.toDate?.()?.toISOString?.() || null,
      tripEndAt: data.tripEndAt?.toDate?.()?.toISOString?.() || null,
      estimate: data.estimate ?? null,
      breakup: data.breakup || [],
      note: data.note || '',
      validUntil: data.validUntil?.toDate?.()?.toISOString?.() || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      convertedBookingId: data.convertedBookingId || null,
    };
  });
});
