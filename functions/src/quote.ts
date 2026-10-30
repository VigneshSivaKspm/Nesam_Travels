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
import { buildFareBreakup, buildTariffFareBreakup, FareBreakup, withExtraChargeLines } from './domain/fareBreakup';
import { extraChargesSnapshot } from './domain/extraCharges';
import { CATEGORY_GST_RATE, FareAdjustmentInput, calculateFare, isOutstation, serviceName } from './domain/pricing';
import {
  CONFIRMED_TARIFF_V2, FixedRouteFare, PricingSnapshot, QuoteResult, TARIFF_CLASSES, TariffClass, TariffConfig, TariffError, cityDropFare, classRates, istDate, localFareFor, matchFixedRoute, paise,
  parseFixedRouteFare, parseTariffConfig, gstOn, quoteFixedRoute, quoteLocalPickupDrop, quoteOneWay, quoteRentalPackage, quoteRoundTrip, r2, withinCityZone, scopedTariffForBrand,
} from './domain/tariff';
import { FareBreakdown, GeoPlace, RideCategory, RouteInfo, TripType } from './domain/types';
import { requirePermission, text, requireAction } from './shared';
import { assertCatalogAvailable } from './onlineCatalog';
import { assertServiceSupported, resolveAndValidateBrand } from './brandContext';

export const TARIFF_DOC = 'business_config/tariff_v2';

export async function loadTariffConfig(tx?: Transaction): Promise<TariffConfig | null> {
  const ref = db.doc(TARIFF_DOC);
  const snap = tx ? await tx.get(ref) : await ref.get();
  return snap.exists ? parseTariffConfig(snap.data()) : null;
}

/** Every enabled, valid fixed route fare (see parseFixedRouteFare); older route rules are not included. */
export async function loadFixedRoutes(tx?: Transaction): Promise<FixedRouteFare[]> {
  const q = db.collection('fare_rules').where('pricingType', '==', 'FIXED_ROUTE').where('status', '==', 'Active');
  const snap = tx ? await tx.get(q) : await q.get();
  return snap.docs.map((d) => parseFixedRouteFare(d.id, d.data())).filter((r): r is FixedRouteFare => r !== null);
}

/** tariff class of a category: an explicit `tariffClass` on the category record, else its duty class. */
export function tariffClassOf(category: { tariffClass?: unknown; dutyClass?: unknown; name?: unknown; seats?: unknown }): TariffClass | null {
  const explicit = typeof category.tariffClass === 'string' ? category.tariffClass.trim().toLowerCase() : '';
  if ((TARIFF_CLASSES as readonly string[]).includes(explicit)) return explicit as TariffClass;
  const duty: DutyClass | null = dutyClassOf(category);
  if (!duty) return null;
  // Innova has its own class; until an Innova rate is saved it is priced at the SUV rate (see classRates).
  return duty === 'sedan' ? 'sedan' : duty === 'crysta' ? 'crysta' : duty === 'innova' ? 'innova' : 'suv';
}

/**
 * The canonical City record (`locations` id) a master-location place belongs to: the place itself when it
 * is a City, else the City found by walking `parentLocationId`, else the one active City with the same
 * state and city name. null for a map pin or anything that cannot be resolved to exactly one City.
 */
async function cityIdOf(place: GeoPlace): Promise<string | null> {
  if (!place.id || place.id === 'pin') return null;
  let id = place.id;
  for (let hop = 0; hop < 4; hop++) {
    const snap = await db.doc(`locations/${id}`).get();
    const l = snap.data();
    if (!snap.exists || !l) return null;
    if (l.type === 'City') return snap.id;
    if (typeof l.parentLocationId !== 'string' || !l.parentLocationId) break;
    id = l.parentLocationId;
  }
  const { city, state } = place as GeoPlace & { city?: string; state?: string };
  if (!city) return null;
  const cities = await db.collection('locations').where('type', '==', 'City').where('status', '==', 'Active').where('city', '==', city).get();
  const same = cities.docs.filter((d) => !state || !d.data().state || d.data().state === state);
  return same.length === 1 ? same[0].id : null;
}

