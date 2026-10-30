// Admin edits to business_config/tariff_v2, one section at a time: base rates (with outstation extra
// usage and the airport fare), a city's Local Pickup & Drop fare, a class's minimum rental hours and a
// rental package. Each save is validated here (the editors' checks are only a convenience), refuses a stale
// edit, bumps the tariff version and writes the audit entry in the same transaction. A saved tariff only
// changes NEW quotes: a booking keeps the pricing snapshot it was quoted with.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin';
import { auditInTx } from './audit';
import {
  RENTAL_HOURS, RentalPackage, TARIFF_CLASSES, TariffClass, TariffConfig, parseRentalPackage, parseTariffConfig, rentalMinHours,
} from './domain/tariff';
import { EXTRA_CATEGORY_ID, ExtraChargeRow, ExtraChargeSide, ExtraChargesConfig, MAX_FREE_WAITING_MINUTES, MAX_WAITING_ROUNDING_MINUTES } from './domain/extraCharges';
import { TARIFF_DOC } from './quote';
import { requirePermission, text, requireAction } from './shared';

const MAX_AMOUNT = 1_000_000;
const bad = (m: string) => new HttpsError('invalid-argument', m);

/** A finite rupee amount at paise precision. `positive` forbids zero (allowances and waiting may be zero). */
function amount(v: unknown, label: string, positive: boolean): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw bad(`${label} must be a number.`);
  if (positive ? v <= 0 : v < 0) throw bad(`${label} must be ${positive ? 'greater than zero' : 'zero or more'}.`);
  if (v > MAX_AMOUNT) throw bad(`${label} is too large.`);
  return Math.round(v * 100) / 100;
}

const obj = (v: unknown, label: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad(`${label} is missing.`);
  return v as Record<string, unknown>;
};

function classOf(v: unknown): TariffClass {
  if (typeof v !== 'string' || !(TARIFF_CLASSES as readonly string[]).includes(v)) throw bad('Choose a supported vehicle category.');
  return v as TariffClass;
}

function hoursOf(v: unknown): number {
  if (typeof v !== 'number' || !(RENTAL_HOURS as readonly number[]).includes(v)) throw bad(`Rental packages are 4, 6, 8, 10 or 12 hours.`);
  return v;
}

// ── Section: base rates, outstation extra usage, airport ────────────────────

function applyBaseRates(base: TariffConfig, d: Record<string, unknown>): TariffConfig {
  const next: TariffConfig = {
    ...base,
    oneWay: { ...base.oneWay, classes: { ...base.oneWay.classes } },
    roundTrip: { ...base.roundTrip, classes: { ...base.roundTrip.classes } },
    outstationExtras: { ...(base.outstationExtras ?? {}) },
  };
  next.oneWay.minKm = amount(d.oneWayMinKm, 'One Way minimum kilometres', true);
  if (d.airport != null) {
    const a = obj(d.airport, 'The airport fare');
    next.airport = { customerBase: amount(a.customerBase, 'Airport customer base fare', true), partnerBase: amount(a.partnerBase, 'Airport partner base payout', true) };
  }
  const classes = obj(d.classes, 'The category rates');
  for (const [key, raw] of Object.entries(classes)) {
    const cls = classOf(key);
    // Innova may be cleared (null): it then uses the SUV rates again. Every other class must stay configured.
    if (raw === null) {
      if (cls !== 'innova') throw bad('Only the Innova rates can be cleared.');
      delete next.oneWay.classes.innova; delete next.roundTrip.classes.innova; delete next.outstationExtras![cls];
      continue;
    }
    const c = obj(raw, `The ${cls} rates`);
    const one = obj(c.oneWay, `The ${cls} One Way rates`), round = obj(c.roundTrip, `The ${cls} Round Trip rates`), extra = obj(c.outstationExtra, `The ${cls} outstation extra usage`);
    next.oneWay.classes[cls] = {
      customerRate: amount(one.customerRate, `${cls} Customer One Way rate`, true), partnerRate: amount(one.partnerRate, `${cls} Partner One Way rate`, true),
      customerBata: amount(one.customerBata, `${cls} Customer allowance`, false), partnerBata: amount(one.partnerBata, `${cls} Partner allowance`, false),
    };
    const minKmPerDay = amount(round.minKmPerDay, `${cls} Round Trip minimum kilometres per day`, true);
    next.roundTrip.classes[cls] = {
      customerRate: amount(round.customerRate, `${cls} Customer Round Trip rate`, true), partnerRate: amount(round.partnerRate, `${cls} Partner Round Trip rate`, true),
      // One Way and Round Trip keep separate allowances (the confirmed Crysta values differ), so each has its own pair.
      customerBata: amount(round.customerBata, `${cls} Round Trip customer allowance`, false), partnerBata: amount(round.partnerBata, `${cls} Round Trip partner allowance`, false),
      minKmPerDay,
    };
    next.outstationExtras![cls] = {
      extraKmRate: amount(extra.extraKmRate, `${cls} customer extra charge per kilometre`, true),
      waitingPerHour: amount(extra.waitingPerHour, `${cls} customer extra charge per waiting hour`, false),
    };
  }
  return next;
}

