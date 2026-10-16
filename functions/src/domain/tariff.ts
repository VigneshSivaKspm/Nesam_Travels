// Confirmed customer tariffs and normal partner rates (Tariff & Operations v2.0, 09 Oct 2026).
//
// Everything is computed in integer PAISE, so 13.50/km or 12.60/km never accumulate
// floating-point error. Customer totals are rounded half-up to the whole rupee (the
// existing fare engine's explicit rounding); partner entitlements keep paise.
//
// Only what is CONFIRMED is calculated. Unresolved items are gated, never guessed:
//   D01/D02 rental distance + partner overtime · D04 tax · D05 add-on units ·
//   D06 missing state rates · D07 multi-city · D08 fixed-route zones · D15 city boundaries.
// A missing rate is `null`, never zero.
import { FareBreakdown } from './types';

export type TariffClass = 'sedan' | 'suv' | 'crysta';
export const TARIFF_CLASSES: readonly TariffClass[] = ['sedan', 'suv', 'crysta'];

/** Rupees → paise, rejecting anything that is not a finite non-negative number. */
export const paise = (rupees: number): number => Math.round(rupees * 100);
export const rupeesOf = (p: number): number => p / 100;
/** Half-up rounding of paise to a whole rupee, returned in rupees. */
export const roundRupee = (p: number): number => Math.floor(p / 100 + 0.5);

/** Money in rupees at paise precision (two decimals, half-up). */
export const r2 = (n: number): number => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
/** GST on a taxable amount, half-up to the paise. Integer arithmetic: 5% of 5,050.00 is exactly 252.50. */
export function gstOn(taxable: number, rate: number): number {
  const taxablePaise = Math.round(taxable * 100);
  const basisPoints = Math.round(rate * 10000);
  return Math.floor((taxablePaise * basisPoints + 5000) / 10000) / 100;
}

/** KM carry one decimal place; amount = km × rate, in paise, half-up. */
export function kmAmountPaise(km: number, ratePaise: number): number {
  const tenths = Math.round(km * 10);
  return Math.floor((tenths * ratePaise) / 10 + 0.5);
}

// ── Configuration ───────────────────────────────────────────────────────────

export interface OneWayRates { customerRate: number; customerBata: number; partnerRate: number; partnerBata: number }
export interface RoundTripRates extends OneWayRates { minKmPerDay: number }
export interface RentalRates { firstHour: number; laterHour: number; minHours: number; minTimeFare: number; partnerPerHour: number }
export interface CityDropRates { customerBase: number; customerExtraKm: number; partnerBase: number; partnerExtraKm: number }
export interface CityZone { id: string; name: string; lat: number; lng: number; radiusKm: number }

export interface TariffConfig {
  /** Rupee amounts. Absent = not configured (never zero). */
  version: number;
  enabled: boolean;
  gstRate: number;
  oneWay: { minKm: number; classes: Partial<Record<TariffClass, OneWayRates>> };
  roundTrip: { maxDays: number; classes: Partial<Record<TariffClass, RoundTripRates>> };
  rental: { classes: Partial<Record<TariffClass, RentalRates>> };
  cityDrop: { baseKm: number; zones: CityZone[]; classes: Partial<Record<TariffClass, CityDropRates>> };
}

