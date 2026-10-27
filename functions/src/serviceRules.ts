// Location-scoped service rules from the Master Admin "Service & Fare Settings" page
// (service_rules collection): booking availability, which cab types are offered, and customer
// fare / partner payout adjustments for a state, city or area, by pickup schedule.
//
// Every booking source (customer quote, customer booking, admin booking) evaluates the same
// rules. With no enabled rule for a trip, pricing and availability are exactly as before.
import { HttpsError } from 'firebase-functions/v2/https';
import { Transaction } from 'firebase-admin/firestore';
import { db } from './admin';
import { FareAdjustmentInput } from './domain/pricing';
import { GeoPlace } from './domain/types';

export interface ServiceRule {
  id: string;
  kind: 'availability' | 'categories' | 'pricing' | 'limit';
  status: string;
  priority: number;
  scope: { state?: string; city?: string; area?: string; side?: 'Pickup or drop' | 'Pickup only' | 'Drop only' };
  service?: string;
  schedule?: { mode?: 'Always' | 'Range'; from?: string; to?: string };
  availability?: 'Available' | 'Limited' | 'Paused';
  categories?: string[];
  customer?: { mode: 'Normal' | 'Increase' | 'Decrease'; percent: number };
  partner?: { mode: 'Normal' | 'Increase' | 'Decrease'; percent: number };
  name?: string;
  reason?: string;
}

export interface RuleOutcome {
  availability: 'Available' | 'Limited' | 'Paused';
  availabilityRule: ServiceRule | null;
  categories: string[] | null;
  customer: FareAdjustmentInput | null;
  partner: { direction: 'increase' | 'decrease'; percent: number } | null;
}

export async function loadServiceRules(tx?: Transaction): Promise<ServiceRule[]> {
  const q = db.collection('service_rules').where('status', '==', 'Enabled');
  const snap = tx ? await tx.get(q) : await q.get();
  return snap.docs.map((d) => ({ ...(d.data() as Omit<ServiceRule, 'id'>), id: d.id }));
}

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

function placeMatches(rule: ServiceRule, p: GeoPlace): boolean {
  const text = `${norm(p.name)} ${norm((p as { address?: string }).address)} ${norm((p as { city?: string }).city)}`;
  const { city, area, state } = rule.scope ?? {};
  if (norm(area) && !text.includes(norm(area))) return false;
  if (norm(city) && !text.includes(norm(city))) return false;
  if (!norm(city) && !norm(area) && norm(state) && !text.includes(norm(state))) return false;
  return true;
}

function applies(rule: ServiceRule, pickup: GeoPlace, drop: GeoPlace, at: Date, service: string): boolean {
  const side = rule.scope?.side ?? 'Pickup or drop';
  const where = side === 'Pickup only' ? placeMatches(rule, pickup) : side === 'Drop only' ? placeMatches(rule, drop) : placeMatches(rule, pickup) || placeMatches(rule, drop);
  if (!where) return false;
  const svc = norm(rule.service);
  if (svc && svc !== 'all' && !norm(service).includes(svc)) return false;
  if (rule.schedule?.mode === 'Range') {
    const from = rule.schedule.from ? Date.parse(rule.schedule.from) : NaN;
    const to = rule.schedule.to ? Date.parse(rule.schedule.to) : NaN;
    if (Number.isFinite(from) && at.getTime() < from) return false;
    if (Number.isFinite(to) && at.getTime() > to) return false;
  }
  return true;
}

const top = (rules: ServiceRule[]) => rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0] ?? null;
const adj = (a: ServiceRule['customer']) => (a && a.mode !== 'Normal' && a.percent > 0 && a.percent < 100 ? { direction: (a.mode === 'Increase' ? 'increase' : 'decrease') as 'increase' | 'decrease', percent: a.percent } : null);

export function evaluateRules(rules: ServiceRule[], pickup: GeoPlace, drop: GeoPlace, at: Date, service: string): RuleOutcome {
  const hit = rules.filter((r) => applies(r, pickup, drop, at, service));
  const av = top(hit.filter((r) => r.kind === 'availability'));
  const cats = top(hit.filter((r) => r.kind === 'categories'));
  const price = top(hit.filter((r) => r.kind === 'pricing'));
  const customer = adj(price?.customer);
  return {
    availability: av?.availability ?? 'Available',
    availabilityRule: av,
    categories: cats?.categories?.length ? cats.categories.map(norm) : null,
    customer: customer ? { id: `rule_${price!.id}`, name: price!.name || 'Location fare rule', direction: customer.direction, percent: customer.percent } : null,
    partner: adj(price?.partner),
  };
}

/** Throws when the location is paused or the cab type is hidden for this trip. */
export function assertBookable(o: RuleOutcome, categoryName: string): void {
  if (o.availability === 'Paused') {
    throw new HttpsError('failed-precondition', `New bookings are paused for this location${o.availabilityRule?.reason ? `: ${o.availabilityRule.reason}` : '.'}`);
  }
  if (o.categories && !o.categories.includes(norm(categoryName))) {
    throw new HttpsError('failed-precondition', `${categoryName} is not offered for this location. Choose another cab type.`);
  }
}

/** A partner payout rule scales the fixed partner rate the booking was priced with. */
export function adjustPartner<T extends { partner: { ratePaise: number; bataPaise: number; basePaise: number } | null }>(pricing: T, o: RuleOutcome): T {
  if (!o.partner || !pricing.partner) return pricing;
  const f = o.partner.direction === 'increase' ? 1 + o.partner.percent / 100 : 1 - o.partner.percent / 100;
  return { ...pricing, partner: { ...pricing.partner, ratePaise: Math.round(pricing.partner.ratePaise * f), basePaise: Math.round(pricing.partner.basePaise * f) } } as T;
}