// ── Section: Local Pickup & Drop ────────────────────────────────────────────

async function cityOf(id: unknown): Promise<{ id: string; name: string }> {
  if (typeof id !== 'string' || !id || id.includes('/')) throw bad('Choose a city.');
  const snap = await db.doc(`locations/${id}`).get();
  const l = snap.data();
  if (!snap.exists || !l || l.type !== 'City') throw bad('That is not a city in the location master.');
  if (l.status !== 'Active') throw bad('That city is not active in the location master.');
  return { id: snap.id, name: text(l.name, 80) || text(l.city, 80) || snap.id };
}

function applyLocal(base: TariffConfig, city: { id: string; name: string }, cls: TariffClass, f: Record<string, unknown>): TariffConfig {
  if (typeof f.enabled !== 'boolean') throw bad('Choose whether this fare is enabled.');
  const existing = base.localPickupDrop?.[city.id];
  const fare = {
    minKm: amount(f.minKm, 'Minimum billable kilometres', true),
    customerRate: amount(f.customerRate, 'Customer rate per kilometre', true),
    partnerRate: amount(f.partnerRate, 'Partner rate per kilometre', true),
    extraKmRate: amount(f.extraKmRate, 'Extra kilometre rate', true),
    waitingPerHour: amount(f.waitingPerHour, 'Waiting charge', false),
    enabled: f.enabled,
  };
  return { ...base, localPickupDrop: { ...(base.localPickupDrop ?? {}), [city.id]: { cityName: city.name, classes: { ...(existing?.classes ?? {}), [cls]: fare } } } };
}

// ── Section: extra charges (waiting, hill, roof carrier) ────────────────────

/** One rate of one side: null / missing = not configured (the value is removed); a number ≥ 0 is stored — 0 is an explicit "no charge". */
function optionalAmount(v: unknown, label: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  return amount(v, label, false);
}

function extraSide(v: unknown, who: 'Customer' | 'Partner', cat: string): ExtraChargeSide {
  const s = v === undefined || v === null ? {} : obj(v, `${cat} ${who.toLowerCase()} charges`);
  const out: ExtraChargeSide = {};
  const waiting = optionalAmount(s.waitingPerHour, `${cat}: ${who} waiting per hour`);
  const hill = optionalAmount(s.hill, `${cat}: ${who} hill charge per trip`);
  const carrier = optionalAmount(s.carrier, `${cat}: ${who} carrier charge per trip`);
  if (waiting !== undefined) out.waitingPerHour = waiting;
  if (hill !== undefined) out.hill = hill;
  if (carrier !== undefined) out.carrier = carrier;
  return out;
}

