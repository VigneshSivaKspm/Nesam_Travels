import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { MasterLocation, TravelService, VehicleCategory } from "../types";
import { subscribeLocations, subscribeServices, subscribeToDocument, subscribeVehicleCategories } from "../services/adminFirestoreService";
import {
  adjText, inScope, isoToIstInput, istInputToIso, phaseOf, rankRules, saveRule, setRuleStatus, subscribeServiceRules, summary,
  type Adjustment, type RuleKind, type ServiceRule, type Side,
} from "../services/serviceRulesService";
import { useCan } from "../components/AccessContext";
import { Modal, Toast, useToast } from "../components/Feedback";
import { Badge, Button, DataTable, EmptyState, Icon, PageHeader, toneForStatus } from "../components/ui";
import { StageBar } from "../components/ui/ListKit";
import MenuButton from "../components/ui/MenuButton";
import TariffConfigCard from "../components/TariffConfigCard";
import FareAdjustmentCard from "../components/FareAdjustmentCard";
import { EstimateList, TripFields, emptyTrip, estimateAll, useQuickData, validateTrip, type CategoryEstimate, type QuickTrip } from "../components/booking/QuickFare";
import { TaxPolicyDialog, type TaxPolicy } from "./Invoices";
import { GST_STATES } from "../domain/gstStates";
import { refDateTime } from "../domain/officeStage";

type Tab = "Booking availability" | "Cab types" | "Pricing rules" | "More settings";
type Sel = { state: string; city: string; area: string };
const SERVICES = ["All", "One Way", "Round Trip", "Airport", "Multicity", "Local Rental", "Local Pickup & Drop"];
const STATUS_FILTERS = ["All", "Active", "Scheduled", "Ended", "Disabled", "Removed"] as const;

/** Tamil helper line under an English heading (reference bilingual headings). */
const Ta = ({ children }: { children: ReactNode }) => <span className="block text-[12px] text-muted" lang="ta">{children}</span>;

