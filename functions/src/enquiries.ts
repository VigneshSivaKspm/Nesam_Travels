// Customer Multicity itinerary enquiry & office quote lifecycle.
// Server-authoritative validation, idempotent submission, customer ownership and quote acceptance.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';
import { approved, inIndia, requireAction, requirePermission, routeFor, text } from './shared';
import { loadTariffConfig, tariffClassOf } from './quote';
import { calendarDays, multicityRatesFor, quoteMulticity } from './domain/tariff';
import { bookingWindowFrom, parsePickupInstant, pickupWindowProblem } from './domain/advanceBooking';
import { GeoPlace } from './domain/types';
import { assertServiceSupported, resolveAndValidateBrand } from './brandContext';
import { createHash } from 'crypto';

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
  if (typeof input.submissionId !== 'string' || input.submissionId !== submissionId || !/^[A-Za-z0-9_-]{1,100}$/.test(submissionId)) {
    throw new HttpsError('invalid-argument', 'Missing submission ID.');
  }
  const brand = resolveAndValidateBrand(input, request);
  assertServiceSupported(brand, 'Multicity');
  const requestKey = createHash('sha256').update(JSON.stringify([uid, brand, submissionId])).digest('hex');
  const submissionRef = db.doc(`multicity_submissions/${requestKey}`);
  const receipt = await submissionRef.get();
  const response = (id: string) => ({ id, code: id, status: 'New', message: 'Your itinerary quote request has been received.' });
  if (receipt.exists) return response(receipt.data()!.enquiryId);

  // Idempotency check: customer retrying with the same submission ID gets the same enquiry
  const existingSnap = await db.collection('enquiries')
    .where('submissionId', '==', submissionId)
    .where('customerId', '==', uid)
    .limit(1)
    .get();

  const existingDoc = existingSnap.docs.find(doc => doc.data().brand === brand || (!doc.data().brand && brand === 'people_taxi'));
  if (existingDoc) {
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
  if (rawStops.length < 1 || rawStops.length > 10) {
    throw new HttpsError('invalid-argument', 'Add from 1 to 10 intermediate stops.');
  }
  const stopIds = new Set<string>();
  const stops: MulticityStop[] = rawStops.map((s: any, idx: number) => {
    const p = cleanPlace(s, `intermediate stop #${idx + 1}`);
    const id = text(s.id, 80);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || stopIds.has(id)) throw new HttpsError('invalid-argument', 'Each intermediate stop needs a unique stop ID.');
    stopIds.add(id);
    return {
      id,
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

  // Vehicle category validation: actual category name or "No preference"
  const categoryId = text(input.categoryId, 80);
  if (input.categoryId != null && (typeof input.categoryId !== 'string' || input.categoryId !== categoryId)) throw new HttpsError('invalid-argument', 'Choose a valid vehicle category or No preference.');
  if (categoryId && !/^[A-Za-z0-9_-]{1,80}$/.test(categoryId)) throw new HttpsError('invalid-argument', 'Choose a valid vehicle category or No preference.');
  const categoryRef = categoryId ? db.doc(`vehicle_categories/${categoryId}`) : null;

  const notes = text(input.notes, 500);
  const passengerName = text(input.passengerName || customerData.name, 100);
  const passengerPhone = text(input.passengerPhone || customerData.phone, 20);
  const defaultSource = brand === 'onewaycarrentals' ? 'onewaycarrentals_web' : brand === 'people_taxi' ? 'peopletaxi_web' : 'nesam_web';
  const source = defaultSource;

  // Generate unique NSM-QT-######
  for (let attempt = 0; attempt < 5; attempt++) {
    const num = String(Math.floor(100000 + Math.random() * 900000));
    const code = `NSM-QT-${num}`;
    const ref = db.doc(`enquiries/${code}`);

    const result = await db.runTransaction(async (tx) => {
      const prior = await tx.get(submissionRef);
      if (prior.exists) return response(prior.data()!.enquiryId);
      const snap = await tx.get(ref);
      if (snap.exists) return null;
      const customer = await tx.get(customerDoc.ref);
      if (!customer.exists || !approved(customer.data()!.status)) throw new HttpsError('permission-denied', 'Your customer account is not active.');
      const category = categoryRef ? await tx.get(categoryRef) : null;
      if (category && (!category.exists || category.data()?.status !== 'Active' || !text(category.data()?.name, 100))) {
        throw new HttpsError('failed-precondition', 'That vehicle category is no longer available. Choose another category or No preference.');
      }
      const categoryName = category ? text(category.data()!.name, 100) : 'No preference';

      const record = {
        code,
        status: 'New',
        brand,
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
        categoryId: categoryId || null,
        vehicle: categoryName,
        pickupAt: Timestamp.fromDate(scheduled),
        tripEndAt: tripEndAt ? Timestamp.fromDate(tripEndAt) : null,
        note: notes,
        source,
        submissionId,
        history: [
          {
            status: 'New',
            note: `Multicity tour enquiry submitted online via ${source} (${brand}). ${stops.length} intermediate stops included.`,
            at: Timestamp.now(),
            byName: passengerName || 'Customer',
          },
        ],
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
        createdByName: passengerName || 'Customer',
      };

      tx.set(ref, record);
      tx.set(submissionRef, { enquiryId: code, customerId: uid, brand, createdAt: FieldValue.serverTimestamp() });
      return { ...response(code), message: 'Your itinerary enquiry has been submitted. Our travel desk will calculate your upfront package quote and notify you shortly.' };
    });

    if (result) return result;
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
      brand: data.brand || null,
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

/**
 * The travel desk prices a Multicity enquiry from the saved Multicity rates of its brand and the chosen vehicle class:
 * the road distance of every leg (pickup → stops → final destination), the trip's Indian calendar days and the brand's
 * Multicity GST policy (included or excluded), else the tariff GST added on top. The quote is written to the enquiry
 * (estimate, breakup, validity) so the customer can review and accept it; nothing else changes.
 */
export const priceMulticityEnquiry = onCall({ timeoutSeconds: 60 }, async (request) => {
  const actor = await requirePermission(request.auth, 'operations');
  requireAction(actor, 'Bookings', 'edit');
  const input = request.data ?? {};
  const enquiryId = text(input.enquiryId, 40);
  if (!/^NSM-QT-\d{6}$/.test(enquiryId)) throw new HttpsError('invalid-argument', 'Invalid enquiry reference.');
  const categoryId = text(input.categoryId, 80);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(categoryId)) throw new HttpsError('invalid-argument', 'Choose the vehicle category to quote.');
  const validDays = Number.isInteger(input.validDays) && input.validDays >= 1 && input.validDays <= 30 ? input.validDays : 7;
  const save = input.save === true;
  const ref = db.doc(`enquiries/${enquiryId}`);
  const [snap, categorySnap, tariff] = await Promise.all([ref.get(), db.doc(`vehicle_categories/${categoryId}`).get(), loadTariffConfig()]);
  const e = snap.data();
  if (!e) throw new HttpsError('not-found', 'The enquiry no longer exists.');
  if (e.serviceId !== 'multicity' && e.tripType !== 'Multicity') throw new HttpsError('failed-precondition', 'Only Multicity enquiries are priced here.');
  if (['Converted', 'Closed'].includes(e.status)) throw new HttpsError('failed-precondition', 'This enquiry is closed.');
  const cat = categorySnap.data();
  if (!cat || cat.status !== 'Active') throw new HttpsError('failed-precondition', 'That vehicle category is not active.');
  const cls = tariffClassOf({ tariffClass: cat.tariffClass, dutyClass: cat.dutyClass, name: cat.name, seats: cat.seats });
  if (!cls) throw new HttpsError('failed-precondition', `${text(cat.name)} is not mapped to a tariff class yet.`);
  if (!tariff) throw new HttpsError('failed-precondition', 'No tariff is saved yet.');
  const brand = typeof e.brand === 'string' && e.brand ? e.brand : 'nesam';
  const rates = multicityRatesFor(tariff, brand, cls);
  if (!rates) throw new HttpsError('failed-precondition', `Multicity rates for ${text(cat.name)} are not complete. Set them in Service & Fare Settings → Multicity (or the Round Trip rates they inherit).`);

  const points: GeoPlace[] = (Array.isArray(e.itinerary) && e.itinerary.length >= 2 ? e.itinerary : [e.pickupPoint, ...(e.stops ?? []), e.dropPoint])
    .filter((p: any) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p: any) => ({ id: 'pin', name: text(p.name, 120), address: text(p.address), lat: p.lat, lng: p.lng, type: 'other' as const }));
  if (points.length < 2) throw new HttpsError('failed-precondition', 'The itinerary has no map positions to measure.');
  const legs = await Promise.all(points.slice(1).map((p, n) => routeFor(points[n], p)));
  const totalKm = legs.reduce((s, l) => s + l.distanceKm, 0);
  const pickupMs = e.pickupAt?.toMillis?.() ?? Date.now();
  const endMs = e.tripEndAt?.toMillis?.() ?? pickupMs;
  const days = calendarDays(pickupMs, endMs) ?? 1;

  // GST: the brand's Multicity policy (pickup-state rules need a verified state, so only the default applies here).
  const rule = tariff.fareGst?.[brand]?.Multicity?.default ?? tariff.fareGst?.common?.Multicity?.default;
  const q = quoteMulticity({ rates, totalKm, days, gstRate: rule ? rule.rate : tariff.gstRate, gstIncluded: rule?.mode === 'included' });
  const rs = (p: number) => Math.round(p) / 100;
  const pct = Math.round(q.gstRate * 10000) / 100;
  const breakup = [
    { label: `Distance: ${q.billableKm} KM billable (itinerary ${q.totalKm} KM, minimum ${rates.minKmPerDay} KM/day × ${days} day${days === 1 ? '' : 's'}) at ₹${rates.customerRate}/KM`, amount: rs(q.distancePaise) },
    { label: `Driver bata: ₹${rates.customerBata} × ${days} day${days === 1 ? '' : 's'}`, amount: rs(q.bataPaise) },
    { label: q.gstIncluded ? `GST (${pct}%), already included in the fare above` : `GST (${pct}%), added on top`, amount: rs(q.gstPaise) },
  ];
  const result = {
    estimate: rs(q.totalPaise), breakup, gstRate: q.gstRate, gstIncluded: q.gstIncluded, includedKm: q.billableKm, extraKmRate: rates.extraKmRate,
    days, totalKm: q.totalKm, categoryId, vehicle: text(cat.name, 100), payout: rs(q.partnerPaise),
  };
  if (!save) return result;
  const validUntil = Timestamp.fromMillis(Date.now() + validDays * 86400000);
  await db.runTransaction(async (tx) => {
    const now = await tx.get(ref);
    if (!now.exists || ['Converted', 'Closed'].includes(now.data()!.status)) throw new HttpsError('failed-precondition', 'This enquiry is closed.');
    tx.update(ref, {
      ...result, status: 'Quote sent', validUntil, quotedAt: FieldValue.serverTimestamp(), quotedBy: actor.uid, quotedByName: actor.name,
      multicityPricing: { tariffVersion: tariff.version, tariffClass: cls, brand, rates, legsKm: legs.map((l) => Math.round(l.distanceKm * 10) / 10) },
      history: FieldValue.arrayUnion({ status: 'Quote sent', note: `Multicity quote ₹${result.estimate.toLocaleString('en-IN')} for ${result.vehicle} (${q.billableKm} KM, ${days} day${days === 1 ? '' : 's'}), valid ${validDays} days.`, at: Timestamp.now(), byName: actor.name }),
    });
  });
  return { ...result, saved: true, validUntil: validUntil.toDate().toISOString() };
});