function wholeMinutes(v: unknown, label: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw bad(`${label} must be a whole number of minutes.`);
  if (v < min || v > max) throw bad(`${label} must be from ${min} to ${max} minutes.`);
  return v;
}

/** The categories a payload refers to, checked against the real vehicle_categories (before the transaction, like cityOf). */
async function extraCategoryNames(data: Record<string, unknown>): Promise<Map<string, string>> {
  const rows = obj(data.categories, 'The category charges');
  const ids = Object.keys(rows);
  if (ids.length > 50) throw bad('Too many categories in one save.');
  const names = new Map<string, string>();
  for (const id of ids) {
    if (!EXTRA_CATEGORY_ID.test(id)) throw bad('Choose a valid vehicle category.');
    const snap = await db.doc(`vehicle_categories/${id}`).get();
    if (!snap.exists) throw bad(`Vehicle category "${id}" does not exist.`);
    names.set(id, text(snap.data()?.name, 80) || id);
  }
  return names;
}

/**
 * Replaces the submitted categories' rows and the waiting rules; categories that are not in the payload — including inactive
 * or renamed ones — keep their saved rows untouched. The section's own version is bumped here, never taken from the client.
 */
function applyExtraCharges(base: TariffConfig, d: Record<string, unknown>, names: Map<string, string>): { next: TariffConfig; changed: string[] } {
  const freeWaitingMinutes = wholeMinutes(d.freeWaitingMinutes, 'Free waiting per stop', 0, MAX_FREE_WAITING_MINUTES);
  const waitingRoundingMinutes = wholeMinutes(d.waitingRoundingMinutes, 'The waiting rounding interval', 1, MAX_WAITING_ROUNDING_MINUTES);
  const rows = obj(d.categories, 'The category charges');
  const categories: Record<string, ExtraChargeRow> = { ...(base.extraCharges?.categories ?? {}) };
  const changed: string[] = [];
  for (const [id, raw] of Object.entries(rows)) {
    const name = names.get(id) ?? id;
    const r = obj(raw, `The ${name} charges`);
    const row: ExtraChargeRow = { customer: extraSide(r.customer, 'Customer', name), partner: extraSide(r.partner, 'Partner', name) };
    const empty = !Object.keys(row.customer).length && !Object.keys(row.partner).length;
    if (empty) { if (categories[id]) { delete categories[id]; changed.push(id); } continue; }
    if (JSON.stringify(categories[id] ?? null) !== JSON.stringify(row)) changed.push(id);
    categories[id] = row;
  }
  const extraCharges: ExtraChargesConfig = { version: (base.extraCharges?.version ?? 0) + 1, freeWaitingMinutes, waitingRoundingMinutes, categories };
  return { next: { ...base, extraCharges }, changed };
}

// ── Sections: rental minimum and packages ───────────────────────────────────

function applyRentalMinimum(base: TariffConfig, cls: TariffClass, hours: unknown): TariffConfig {
  if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 12) throw bad('The minimum rental must be a whole number of hours from 1 to 12.');
  const current = base.rentalPackages?.[cls];
  // Packages already saved are kept untouched; the ones below the new minimum simply stop being quotable.
  return { ...base, rentalPackages: { ...(base.rentalPackages ?? {}), [cls]: { packages: current?.packages ?? {}, minHours: hours } } };
}

function applyRentalPackage(base: TariffConfig, cls: TariffClass, hours: number, p: Record<string, unknown>): TariffConfig {
  const min = rentalMinHours(base, cls);
  if (hours < min) throw bad(`A ${hours}-hour package is shorter than this category's ${min}-hour minimum.`);
  if (typeof p.enabled !== 'boolean') throw bad('Choose whether this package is available.');
  if (p.gstMode !== 'included' && p.gstMode !== 'excluded') throw bad('Choose whether the fare includes GST or GST is added.');
  const pkg: RentalPackage | null = parseRentalPackage({
    customerFare: amount(p.customerFare, 'Customer fare', true), partnerPayout: amount(p.partnerPayout, 'Partner payout', true),
    includedKm: amount(p.includedKm, 'Covered kilometres', true), extraKmRate: amount(p.extraKmRate, 'Extra kilometre charge', true),
    extraHourRate: amount(p.extraHourRate, 'Extra hour charge', true), gstMode: p.gstMode, enabled: p.enabled,
  });
  if (!pkg) throw bad('The rental package is incomplete.');
  const current = base.rentalPackages?.[cls];
  return { ...base, rentalPackages: { ...(base.rentalPackages ?? {}), [cls]: { ...(current?.minHours ? { minHours: current.minHours } : {}), packages: { ...(current?.packages ?? {}), [String(hours)]: pkg } } } };
}

