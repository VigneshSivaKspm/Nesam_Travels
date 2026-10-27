import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomInt } from 'crypto';
import { db } from './admin';
import { auditInTx } from './audit';
import { optionalEmail, whatsappContact } from './bookingBuild';
import { bookingWindowFrom, parsePickupInstant, pickupWindowProblem } from './domain/advanceBooking';
import { dutyClassOf } from './domain/eligibility';
import { isOutstation, mapCategory, mapCoupon, normalizeCode, validateCoupon } from './domain/pricing';
import { COMMISSION_NOT_CONFIGURED, resolveCommission } from './domain/finance';
import { formatDate, formatDateTime12, formatTime12 } from './domain/time';
import { GeoPlace, TripType } from './domain/types';
import { loadCommissionPolicy } from './commission';
import { effectiveAdjustment, loadFareAdjustment } from './fareConfig';
import { adjustPartner, assertBookable, assertWithinLimits, availabilityFields, evaluateRules, loadServiceRules, partnerPayoutRupees, ruleServiceText } from './serviceRules';
import { createContactInTx, maskPhone } from './contacts';
import { loadTariffConfig, priceBooking, rentalHoursOf, tariffClassOf } from './quote';
import { assertLegalAccepted } from './legal';
import { nextBookingCode } from './bookingSequence';
import { notifyInTx, pushAfterCommit, NotifyInput } from './notify';
import { NO_BOOKABLE_CATEGORIES, approved, inIndia, requestIdOf as id, routeFor, text } from './shared';

function place(v: any): GeoPlace {
  if (!v || !inIndia(v.lat, v.lng)) throw new HttpsError('invalid-argument', 'Choose valid pickup and drop locations in India.');
  return { id: 'pin', name: text(v.name, 120), address: text(v.address), lat: v.lat, lng: v.lng, type: v.type === 'airport' ? 'airport' : 'other' };
}

