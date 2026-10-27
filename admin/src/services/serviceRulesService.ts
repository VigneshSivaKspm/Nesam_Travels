/**
 * Service & Fare Settings rules (service_rules): booking availability, cab types, pricing
 * adjustments and fare limits scoped to a state / city / area and a pickup schedule. The booking
 * server (functions/src/serviceRules.ts) applies the enabled rules to every quote and booking.
 */
import { addDoc, arrayUnion, collection, doc, onSnapshot, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type RuleKind = "availability" | "categories" | "pricing" | "limit";
export type RuleStatus = "Enabled" | "Disabled" | "Removed";
export type Side = "Pickup or drop" | "Pickup only" | "Drop only";
export interface Adjustment { mode: "Normal" | "Increase" | "Decrease"; percent: number }

export interface ServiceRule {
  id: string;
  kind: RuleKind;
  name: string;
  status: RuleStatus;
  priority: number;
  scope: { state: string; city: string; area: string; side: Side };
  service: string;
  schedule: { mode: "Always" | "Range"; from?: string; to?: string };
  availability?: "Available" | "Limited" | "Paused";
  categories?: string[];
  customer?: Adjustment;
  partner?: Adjustment;
  limit?: { target: "Customer fare" | "Partner payout"; category: string; min: number; max: number; reference: string };
  reason: string;
  history?: { action: string; reason: string; byName: string; at: Timestamp; before?: string; after?: string }[];
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: Timestamp;
}

const who = () => ({ uid: auth.currentUser?.uid ?? "", name: auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "Staff" });
const COL = "service_rules";

export function subscribeServiceRules(cb: (rows: ServiceRule[]) => void, onError?: (m: string) => void) {
  return onSnapshot(collection(db, COL), (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<ServiceRule, "id">), id: d.id }))), (e) => (onError ? onError(e.message) : cb([])));
}

export const summary = (r: Omit<ServiceRule, "id">) =>
  r.kind === "availability" ? r.availability ?? "Available"
  : r.kind === "categories" ? (r.categories ?? []).join(" · ")
  : r.kind === "pricing" ? `Customer ${adjText(r.customer)} · Partner ${adjText(r.partner)}`
  : r.limit ? `${r.limit.target} ₹${r.limit.min}–₹${r.limit.max}` : "";

export const adjText = (a?: Adjustment) => (!a || a.mode === "Normal" ? "normal" : `${a.mode === "Increase" ? "+" : "−"}${a.percent}%`);

export async function saveRule(rule: Omit<ServiceRule, "id" | "history" | "updatedBy" | "updatedByName" | "updatedAt">, id?: string, before?: ServiceRule) {
  const me = who();
  const entry = { action: id ? "Edited" : "Created", reason: rule.reason, byName: me.name, at: Timestamp.now(), ...(before ? { before: summary(before), after: summary(rule) } : { after: summary(rule) }) };
  if (id) await updateDoc(doc(db, COL, id), { ...rule, updatedBy: me.uid, updatedByName: me.name, updatedAt: serverTimestamp(), history: arrayUnion(entry) });
  else await addDoc(collection(db, COL), { ...rule, updatedBy: me.uid, updatedByName: me.name, updatedAt: serverTimestamp(), history: [entry] });
}

export async function setRuleStatus(r: ServiceRule, status: RuleStatus, reason: string) {
  const me = who();
  await updateDoc(doc(db, COL, r.id), { status, updatedBy: me.uid, updatedByName: me.name, updatedAt: serverTimestamp(), history: arrayUnion({ action: status === "Enabled" ? "Enabled" : status === "Disabled" ? "Disabled" : "Removed", reason, byName: me.name, at: Timestamp.now(), before: r.status, after: status }) });
}

/** Active now / scheduled / ended for an enabled rule. */
export function phaseOf(r: ServiceRule, now = Date.now()): "Active" | "Scheduled" | "Ended" | "Disabled" | "Removed" {
  if (r.status !== "Enabled") return r.status;
  if (r.schedule.mode === "Range") {
    if (r.schedule.from && Date.parse(r.schedule.from) > now) return "Scheduled";
    if (r.schedule.to && Date.parse(r.schedule.to) < now) return "Ended";
  }
  return "Active";
}

/** A rule applies to the selected location when its scope is the same or wider. */
export function inScope(r: ServiceRule, sel: { state: string; city: string; area: string }) {
  if (sel.area && r.scope.area && r.scope.area !== sel.area) return false;
  if (sel.city && r.scope.city && r.scope.city !== sel.city) return false;
  if (sel.state && r.scope.state && r.scope.state !== sel.state) return false;
  return true;
}
