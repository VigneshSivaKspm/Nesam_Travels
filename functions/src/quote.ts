// One pricing path for every booking source: customer app/web, Admin manual booking, the
// quote preview and the final invoice all go through priceBooking(). The confirmed tariff
// (domain/tariff.ts) is used when finance has enabled it in business_config/tariff_v2;
// otherwise, and for duties the confirmed tariff does not cover yet (local / airport trips
// outside a configured city zone), the admin vehicle-category fares remain in force and
// the snapshot records which source priced the booking.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { db } from './admin';
import { auditInTx } from './audit';
import { DutyClass, dutyClassOf } from './domain/eligibility';
import { buildFareBreakup, buildTariffFareBreakup, FareBreakup } from './domain/fareBreakup';
import { FareAdjustmentInput, calculateFare, isOutstation, serviceName } from './domain/pricing';
import {
  CONFIRMED_TARIFF_V2, PricingSnapshot, TARIFF_CLASSES, TariffClass, TariffConfig, TariffError, cityDropFare, paise, parseTariffConfig,
  gstOn, quoteOneWay, quoteRoundTrip, r2, withinCityZone,
} from './domain/tariff';
import { FareBreakdown, GeoPlace, RideCategory, RouteInfo, TripType } from './domain/types';
import { requirePermission, text } from './shared';

export const TARIFF_DOC = 'business_config/tariff_v2';

export async function loadTariffConfig(tx?: Transaction): Promise<TariffConfig | null> {
  const ref = db.doc(TARIFF_DOC);
  const snap = tx ? await tx.get(ref) : await ref.get();
  return snap.exists ? parseTariffConfig(snap.data()) : null;
}

/** tariff class of a category: an explicit `tariffClass` on the category record, else its duty class. */
export function tariffClassOf(category: { tariffClass?: unknown; dutyClass?: unknown; name?: unknown; seats?: unknown }): TariffClass | null {
  const explicit = typeof category.tariffClass === 'string' ? category.tariffClass.trim().toLowerCase() : '';
  if ((TARIFF_CLASSES as readonly string[]).includes(explicit)) return explicit as TariffClass;
  const duty: DutyClass | null = dutyClassOf(category);
  if (!duty) return null;
  return duty === 'sedan' ? 'sedan' : duty === 'crysta' ? 'crysta' : 'suv';
}

export interface PriceInput {
  category: RideCategory & { tariffClass?: unknown; dutyClass?: unknown };
  route: RouteInfo;
  tripType: TripType;
  pickup: GeoPlace;
  drop: GeoPlace;
  pickupAt: Date;
  /** Round trips: when the trip ends (unambiguous instant). */
  tripEndAt: Date | null;
  tariff: TariffConfig | null;
  adjustment: FareAdjustmentInput | null;
  /** Coupon or admin discount in rupees. */
  discount?: number;
  adminDiscount?: Parameters<typeof calculateFare>[0]['adminDiscount'];
}

export interface PriceResult {
  fare: FareBreakdown;
  breakup: FareBreakup;
  pricing: PricingSnapshot;
  service: string;
  outstation: boolean;
  /** true when a percentage commission would apply (older category pricing). */
  usesCommissionPolicy: boolean;
}