export const createBooking = onCall({ timeoutSeconds: 60 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const input = request.data ?? {};
  const requestId = id(input.requestId);
  if (!['Cash', 'UPI'].includes(input.paymentMethod)) throw new HttpsError('failed-precondition', 'Choose cash or UPI. Wallet and card checkout are not enabled.');
  const ref = db.doc(`bookings/${requestId}`);
  const existing = await ref.get();
  if (existing.exists) {
    if (existing.data()!.customerId !== uid) throw new HttpsError('permission-denied', 'Request already used.');
    return { id: requestId, fare: existing.data()!.fare };
  }
  // Customers must have accepted the current published Terms & Privacy Policy (none published → no block).
  await assertLegalAccepted(uid, 'customer');
  // NESAM takes advance bookings only. The pickup must be an unambiguous instant
  // (ISO-8601 with "Z" or an offset) inside the booking window; there is no
  // "now" and no default pickup time.
  if (input.termsAccepted !== true) throw new HttpsError('failed-precondition', 'Accept the NESAM terms and cancellation policy to submit a booking request.');
  const now = new Date();
  const scheduled = parsePickupInstant(input.scheduledAt);
  const window = bookingWindowFrom((await db.doc('settings/operations').get()).data());
  const scheduleProblem = pickupWindowProblem(scheduled, now, window);
  if (scheduleProblem || !scheduled) throw new HttpsError('invalid-argument', scheduleProblem || 'Choose the pickup date and time.');
  const when = scheduled;
  const pickup = place(input.pickup), drop = place(input.drop);
  const route = await routeFor(pickup, drop);
  const tripType: TripType =
    input.tripType === 'Round Trip'
      ? 'Round Trip'
      : input.tripType === 'Local Rental'
      ? 'Local Rental'
      : input.tripType === 'Airport Taxi'
      ? 'Airport Taxi'
      : 'One Way';
  // A round trip is billed by Indian calendar date, so the customer states when it ends.
  let tripEndAt: Date | null = null;
  if (tripType === 'Round Trip') {
    tripEndAt = parsePickupInstant(input.tripEndAt);
    if (!tripEndAt) throw new HttpsError('invalid-argument', 'Choose the date and time your round trip ends.');
    if (tripEndAt.getTime() < when.getTime()) throw new HttpsError('invalid-argument', 'The trip cannot end before it starts.');
  }
  const pushes: { id: string; input: NotifyInput }[] = [];
  const serviceRules = await loadServiceRules();
  const result = await db.runTransaction(async (tx) => {
    pushes.length = 0; // the callback can retry; only the committed attempt may push
    const [previous, customer, categories, coupons, history, policy, adjustmentDoc, tariff] = await Promise.all([
      tx.get(ref), tx.get(db.doc(`customers/${uid}`)),
      tx.get(db.collection('vehicle_categories').where('status', '==', 'Active')),
      tx.get(db.collection('coupons')),
      tx.get(db.collection('bookings').where('customerId', '==', uid)),
      loadCommissionPolicy(tx),
      loadFareAdjustment(tx),
      loadTariffConfig(tx),
    ]);
    if (!customer.exists || !approved(customer.data()!.status)) throw new HttpsError('permission-denied', 'Your account is not active.');
    if (previous.exists) {
      if (previous.data()!.customerId !== uid) throw new HttpsError('permission-denied', 'Request already used.');
      return { id: requestId, fare: previous.data()!.fare };
    }
    // Several advance bookings may be open at once; there is no "one active booking" limit.
    let configured = categories.docs.map(d => {
      const c = mapCategory(d.id, d.data());
      return c ? { ...c, tariffClass: d.data().tariffClass, dutyClass: d.data().dutyClass } : null;
    }).filter((c): c is NonNullable<typeof c> => c !== null);
    if (!configured.length) {
      configured = [
        {
          id: 'cat-sedan', name: 'Sedan', description: 'Swift Dzire, Toyota Etios or similar', seats: 4, displayOrder: 1,
          matchVehicleTypes: ['sedan', 'dzire', 'etios'], tariffClass: 'sedan', dutyClass: 'sedan',
          fare: { baseFare: 0, baseKm: 0, perKmRate: 15, perMinuteRate: 0, minimumFare: 1950, nightCharge: 0, driverAllowance: 400, outstationPerKmRate: 15, extras: { waitingPerHour: 0, extraKmRate: 15, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 } },
        },
        {
          id: 'cat-suv-6', name: 'SUV (6+1)', description: 'Maruti Ertiga, Mahindra Marazzo (6 Passengers)', seats: 6, displayOrder: 2,
          matchVehicleTypes: ['suv', 'ertiga', 'marazzo'], tariffClass: 'suv-6', dutyClass: 'suv-6',
          fare: { baseFare: 0, baseKm: 0, perKmRate: 20, perMinuteRate: 0, minimumFare: 2600, nightCharge: 0, driverAllowance: 400, outstationPerKmRate: 20, extras: { waitingPerHour: 0, extraKmRate: 20, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 } },
        },
        {
          id: 'cat-suv-7', name: 'SUV (7+1)', description: 'Mahindra Scorpio, Bolero Neo (7 Passengers)', seats: 7, displayOrder: 3,
          matchVehicleTypes: ['suv', 'scorpio', 'bolero'], tariffClass: 'suv-7', dutyClass: 'suv-7',
          fare: { baseFare: 0, baseKm: 0, perKmRate: 20, perMinuteRate: 0, minimumFare: 2600, nightCharge: 0, driverAllowance: 400, outstationPerKmRate: 20, extras: { waitingPerHour: 0, extraKmRate: 20, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 } },
        },
        {
          id: 'cat-innova', name: 'Innova', description: 'Toyota Innova (Spacious highway comfort, 7 Seater)', seats: 7, displayOrder: 4,
          matchVehicleTypes: ['innova'], tariffClass: 'innova', dutyClass: 'innova',
          fare: { baseFare: 0, baseKm: 0, perKmRate: 20, perMinuteRate: 0, minimumFare: 2600, nightCharge: 0, driverAllowance: 400, outstationPerKmRate: 20, extras: { waitingPerHour: 0, extraKmRate: 20, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 } },
        },
        {
          id: 'cat-crysta', name: 'Innova Crysta', description: 'Executive Luxury MPV, Premium Highway Chauffeur', seats: 7, displayOrder: 5,
          matchVehicleTypes: ['crysta', 'innova crysta'], tariffClass: 'crysta', dutyClass: 'crysta',
          fare: { baseFare: 0, baseKm: 0, perKmRate: 26, perMinuteRate: 0, minimumFare: 3380, nightCharge: 0, driverAllowance: 600, outstationPerKmRate: 26, extras: { waitingPerHour: 0, extraKmRate: 26, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 } },
        },
      ];
    }
    const catReq = (input.categoryId || '').trim().toLowerCase();
    const category = configured.find(c =>
      c.id === input.categoryId ||
      c.id.toLowerCase() === catReq ||
      c.name.toLowerCase() === catReq ||
      c.id.replace('cat-', '') === catReq.replace('cat-', '')
    ) ?? configured[0];
    if (!category) throw new HttpsError('failed-precondition', 'This vehicle category is no longer available.');
    const rules = evaluateRules(serviceRules, pickup, drop, when, ruleServiceText(pickup, drop, route.distanceKm, tripType));
    assertBookable(rules, category.name);
    const adjustment = rules.customer ?? effectiveAdjustment(adjustmentDoc, now);
    const priceInput = { category, route, tripType, pickup, drop, pickupAt: when, tripEndAt, tariff, adjustment, rentalHours: tripType === 'Local Rental' ? rentalHoursOf(input.rentalHours) : null };
    const beforeDiscount = priceBooking(priceInput);
    // The percentage commission only prices duties still on the category engine; confirmed
    // tariff duties carry fixed partner rates, so no commission is required (or invented).
    const resolvedComm = beforeDiscount.usesCommissionPolicy ? resolveCommission(policy, { categoryId: category.id }) : null;
    const commission = beforeDiscount.usesCommissionPolicy
      ? (resolvedComm ?? { rate: 10, base: 'taxable' as const, source: 'default', policyVersion: 1 })
      : null;
    const service = beforeDiscount.service;
    const couponCode = normalizeCode(text(input.couponCode, 50));
    let discount = 0, usedCoupon;
    if (couponCode) {
      const prior = history.docs.map(d => d.data()).filter(b => b.status !== 'Cancelled' && b.status !== 'Rejected');
      const result = validateCoupon(coupons.docs.map(d => mapCoupon(d.id, d.data())), couponCode, {
        subtotal: beforeDiscount.fare.subtotal, categoryId: category.id, service,
        isFirstBooking: prior.length === 0, customerUses: prior.filter(b => normalizeCode(b.couponCode || '') === couponCode).length,
        pickupAt: when, completedTrips: prior.filter(b => b.status === 'Completed').length,
        pickupText: `${pickup.name} ${pickup.address ?? ''}`, dropText: `${drop.name} ${drop.address ?? ''}`,
        fixedRoute: beforeDiscount.pricing.model === 'city_drop_package', peakAdjusted: adjustment?.direction === 'increase',
      });
      if (!result.ok) throw new HttpsError('failed-precondition', result.message);
      discount = result.coupon.discount;
      usedCoupon = coupons.docs.find(d => normalizeCode(d.data().code || '') === couponCode);
    }
    const pricedRaw = priceBooking({ ...priceInput, discount });
    const priced = { ...pricedRaw, pricing: adjustPartner(pricedRaw.pricing, rules) };
    assertWithinLimits(rules, { categoryName: category.name, customerFare: priced.fare.total, partnerPayout: partnerPayoutRupees(priced.pricing) });
    const fare = priced.fare, breakup = priced.breakup;
    if (!Number.isFinite(input.expectedFare) || fare.total !== input.expectedFare) {
      throw new HttpsError('failed-precondition', `The current fare is ₹${fare.total}. Review the updated fare and book again.`, { fare, breakup, pricing: priced.pricing });
    }
    const c = customer.data()!;
    const phone = text(c.phone);
    // Optional extras from the customer's own booking form.
    const whatsapp = phone && /^\+91[6-9]\d{9}$/.test(phone.replace(/\s/g, '')) ? whatsappContact(input.whatsapp, phone.replace(/\s/g, '')) : null;
    const email = optionalEmail(input.email) || text(c.email);
    const date = formatDate(when);
    const time = formatTime12(when);
    const bookingCode = await nextBookingCode(tx, now);
    const stamp = FieldValue.serverTimestamp();
    const rawSource = text(input.bookingSource || input.source || input.brand || '');
    let bookingSource = 'customer';
    if (rawSource.toLowerCase().includes('oneway') || rawSource.toLowerCase().includes('one_way')) {
      bookingSource = 'onewaycarrentals';
    } else if (rawSource.toLowerCase().includes('people')) {
      bookingSource = 'people_taxi';
    } else if (rawSource.toLowerCase().includes('nesam')) {
      bookingSource = 'nesam';
    } else if (rawSource) {
      bookingSource = rawSource;
    }
    tx.create(ref, {
      id: requestId, bookingId: bookingCode, customerId: uid, customer: text(c.name), phoneMasked: maskPhone(phone),
      pickup: pickup.name, pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng, pickupLatitude: pickup.lat, pickupLongitude: pickup.lng, pickupType: pickup.type,
      drop: drop.name, dropAddress: drop.address, dropLat: drop.lat, dropLng: drop.lng, dropType: drop.type,
      service, tripType, vehicle: category.name, vehicleCategory: category.name, vehicleCategoryId: category.id,
      passengerSeatsRequired: category.seats, dutyClass: dutyClassOf({ dutyClass: category.dutyClass, name: category.name, seats: category.seats }) ?? '', tariffClass: tariffClassOf(category) ?? '',
      fare: fare.total, fareBreakdown: fare, fareBreakup: breakup, pricing: priced.pricing, fareVerified: true, ...(commission ? { commission } : {}), distanceKm: fare.distanceKm, durationMin: fare.durationMin,
      ...(tripEndAt ? { tripEndAt: Timestamp.fromDate(tripEndAt), endDate: priced.pricing.endDate, billableDays: priced.pricing.days } : {}),
      discountDetails: fare.discountDetail, globalAdjustmentApplied: fare.globalAdjustment ?? null,
      routeEstimated: false, couponCode, discount, notes: text(input.notes), payment: 'Pending', paymentStatus: 'Unpaid',
      paymentMethod: input.paymentMethod === 'UPI' ? 'UPI' : 'Cash',
      rideTiming: 'scheduled', bookingType: 'advance', scheduledAt: Timestamp.fromDate(when), pickupAt: Timestamp.fromDate(when),
      termsAccepted: true, termsAcceptedAt: stamp,
      date, time, status: 'Pending', tripSubStatus: 'Not Started', source: bookingSource, bookingSource, brand: bookingSource, ...availabilityFields(rules), createdAt: stamp, updatedAt: stamp,
    });
    // Raw contact details live in booking_contacts (staff + the customer); partners get the masked number only.
    createContactInTx(tx, requestId, { customerId: uid, name: text(c.name), phone, whatsapp, email });
    tx.create(db.doc(`booking_secrets/${requestId}`), { customerId: uid, otp: String(randomInt(1000, 10000)), createdAt: stamp });
    // No marketplace record is created here. A booking reaches partners only when an admin
    // approves it and then deliberately publishes, or directly assigns, it.
    tx.create(ref.collection('events').doc(), { type: 'created', actorId: uid, actorRole: 'customer', at: stamp });
    auditInTx(tx, { action: 'booking_created', entity: 'booking', entityId: requestId, performedBy: uid, performedByName: text(c.name), role: 'customer', bookingId: requestId, next: { bookingCode, fare: fare.total, adjustment: fare.globalAdjustment, discount: fare.discountDetail } });
    if (usedCoupon) tx.update(usedCoupon.ref, { usedCount: FieldValue.increment(1) });
    // Serializes first-booking/per-customer coupon eligibility across concurrent requests.
    tx.update(customer.ref, { lastBookingAt: stamp });
    const sourceTag = bookingSource === 'onewaycarrentals'
      ? ' · [One Way Car Rental]'
      : bookingSource === 'people_taxi'
      ? ' · [People Taxi]'
      : '';
    const sourceTitle = bookingSource === 'onewaycarrentals'
      ? 'New One Way Car Rental booking to review'
      : bookingSource === 'people_taxi'
      ? 'New People Taxi booking to review'
      : 'New booking request to review';
    const n: NotifyInput = {
      recipientType: 'admin', recipientId: 'admin', category: 'bookings', severity: 'info', sound: 'new_booking',
      title: sourceTitle, message: `${bookingCode}${sourceTag} · ${text(c.name)} · ${pickup.name} → ${drop.name} · ${formatDateTime12(when)} · ₹${fare.total.toLocaleString('en-IN')}`,
      bookingId: requestId, bookingCode, cta: { label: 'Review booking', page: 'booking-detail', bookingId: requestId }, push: true, sentBy: uid,
    };
    pushes.push({ id: notifyInTx(tx, n), input: n });
    return { id: requestId, fare: fare.total };
  });
  await pushAfterCommit(pushes);
  return result;
});