/** Master Admin "Service & Fare Settings": location-scoped availability, cab types and pricing. */
export default function Pricing({ onNavigate }: { onNavigate: (page: string, tab?: string) => void }) {
  const [tab, setTab] = useState<Tab>("Booking availability");
  const [sel, setSel] = useState<Sel>({ state: "", city: "", area: "" });
  const [rules, setRules] = useState<ServiceRule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [services, setServices] = useState<TravelService[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [sheet, setSheet] = useState<{ kind: "new"; ruleKind: RuleKind } | { kind: "edit" | "preview" | "status"; rule: ServiceRule; to?: "Enabled" | "Disabled" | "Removed" } | { kind: "history" | "test" | "base" | "limits" | "all" | "tax" } | null>(null);
  const canEdit = useCan("pricing");
  const canTest = useCan("operations");
  const { toast, show } = useToast(6000);
  useEffect(() => {
    const u = [subscribeServiceRules((r) => { setRules(r); setLoaded(true); setLoadError(null); }, (m) => { setLoadError(m); setLoaded(true); }), subscribeLocations(setLocations), subscribeVehicleCategories(setCategories), subscribeServices(setServices)];
    return () => u.forEach((x) => x());
  }, []);

  const active = locations.filter((l) => l.status === "Active");
  const stateName = (code: string) => GST_STATES.find(([c]) => c === code)?.[1] ?? code;
  const states = Array.from(new Set(active.map((l) => l.state).filter(Boolean)));
  const inState = (l: MasterLocation) => !sel.state || l.state === sel.state || l.state === stateName(sel.state);
  const cities = Array.from(new Set(active.filter(inState).map((l) => l.city).filter(Boolean))).sort();
  const areas = Array.from(new Set(active.filter((l) => inState(l) && (!sel.city || l.city === sel.city)).map((l) => l.area || l.name).filter(Boolean))).sort();
  const scoped = rules.filter((r) => r.status !== "Removed" || filter === "Removed").filter((r) => inScope(r, sel));
  const byKind = (k: RuleKind) => scoped.filter((r) => r.kind === k).filter((r) => filter === "All" ? r.status !== "Removed" : phaseOf(r) === filter);
  const activeOf = (k: RuleKind) => rankRules(scoped.filter((r) => r.kind === k && phaseOf(r) === "Active"));
  const where = sel.area || sel.city || (sel.state ? stateName(sel.state) : "All locations");
  const catNames = categories.filter((c) => c.status === "Active").map((c) => c.name);

  const ruleTable = (list: ServiceRule[]) => !loaded ? <p className="text-[12px] text-muted py-4" role="status">Loading saved settings…</p> : list.length === 0 ? null : (
    <DataTable label="Rules" minWidth={980} fixed hasActions>
      <thead><tr><th>SETTING</th><th>APPLIES TO</th><th>VALUE</th><th>PICKUP SCHEDULE</th><th>STATUS</th><th className="ds-actions">ACTIONS</th></tr></thead>
      <tbody>{list.map((r) => (
        <tr key={r.id}>
          <td><strong>{r.name}</strong><small>{r.service || "All"} · Priority {r.priority}</small></td>
          <td><strong>{r.scope.area ? "Area-specific rule" : r.scope.city ? "City rule" : r.scope.state ? "State rule" : "All locations"}</strong><small>{[r.scope.area, r.scope.city, r.scope.state && stateName(r.scope.state)].filter(Boolean).join(", ") || "Everywhere"} · {r.scope.side}</small></td>
          <td>{summary(r)}</td>
          <td>{r.schedule.mode === "Always" ? "Always" : `${r.schedule.from ? refDateTime(new Date(r.schedule.from)) : "Now"} → ${r.schedule.to ? refDateTime(new Date(r.schedule.to)) : "Open"}`}</td>
          <td><Badge tone={toneForStatus(phaseOf(r) === "Active" ? "Enabled" : phaseOf(r))}>{phaseOf(r) === "Active" ? "Enabled" : phaseOf(r)}</Badge></td>
          <td className="ds-actions"><div>
            {canEdit && r.status !== "Removed" && <Button size="sm" onClick={() => setSheet({ kind: "edit", rule: r })}>Edit</Button>}
            <Button size="sm" variant="ghost" onClick={() => setSheet({ kind: "preview", rule: r })}>Preview</Button>
            {canEdit && r.status !== "Removed" && <MenuButton iconOnly label={`More actions for ${r.name}`} items={[
              r.status === "Enabled" ? { label: "Disable rule", icon: "ban", onSelect: () => setSheet({ kind: "status", rule: r, to: "Disabled" }) } : { label: "Enable rule", icon: "circle-check", onSelect: () => setSheet({ kind: "status", rule: r, to: "Enabled" }) },
              { label: "Remove rule", icon: "trash-2", danger: true, onSelect: () => setSheet({ kind: "status", rule: r, to: "Removed" }) },
            ]} />}
          </div></td>
        </tr>
      ))}</tbody>
    </DataTable>
  );

  const tools: [string, string, string, () => void][] = [
    ["Base rates", "Regular ₹/km, driver bata and partner payout.", "Company-wide", () => setSheet({ kind: "base" })],
    ["Local fares", "Rental packages and Local Pickup & Drop.", "City-wise", () => onNavigate("services")],
    ["Extra charges", "Waiting, hills, carrier and other add-ons.", "Configured scope", () => onNavigate("categories")],
    ["Fixed route fares", "Set an agreed fare for a specific route.", "Route-wise", () => onNavigate("fare-rules")],
    ["Business contracts", "Company rates, credit terms and contracts.", "Business account", () => onNavigate("business")],
    ["Service boundaries", "Define verified cities, areas and service zones.", "Service areas", () => onNavigate("locations")],
    ["Fare limits", "Review approved minimum and maximum amounts.", "Configured scope", () => setSheet({ kind: "limits" })],
    ["All rules & schedules", "Find rules across locations and pickup schedules.", "All locations", () => setSheet({ kind: "all" })],
    ["Tax settings", "Review tax classification and invoice settings.", "Company-wide", () => setSheet({ kind: "tax" })],
  ];

  const statusChips = <div className="ds-chip-row">{STATUS_FILTERS.map((s) => <Button key={s} size="sm" variant={filter === s ? "primary" : "secondary"} onClick={() => setFilter(s)}>{s}</Button>)}</div>;

  return (
    <div className="ds-page-body">
      <Toast toast={toast} />
      {loadError && <div className="ds-error mb-4" role="alert"><Icon name="circle-alert" />Saved settings could not be loaded: {loadError}. Check your pricing access and reload.</div>}
      <PageHeader title="Service & Fare Settings" subtitle="Choose a location, then manage booking availability, cab types and fares." actions={<><Button icon="history" onClick={() => setSheet({ kind: "history" })}>Change history</Button><Button variant="primary" icon="calculator" disabledReason={canTest ? undefined : "Test fare prices a trip through the booking server, which needs operations access."} onClick={() => setSheet({ kind: "test" })}>Test fare</Button></>} />
      <section className="ds-panel ds-panel-pad mb-5">
        <span className="ds-eyebrow">LOCATION</span>
        <h2 className="text-[17px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>Which location are you managing?</h2>
        <Ta>எந்த இடத்திற்கான setting?</Ta>
        <div className="ds-filterbar mt-3">
          <label className="ds-field"><span>State</span><select className="ds-select" value={sel.state} onChange={(e) => setSel({ state: e.target.value, city: "", area: "" })}><option value="">All states</option>{GST_STATES.filter(([c, n]) => !states.length || states.includes(c) || states.includes(n)).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}</select></label>
          <label className="ds-field"><span>City</span><select className="ds-select" value={sel.city} onChange={(e) => setSel({ ...sel, city: e.target.value, area: "" })}><option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="ds-field"><span>Area / Zone</span><select className="ds-select" value={sel.area} onChange={(e) => setSel({ ...sel, area: e.target.value })}><option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select></label>
        </div>
        <p className="text-[11px] text-faint">Existing confirmed fares and accepted partner payouts are retained.</p>
        <div className="ds-kpi-grid mt-4" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
          <div className="ds-kpi"><span className="ds-kpi-label">Booking controls</span><span className="text-[14px] font-semibold text-ink">{activeOf("availability")[0]?.availability ?? "Available by default"}</span><span className="ds-kpi-note">{activeOf("availability").length ? activeOf("availability")[0].name : "No active availability restriction"}</span></div>
          <div className="ds-kpi"><span className="ds-kpi-label">Configured cabs</span><span className="text-[14px] font-semibold text-ink">{activeOf("categories")[0]?.categories?.join(", ") || "All active cab types"}</span><span className="ds-kpi-note">{activeOf("categories").length} active category rule{activeOf("categories").length === 1 ? "" : "s"}</span></div>
          <div className="ds-kpi"><span className="ds-kpi-label">Pricing rules</span><span className="text-[14px] font-semibold text-ink">{activeOf("pricing").length} active</span><span className="ds-kpi-note">{scoped.filter((r) => r.kind === "pricing" && phaseOf(r) === "Scheduled").length} scheduled</span></div>
        </div>
        <p className="text-[11px] text-muted mt-3">Rules active now · IST · {where}. Exact availability and fare depend on the route, cab type and pickup time.</p>
      </section>

      <StageBar label="Settings" tabs={(["Booking availability", "Cab types", "Pricing rules", "More settings"] as const).map((t) => ({ id: t, label: t }))} value={tab} onChange={setTab} />

      {tab === "Booking availability" && (
        <section className="ds-panel ds-panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div><h2 className="text-[16px] font-bold text-ink">Can customers book in this area?</h2><Ta>இந்த இடத்தில் booking எடுக்கலாமா?</Ta></div>
            {canEdit && <Button variant="primary" icon="plus" onClick={() => setSheet({ kind: "new", ruleKind: "availability" })}>Add booking availability</Button>}
          </div>
          {statusChips}
          {ruleTable(byKind("availability")) ?? <EmptyState title="Booking service is available by default" hint="No additional availability setting for this selection. Wider matching settings still apply." />}
          <p className="text-[11px] text-faint mt-3">Set pickup dates and times inside each rule. Use More settings for base rates and local fares.</p>
        </section>
      )}
      {tab === "Cab types" && (
        <section className="ds-panel ds-panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div><h2 className="text-[16px] font-bold text-ink">Which cab types should customers see?</h2><Ta>Customer-க்கு எந்த car வகைகளைக் காட்ட வேண்டும்?</Ta></div>
            {canEdit && <Button variant="primary" icon="plus" onClick={() => setSheet({ kind: "new", ruleKind: "categories" })}>Add cab types</Button>}
          </div>
          {statusChips}
          {ruleTable(byKind("categories")) ?? <EmptyState title="All active cab types are shown" hint="No cab type rule for this selection. Wider matching settings still apply." />}
        </section>
      )}
      {tab === "Pricing rules" && (
        <section className="ds-panel ds-panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div><h2 className="text-[16px] font-bold text-ink">When should the fare increase or decrease?</h2><Ta>இந்த இடத்திற்குக் கட்டணத்தை ஏற்ற / குறைக்க</Ta></div>
            {canEdit && <Button variant="primary" icon="plus" onClick={() => setSheet({ kind: "new", ruleKind: "pricing" })}>Add pricing rule</Button>}
          </div>
          <div className="ds-kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="ds-kpi"><span className="ds-kpi-label">Customer fare</span><span className="ds-kpi-note">Amount the customer pays</span><span className="text-[14px] font-semibold text-ink">{activeOf("pricing")[0] ? adjText(activeOf("pricing")[0].customer) : "Normal applicable fare"}</span></div>
            <div className="ds-kpi"><span className="ds-kpi-label">Partner payout</span><span className="ds-kpi-note">Amount for the Vendor / Driver Partner</span><span className="text-[14px] font-semibold text-ink">{activeOf("pricing")[0] ? adjText(activeOf("pricing")[0].partner) : "Normal applicable payout"}</span></div>
          </div>
          {statusChips}
          {ruleTable(byKind("pricing")) ?? <EmptyState title="Normal applicable fare" hint="No additional fare adjustment for this selection. Wider matching settings still apply." />}
          <div className="mt-5"><FareAdjustmentCard /></div>
        </section>
      )}
      {tab === "More settings" && (
        <section className="ds-panel ds-panel-pad">
          <h2 className="text-[16px] font-bold text-ink">Choose what you want to manage.</h2>
          <p className="text-[12px] text-muted mb-4">Each tool shows its own scope</p>
          <div className="ds-tool-grid">
            {tools.map(([t, d, scope, go]) => (
              <button key={t} type="button" className="ds-tool" onClick={go}>
                <strong>{t}</strong><span>{d}</span><small>{scope}</small><Icon name="arrow-up-right" />
              </button>
            ))}
          </div>
          <p className="text-[11px] text-faint mt-4">Check the location, service and pickup dates inside each tool before saving.</p>
        </section>
      )}

      {sheet?.kind === "new" && <RuleSheet kind={sheet.ruleKind} sel={sel} categories={catNames} services={services} rules={rules} onClose={() => setSheet(null)} onDone={(t) => { setSheet(null); show(t); }} />}
      {sheet?.kind === "edit" && <RuleSheet kind={sheet.rule.kind} rule={sheet.rule} sel={sel} categories={catNames} services={services} rules={rules} onClose={() => setSheet(null)} onDone={(t) => { setSheet(null); show(t); }} />}
      {sheet?.kind === "preview" && <PreviewSheet rule={sheet.rule} canTest={canTest} onTest={() => setSheet({ kind: "test" })} onClose={() => setSheet(null)} />}
      {sheet?.kind === "status" && <StatusSheet rule={sheet.rule} to={sheet.to!} onClose={() => setSheet(null)} onDone={(t) => { setSheet(null); show(t); }} />}
      {sheet?.kind === "history" && <HistorySheet rules={rules} onClose={() => setSheet(null)} />}
      {sheet?.kind === "test" && <TestFareSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === "base" && <Modal title="Company-wide base rates" onClose={() => setSheet(null)} wide><TariffConfigCard /></Modal>}
      {sheet?.kind === "limits" && <LimitsSheet rules={rules.filter((r) => r.kind === "limit" && r.status !== "Removed")} canEdit={canEdit} onAdd={() => setSheet({ kind: "new", ruleKind: "limit" })} onEdit={(r) => setSheet({ kind: "edit", rule: r })} onStatus={(r, to) => setSheet({ kind: "status", rule: r, to })} onClose={() => setSheet(null)} />}
      {sheet?.kind === "all" && <Modal title="All rules & schedules" onClose={() => setSheet(null)} wide>{ruleTable(rules.filter((r) => r.status !== "Removed")) ?? <EmptyState title="No rules configured" />}</Modal>}
      {sheet?.kind === "tax" && <TaxSheet onClose={() => setSheet(null)} onSaved={() => { setSheet(null); show("Approved tax policy saved."); }} />}
    </div>
  );
}

function TaxSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [policy, setPolicy] = useState<TaxPolicy | null | undefined>(undefined);
  useEffect(() => subscribeToDocument<TaxPolicy>("settings/tax_policy", setPolicy, () => setPolicy(null)), []);
  if (policy === undefined) return null;
  const fallback: TaxPolicy = { services: Object.fromEntries(["One Way", "Round Trip", "Airport", "Multicity", "Local Rental", "Local Pickup & Drop"].map((s) => [s, { classification: s === "Local Rental" ? "Vehicle rental" : "Passenger transportation", sac: s === "Local Rental" ? "996601" : "996412" }])), approved: false, reference: "" };
  return <TaxPolicyDialog policy={policy ? { ...fallback, ...policy, services: { ...fallback.services, ...policy.services } } : fallback} onClose={onClose} onSaved={onSaved} />;
}

