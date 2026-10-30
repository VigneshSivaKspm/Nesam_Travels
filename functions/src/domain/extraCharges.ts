// Extra charges: waiting, hill travel and roof carrier, per vehicle category (business_config/tariff_v2 → extraCharges).
//
// One authoritative record inside the tariff document, so it shares the tariff's version check, audit trail and
// "a saved tariff only changes NEW quotes" rule. Customer and Partner amounts are separate. Money is stored in rupees at
// paise precision (like every other tariff field) and snapshotted in paise. An ABSENT amount is "not configured"; a
// stored 0 is an explicit "no charge" — the two are never mixed up.
//
// A quote copies the category's rates into its pricing snapshot (PricingSnapshot.extraCharges), so editing the
// configuration never reprices an existing booking. `extraChargeAmounts` is the one calculation for what those rates
// charge for an actual waiting time / hill / carrier; billing at actuals must use it with the booking's own snapshot.

/** One side's rates, in rupees. Absent = not configured. */
export interface ExtraChargeSide {
  /** Per hour of chargeable waiting. */
  waitingPerHour?: number;
  /** Per trip, when hill travel applies. */
  hill?: number;
  /** Per trip, when a roof carrier is used. */
  carrier?: number;
}
export interface ExtraChargeRow { customer: ExtraChargeSide; partner: ExtraChargeSide }

export interface ExtraChargesConfig {
  /** Counts saves of this section only (the tariff version counts every tariff save). */
  version: number;
  /** Waiting that is free at each stop, minutes. Absent = not configured; 0 = nothing is free. */
  freeWaitingMinutes?: number;
  /** Chargeable waiting is rounded UP to a multiple of this many minutes. Absent = not configured. */
  waitingRoundingMinutes?: number;
  /** Keyed by the real vehicle category id. */
  categories: Record<string, ExtraChargeRow>;
}

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isWholeMinutes = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export const EXTRA_CATEGORY_ID = /^[A-Za-z0-9_-]{1,128}$/;
export const MAX_FREE_WAITING_MINUTES = 1440;
export const MAX_WAITING_ROUNDING_MINUTES = 1440;

function parseSide(v: unknown): ExtraChargeSide {
  const s = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out: ExtraChargeSide = {};
  if (isAmount(s.waitingPerHour)) out.waitingPerHour = s.waitingPerHour;
  if (isAmount(s.hill)) out.hill = s.hill;
  if (isAmount(s.carrier)) out.carrier = s.carrier;
  return out;
}
const hasAny = (s: ExtraChargeSide) => s.waitingPerHour !== undefined || s.hill !== undefined || s.carrier !== undefined;

/** Parses the stored section. Anything malformed is dropped (treated as not configured). */
export function parseExtraCharges(d: unknown): ExtraChargesConfig | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const raw = d as Record<string, unknown>;
  const categories: Record<string, ExtraChargeRow> = {};
  if (raw.categories && typeof raw.categories === 'object') {
    for (const [id, row] of Object.entries(raw.categories as Record<string, unknown>)) {
      if (!EXTRA_CATEGORY_ID.test(id) || !row || typeof row !== 'object') continue;
      const customer = parseSide((row as Record<string, unknown>).customer);
      const partner = parseSide((row as Record<string, unknown>).partner);
      if (hasAny(customer) || hasAny(partner)) categories[id] = { customer, partner };
    }
  }
  const out: ExtraChargesConfig = { version: typeof raw.version === 'number' && Number.isInteger(raw.version) && raw.version >= 0 ? raw.version : 0, categories };
  if (isWholeMinutes(raw.freeWaitingMinutes, 0, MAX_FREE_WAITING_MINUTES)) out.freeWaitingMinutes = raw.freeWaitingMinutes;
  if (isWholeMinutes(raw.waitingRoundingMinutes, 1, MAX_WAITING_ROUNDING_MINUTES)) out.waitingRoundingMinutes = raw.waitingRoundingMinutes;
  return out;
}