/** Throws HttpsError for anything the confirmed tariff cannot price (never invents a number). */
export function priceBooking(i: PriceInput): PriceResult {
  const outstation = isOutstation(i.route.distanceKm);
  const service = serviceName(i.pickup, i.drop, i.route.distanceKm, i.tripType);
  const klass = tariffClassOf(i.category);
  const cfg = i.tariff && i.tariff.enabled ? i.tariff : null;
  const useTariff = !!cfg && !!klass && (i.tripType === 'Round Trip' || (i.tripType === 'One Way' && outstation));

  if (cfg && !klass) {
    throw new HttpsError('failed-precondition', `${i.category.name} is not mapped to a tariff class yet. An admin must set its vehicle class.`);
  }
  if (useTariff && cfg && klass) {
    try {
      const run = (discount: number) => (i.tripType === 'Round Trip'
        ? quoteRoundTrip({
            config: cfg, tariffClass: klass, tripType: 'Round Trip', routeKm: i.route.distanceKm, durationMin: i.route.durationMin,
            pickupMs: i.pickupAt.getTime(), endMs: i.tripEndAt ? i.tripEndAt.getTime() : null, discount,
            adjustmentPercent: i.adjustment?.percent ?? 0, adjustmentDirection: i.adjustment?.direction,
          })
        : quoteOneWay({
            config: cfg, tariffClass: klass, tripType: 'One Way', routeKm: i.route.distanceKm, durationMin: i.route.durationMin,
            pickupMs: i.pickupAt.getTime(), endMs: null, discount,
            adjustmentPercent: i.adjustment?.percent ?? 0, adjustmentDirection: i.adjustment?.direction,
          }));
      let q = run(i.discount ?? 0);
      if (i.adminDiscount) {
        const v = Math.max(0, i.adminDiscount.value);
        const requested = i.adminDiscount.type === 'percentage' ? Math.round((q.fare.subtotal * Math.min(100, v)) / 100) : Math.round(v);
        q = run(requested);
        if (q.fare.discount > 0) q.fare.discountDetail = { type: i.adminDiscount.type, value: v, amount: q.fare.discount, source: 'admin', reason: i.adminDiscount.reason ?? '' };
      }
      return {
        fare: q.fare, pricing: q.pricing, service, outstation,
        breakup: buildTariffFareBreakup(i.category, q.fare, outstation || i.tripType === 'Round Trip', q.pricing),
        usesCommissionPolicy: false,
      };
    } catch (e) {
      if (e instanceof TariffError) throw new HttpsError('failed-precondition', e.message, { code: e.code });
      throw e;
    }
  }

  // City drop package: only inside a configured city zone (boundaries are an open decision).
  if (cfg && klass && i.tripType === 'One Way' && !outstation && cfg.cityDrop.classes[klass]) {
    const zone = withinCityZone(cfg, i.pickup, i.drop);
    if (zone) {
      const pack = cityDropFare(cfg, klass, i.route.distanceKm);
      const pre = r2(pack.customerPaise / 100);
      const discount = Math.min(Math.max(0, r2(i.discount ?? 0)), pre);
      const taxable = r2(pre - discount);
      const gst = gstOn(taxable, cfg.gstRate);
      const fare: FareBreakdown = {
        subtotalBeforeAdjustment: pre, globalAdjustment: null, discountDetail: discount > 0 ? { type: 'coupon', value: discount, amount: discount, source: 'coupon', reason: '' } : null,
        baseFare: cfg.cityDrop.classes[klass]!.customerBase, distanceFare: r2(pre - cfg.cityDrop.classes[klass]!.customerBase),
        timeFare: 0, nightCharge: 0, driverAllowance: 0, minimumFareAdjustment: 0, subtotal: pre, discount, taxableAmount: taxable, gstRate: cfg.gstRate, gst, total: r2(taxable + gst),
        distanceKm: Math.round(i.route.distanceKm * 10) / 10, durationMin: Math.round(i.route.durationMin), perKmRate: cfg.cityDrop.classes[klass]!.customerExtraKm, perMinuteRate: 0,
      };
      const pricing: PricingSnapshot = {
        schema: 2, source: 'tariff_v2', model: 'city_drop_package', tariffVersion: cfg.version, tariffClass: klass, gstRate: cfg.gstRate,
        quotedKm: Math.max(cfg.cityDrop.baseKm, fare.distanceKm), includedKm: cfg.cityDrop.baseKm, extraKmRatePaise: paise(cfg.cityDrop.classes[klass]!.customerExtraKm),
        customerRatePaise: paise(cfg.cityDrop.classes[klass]!.customerExtraKm), customerBataPaise: 0, days: 1, minKmPerDay: cfg.cityDrop.baseKm,
        packagePaise: pack.customerPaise, discount, adminAdjustment: 0, adjustmentPercent: 0, adjustmentDirection: 'increase',
        partner: { mode: 'NORMAL_RATE', ratePaise: paise(cfg.cityDrop.classes[klass]!.partnerExtraKm), bataPaise: 0, minKm: cfg.cityDrop.baseKm, days: 1, basePaise: pack.partnerPaise },
        pickupDate: '', endDate: null, gates: [`D15: city boundary "${zone.name}" is a configured zone awaiting business confirmation`, 'D05: add-on units and partner share are pending'],
      };
      return { fare, pricing, service: 'City drop', outstation: false, breakup: buildTariffFareBreakup(i.category, fare, false, pricing), usesCommissionPolicy: false };
    }
  }

  // Older admin-category engine: local / airport trips and anything while the tariff is off.
  const fare = calculateFare({
    category: i.category, route: i.route, tripType: i.tripType, pickupTime: i.pickupAt, discount: i.discount ?? 0, adjustment: i.adjustment, adminDiscount: i.adminDiscount ?? null,
  });
  const legs = i.tripType === 'Round Trip' ? 2 : 1;
  const extraRate = i.category.fare.extras?.extraKmRate ?? i.category.fare.perKmRate;
  const pricing: PricingSnapshot = {
    schema: 2, source: 'legacy_category', model: 'legacy_category', tariffVersion: 0, tariffClass: klass, gstRate: fare.gstRate,
    quotedKm: Math.round(i.route.distanceKm * legs * 10) / 10, includedKm: Math.round(i.route.distanceKm * legs * 10) / 10,
    extraKmRatePaise: paise(extraRate), customerRatePaise: paise(fare.perKmRate), customerBataPaise: 0, days: 1, minKmPerDay: 0,
    packagePaise: paise(fare.subtotal), discount: fare.discount, adminAdjustment: 0, adjustmentPercent: 0, adjustmentDirection: 'increase', partner: null, pickupDate: '', endDate: null,
    gates: cfg ? ['Local / airport duty outside a configured city zone is priced by the vehicle category (confirmed tariff does not cover it yet)'] : ['Confirmed tariff is not enabled; vehicle category fares apply'],
  };
  return { fare, pricing, service, outstation, breakup: buildFareBreakup(i.category, fare, outstation), usesCommissionPolicy: true };
}