function RuleSheet({ kind, rule, sel, categories, services, rules, onClose, onDone }: {
  kind: RuleKind; rule?: ServiceRule; sel: Sel; categories: string[]; services: TravelService[]; rules: ServiceRule[]; onClose: () => void; onDone: (t: string) => void;
}) {
  const [scope, setScope] = useState(rule?.scope ?? { ...sel, side: "Pickup or drop" as Side });
  const [name, setName] = useState(rule?.name ?? "");
  const [service, setService] = useState(rule?.service ?? "All");
  const [priority, setPriority] = useState(rule?.priority ?? 10);
  const [mode, setMode] = useState<"Always" | "Range">(rule?.schedule.mode ?? "Always");
  const [from, setFrom] = useState(isoToIstInput(rule?.schedule.from));
  const [to, setTo] = useState(isoToIstInput(rule?.schedule.to));
  const [availability, setAvailability] = useState(rule?.availability ?? "Available");
  const [cats, setCats] = useState<string[]>(rule?.categories ?? []);
  const [customer, setCustomer] = useState<Adjustment>(rule?.customer ?? { mode: "Normal", percent: 0 });
  const [partner, setPartner] = useState<Adjustment>(rule?.partner ?? { mode: "Normal", percent: 0 });
  const [limit, setLimit] = useState(rule?.limit ?? { target: "Customer fare" as const, category: "All", min: 0, max: 0, reference: "" });
  const [reason, setReason] = useState("");
  const [more, setMore] = useState(!!rule);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const where = [scope.area, scope.city, scope.state && GST_STATES.find(([c]) => c === scope.state)?.[1]].filter(Boolean).join(", ") || "All locations";
  const title = { availability: "Booking availability", categories: "Cab types", pricing: "Pricing rules", limit: "Fare limit" }[kind];
  const draft: Omit<ServiceRule, "id"> = {
    kind, name: name.trim() || `${scope.area || scope.city || "All locations"} ${kind === "categories" ? "cab categories" : kind === "availability" ? "availability" : kind === "pricing" ? "fare rule" : "fare limit"}`,
    status: rule?.status === "Disabled" ? "Disabled" : "Enabled", priority, scope, service: service === "All" ? "" : service,
    schedule: mode === "Always" ? { mode } : { mode, ...(from ? { from: istInputToIso(from) } : {}), ...(to ? { to: istInputToIso(to) } : {}) },
    ...(kind === "availability" ? { availability } : {}), ...(kind === "categories" ? { categories: cats } : {}),
    ...(kind === "pricing" ? { customer, partner } : {}), ...(kind === "limit" ? { limit } : {}), reason: reason.trim(),
  };
  // Same kind, same scope and service, overlapping schedule = conflict.
  const conflict = rules.find((r) => r.id !== rule?.id && r.kind === kind && r.status === "Enabled" && r.priority === priority
    && r.scope.state === scope.state && r.scope.city === scope.city && r.scope.area === scope.area && (r.service || "") === draft.service
    && (r.schedule.mode === "Always" || mode === "Always" || !((r.schedule.to ? Date.parse(r.schedule.to) : Infinity) <= (from ? Date.parse(istInputToIso(from)) : -Infinity) || (to ? Date.parse(istInputToIso(to)) : Infinity) <= (r.schedule.from ? Date.parse(r.schedule.from) : -Infinity))));
  const check = () => {
    if (kind === "categories" && !cats.length) return "Choose at least one cab type.";
    if (kind === "pricing" && customer.mode === "Normal" && partner.mode === "Normal") return "Choose an increase or decrease for the customer fare or the partner payout.";
    if (kind === "pricing" && [customer, partner].some((a) => a.mode !== "Normal" && !(a.percent > 0 && a.percent < 100))) return "Enter a percentage between 1 and 99.";
    if (kind === "limit" && !(limit.max > 0 && limit.max >= limit.min)) return "Enter a valid minimum and maximum.";
    if (mode === "Range" && !from && !to) return "Set the pickup date range or choose Always.";
    if (mode === "Range" && from && to && to <= from) return "The end must be after the start.";
    if (conflict) return `Resolve this overlapping rule before preview: ${conflict.name}.`;
    if (reason.trim().length < 5) return "Record the reason for this change.";
    return null;
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const why = check();
    if (why) return setError(why);
    if (!preview) { setError(null); return setPreview(true); }
    setBusy(true);
    try { await saveRule(draft, rule?.id, rule); onDone(`${draft.name} saved.`); }
    catch (err) { setError(err instanceof Error ? err.message : "The setting was not saved. Check your permissions and try again."); setBusy(false); }
  };
  const adjEditor = (label: string, sub: string, a: Adjustment, set: (a: Adjustment) => void) => (
    <div className="ds-panel ds-panel-pad">
      <strong className="text-[13px] text-ink">{label}</strong><p className="text-[11px] text-muted mb-2">{sub}</p>
      <div className="ds-seg" style={{ "--ds-seg": 3 } as React.CSSProperties}>{(["Normal", "Increase", "Decrease"] as const).map((m) => <button key={m} type="button" aria-pressed={a.mode === m} onClick={() => set({ ...a, mode: m })}>{m === "Normal" ? "Normal rate" : m}</button>)}</div>
      {a.mode !== "Normal" ? <label className="ds-field mt-2"><span>Percent</span><input className="ds-input" type="number" min={1} max={99} value={a.percent || ""} onChange={(e) => set({ ...a, percent: Number(e.target.value) })} /></label> : <p className="text-[11px] text-faint mt-2">Use the applicable base amount.</p>}
    </div>
  );
  return (
    <Modal title={rule ? "Edit settings" : "Add settings"} onClose={onClose} busy={busy} size="lg" footNote="Review the location, amounts and pickup schedule before saving." footer={<>{preview && <Button onClick={() => setPreview(false)}>Back</Button>}<Button variant="primary" type="submit" form="rule-form" loading={busy}>{preview ? "Save settings" : "Preview settings"}</Button></>}>
      <form id="rule-form" onSubmit={save} className="grid gap-4" noValidate>
        <p className="text-[12px] text-muted">{where} · {scope.side}</p>
        {error && <div className="ds-error" role="alert"><Icon name="circle-alert" />{error}</div>}
        {preview ? (
          <dl className="ds-facts" data-cols={2}>
            {([["Rule", draft.name], ["Location", where], ["Service / categories", `${service} · ${kind === "categories" ? cats.join(" · ") : "All"}`], ["Value", summary(draft)], ["Pickup schedule", mode], ["Priority", String(priority)], ["Reason", reason]] as const).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        ) : (
          <>
            <h3 className="text-[14px] font-bold text-ink">{title}</h3>
            {kind === "availability" && (
              <div className="grid gap-2">
                {([["Available", "Customers can request bookings."], ["Limited", "Limited service. Office confirmation is required."], ["Paused", "Stop new booking requests for this selection."]] as const).map(([v, d]) => (
                  <label key={v} className="ds-check ds-panel ds-panel-pad" style={{ alignItems: "center" }}><input type="radio" name="avail" checked={availability === v} onChange={() => setAvailability(v)} /><span><strong className="block text-[13px] text-ink">{v}</strong><small className="text-muted">{d}</small></span></label>
                ))}
              </div>
            )}
            {kind === "categories" && (
              <>
                <div className="flex flex-wrap gap-4">{categories.map((c) => <label key={c} className="ds-check"><input type="checkbox" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} />{c}</label>)}</div>
                <p className="text-[11px] text-faint">Unchecked categories stay hidden in search. Time-based cab unavailability is managed under Booking availability.</p>
              </>
            )}
            {kind === "pricing" && (
              <div className="grid gap-3 md:grid-cols-2">
                {adjEditor("Customer fare", "Amount the customer pays", customer, setCustomer)}
                {adjEditor("Partner payout", "Amount the partner receives", partner, setPartner)}
                <p className="text-[11px] text-faint md:col-span-2">Customer fare and partner payout change independently. Fixed route / B2B adjustments require opt-in on the corresponding rate.</p>
              </div>
            )}
            {kind === "limit" && (
              <div className="ds-form-grid">
                <label className="ds-field"><span>Applies to</span><select className="ds-select" value={limit.target} onChange={(e) => setLimit({ ...limit, target: e.target.value as typeof limit.target })}><option>Customer fare</option><option>Partner payout</option></select></label>
                <label className="ds-field"><span>Category</span><select className="ds-select" value={limit.category} onChange={(e) => setLimit({ ...limit, category: e.target.value })}><option>All</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="ds-field"><span>Minimum · ₹</span><input className="ds-input" type="number" min={0} value={limit.min || ""} onChange={(e) => setLimit({ ...limit, min: Number(e.target.value) })} /></label>
                <label className="ds-field"><span>Maximum · ₹</span><input className="ds-input" type="number" min={0} value={limit.max || ""} onChange={(e) => setLimit({ ...limit, max: Number(e.target.value) })} /></label>
                <label className="ds-field" data-span="2"><span>Office approval / state notification reference</span><input className="ds-input" value={limit.reference} onChange={(e) => setLimit({ ...limit, reference: e.target.value })} /></label>
              </div>
            )}
            <div className="ds-field"><span>Applicable pickup dates</span><Ta>எந்த pickup தேதிகளுக்குப் பொருந்தும்?</Ta>
              <div className="ds-seg mt-1">{(["Always", "Range"] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "Always" ? "Always" : "Specific dates & times"}</button>)}</div>
            </div>
            {mode === "Range" && <div className="ds-form-grid"><label className="ds-field"><span>From · IST</span><input className="ds-input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="ds-field"><span>To · IST</span><input className="ds-input" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label><p className="text-[11px] text-faint" data-span="2">Matched on the pickup time in IST. The start time is included; the end time is not.</p></div>}
            <details className="ds-disclosure" open={more} onToggle={(e) => setMore((e.target as HTMLDetailsElement).open)}>
              <summary>More options · Service, pickup / drop, categories &amp; priority</summary>
              <div className="ds-form-grid">
                <label className="ds-field"><span>Rule name</span><input className="ds-input" value={name} placeholder={draft.name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="ds-field"><span>Service</span><select className="ds-select" value={service} onChange={(e) => setService(e.target.value)}>{Array.from(new Set([...SERVICES, ...services.map((s) => s.name)])).map((s) => <option key={s}>{s}</option>)}</select></label>
                <label className="ds-field"><span>Applies to</span><select className="ds-select" value={scope.side} onChange={(e) => setScope({ ...scope, side: e.target.value as Side })}><option>Pickup or drop</option><option>Pickup only</option><option>Drop only</option></select></label>
                <label className="ds-field"><span>Priority</span><input className="ds-input" type="number" min={1} max={100} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></label>
              </div>
            </details>
            {conflict && <p className="text-[11px] text-bad">Resolve this overlapping rule before preview · {conflict.name} · Change the location, dates, service or {kind === "categories" ? "cab types" : "priority"}.</p>}
            <label className="ds-field"><span>Reason for this change</span><input className="ds-input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          </>
        )}
      </form>
    </Modal>
  );
}

function PreviewSheet({ rule, canTest, onTest, onClose }: { rule: ServiceRule; canTest: boolean; onTest: () => void; onClose: () => void }) {
  return (
    <Modal title="Rule preview" onClose={onClose} footer={<Button icon="calculator" disabledReason={canTest ? undefined : "Test fare needs operations access."} onClick={onTest}>Test search</Button>}>
      <dl className="ds-facts" data-cols={2}>
        {([["Rule", rule.name], ["Location", [rule.scope.area, rule.scope.city, rule.scope.state].filter(Boolean).join(", ") || "All locations"], ["Service / categories", `${rule.service || "All"} · ${rule.categories?.join(" · ") || "All"}`], ["State", phaseOf(rule)], ["Priority", String(rule.priority)], ["Customer / payout", rule.kind === "pricing" ? `${adjText(rule.customer)} / ${adjText(rule.partner)}` : "Not applicable"], ["Reason", rule.reason]] as const).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <p className="text-[11px] text-faint mt-3">Test customer search to see the rule applied to a real route.</p>
    </Modal>
  );
}

function StatusSheet({ rule, to, onClose, onDone }: { rule: ServiceRule; to: "Enabled" | "Disabled" | "Removed"; onClose: () => void; onDone: (t: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verb = to === "Enabled" ? "Enable" : to === "Disabled" ? "Disable" : "Remove";
  return (
    <Modal title={`${verb} ${rule.name}`} onClose={onClose} busy={busy} footer={<><Button onClick={onClose}>Cancel</Button><Button variant={to === "Enabled" ? "primary" : "danger"} loading={busy} onClick={async () => {
      if (reason.trim().length < 5) return setError("Record the reason for the status change.");
      setBusy(true);
      try { await setRuleStatus(rule, to, reason.trim()); onDone(`${rule.name} ${to.toLowerCase()}.`); } catch (err) { setError(err instanceof Error ? err.message : "The status was not changed."); setBusy(false); }
    }}>Confirm {verb.toLowerCase()}</Button></>}>
      <p className="text-[13px] text-ink mb-1">{verb} this rule?</p>
      <p className="text-[12px] text-muted mb-3">{[rule.scope.area, rule.scope.city].filter(Boolean).join(", ") || "All locations"} · {rule.scope.side} · {summary(rule)}</p>
      {error && <div className="ds-error" role="alert">{error}</div>}
      <label className="ds-field"><span>Reason for status change</span><input className="ds-input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    </Modal>
  );
}

function HistorySheet({ rules, onClose }: { rules: ServiceRule[]; onClose: () => void }) {
  const rows = rules.flatMap((r) => (r.history ?? []).map((h) => ({ ...h, rule: r }))).sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0));
  const [open, setOpen] = useState<(typeof rows)[number] | null>(null);
  return (
    <Modal title="Change history" onClose={onClose} wide footNote="Read-only change history">
      <p className="text-[12px] text-muted mb-3">Who changed the setting, when it changed, and the recorded reason. Open View change for the original before / after values.</p>
      {rows.length === 0 ? <EmptyState /> : (
        <DataTable label="Change history" minWidth={820} hideTools hasActions>
          <thead><tr><th>DATE / TIME · IST</th><th>CHANGE / RECORD</th><th>REASON</th><th>STAFF / ID</th><th className="ds-actions">DETAILS</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{refDateTime(r.at?.toDate?.() ?? null)}</td><td><strong>{r.action}</strong><small>{r.rule.name} · {r.location || [r.rule.scope.area, r.rule.scope.city].filter(Boolean).join(", ") || "All locations"}</small></td><td>{r.reason}</td><td>{r.byName}{r.byUid && <small>{r.byUid.slice(0, 8)}</small>}</td><td className="ds-actions"><div><Button size="sm" onClick={() => setOpen(r)}>View change</Button></div></td></tr>)}</tbody>
        </DataTable>
      )}
      {open && <Modal title="View change" onClose={() => setOpen(null)}><dl className="ds-facts" data-cols={1}><div><dt>Before</dt><dd>{open.before || "—"}</dd></div><div><dt>After</dt><dd>{open.after || "—"}</dd></div><div><dt>Reason</dt><dd>{open.reason}</dd></div></dl></Modal>}
    </Modal>
  );
}