const paiseOf = (rupees: number) => Math.round(rupees * 100);
export interface ExtraChargeSidePaise { waitingPerHourPaise?: number; hillPaise?: number; carrierPaise?: number }
const sidePaise = (s: ExtraChargeSide): ExtraChargeSidePaise => ({
  ...(s.waitingPerHour !== undefined ? { waitingPerHourPaise: paiseOf(s.waitingPerHour) } : {}),
  ...(s.hill !== undefined ? { hillPaise: paiseOf(s.hill) } : {}),
  ...(s.carrier !== undefined ? { carrierPaise: paiseOf(s.carrier) } : {}),
});

/** What a quote stores about the extra charges of ITS category, so the booking keeps them whatever is saved later. */
export interface ExtraChargesSnapshot {
  schema: 1;
  /** extraCharges.version and tariff version in force when quoted. */
  version: number;
  tariffVersion: number;
  categoryId: string;
  freeWaitingMinutes: number | null;
  waitingRoundingMinutes: number | null;
  customer: ExtraChargeSidePaise;
  partner: ExtraChargeSidePaise;
}

/** The snapshot for one category, or undefined when nothing is configured for it (nothing is invented). */
export function extraChargesSnapshot(cfg: ExtraChargesConfig | undefined, tariffVersion: number, categoryId: string): ExtraChargesSnapshot | undefined {
  const row = cfg?.categories[categoryId];
  if (!cfg || !row) return undefined;
  return {
    schema: 1, version: cfg.version, tariffVersion, categoryId,
    freeWaitingMinutes: cfg.freeWaitingMinutes ?? null, waitingRoundingMinutes: cfg.waitingRoundingMinutes ?? null,
    customer: sidePaise(row.customer), partner: sidePaise(row.partner),
  };
}

/**
 * Chargeable waiting minutes: (waited − free minutes per stop × stops), never below zero, rounded UP to the rounding
 * interval. null when the free time or the interval was never configured — the caller must not guess them.
 */
export function chargeableWaitingMinutes(s: Pick<ExtraChargesSnapshot, 'freeWaitingMinutes' | 'waitingRoundingMinutes'>, waitedMinutes: number, stops: number): number | null {
  if (s.freeWaitingMinutes === null || s.waitingRoundingMinutes === null) return null;
  if (!Number.isFinite(waitedMinutes) || waitedMinutes < 0 || !Number.isInteger(stops) || stops < 1) return null;
  const over = Math.max(0, waitedMinutes - s.freeWaitingMinutes * stops);
  return Math.ceil(over / s.waitingRoundingMinutes) * s.waitingRoundingMinutes;
}

export interface ExtraUsage { waitedMinutes?: number; stops?: number; hill?: boolean; carrier?: boolean }
export interface ExtraChargeAmounts {
  /** Paise; null = the rate (or the waiting rules) were not configured, so no amount can be stated. 0 = configured as no charge / not used. */
  waitingPaise: number | null; hillPaise: number | null; carrierPaise: number | null;
}

/** One side's amounts for the extras actually used. Customer and partner are always computed separately. */
export function extraChargeAmounts(s: ExtraChargesSnapshot, side: 'customer' | 'partner', use: ExtraUsage): ExtraChargeAmounts {
  const r = s[side];
  let waitingPaise: number | null = 0;
  if (use.waitedMinutes !== undefined) {
    const minutes = chargeableWaitingMinutes(s, use.waitedMinutes, use.stops ?? 1);
    waitingPaise = r.waitingPerHourPaise === undefined || minutes === null ? null : Math.round((minutes * r.waitingPerHourPaise) / 60);
  }
  const perTrip = (used: boolean | undefined, rate: number | undefined) => (used ? (rate === undefined ? null : rate) : 0);
  return { waitingPaise, hillPaise: perTrip(use.hill, r.hillPaise), carrierPaise: perTrip(use.carrier, r.carrierPaise) };
}