/** The City both places belong to, for Local Pickup & Drop pricing; null when they differ or cannot be resolved. */
export async function sharedCityId(pickup: GeoPlace, drop: GeoPlace): Promise<string | null> {
  const [a, b] = await Promise.all([cityIdOf(pickup), cityIdOf(drop)]);
  return a && a === b ? a : null;
}

/** Whole rental hours from a request, or null when none were asked for. */
export function rentalHoursOf(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;
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
  /** Canonical City both places belong to (see sharedCityId). Enables Local Pickup & Drop pricing. */
  localCityId?: string | null;
  /** Local Rental only: the package the customer chose, in hours. */
  rentalHours?: number | null;
  /** Enabled fixed route fares and the booked service. Only places with canonical location ids (never a map pin) can match one. */
  fixedRoutes?: FixedRouteFare[];
  serviceId?: string;
  businessContract?: import('./domain/business').BusinessContract | null;
  /** Brand scope applied to price this booking. */
  brand?: string;
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

/**
 * Throws HttpsError for anything the confirmed tariff cannot price (never invents a number). Whatever path prices the trip, the
 * quote also records the category's extra-charge rates (waiting, hill, roof carrier — customer and partner) in its snapshot and
 * discloses them in the breakup. The fare itself is unchanged: these are billed only for the extras actually used.
 */
export function priceBooking(i: PriceInput): PriceResult {
  const r = priceBookingCore(i);
  let extra = extraChargesSnapshot(i.tariff?.extraCharges, i.tariff?.version ?? 0, i.category.id);
  const klass = tariffClassOf(i.category);
  if (extra && i.brand && klass && i.tariff?.brandOverrides?.[i.brand]) {
    const brandService = i.tariff.brandOverrides[i.brand]?.[i.tripType] || i.tariff.brandOverrides[i.brand]?.['One Way'];
    const ov = brandService?.[klass];
    if (ov) {
      extra = {
        ...extra,
        customer: {
          ...extra.customer,
          ...(ov.waitingPerHour !== undefined ? { waitingPerHourPaise: Math.round(ov.waitingPerHour * 100) } : {}),
          ...(ov.hillCharge !== undefined ? { hillPaise: Math.round(ov.hillCharge * 100) } : {}),
          ...(ov.carrierCharge !== undefined ? { carrierPaise: Math.round(ov.carrierCharge * 100) } : {}),
        },
      };
    }
  }
  return extra ? { ...r, pricing: { ...r.pricing, extraCharges: extra }, breakup: withExtraChargeLines(r.breakup, extra) } : r;
}

function priceBookingCore(i: PriceInput): PriceResult {
  const effectiveTariff = i.tariff ? scopedTariffForBrand(i.tariff, i.brand, i.tripType) : null;
  const outstation = isOutstation(i.route.distanceKm);
  const service = serviceName(i.pickup, i.drop, i.route.distanceKm, i.tripType);
  const klass = tariffClassOf(i.category);
  const cfg = effectiveTariff && effectiveTariff.enabled ? effectiveTariff : null;
  const useTariff = !!cfg && !!klass && (i.tripType === 'Round Trip' || (i.tripType === 'One Way' && outstation));

  // A coupon or an admin discount, applied the same way on every confirmed-tariff path.
  const withDiscounts = (run: (discount: number) => QuoteResult): QuoteResult => {
    let q = run(i.discount ?? 0);
    if (i.adminDiscount) {
      const v = Math.max(0, i.adminDiscount.value);
      const requested = i.adminDiscount.type === 'percentage' ? Math.round((q.fare.subtotal * Math.min(100, v)) / 100) : Math.round(v);
      q = run(requested);
      if (q.fare.discount > 0) q.fare.discountDetail = { type: i.adminDiscount.type, value: v, amount: q.fare.discount, source: 'admin', reason: i.adminDiscount.reason ?? '' };
    }
    return q;
  };
  const adjust = { adjustmentPercent: i.adjustment?.percent ?? 0, adjustmentDirection: i.adjustment?.direction };
  const timing = { routeKm: i.route.distanceKm, durationMin: i.route.durationMin, pickupMs: i.pickupAt.getTime(), endMs: null };

  // An enabled fixed route fare replaces the distance-based base fare for exactly its route, direction, service,
  // category and dates. Anything that does not match keeps its normal pricing; a map pin never matches.
  const hasId = (id: string) => !!id && id !== 'pin';
  const fixed = i.businessContract ? { rule: i.businessContract.rule, reversed: false } : i.tripType === 'One Way' && i.fixedRoutes?.length && hasId(i.pickup.id) && hasId(i.drop.id)
    ? matchFixedRoute(i.fixedRoutes, { originId: i.pickup.id, destinationId: i.drop.id, categoryId: i.category.id, serviceId: i.serviceId ?? '', date: istDate(i.pickupAt.getTime()) })
    : null;
  if (fixed) {
    const tariff = effectiveTariff;
    const q = withDiscounts((discount) => quoteFixedRoute({
      rule: fixed.rule, reversed: fixed.reversed, gstRate: tariff?.gstRate ?? CATEGORY_GST_RATE, tariffVersion: tariff?.version ?? 0, tariffClass: klass,
      routeKm: i.route.distanceKm*(i.businessContract&&i.tripType==='Round Trip'?2:1), durationMin: i.route.durationMin, pickupMs: i.pickupAt.getTime(), discount, adjustmentPercent: i.adjustment?.percent ?? 0, adjustmentDirection: i.adjustment?.direction,
    }));
    if (i.businessContract?.perKm) {
      const c=i.businessContract;
      q.pricing={...q.pricing,model:'business_contract_per_km',businessCustomerRatePaise:paise(c.customerRate),businessGstMode:c.rule.gstMode,extraKmRatePaise:paise(c.customerRate/(c.rule.gstMode==='included'?1+q.pricing.gstRate:1)),partner:{...q.pricing.partner!,minKm:q.pricing.quotedKm,ratePaise:paise(c.partnerRate)},brand:i.brand,brandScoped:!!(i.brand&&i.tariff?.brandOverrides?.[i.brand])};
    }
    return { fare: q.fare, pricing: { ...q.pricing, brand: i.brand, brandScoped: !!(i.brand && i.tariff?.brandOverrides?.[i.brand]) }, service, outstation, breakup: buildTariffFareBreakup(i.category, q.fare, outstation, q.pricing), usesCommissionPolicy: false };
  }

  // Fixed rental packages and per-city Local Pickup & Drop fares switch on one by one (each has its own
  // enabled flag), so they do not wait for the confirmed-tariff switch. Anything not explicitly enabled
  // and valid is never priced here: a rental with no usable package is refused, a local trip falls through.
  if (i.tripType === 'Local Rental' && i.rentalHours != null) {
    const tariff = effectiveTariff, hours = i.rentalHours;
    if (!tariff || !klass) throw new HttpsError('failed-precondition', 'Rental packages are not configured for this vehicle.');
    try {
      const q = withDiscounts((discount) => quoteRentalPackage({ config: tariff, tariffClass: klass, tripType: 'One Way', hours, discount, ...timing, ...adjust }));
      return { fare: q.fare, pricing: { ...q.pricing, brand: i.brand, brandScoped: !!(i.brand && i.tariff?.brandOverrides?.[i.brand]) }, service, outstation, breakup: buildTariffFareBreakup(i.category, q.fare, false, q.pricing), usesCommissionPolicy: false };
    } catch (e) {
      if (e instanceof TariffError) throw new HttpsError('failed-precondition', e.message, { code: e.code });
      throw e;
    }
  }
  if (effectiveTariff && klass && i.localCityId && i.tripType === 'One Way' && service === 'Local' && localFareFor(effectiveTariff, i.localCityId, klass)) {
    const tariff = effectiveTariff, cityId = i.localCityId;
    const q = withDiscounts((discount) => quoteLocalPickupDrop({ config: tariff, tariffClass: klass, tripType: 'One Way', cityId, discount, ...timing, ...adjust }));
    return { fare: q.fare, pricing: { ...q.pricing, brand: i.brand, brandScoped: !!(i.brand && i.tariff?.brandOverrides?.[i.brand]) }, service, outstation, breakup: buildTariffFareBreakup(i.category, q.fare, false, q.pricing), usesCommissionPolicy: false };
  }

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
      const q = withDiscounts(run);
      return {
        fare: q.fare, pricing: { ...q.pricing, brand: i.brand, brandScoped: !!(i.brand && i.tariff?.brandOverrides?.[i.brand]) }, service, outstation,
        breakup: buildTariffFareBreakup(i.category, q.fare, outstation || i.tripType === 'Round Trip', q.pricing),
        usesCommissionPolicy: false,
      };
    } catch (e) {
      if (e instanceof TariffError) throw new HttpsError('failed-precondition', e.message, { code: e.code });
      throw e;
    }
  }

  // City drop package: only inside a configured city zone (boundaries are an open decision).
  const dropRates = cfg && klass ? classRates(cfg.cityDrop.classes, klass) : undefined;
  if (cfg && klass && i.tripType === 'One Way' && !outstation && dropRates) {
    const zone = withinCityZone(cfg, i.pickup, i.drop);
    if (zone) {
      const pack = cityDropFare(cfg, klass, i.route.distanceKm);
      const pre = r2(pack.customerPaise / 100);
      const discount = Math.min(Math.max(0, r2(i.discount ?? 0)), pre);
      const taxable = r2(pre - discount);
      const gst = gstOn(taxable, cfg.gstRate);
      const fare: FareBreakdown = {
        subtotalBeforeAdjustment: pre, globalAdjustment: null, discountDetail: discount > 0 ? { type: 'coupon', value: discount, amount: discount, source: 'coupon', reason: '' } : null,
        baseFare: dropRates.customerBase, distanceFare: r2(pre - dropRates.customerBase),
        timeFare: 0, nightCharge: 0, driverAllowance: 0, minimumFareAdjustment: 0, subtotal: pre, discount, taxableAmount: taxable, gstRate: cfg.gstRate, gst, total: r2(taxable + gst),
        distanceKm: Math.round(i.route.distanceKm * 10) / 10, durationMin: Math.round(i.route.durationMin), perKmRate: dropRates.customerExtraKm, perMinuteRate: 0,
      };
      const pricing: PricingSnapshot = {
        schema: 2, source: 'tariff_v2', model: 'city_drop_package', tariffVersion: cfg.version, tariffClass: klass, gstRate: cfg.gstRate,
        quotedKm: Math.max(cfg.cityDrop.baseKm, fare.distanceKm), includedKm: cfg.cityDrop.baseKm, extraKmRatePaise: paise(dropRates.customerExtraKm),
        customerRatePaise: paise(dropRates.customerExtraKm), customerBataPaise: 0, days: 1, minKmPerDay: cfg.cityDrop.baseKm,
        packagePaise: pack.customerPaise, discount, adminAdjustment: 0, adjustmentPercent: 0, adjustmentDirection: 'increase',
        partner: { mode: 'NORMAL_RATE', ratePaise: paise(dropRates.partnerExtraKm), bataPaise: 0, minKm: cfg.cityDrop.baseKm, days: 1, basePaise: pack.partnerPaise },
        brand: i.brand, brandScoped: !!(i.brand && i.tariff?.brandOverrides?.[i.brand]),
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
    brand: i.brand, brandScoped: false,
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
  requireAction(actor, 'Settings', 'edit');
  const input = request.data ?? {};
  // `keepSavedRates` only flips the on/off switch: every saved rate, zone and local fare stays as it is.
  const keepSaved = input.keepSavedRates === true;
  const raw = input.useConfirmedDefaults === true ? { ...CONFIRMED_TARIFF_V2, cityDrop: { ...CONFIRMED_TARIFF_V2.cityDrop, zones: input.cityDrop?.zones ?? [] } } : input;
  const submitted = parseTariffConfig({ ...raw, enabled: input.enabled === true, version: 0 });
  if (!submitted) throw new HttpsError('invalid-argument', 'The tariff configuration is invalid.');
  const reason = text(input.reason, 300);
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'Give a short reason for the change.');
  const ref = db.doc(TARIFF_DOC);
  return db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const before = current.exists ? parseTariffConfig(current.data()) : null;
    if (typeof input.expectedVersion === 'number' && input.expectedVersion !== (before?.version ?? 0)) {
      throw new HttpsError('failed-precondition', 'The tariff was changed by someone else. Reload and review it before saving.');
    }
    if (keepSaved && !before) throw new HttpsError('failed-precondition', 'No tariff is saved yet. Save base rates first.');
    // Loading the confirmed values replaces the one-way / round-trip / rental / city-drop rates only; the
    // outstation extras, airport fare, Local Pickup & Drop fares and rental packages keep their saved values.
    const parsed: TariffConfig = keepSaved && before ? {
      ...before,
      enabled: input.enabled === true,
      // City-drop zones may be replaced on their own; every rate stays as saved.
      ...(Array.isArray(input.cityDrop?.zones) ? { cityDrop: { ...before.cityDrop, zones: submitted.cityDrop.zones } } : {}),
    } : {
      ...submitted,
      ...(submitted.outstationExtras ?? before?.outstationExtras ? { outstationExtras: submitted.outstationExtras ?? before?.outstationExtras } : {}),
      ...(submitted.oneWayExtras ?? before?.oneWayExtras ? { oneWayExtras: submitted.oneWayExtras ?? before?.oneWayExtras } : {}),
      ...(submitted.roundTripExtras ?? before?.roundTripExtras ? { roundTripExtras: submitted.roundTripExtras ?? before?.roundTripExtras } : {}),
      ...(submitted.airport ?? before?.airport ? { airport: submitted.airport ?? before?.airport } : {}),
      ...(submitted.localPickupDrop ?? before?.localPickupDrop ? { localPickupDrop: submitted.localPickupDrop ?? before?.localPickupDrop } : {}),
      ...(submitted.rentalPackages ?? before?.rentalPackages ? { rentalPackages: submitted.rentalPackages ?? before?.rentalPackages } : {}),
      // The extra-charge rates are edited only by their own section: a full tariff save never drops them.
      ...(before?.extraCharges ? { extraCharges: before.extraCharges } : {}),
    };
    if (parsed.enabled && !Object.keys(parsed.oneWay.classes).length && !Object.keys(parsed.roundTrip.classes).length) {
      throw new HttpsError('failed-precondition', 'Configure at least one one-way or round-trip rate card before enabling the tariff.');
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
import { adjustPartner, assertBookable, assertWithinLimits, evaluateRules, loadServiceRules, partnerPayoutRupees, ruleServiceText } from './serviceRules';
import { approved, inIndia, routeFor } from './shared';
import { requestIp } from './security';
import { rateLimited } from './http/util';

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
  // Signed-out visitors may see fares too (nothing is written or returned about any account);
  // they are rate-limited per IP and get no coupon, which depends on the customer's history.
  const uid = request.auth?.uid;
  if (!uid && rateLimited(`quote:${requestIp(request)}`, 30)) throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a moment.');
  const input = request.data ?? {};
  const brand = resolveAndValidateBrand(input, request);
  const pickup = placeOf(input.pickup, 'pickup'), drop = placeOf(input.drop, 'drop');
  const tripType: TripType =
    input.tripType === 'Round Trip'
      ? 'Round Trip'
      : input.tripType === 'Local Rental'
      ? 'Local Rental'
      : input.tripType === 'Airport Taxi'
      ? 'Airport Taxi'
      : 'One Way';
  assertServiceSupported(brand, tripType);
  const now = new Date();
  const when = parsePickupInstant(input.scheduledAt);
  const window = bookingWindowFrom((await db.doc('settings/operations').get()).data());
  const problem = pickupWindowProblem(when, now, window);
  if (problem || !when) throw new HttpsError('invalid-argument', problem || 'Choose the pickup date and time.');
  const tripEndAt = tripType === 'Round Trip' ? parsePickupInstant(input.tripEndAt) : null;
  const route = await routeFor(pickup, drop);
  const customer = uid ? await db.doc(`customers/${uid}`).get() : null;
  if (customer?.exists && !approved(customer.data()!.status)) throw new HttpsError('permission-denied', 'Your account is not active.');
  // A coupon is only checked for an existing customer account.
  const customerId = customer?.exists ? uid : null;
  const [categories, tariff, adjustmentDoc, coupons, history, serviceRules] = await Promise.all([
    db.collection('vehicle_categories').where('status', '==', 'Active').get(),
    loadTariffConfig(),
    loadFareAdjustment(),
    input.couponCode && customerId ? db.collection('coupons').get() : Promise.resolve(null),
    input.couponCode && customerId ? db.collection('bookings').where('customerId', '==', customerId).get() : Promise.resolve(null),
    loadServiceRules(),
  ]);
  const rules = evaluateRules(serviceRules, pickup, drop, when, ruleServiceText(pickup, drop, route.distanceKm, tripType));
  const adjustment = rules.customer ?? effectiveAdjustment(adjustmentDoc, now);
  const code = normalizeCode(text(input.couponCode, 50));
  const prior = history ? history.docs.map((d) => d.data()).filter((b) => b.status !== 'Cancelled' && b.status !== 'Rejected') : [];
  const onlineMasters=(await db.collection('services').get()).docs.map(d=>d.data());
  const quotes = categories.docs
    .map((d) => ({ d, c: mapCategory(d.id, d.data()) }))
    .filter((x): x is { d: FirebaseFirestore.QueryDocumentSnapshot; c: NonNullable<ReturnType<typeof mapCategory>> } => x.c !== null)
    .sort((a, b) => a.c.displayOrder - b.c.displayOrder)
    .map(({ d, c }) => {
      const category = { ...c, tariffClass: d.data().tariffClass, dutyClass: d.data().dutyClass };
      const base = { category, route, tripType, pickup, drop, pickupAt: when, tripEndAt, tariff, adjustment, rentalHours: tripType === 'Local Rental' ? rentalHoursOf(input.rentalHours) : null, brand };
      try {
        assertCatalogAvailable(onlineMasters,tripType,category.id);
        assertBookable(rules, category.name);
        const before = priceBooking(base);
        let couponMessage = '', discount = 0;
        if (code && coupons) {
          const r = validateCoupon(coupons.docs.map((x) => mapCoupon(x.id, x.data())), code, {
            subtotal: before.fare.subtotal, categoryId: c.id, service: before.service, isFirstBooking: prior.length === 0,
            customerUses: prior.filter((b) => normalizeCode(b.couponCode || '') === code).length,
            pickupAt: when, completedTrips: prior.filter((b) => b.status === 'Completed').length,
            pickupText: `${pickup.name} ${pickup.address ?? ''}`, dropText: `${drop.name} ${drop.address ?? ''}`,
            fixedRoute: before.pricing.model === 'city_drop_package' || before.pricing.model === 'fixed_route', peakAdjusted: adjustment?.direction === 'increase',
          });
          if (r.ok) { discount = r.coupon.discount; couponMessage = r.coupon.message; } else couponMessage = r.message;
        } else if (code) couponMessage = 'Sign in to apply this code.';
        const priced = discount > 0 ? priceBooking({ ...base, discount }) : before;
        // The same limit check a booking makes, so a quote the customer sees can always be booked.
        assertWithinLimits(rules, { categoryName: category.name, customerFare: priced.fare.total, partnerPayout: partnerPayoutRupees(adjustPartner(priced.pricing, rules)) });
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
    /** Limited service here: the office confirms the booking before it is accepted. */
    limitedAvailability: rules.availability === 'Limited',
    quotes,
  };
});