function LimitsSheet({ rules, canEdit, onAdd, onEdit, onStatus, onClose }: { rules: ServiceRule[]; canEdit: boolean; onAdd: () => void; onEdit: (r: ServiceRule) => void; onStatus: (r: ServiceRule, to: "Enabled" | "Disabled" | "Removed") => void; onClose: () => void }) {
  return (
    <Modal title="Fare limits" onClose={onClose} wide>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div><strong className="text-[15px] text-ink">Office &amp; authority fare limits</strong><p className="text-[12px] text-muted">Stops a new quote for rate review when a configured limit is breached.</p></div>
        {canEdit && <Button icon="plus" onClick={onAdd}>Add limit</Button>}
      </div>
      {rules.length === 0 ? <EmptyState title="No limits configured" hint="Add an office-approved limit or a verified state notification reference when applicable." /> : (
        <DataTable label="Fare limits" minWidth={760} hideTools hasActions>
          <thead><tr><th>LIMIT / REFERENCE</th><th>STATE / SERVICE / CATEGORY</th><th>CUSTOMER OR PARTNER</th><th>MINIMUM / MAXIMUM</th><th>STATUS</th>{canEdit && <th className="ds-actions">ACTIONS</th>}</tr></thead>
          <tbody>{rules.map((r) => <tr key={r.id}><td><strong>{r.name}</strong><small>{r.limit?.reference}</small></td><td>{[r.scope.area, r.scope.city, r.scope.state && GST_STATES.find(([c]) => c === r.scope.state)?.[1]].filter(Boolean).join(", ") || "All"} · {r.service || "All"} · {r.limit?.category}</td><td>{r.limit?.target}</td><td>₹{r.limit?.min} – ₹{r.limit?.max}</td><td><Badge tone={toneForStatus(phaseOf(r) === "Active" ? "Enabled" : phaseOf(r))}>{phaseOf(r) === "Active" ? "Enabled" : phaseOf(r)}</Badge></td>{canEdit && <td className="ds-actions"><div><Button size="sm" onClick={() => onEdit(r)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => onStatus(r, r.status === "Enabled" ? "Disabled" : "Enabled")}>{r.status === "Enabled" ? "Disable" : "Enable"}</Button><Button size="sm" variant="ghost" onClick={() => onStatus(r, "Removed")}>Remove</Button></div></td>}</tr>)}</tbody>
        </DataTable>
      )}
    </Modal>
  );
}