/**
 * Saves one section of the tariff. `expectedVersion` is required: the editor saves against the version it
 * loaded, and a newer tariff is refused rather than overwritten. A brand-new tariff starts switched off —
 * nothing here turns the confirmed tariff on.
 */
export const saveTariffSection = onCall(async (request) => {
  const actor = await requirePermission(request.auth, 'pricing');
  requireAction(actor, 'Settings', 'edit');
  const input = request.data ?? {};
  const reason = text(input.reason, 300);
  if (reason.length < 5) throw bad('Give a short reason for the change.');
  if (typeof input.expectedVersion !== 'number' || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw bad('Reload the tariff before saving.');
  const section = input.section;
  const city = section === 'localPickupDrop' ? await cityOf(input.cityId) : null;
  const extraNames = section === 'extraCharges' ? await extraCategoryNames(obj(input.data, 'The extra charges')) : null;

  const ref = db.doc(TARIFF_DOC);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? parseTariffConfig(snap.data()) : null;
    if (input.expectedVersion !== (before?.version ?? 0)) {
      throw new HttpsError('failed-precondition', 'The tariff was changed by someone else. Reload and review it before saving.');
    }
    const base = before ?? parseTariffConfig({ enabled: false, version: 0 })!;
    let next: TariffConfig;
    let meta: Record<string, unknown>;
    if (section === 'baseRates') {
      const d = obj(input.data, 'The rates');
      next = applyBaseRates(base, d);
      meta = { section, classes: Object.keys(obj(d.classes, 'The category rates')) };
    } else if (section === 'localPickupDrop' && city) {
      const cls = classOf(input.class);
      next = applyLocal(base, city, cls, obj(input.data, 'The fare'));
      meta = { section, cityId: city.id, cityName: city.name, class: cls };
    } else if (section === 'extraCharges' && extraNames) {
      const r = applyExtraCharges(base, obj(input.data, 'The extra charges'), extraNames);
      next = r.next;
      meta = { section, extraChargesVersion: next.extraCharges?.version ?? 0, was: base.extraCharges?.version ?? 0, categories: r.changed };
    } else if (section === 'rentalMinimum') {
      const cls = classOf(input.class);
      next = applyRentalMinimum(base, cls, input.minHours);
      meta = { section, class: cls, minHours: input.minHours, was: rentalMinHours(base, cls) };
    } else if (section === 'rentalPackage') {
      const cls = classOf(input.class), hours = hoursOf(input.hours);
      next = applyRentalPackage(base, cls, hours, obj(input.data, 'The package'));
      meta = { section, class: cls, hours };
    } else {
      throw bad('Unknown tariff section.');
    }
    const version = (before?.version ?? 0) + 1;
    tx.set(ref, { ...next, enabled: base.enabled, version, updatedBy: actor.uid, updatedByName: actor.name, updatedAt: FieldValue.serverTimestamp() });
    auditInTx(tx, {
      action: 'tariff_section_saved', entity: 'tariff', entityId: 'v2', performedBy: actor.uid, performedByName: actor.name, role: 'admin',
      previous: before ? { version: before.version } : null, next: { version }, meta, reason,
    });
    return { version, ...(section === 'extraCharges' ? { extraChargesVersion: next.extraCharges?.version ?? 0 } : {}) };
  });
});