// ── Admin: save the tariff configuration ────────────────────────────────────

/**
 * Saves business_config/tariff_v2. Passing `useConfirmedDefaults: true` writes the values the
 * owner confirmed on 09 Oct 2026; `enabled` switches the confirmed tariff on for NEW bookings
 * only — a confirmed booking keeps the pricing snapshot it was quoted with.
 */
export const saveTariffConfig = onCall(async (request) => {
  const actor = await requirePermission(request.auth, 'pricing');
  const input = request.data ?? {};
  const raw = input.useConfirmedDefaults === true ? { ...CONFIRMED_TARIFF_V2, cityDrop: { ...CONFIRMED_TARIFF_V2.cityDrop, zones: input.cityDrop?.zones ?? [] } } : input;
  const parsed = parseTariffConfig({ ...raw, enabled: input.enabled === true, version: 0 });
  if (!parsed) throw new HttpsError('invalid-argument', 'The tariff configuration is invalid.');
  if (parsed.enabled && !Object.keys(parsed.oneWay.classes).length && !Object.keys(parsed.roundTrip.classes).length) {
    throw new HttpsError('failed-precondition', 'Configure at least one one-way or round-trip rate card before enabling the tariff.');
  }
  const reason = text(input.reason, 300);
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'Give a short reason for the change.');
  const ref = db.doc(TARIFF_DOC);
  return db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const before = current.exists ? parseTariffConfig(current.data()) : null;
    if (typeof input.expectedVersion === 'number' && input.expectedVersion !== (before?.version ?? 0)) {
      throw new HttpsError('failed-precondition', 'The tariff was changed by someone else. Reload and review it before saving.');
    }
    const version = (before?.version ?? 0) + 1;
    tx.set(ref, { ...parsed, version, updatedBy: actor.uid, updatedByName: actor.name, updatedAt: FieldValue.serverTimestamp() });
    auditInTx(tx, { action: 'tariff_saved', entity: 'tariff', entityId: 'v2', performedBy: actor.uid, performedByName: actor.name, role: 'admin', previous: before ? { version: before.version, enabled: before.enabled } : null, next: { version, enabled: parsed.enabled }, reason });
    return { version, enabled: parsed.enabled };
  });
});

// ── Customer: authoritative quotes for every bookable category ──────────────

import { mapCategory, mapCoupon, normalizeCode, validateCoupon } from './domain/pricing';
import { bookingWindowFrom, parsePickupInstant, pickupWindowProblem } from './domain/advanceBooking';
import { effectiveAdjustment, loadFareAdjustment } from './fareConfig';
import { approved, inIndia, routeFor } from './shared';