function TestFareSheet({ onClose }: { onClose: () => void }) {
  const data = useQuickData();
  const [trip, setTrip] = useState<QuickTrip>(emptyTrip);
  const [res, setRes] = useState<CategoryEstimate[] | null>(null);
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (e: FormEvent) => {
    e.preventDefault();
    const why = validateTrip(trip);
    if (why) return setError(why);
    setBusy(true);
    setError(null);
    const list = await estimateAll(trip, data.categories);
    setRes(list);
    setSel(list.find((x) => x.quote)?.category.id ?? "");
    setBusy(false);
  };
  const okCount = useMemo(() => res?.filter((r) => r.quote).length ?? 0, [res]);
  return (
    <Modal title="Test search · Shared availability & pricing" onClose={onClose} wide footNote="Uses the same rules as customer and office estimates." footer={<Button variant="primary" type="submit" form="test-fare" loading={busy}>Run test search</Button>}>
      <form id="test-fare" onSubmit={run} noValidate>
        {error && <div className="ds-error" role="alert"><Icon name="circle-alert" />{error}</div>}
        <p className="text-[12px] text-muted mb-3">Prices the trip with the same availability, cab type, schedule, fare rule and fare limit checks that customer and office bookings use. No booking or payment is created.</p>
        <TripFields trip={trip} set={(p) => setTrip((t) => ({ ...t, ...p }))} data={data} idPrefix="test-fare" />
      </form>
      {res && (
        <div className="mt-4">
          <p className="text-[12px] text-muted mb-2">{okCount} of {res.length} cab types available for this search. Hidden or paused types show the rule message.</p>
          <EstimateList estimates={res} selected={sel} onSelect={setSel} priceEntered="Excluding GST" />
        </div>
      )}
    </Modal>
  );
}
