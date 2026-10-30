// The customer-readable fare breakup stored on every booking (`fareBreakup`).
// It is derived from the server-calculated FareBreakdown and the category's
// own configuration, so every app shows the same lines in the same words and
// never recomputes them. Each line says whether it is already in the price
// ("included") or payable separately ("extra").
import { FareBreakdown, RideCategory } from './types';
import type { PricingSnapshot } from './tariff';
import type { ExtraChargesSnapshot } from './extraCharges';

export type FareLineTreatment = 'included' | 'extra' | 'not_applicable';

export interface FareLine {
  key: string;
  label: string;
  /** Rupees. Negative for reductions. null = billed at actuals / rate only. */
  amount: number | null;
  treatment: FareLineTreatment;
  /** Human-readable rate, coverage or rule, e.g. "Includes 250 KM". */
  detail: string;
}

export interface FareBreakup {
  schema: 1;
  lines: FareLine[];
  /** What the customer pays for the package (incl. GST) — always equals fare.total. */
  packageTotal: number;
  /** Extras whose amount is known up front. Others are billed at actuals. */
  knownExtras: number;
  /** True when at least one extra is billed at actuals. */
  hasActualsExtras: boolean;
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function buildFareBreakup(category: RideCategory, fare: FareBreakdown, outstation: boolean): FareBreakup {
  const x = category.fare.extras;
  const lines: FareLine[] = [];
  const add = (l: FareLine) => lines.push(l);

  add({
    key: 'base', label: 'Base package', amount: fare.baseFare, treatment: 'included',
    detail: category.fare.baseKm > 0 ? `Includes ${category.fare.baseKm} KM` : 'Base fare',
  });
  add({
    key: 'distance', label: 'Distance charge', amount: fare.distanceFare, treatment: 'included',
    detail: fare.distanceFare > 0
      ? `${fare.distanceKm} KM booked at ${rupees(fare.perKmRate)}/KM beyond the included ${category.fare.baseKm} KM`
      : `${fare.distanceKm} KM booked, within the included KM`,
  });
  if (fare.timeFare > 0) add({ key: 'time', label: 'Time charge', amount: fare.timeFare, treatment: 'included', detail: `${fare.durationMin} min at ${rupees(fare.perMinuteRate)}/min` });
  if (fare.nightCharge > 0) add({ key: 'night', label: 'Night charge', amount: fare.nightCharge, treatment: 'included', detail: 'Pickup between 10:00 PM and 06:00 AM' });
  add(outstation
    ? { key: 'driverAllowance', label: 'Driver allowance', amount: fare.driverAllowance, treatment: 'included', detail: 'Outstation trip — included in the fare' }
    : { key: 'driverAllowance', label: 'Driver allowance', amount: null, treatment: 'not_applicable', detail: 'Not applicable to local trips' });
  if (fare.minimumFareAdjustment > 0) add({ key: 'minimum', label: 'Minimum fare top-up', amount: fare.minimumFareAdjustment, treatment: 'included', detail: 'Applied so the fare reaches the category minimum' });
  if (fare.globalAdjustment) {
    const a = fare.globalAdjustment;
    add({ key: 'adjustment', label: a.name || 'Fare adjustment', amount: a.amount, treatment: 'included', detail: `${a.direction === 'increase' ? '+' : '−'}${a.percent}% on the package total` });
  }
  if (fare.adminAdjustment) add({ key: 'agreed', label: 'Agreed fare adjustment', amount: fare.adminAdjustment, treatment: 'included', detail: 'Authorised by NESAM staff' });
  if (fare.discount > 0) {
    const d = fare.discountDetail;
    add({
      key: 'discount', label: 'Discount', amount: -fare.discount, treatment: 'included',
      detail: d?.type === 'percentage' ? `${d.value}% discount` : d?.type === 'fixed' ? `Flat ${rupees(d.value)} discount` : 'Promo discount',
    });
  }
  add({ key: 'gst', label: `GST (${Math.round(fare.gstRate * 100)}%)`, amount: fare.gst, treatment: 'included', detail: 'Included in the total payable' });

  // Charges outside the package.
  add({
    key: 'extraKm', label: 'Extra KM', amount: null, treatment: 'extra',
    detail: `${rupees(x?.extraKmRate ?? fare.perKmRate)} per KM beyond the ${fare.distanceKm} KM booked`,
  });
  add({
    key: 'waiting', label: 'Waiting charges', amount: null, treatment: 'extra',
    detail: x && x.waitingPerHour > 0 ? `${rupees(x.waitingPerHour)} per hour of waiting` : 'Billed at actuals',
  });
  add(x?.tollIncluded
    ? { key: 'toll', label: 'Toll', amount: null, treatment: 'included', detail: 'Included in the fare' }
    : { key: 'toll', label: 'Toll', amount: null, treatment: 'extra', detail: 'Payable separately at actuals' });
  add(x?.parkingIncluded
    ? { key: 'parking', label: 'Parking', amount: null, treatment: 'included', detail: 'Included in the fare' }
    : { key: 'parking', label: 'Parking', amount: null, treatment: 'extra', detail: 'Payable separately at actuals' });
  add(outstation
    ? { key: 'stateTax', label: 'State tax / permit', amount: x && x.permitCharge > 0 ? x.permitCharge : null, treatment: 'extra', detail: x && x.permitCharge > 0 ? 'Payable separately per trip' : 'Payable separately at actuals' }
    : { key: 'stateTax', label: 'State tax / permit', amount: null, treatment: 'not_applicable', detail: 'Not applicable to local trips' });
  if (x && x.carrierCharge > 0) add({ key: 'carrier', label: 'Carrier / luggage', amount: x.carrierCharge, treatment: 'extra', detail: 'Payable separately if a carrier is used' });

  const extras = lines.filter((l) => l.treatment === 'extra');
  return {
    schema: 1,
    lines,
    packageTotal: fare.total,
    knownExtras: extras.reduce((s, l) => s + (l.amount ?? 0), 0),
    hasActualsExtras: extras.some((l) => l.amount === null),
  };
}

const num2 = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Fare lines for a booking priced by the confirmed tariff: dates / billable days, the
 * included kilometres, the daily or per-trip bata and what is billed beyond the package.
 * The extras block is shared with the category breakup so the wording stays identical.
 */
export function buildTariffFareBreakup(category: RideCategory, fare: FareBreakdown, outstation: boolean, pricing: PricingSnapshot): FareBreakup {
  const base = buildFareBreakup(category, fare, outstation);
  const rate = num2(pricing.customerRatePaise);
  const roundTrip = pricing.model === 'round_trip_calendar';
  // A waiting rate saved with the tariff replaces the category wording; without one the category line is unchanged.
  const w = pricing.waitingPerHourPaise;
  const waiting = typeof w !== 'number' ? null : w > 0 ? `${num2(w)} per hour of waiting` : 'No waiting charge';
  const extrasBlock = (rest: FareLine[]): FareLine[] => rest.map((l) => (l.key === 'waiting' && waiting ? { ...l, detail: waiting } : l));
  if (pricing.model === 'rental_package') {
    const head: FareLine[] = [{
      key: 'package', label: `${pricing.rentalHours ?? ''}-hour rental package`.trim(), amount: fare.baseFare, treatment: 'included',
      detail: `${pricing.includedKm} KM included; ${num2(pricing.extraHourRatePaise ?? 0)} per extra hour`,
    }];
    const rest = base.lines.filter((l) => !['base', 'distance', 'time', 'night', 'driverAllowance', 'minimum'].includes(l.key));
    const lines = [...head, ...extrasBlock(rest).map((l) => (l.key === 'extraKm' ? { ...l, detail: `${num2(pricing.extraKmRatePaise)} per KM beyond the ${pricing.includedKm} KM included` } : l))];
    const extras = lines.filter((l) => l.treatment === 'extra');
    return { schema: 1, lines, packageTotal: fare.total, knownExtras: extras.reduce((s, l) => s + (l.amount ?? 0), 0), hasActualsExtras: extras.some((l) => l.amount === null) };
  }
  if (pricing.model === 'fixed_route') {
    const head: FareLine[] = [{
      key: 'package', label: 'Fixed route fare', amount: fare.baseFare, treatment: 'included',
      detail: `Agreed fare for this route (${pricing.includedKm} KM by road); it does not change with the kilometres driven`,
    }];
    // No per-KM charge is added to an agreed fare.
    const rest = base.lines.filter((l) => !['base', 'distance', 'time', 'night', 'driverAllowance', 'minimum', 'extraKm'].includes(l.key));
    const lines = [...head, ...extrasBlock(rest)];
    const extras = lines.filter((l) => l.treatment === 'extra');
    return { schema: 1, lines, packageTotal: fare.total, knownExtras: extras.reduce((s, l) => s + (l.amount ?? 0), 0), hasActualsExtras: extras.some((l) => l.amount === null) };
  }
  const head: FareLine[] = [
    {
      key: 'distance', label: roundTrip ? 'Distance (billable KM)' : 'Distance charge', amount: fare.distanceFare + fare.minimumFareAdjustment, treatment: 'included',
      detail: roundTrip
        ? `${pricing.includedKm} KM billable (minimum ${pricing.minKmPerDay} KM/day × ${pricing.days} day${pricing.days === 1 ? '' : 's'}) at ${rate}/KM`
        : pricing.model === 'local_pickup_drop'
        ? `${pricing.includedKm} KM billable (local minimum ${pricing.minKmPerDay} KM) at ${rate}/KM`
        : `${pricing.includedKm} KM included (minimum 130 KM) at ${rate}/KM`,
    },
    {
      key: 'driverAllowance', label: roundTrip ? 'Driver bata (per day)' : 'Driver bata', amount: fare.driverAllowance, treatment: 'included',
      detail: roundTrip ? `${num2(pricing.customerBataPaise)} × ${pricing.days} day${pricing.days === 1 ? '' : 's'} (${pricing.pickupDate}${pricing.endDate ? ` → ${pricing.endDate}` : ''})` : 'Included in the fare',
    },
  ];
  const rest = base.lines.filter((l) => !['base', 'distance', 'time', 'night', 'driverAllowance', 'minimum'].includes(l.key));
  const lines = [
    ...(pricing.model === 'local_pickup_drop' ? head.filter((l) => l.key !== 'driverAllowance') : head),
    ...extrasBlock(rest).map((l) => (l.key === 'extraKm' ? { ...l, detail: `${num2(pricing.extraKmRatePaise)} per KM beyond the ${pricing.includedKm} KM included` } : l)),
  ];
  const extras = lines.filter((l) => l.treatment === 'extra');
  return { schema: 1, lines, packageTotal: fare.total, knownExtras: extras.reduce((s, l) => s + (l.amount ?? 0), 0), hasActualsExtras: extras.some((l) => l.amount === null) };
}

/**
 * Discloses the category's configured waiting / hill / roof-carrier rates on a quoted breakup. They are charges outside the
 * package that apply only to the extras actually used, so no amount is added to the total: each line states its rate and
 * rule. A rate that was never configured adds no line and leaves the category's own wording alone.
 */
export function withExtraChargeLines(b: FareBreakup, s: ExtraChargesSnapshot): FareBreakup {
  const c = s.customer;
  let lines = [...b.lines];
  const upsert = (line: FareLine) => {
    const at = lines.findIndex((l) => l.key === line.key);
    if (at >= 0) lines[at] = line; else lines.push(line);
  };
  if (c.waitingPerHourPaise !== undefined) {
    const rule = s.freeWaitingMinutes !== null && s.waitingRoundingMinutes !== null
      ? ` after ${s.freeWaitingMinutes} free minute${s.freeWaitingMinutes === 1 ? '' : 's'} per stop, counted in ${s.waitingRoundingMinutes}-minute blocks`
      : '';
    upsert({
      key: 'waiting', label: 'Waiting charges', amount: null, treatment: 'extra',
      detail: c.waitingPerHourPaise > 0 ? `${num2(c.waitingPerHourPaise)} per hour of waiting${rule}` : 'No waiting charge',
    });
  }
  if (c.hillPaise !== undefined) {
    upsert({ key: 'hill', label: 'Hill travel', amount: null, treatment: 'extra', detail: c.hillPaise > 0 ? `${num2(c.hillPaise)} per trip when hill travel applies` : 'No hill charge' });
  }
  if (c.carrierPaise !== undefined) {
    // The category's older carrier line is replaced by the configured one.
    lines = lines.filter((l) => l.key !== 'carrier');
    upsert({ key: 'carrier', label: 'Roof carrier', amount: null, treatment: 'extra', detail: c.carrierPaise > 0 ? `${num2(c.carrierPaise)} per trip when a roof carrier is used` : 'No roof carrier charge' });
  }
  const extras = lines.filter((l) => l.treatment === 'extra');
  return { ...b, lines, knownExtras: extras.reduce((sum, l) => sum + (l.amount ?? 0), 0), hasActualsExtras: extras.some((l) => l.amount === null) };
}