function placeOf(v: any, role: string): GeoPlace {
  if (!v || !inIndia(v.lat, v.lng)) throw new HttpsError('invalid-argument', `Choose a valid ${role} location in India.`);
  return { id: 'pin', name: text(v.name, 120), address: text(v.address), lat: v.lat, lng: v.lng, type: v.type === 'airport' ? 'airport' : 'other' };
}

/**
 * The fare the customer will be charged, for each active vehicle category, computed by the same
 * priceBooking() createBooking uses — so what the customer reviews is what is booked. Nothing is
 * written. The pickup time matters (night charge, calendar days), so it is validated like a booking.
 */
export const quoteBooking = onCall({ timeoutSeconds: 60 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const input = request.data ?? {};
  const pickup = placeOf(input.pickup, 'pickup'), drop = placeOf(input.drop, 'drop');
  const tripType: TripType =
    input.tripType === 'Round Trip'
      ? 'Round Trip'
      : input.tripType === 'Local Rental'
      ? 'Local Rental'
      : input.tripType === 'Airport Taxi'
      ? 'Airport Taxi'
      : 'One Way';
  const now = new Date();
  const when = parsePickupInstant(input.scheduledAt);
  const window = bookingWindowFrom((await db.doc('settings/operations').get()).data());
  const problem = pickupWindowProblem(when, now, window);
  if (problem || !when) throw new HttpsError('invalid-argument', problem || 'Choose the pickup date and time.');
  const tripEndAt = tripType === 'Round Trip' ? parsePickupInstant(input.tripEndAt) : null;
  const route = await routeFor(pickup, drop);
  const [categories, tariff, adjustmentDoc, customer, coupons, history] = await Promise.all([
    db.collection('vehicle_categories').where('status', '==', 'Active').get(),
    loadTariffConfig(),
    loadFareAdjustment(),
    db.doc(`customers/${uid}`).get(),
    input.couponCode ? db.collection('coupons').get() : Promise.resolve(null),
    input.couponCode ? db.collection('bookings').where('customerId', '==', uid).get() : Promise.resolve(null),
  ]);
  if (!customer.exists || !approved(customer.data()!.status)) throw new HttpsError('permission-denied', 'Your account is not active.');
  const adjustment = effectiveAdjustment(adjustmentDoc, now);
  const code = normalizeCode(text(input.couponCode, 50));
  const prior = history ? history.docs.map((d) => d.data()).filter((b) => b.status !== 'Cancelled' && b.status !== 'Rejected') : [];
  const quotes = categories.docs
    .map((d) => ({ d, c: mapCategory(d.id, d.data()) }))
    .filter((x): x is { d: FirebaseFirestore.QueryDocumentSnapshot; c: NonNullable<ReturnType<typeof mapCategory>> } => x.c !== null)
    .sort((a, b) => a.c.displayOrder - b.c.displayOrder)
    .map(({ d, c }) => {
      const category = { ...c, tariffClass: d.data().tariffClass, dutyClass: d.data().dutyClass };
      const base = { category, route, tripType, pickup, drop, pickupAt: when, tripEndAt, tariff, adjustment };
      try {
        const before = priceBooking(base);
        let couponMessage = '', discount = 0;
        if (code && coupons) {
          const r = validateCoupon(coupons.docs.map((x) => mapCoupon(x.id, x.data())), code, {
            subtotal: before.fare.subtotal, categoryId: c.id, service: before.service, isFirstBooking: prior.length === 0,
            customerUses: prior.filter((b) => normalizeCode(b.couponCode || '') === code).length,
          });
          if (r.ok) { discount = r.coupon.discount; couponMessage = r.coupon.message; } else couponMessage = r.message;
        }
        const priced = discount > 0 ? priceBooking({ ...base, discount }) : before;
        return {
          categoryId: c.id, ok: true as const, fare: priced.fare, breakup: priced.breakup, service: priced.service,
          model: priced.pricing.model, days: priced.pricing.days, includedKm: priced.pricing.includedKm, couponMessage, couponApplied: discount > 0,
        };
      } catch (e) {
        return { categoryId: c.id, ok: false as const, error: e instanceof HttpsError ? e.message : 'This category cannot be priced right now.' };
      }
    });
  return {
    route: { distanceKm: Math.round(route.distanceKm * 10) / 10, durationMin: Math.round(route.durationMin) },
    service: quotes.find((q) => q.ok)?.service ?? '',
    quotes,
  };
});