/** The values the owner confirmed on 09 Oct 2026 (Crysta one-way bata ₹600 supersedes ₹500). */
export const CONFIRMED_TARIFF_V2: Omit<TariffConfig, 'version' | 'enabled'> = {
  gstRate: 0.05,
  oneWay: {
    minKm: 130,
    classes: {
      sedan: { customerRate: 15, customerBata: 400, partnerRate: 13.5, partnerBata: 300 },
      suv: { customerRate: 20, customerBata: 400, partnerRate: 18, partnerBata: 300 },
      crysta: { customerRate: 26, customerBata: 600, partnerRate: 24, partnerBata: 400 },
    },
  },
  roundTrip: {
    maxDays: 30,
    classes: {
      sedan: { customerRate: 14, customerBata: 400, partnerRate: 12.6, partnerBata: 300, minKmPerDay: 250 },
      suv: { customerRate: 19, customerBata: 400, partnerRate: 17.1, partnerBata: 300, minKmPerDay: 250 },
      crysta: { customerRate: 22, customerBata: 500, partnerRate: 20, partnerBata: 400, minKmPerDay: 300 },
    },
  },
  rental: {
    classes: {
      sedan: { firstHour: 500, laterHour: 350, minHours: 4, minTimeFare: 1550, partnerPerHour: 250 },
      suv: { firstHour: 700, laterHour: 450, minHours: 5, minTimeFare: 2500, partnerPerHour: 400 },
      crysta: { firstHour: 800, laterHour: 600, minHours: 10, minTimeFare: 6200, partnerPerHour: 500 },
    },
  },
  cityDrop: {
    baseKm: 20,
    zones: [],
    classes: {
      sedan: { customerBase: 800, customerExtraKm: 35, partnerBase: 500, partnerExtraKm: 25 },
      suv: { customerBase: 1200, customerExtraKm: 50, partnerBase: 700, partnerExtraKm: 35 },
      crysta: { customerBase: 2000, customerExtraKm: 70, partnerBase: 1200, partnerExtraKm: 50 },
    },
  },
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function rateMap<T extends object>(v: unknown, keys: readonly (keyof T)[]): Partial<Record<TariffClass, T>> {
  const out: Partial<Record<TariffClass, T>> = {};
  if (!v || typeof v !== 'object') return out;
  for (const c of TARIFF_CLASSES) {
    const r = (v as Record<string, unknown>)[c];
    if (!r || typeof r !== 'object') continue;
    // A class with any missing rate is left out entirely: a partial rate card is not a price.
    if (keys.every((k) => isNum((r as Record<string, unknown>)[k as string]))) out[c] = r as T;
  }
  return out;
}

/** Parses business_config/tariff_v2. Anything malformed is dropped (treated as not configured). */
export function parseTariffConfig(d: Record<string, any> | undefined | null): TariffConfig | null {
  if (!d || typeof d !== 'object') return null;
  const zones: CityZone[] = Array.isArray(d.cityDrop?.zones)
    ? d.cityDrop.zones.filter((z: any) => z && typeof z.id === 'string' && isNum(z.radiusKm) && z.radiusKm > 0 && Number.isFinite(z.lat) && Number.isFinite(z.lng))
        .map((z: any) => ({ id: z.id, name: String(z.name ?? z.id), lat: z.lat, lng: z.lng, radiusKm: z.radiusKm }))
    : [];
  return {
    version: typeof d.version === 'number' ? d.version : 0,
    enabled: d.enabled === true,
    gstRate: isNum(d.gstRate) && d.gstRate < 1 ? d.gstRate : 0.05,
    oneWay: { minKm: isNum(d.oneWay?.minKm) && d.oneWay.minKm > 0 ? d.oneWay.minKm : 130, classes: rateMap<OneWayRates>(d.oneWay?.classes, ['customerRate', 'customerBata', 'partnerRate', 'partnerBata']) },
    roundTrip: {
      maxDays: isNum(d.roundTrip?.maxDays) && d.roundTrip.maxDays >= 1 ? Math.floor(d.roundTrip.maxDays) : 30,
      classes: rateMap<RoundTripRates>(d.roundTrip?.classes, ['customerRate', 'customerBata', 'partnerRate', 'partnerBata', 'minKmPerDay']),
    },
    rental: { classes: rateMap<RentalRates>(d.rental?.classes, ['firstHour', 'laterHour', 'minHours', 'minTimeFare', 'partnerPerHour']) },
    cityDrop: { baseKm: isNum(d.cityDrop?.baseKm) && d.cityDrop.baseKm > 0 ? d.cityDrop.baseKm : 20, zones, classes: rateMap<CityDropRates>(d.cityDrop?.classes, ['customerBase', 'customerExtraKm', 'partnerBase', 'partnerExtraKm']) },
  };
}

// ── IST calendar days ───────────────────────────────────────────────────────

/** Calendar date (YYYY-MM-DD) of an instant on the India calendar. */
export function istDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/**
 * Chargeable days of a round trip = Indian end date − Indian pickup date + 1. A midnight
 * boundary adds a day even when fewer than 24 hours elapsed. Returns null for an end that
 * is before the pickup.
 */
export function calendarDays(pickupMs: number, endMs: number): number | null {
  if (!Number.isFinite(pickupMs) || !Number.isFinite(endMs) || endMs < pickupMs) return null;
  const a = Date.parse(`${istDate(pickupMs)}T00:00:00Z`);
  const b = Date.parse(`${istDate(endMs)}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

// ── Calculations ────────────────────────────────────────────────────────────

/** What a duty's partner is entitled to under the normal fixed rate. Not used for marketplace duties. */
export interface PartnerNormalRate {
  mode: 'NORMAL_RATE';
  ratePaise: number;
  bataPaise: number;
  /** Partner billable-KM floor (same as the customer floor — a working assumption, D03). */
  minKm: number;
  days: number;
  basePaise: number;
}

export interface PricingSnapshot {
  schema: 2;
  /** 'tariff_v2' (this module) or 'legacy_category' (admin category fares, kept for local / airport duties). */
  source: 'tariff_v2' | 'legacy_category';
  model: 'one_way_standard' | 'round_trip_calendar' | 'city_drop_package' | 'rental_time' | 'legacy_category';
  tariffVersion: number;
  tariffClass: TariffClass | null;
  gstRate: number;
  quotedKm: number;
  includedKm: number;
  /** Customer rate for each km beyond the quoted / included package. */
  extraKmRatePaise: number;
  customerRatePaise: number;
  customerBataPaise: number;
  days: number;
  minKmPerDay: number;
  /** Customer package before discount and GST, paise. */
  packagePaise: number;
  /** Fixed discount carried into the final fare (coupon, admin), rupees. */
  discount: number;
  /** Staff-authorised pre-GST adjustment carried into the final fare, rupees. */
  adminAdjustment: number;
  /** Global percentage adjustment in force when quoted; re-applied once to the final package. */
  adjustmentPercent: number;
  adjustmentDirection: 'increase' | 'decrease';
  partner: PartnerNormalRate | null;
  /** Dates charged, IST, for round trips. */
  pickupDate: string;
  endDate: string | null;
  /** Free-text decisions still open that affect this quote. */
  gates: string[];
}

export interface QuoteInput {
  config: TariffConfig;
  tariffClass: TariffClass;
  tripType: 'One Way' | 'Round Trip';
  routeKm: number;
  durationMin: number;
  pickupMs: number;
  endMs: number | null;
  discount?: number;
  adjustmentPercent?: number;
  adjustmentDirection?: 'increase' | 'decrease';
}

export interface QuoteResult {
  fare: FareBreakdown;
  pricing: PricingSnapshot;
}

export class TariffError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const GATES_ONE_WAY = [
  'D03: partner floor and quoted-KM treatment (130-km floor assumed to apply to partner payout)',
  'D04: tax rate, base and inclusions are configured separately',
];
const GATES_ROUND_TRIP = [
  'D03: SUV / Crysta round-trip partner rates and partner daily minimum (matching customer minimum assumed)',
  'D04: tax rate, base and inclusions are configured separately',
];

function toBreakdown(args: {
  packagePaise: number; distancePaise: number; bataPaise: number; floorPaise: number; discount: number; adminAdjustment: number;
  adjustmentPercent: number; adjustmentDirection: 'increase' | 'decrease'; gstRate: number; km: number; durationMin: number; ratePaise: number;
}): FareBreakdown {
  // The package keeps its paise; GST is worked out on the taxable amount and kept to the paise
  // (Functional Spec p.8: a 310 km Sedan trip is ₹5,050.00 + ₹252.50 GST = ₹5,302.50).
  const pre = r2(args.packagePaise / 100);
  const adjustmentAmount = args.adjustmentPercent > 0 ? (args.adjustmentDirection === 'decrease' ? -1 : 1) * r2((pre * args.adjustmentPercent) / 100) : 0;
  const subtotal = Math.max(0, r2(pre + adjustmentAmount + args.adminAdjustment));
  const discount = Math.min(Math.max(0, r2(args.discount)), subtotal);
  const taxable = r2(subtotal - discount);
  const gst = gstOn(taxable, args.gstRate);
  return {
    subtotalBeforeAdjustment: pre,
    globalAdjustment: args.adjustmentPercent > 0 ? { id: 'fare-adjustment', name: 'Fare adjustment', direction: args.adjustmentDirection, percent: args.adjustmentPercent, amount: adjustmentAmount } : null,
    discountDetail: discount > 0 ? { type: 'coupon', value: discount, amount: discount, source: 'coupon', reason: '' } : null,
    baseFare: 0,
    // The lines always add up to the package: distance is the remainder after bata and the floor top-up.
    distanceFare: r2(pre - args.bataPaise / 100 - args.floorPaise / 100),
    timeFare: 0,
    nightCharge: 0,
    driverAllowance: r2(args.bataPaise / 100),
    minimumFareAdjustment: r2(args.floorPaise / 100),
    ...(args.adminAdjustment ? { adminAdjustment: args.adminAdjustment } : {}),
    subtotal,
    discount,
    taxableAmount: taxable,
    gstRate: args.gstRate,
    gst,
    total: r2(taxable + gst),
    distanceKm: Math.round(args.km * 10) / 10,
    durationMin: Math.round(args.durationMin),
    perKmRate: rupeesOf(args.ratePaise),
    perMinuteRate: 0,
  };
}

/** Standard one-way: included KM = max(floor, quoted route KM); base = included × rate + bata. */
export function quoteOneWay(i: QuoteInput): QuoteResult {
  const r = i.config.oneWay.classes[i.tariffClass];
  if (!r) throw new TariffError('rate-missing', 'The one-way tariff for this vehicle class is not configured.');
  const included = Math.max(i.config.oneWay.minKm, Math.round(i.routeKm * 10) / 10);
  const ratePaise = paise(r.customerRate), bataPaise = paise(r.customerBata);
  const distancePaise = kmAmountPaise(included, ratePaise);
  const floorPaise = kmAmountPaise(Math.max(0, included - i.routeKm), ratePaise);
  const packagePaise = distancePaise + bataPaise;
  const partnerKm = included;
  const fare = toBreakdown({
    packagePaise, distancePaise: distancePaise - floorPaise, bataPaise, floorPaise, discount: i.discount ?? 0, adminAdjustment: 0,
    adjustmentPercent: i.adjustmentPercent ?? 0, adjustmentDirection: i.adjustmentDirection ?? 'increase', gstRate: i.config.gstRate,
    km: included, durationMin: i.durationMin, ratePaise,
  });
  return {
    fare,
    pricing: {
      schema: 2, source: 'tariff_v2', model: 'one_way_standard', tariffVersion: i.config.version, tariffClass: i.tariffClass, gstRate: i.config.gstRate,
      quotedKm: included, includedKm: included, extraKmRatePaise: ratePaise, customerRatePaise: ratePaise, customerBataPaise: bataPaise,
      days: 1, minKmPerDay: i.config.oneWay.minKm, packagePaise, discount: fare.discount, adminAdjustment: 0,
      adjustmentPercent: i.adjustmentPercent ?? 0, adjustmentDirection: i.adjustmentDirection ?? 'increase',
      partner: { mode: 'NORMAL_RATE', ratePaise: paise(r.partnerRate), bataPaise: paise(r.partnerBata), minKm: i.config.oneWay.minKm, days: 1, basePaise: kmAmountPaise(partnerKm, paise(r.partnerRate)) + paise(r.partnerBata) },
      pickupDate: istDate(i.pickupMs), endDate: null, gates: [...GATES_ONE_WAY],
    },
  };
}

/** Round trip by Indian calendar days; billable KM = max(total KM, daily minimum × days). */
export function quoteRoundTrip(i: QuoteInput): QuoteResult {
  const r = i.config.roundTrip.classes[i.tariffClass];
  if (!r) throw new TariffError('rate-missing', 'The round-trip tariff for this vehicle class is not configured.');
  if (i.endMs === null) throw new TariffError('end-required', 'Choose the date and time the trip ends.');
  const days = calendarDays(i.pickupMs, i.endMs);
  if (days === null) throw new TariffError('end-before-pickup', 'The trip cannot end before it starts.');
  if (days > i.config.roundTrip.maxDays) throw new TariffError('too-long', `Round trips can be booked for up to ${i.config.roundTrip.maxDays} days.`);
  const actualKm = Math.round(i.routeKm * 2 * 10) / 10;
  const floorKm = r.minKmPerDay * days;
  const billable = Math.max(actualKm, floorKm);
  const ratePaise = paise(r.customerRate), bataPaise = paise(r.customerBata) * days;
  const distancePaise = kmAmountPaise(billable, ratePaise);
  const floorPaise = kmAmountPaise(Math.max(0, billable - actualKm), ratePaise);
  const packagePaise = distancePaise + bataPaise;
  const partnerRate = paise(r.partnerRate);
  const fare = toBreakdown({
    packagePaise, distancePaise: distancePaise - floorPaise, bataPaise, floorPaise, discount: i.discount ?? 0, adminAdjustment: 0,
    adjustmentPercent: i.adjustmentPercent ?? 0, adjustmentDirection: i.adjustmentDirection ?? 'increase', gstRate: i.config.gstRate,
    km: billable, durationMin: i.durationMin * 2, ratePaise,
  });
  return {
    fare,
    pricing: {
      schema: 2, source: 'tariff_v2', model: 'round_trip_calendar', tariffVersion: i.config.version, tariffClass: i.tariffClass, gstRate: i.config.gstRate,
      quotedKm: actualKm, includedKm: billable, extraKmRatePaise: ratePaise, customerRatePaise: ratePaise, customerBataPaise: paise(r.customerBata),
      days, minKmPerDay: r.minKmPerDay, packagePaise, discount: fare.discount, adminAdjustment: 0,
      adjustmentPercent: i.adjustmentPercent ?? 0, adjustmentDirection: i.adjustmentDirection ?? 'increase',
      partner: { mode: 'NORMAL_RATE', ratePaise: partnerRate, bataPaise: paise(r.partnerBata), minKm: r.minKmPerDay, days, basePaise: kmAmountPaise(billable, partnerRate) + paise(r.partnerBata) * days },
      pickupDate: istDate(i.pickupMs), endDate: istDate(i.endMs), gates: [...GATES_ROUND_TRIP],
    },
  };
}

/**
 * Local rental TIME component only. Fare = minimum time fare + max(0, minutes − minimum
 * minutes) × later-hour rate / 60 (no rounding of an extra minute to an hour). The distance
 * component is an OPEN decision (D01/D02), so a rental is never quoted as bookable.
 */
export function rentalTimeFare(r: RentalRates, minutes: number): { timePaise: number; minutesOver: number } {
  const minMinutes = r.minHours * 60;
  const over = Math.max(0, minutes - minMinutes);
  const extra = (over * paise(r.laterHour)) / 60;
  return { timePaise: paise(r.minTimeFare) + Math.floor(extra + 0.5), minutesOver: over };
}

/** Local city drop package: base for the first N km + extra km at the class extra rate. */
export function cityDropFare(cfg: TariffConfig, cls: TariffClass, km: number): { customerPaise: number; partnerPaise: number; extraKm: number } {
  const r = cfg.cityDrop.classes[cls];
  if (!r) throw new TariffError('rate-missing', 'The city-drop package for this vehicle class is not configured.');
  const extraKm = Math.max(0, Math.round(km * 10) / 10 - cfg.cityDrop.baseKm);
  return {
    customerPaise: paise(r.customerBase) + kmAmountPaise(extraKm, paise(r.customerExtraKm)),
    partnerPaise: paise(r.partnerBase) + kmAmountPaise(extraKm, paise(r.partnerExtraKm)),
    extraKm,
  };
}

/** True when both places lie inside the SAME configured city zone. No zones configured → false (gated, D15). */
export function withinCityZone(cfg: TariffConfig, a: { lat: number; lng: number }, b: { lat: number; lng: number }): CityZone | null {
  const dist = (p: { lat: number; lng: number }, z: CityZone) => {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (p.lat - z.lat) * rad, dLng = (p.lng - z.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(z.lat * rad) * Math.cos(p.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  return cfg.cityDrop.zones.find((z) => dist(a, z) <= z.radiusKm && dist(b, z) <= z.radiusKm) ?? null;
}

// ── Final fare from verified total KM ───────────────────────────────────────

export interface FinalInput {
  pricing: PricingSnapshot;
  /** Total KM the driver entered for the whole trip. */
  totalKm: number;
  /** Actual trip end instant. */
  endMs: number;
  /** Customer-facing add-ons recorded at actuals (tolls are handled separately by the booking). */
}

export interface FinalResult {
  fare: FareBreakdown;
  billableKm: number;
  extraKm: number;
  days: number;
  extraKmPaise: number;
  customerPackagePaise: number;
  /** Partner entitlement for a NORMAL_RATE duty, paise; null for marketplace / legacy payouts. */
  partnerPaise: number | null;
  /** Calendar days beyond the quoted days (trip ran into another date). */
  extraDays: number;
}

/**
 * Final fare = the LOCKED quoted package + only the distance beyond the quoted included KM
 * (never the whole trip priced again). A shorter trip never reduces the quoted package.
 * A round trip that runs into another Indian date adds the day's bata and daily minimum.
 */
export function finalizeFare(i: FinalInput): FinalResult {
  const p = i.pricing;
  if (!(i.totalKm > 0) || !Number.isFinite(i.totalKm)) throw new TariffError('km-required', 'Enter the total kilometres driven.');
  const totalKm = Math.round(i.totalKm * 10) / 10;
  let packagePaise = p.packagePaise;
  let includedKm = p.includedKm;
  let days = p.days;
  let extraDays = 0;
  if (p.model === 'round_trip_calendar' && p.endDate) {
    const actual = calendarDays(Date.parse(`${p.pickupDate}T12:00:00+05:30`), i.endMs);
    if (actual !== null && actual > p.days) {
      extraDays = actual - p.days;
      days = actual;
      // The new dates carry their own bata and their own daily minimum.
      includedKm = p.includedKm + p.minKmPerDay * extraDays;
      packagePaise += p.customerBataPaise * extraDays + kmAmountPaise(p.minKmPerDay * extraDays, p.extraKmRatePaise);
    }
  }
  const extraKm = Math.max(0, Math.round((totalKm - includedKm) * 10) / 10);
  const extraKmPaise = kmAmountPaise(extraKm, p.extraKmRatePaise);
  const total = packagePaise + extraKmPaise;
  const pre = r2(total / 100);
  const adjustmentAmount = p.adjustmentPercent > 0 ? (p.adjustmentDirection === 'decrease' ? -1 : 1) * r2((pre * p.adjustmentPercent) / 100) : 0;
  const subtotal = Math.max(0, r2(pre + adjustmentAmount + p.adminAdjustment));
  const discount = Math.min(p.discount, subtotal);
  const taxable = r2(subtotal - discount);
  const gst = gstOn(taxable, p.gstRate);
  const billableKm = Math.max(totalKm, includedKm);
  let partnerPaise: number | null = null;
  if (p.partner) {
    const partnerKm = Math.max(totalKm, p.model === 'round_trip_calendar' ? p.partner.minKm * days : p.partner.minKm, p.quotedKm && p.model === 'one_way_standard' ? p.quotedKm : 0);
    partnerPaise = kmAmountPaise(partnerKm, p.partner.ratePaise) + p.partner.bataPaise * days;
  }
  const fare: FareBreakdown = {
    subtotalBeforeAdjustment: pre,
    globalAdjustment: p.adjustmentPercent > 0 ? { id: 'fare-adjustment', name: 'Fare adjustment', direction: p.adjustmentDirection, percent: p.adjustmentPercent, amount: adjustmentAmount } : null,
    discountDetail: discount > 0 ? { type: 'coupon', value: discount, amount: discount, source: 'coupon', reason: '' } : null,
    baseFare: 0,
    distanceFare: r2(pre - (p.customerBataPaise * days) / 100 - Math.max(0, kmAmountPaise(Math.max(0, includedKm - totalKm), p.extraKmRatePaise)) / 100),
    timeFare: 0,
    nightCharge: 0,
    driverAllowance: r2((p.customerBataPaise * days) / 100),
    minimumFareAdjustment: Math.max(0, r2(kmAmountPaise(Math.max(0, includedKm - totalKm), p.extraKmRatePaise) / 100)),
    ...(p.adminAdjustment ? { adminAdjustment: p.adminAdjustment } : {}),
    subtotal, discount, taxableAmount: taxable, gstRate: p.gstRate, gst, total: r2(taxable + gst),
    distanceKm: totalKm, durationMin: 0, perKmRate: rupeesOf(p.extraKmRatePaise), perMinuteRate: 0,
  };
  return { fare, billableKm, extraKm, days, extraKmPaise, customerPackagePaise: packagePaise, partnerPaise, extraDays };
}

/**
 * Final fare for a booking priced by the older admin-category engine. The quoted package
 * stays; only the kilometres beyond the quoted distance are added at the category's
 * extra-km rate, and GST follows the same rate as the quote.
 */
export function finalizeLegacyFare(args: { total: number; taxable: number; gstRate: number; discount: number; quotedKm: number; extraKmRate: number; totalKm: number }) {
  const totalKm = Math.round(args.totalKm * 10) / 10;
  const extraKm = Math.max(0, Math.round((totalKm - args.quotedKm) * 10) / 10);
  const extra = Math.round(extraKm * args.extraKmRate);
  const taxable = args.taxable + extra;
  const gst = Math.round(taxable * args.gstRate);
  return { extraKm, extra, taxable, gst, total: taxable + gst, distanceKm: totalKm };
}
