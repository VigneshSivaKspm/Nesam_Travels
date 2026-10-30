import { useEffect, useMemo, useState } from "react";
import type { VehicleCategory } from "../types";
import { subscribeVehicleCategories } from "../services/adminFirestoreService";
import { saveTariffSection } from "../services/bookingOpsService";
import { ActionError } from "../services/callables";
import { useTariff, type ExtraChargeRow, type Tariff } from "../services/tariffService";
import { useCan } from "../components/AccessContext";
import { Field, Notice, inputCls, primaryBtn } from "../components/FormKit";
import { Button, EmptyState, PageHeader } from "../components/ui";

/**
 * Service & Fare Settings → Extra charges: "Waiting, hills & roof carrier".
 *
 * Reads and writes business_config/tariff_v2 → extraCharges, the one authoritative record (saveTariffSection, section
 * "extraCharges": pricing access, a stale-edit check against the tariff version, a required reason, audited, and the
 * section's own version counted on the server). Rows are the real vehicle categories, keyed by their ids. A blank box is
 * "not configured"; 0 is an explicit "no charge". A saved change only affects NEW quotes — a booking keeps the rates in its
 * own pricing snapshot.
 */

const CELLS = ["cWait", "pWait", "cHill", "pHill", "cCarrier", "pCarrier"] as const;
type Cell = (typeof CELLS)[number];
type Row = Record<Cell, string>;
interface Form { free: string; round: string; scope: string; tax: string; rows: Record<string, Row> }

const GROUPS: { title: string; unit: string; cells: [Cell, string][] }[] = [
  { title: "Waiting per hour", unit: "₹/hour", cells: [["cWait", "Customer"], ["pWait", "Partner"]] },
  { title: "Hill charge per trip", unit: "₹/trip", cells: [["cHill", "Customer"], ["pHill", "Partner"]] },
  { title: "Carrier charge per trip", unit: "₹/trip", cells: [["cCarrier", "Customer"], ["pCarrier", "Partner"]] },
];

const MAX_AMOUNT = 1_000_000;
const str = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const blank = (): Row => ({ cWait: "", pWait: "", cHill: "", pHill: "", cCarrier: "", pCarrier: "" });
const toNum = (s: string) => (s.trim() === "" ? NaN : Number(s));

function rowFrom(r?: ExtraChargeRow): Row {
  return {
    cWait: str(r?.customer?.waitingPerHour), pWait: str(r?.partner?.waitingPerHour),
    cHill: str(r?.customer?.hill), pHill: str(r?.partner?.hill),
    cCarrier: str(r?.customer?.carrier), pCarrier: str(r?.partner?.carrier),
  };
}
function formFrom(t: Tariff | null | undefined, ids: string[]): Form {
  const x = t?.extraCharges;
  return { free: str(x?.freeWaitingMinutes), round: str(x?.waitingRoundingMinutes), scope: x?.waitingRoundingScope ?? "", tax: x?.taxTreatment ?? "", rows: Object.fromEntries(ids.map((id) => [id, rowFrom(x?.categories?.[id])])) };
}
/** Comparable form: numbers, so "15.50" and "15.5" are the same value. */
const canon = (f: Form, ids: string[]) => JSON.stringify([
  f.free.trim() === "" ? null : toNum(f.free), f.round.trim() === "" ? null : toNum(f.round), f.scope, f.tax,
  ids.map((id) => CELLS.map((k) => { const v = (f.rows[id] ?? blank())[k]; return v.trim() === "" ? null : toNum(v); })),
]);

export default function ExtraCharges({ onBack }: { onBack: () => void }) {
  const canEdit = useCan("pricing");
  const { tariff: t, error: loadError } = useTariff();
  const [categories, setCategories] = useState<VehicleCategory[] | null>(null);
  const [catError, setCatError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ free: "", round: "", scope: "", tax: "", rows: {} });
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => subscribeVehicleCategories((c) => { setCategories(c); setCatError(null); }, setCatError), []);

  // Only active categories are priced here; saved rows of other categories are left untouched by the server.
  const active = useMemo(() => (categories ?? []).filter((c) => c.status === "Active").sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99) || a.name.localeCompare(b.name)), [categories]);
  const ids = useMemo(() => active.map((c) => c.id), [active]);
  const idsKey = ids.join("|");
  const ready = t !== undefined && categories !== null;
  const savedVersion = t?.version ?? 0;
  const saved = useMemo(() => canon(formFrom(t, ids), ids), [t, ids]);
  const dirty = ready && canon(form, ids) !== saved;

  // Load the saved values once, and again whenever the saved tariff or the category list moves on while nothing is being edited.
  const [loadedKey, setLoadedKey] = useState("");
  useEffect(() => {
    if (!ready) return;
    if (loadedVersion === null || (!dirty && (loadedVersion !== savedVersion || loadedKey !== idsKey))) {
      setForm(formFrom(t, ids));
      setLoadedVersion(savedVersion);
      setLoadedKey(idsKey);
    }
  }, [ready, t, ids, idsKey, dirty, loadedVersion, loadedKey, savedVersion]);
  const stale = loadedVersion !== null && loadedVersion !== savedVersion && dirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setCell = (id: string, k: Cell, v: string) => { setForm((f) => ({ ...f, rows: { ...f.rows, [id]: { ...(f.rows[id] ?? blank()), [k]: v } } })); setMsg(null); };
  const setGlobal = (patch: Partial<Pick<Form, "free" | "round" | "scope" | "tax">>) => { setForm((f) => ({ ...f, ...patch })); setMsg(null); };

  /** The same rules the server enforces; the server is still the authority. */
  const problem = useMemo((): string | null => {
    const free = toNum(form.free), round = toNum(form.round);
    if (!Number.isInteger(free) || free < 0 || free > 1440) return "Enter the free waiting per stop as whole minutes (0 to 1440).";
    if (!Number.isInteger(round) || round < 1 || round > 1440) return "Enter the chargeable waiting rounding interval as whole minutes (at least 1).";
    for (const c of active) {
      const r = form.rows[c.id] ?? blank();
      for (const g of GROUPS) for (const [k, who] of g.cells) {
        if (r[k].trim() === "") continue;
        const v = toNum(r[k]);
        if (!Number.isFinite(v) || v < 0) return `${c.name}: ${who.toLowerCase()} ${g.title.toLowerCase()} must be zero or more.`;
        if (v > MAX_AMOUNT) return `${c.name}: ${who.toLowerCase()} ${g.title.toLowerCase()} is too large.`;
      }
    }
    return null;
  }, [form, active]);

  const reasonOk = reason.trim().length >= 5;
  const locked = !canEdit || busy || !ready || !!loadError;
  const configured = !!t?.extraCharges;
  const anyRate = active.some((c) => t?.extraCharges?.categories?.[c.id]);

  const save = async () => {
    if (locked || busy) return;
    if (problem) return setMsg({ tone: "error", text: problem });
    if (!reasonOk) return setMsg({ tone: "error", text: "Give a short reason for the change." });
    if (stale) return setMsg({ tone: "error", text: "The tariff was changed by someone else. Reload and review it before saving." });
    const side = (r: Row, w: Cell, h: Cell, c: Cell) => ({
      waitingPerHour: r[w].trim() === "" ? null : toNum(r[w]), hill: r[h].trim() === "" ? null : toNum(r[h]), carrier: r[c].trim() === "" ? null : toNum(r[c]),
    });
    const categoriesData = Object.fromEntries(active.map((c) => {
      const r = form.rows[c.id] ?? blank();
      return [c.id, { customer: side(r, "cWait", "cHill", "cCarrier"), partner: side(r, "pWait", "pHill", "pCarrier") }];
    }));
    setBusy(true);
    setMsg(null);
    try {
      const r = await saveTariffSection({
        section: "extraCharges", expectedVersion: loadedVersion ?? 0, reason: reason.trim(),
        data: { freeWaitingMinutes: toNum(form.free), waitingRoundingMinutes: toNum(form.round), waitingRoundingScope: form.scope || null, taxTreatment: form.tax || null, categories: categoriesData },
      });
      setLoadedVersion(r.version);
      setReason("");
      setMsg({ tone: "ok", text: `Saved as charge version ${r.extraChargesVersion ?? "—"} (tariff version ${r.version}). New quotes use these charges; existing bookings keep the rates they were quoted with.` });
    } catch (e) {
      // The entered values stay in the form so nothing has to be typed again.
      setMsg({ tone: "error", text: e instanceof ActionError ? e.message : "The extra charges were not saved." });
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (busy) return;
    if (dirty && !window.confirm("Discard your unsaved extra-charge changes?")) return;
    onBack();
  };

  const chargeVersion = t?.extraCharges?.version;
  return (
    <div className="ds-page-body">
      <PageHeader
        title="Waiting, hills & roof carrier"
        subtitle="Charges outside the package, by vehicle category. Customer and Partner amounts are set separately."
        actions={<Button icon="arrow-left" onClick={goBack}>Back to Service &amp; Fare Settings</Button>}
      />
      <section className="ds-panel ds-panel-pad space-y-5" aria-labelledby="extra-h">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="extra-h" className="text-[16px] font-bold text-ink">Extra charges</h2>
            <p className="text-sm text-muted">A blank box means not configured. Enter 0 for an explicit &ldquo;no charge&rdquo;. A new version affects new quotes only.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-300">Unsaved changes</span>}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-gray-100 text-gray-700 border-gray-300">
              {!ready ? "Loading…" : chargeVersion ? `Charge version ${chargeVersion} · tariff version ${savedVersion}` : "Charge version: none saved yet"}
            </span>
          </div>
        </div>

        {(loadError || catError) && <Notice tone="error">{loadError ? `The saved charges could not be loaded: ${loadError}.` : `The vehicle categories could not be loaded: ${catError}.`} Check your pricing access and reload.</Notice>}
        {!ready && !loadError && !catError && <p className="text-[12px] text-muted" role="status">Loading the saved charges and vehicle categories…</p>}
        {stale && <Notice tone="warn">The tariff was changed by someone else (now version {savedVersion}). Your edits were made on version {loadedVersion}. <button type="button" className="underline font-semibold" onClick={() => { setForm(formFrom(t, ids)); setLoadedVersion(savedVersion); setMsg(null); }}>Discard my edits and reload</button></Notice>}
        {!canEdit && ready && <Notice tone="info">You can view the extra charges. Changing them needs pricing access.</Notice>}
        {ready && !configured && <Notice tone="info">Extra charges are not configured yet. Nothing is charged for waiting, hills or a roof carrier until rates are saved here.</Notice>}
        {ready && configured && !anyRate && active.length > 0 && <Notice tone="info">No charge is configured for any active vehicle category yet.</Notice>}

        {ready && active.length === 0 && !catError && (
          <EmptyState title="No active vehicle categories" hint="Activate or create a vehicle category (Cab types → Vehicle categories) before setting its extra charges." />
        )}

        {ready && active.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 max-w-[640px]">
              <Field label="Free waiting per stop" required hint="Minutes at each stop before waiting is charged. 0 = nothing is free.">
                <input type="number" inputMode="numeric" min={0} max={1440} step={1} value={form.free} disabled={locked} onChange={(e) => setGlobal({ free: e.target.value })} placeholder="Not configured" className={`${inputCls} tabular-nums`} />
              </Field>
              <Field label="Chargeable waiting rounding interval" required hint="Minutes. Chargeable waiting is rounded up to this interval.">
                <input type="number" inputMode="numeric" min={1} max={1440} step={1} value={form.round} disabled={locked} onChange={(e) => setGlobal({ round: e.target.value })} placeholder="Not configured" className={`${inputCls} tabular-nums`} />
              </Field>
              <Field label="Rounding applies" hint="Free waiting is always applied to each stop on its own. This chooses whether the interval then rounds each stop or the combined total. Not decided = approved waiting cannot be billed.">
                <select className={inputCls} value={form.scope} disabled={locked} onChange={(e) => setGlobal({ scope: e.target.value })}>
                  <option value="">Not decided</option>
                  <option value="per_stop">To each stop</option>
                  <option value="combined">To the combined chargeable waiting</option>
                </select>
              </Field>
              <Field label="Tax on extra charges" hint="Applies to what the customer is billed for approved extras. Not decided = approved extras cannot be billed.">
                <select className={inputCls} value={form.tax} disabled={locked} onChange={(e) => setGlobal({ tax: e.target.value })}>
                  <option value="">Not decided</option>
                  <option value="no_gst">Separate line, no GST added</option>
                  <option value="tariff_gst">Add the booking&rsquo;s own GST rate</option>
                </select>
              </Field>
            </div>

            <div className="overflow-auto max-h-[56vh] rounded-lg border border-line">
              <table className="w-full text-[12px]" style={{ minWidth: 860 }}>
                <caption className="sr-only">Waiting, hill and roof carrier charges by vehicle category</caption>
                <thead className="sticky top-0 z-10 bg-neutral-bg">
                  <tr>
                    <th scope="col" rowSpan={2} className="sticky left-0 z-20 bg-neutral-bg px-3 py-2 text-left text-[11px] font-semibold text-muted align-bottom min-w-[170px]">Vehicle category</th>
                    {GROUPS.map((g) => <th key={g.title} scope="colgroup" colSpan={2} className="px-2 pt-2 text-center text-[11px] font-semibold text-muted">{g.title}<span className="font-normal text-faint"> · {g.unit}</span></th>)}
                  </tr>
                  <tr>
                    {GROUPS.flatMap((g) => g.cells.map(([k, who]) => <th key={k} scope="col" className="px-2 pb-2 text-center text-[11px] font-semibold text-muted min-w-[112px]">{who}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((c) => (
                    <tr key={c.id} className="border-t border-line-soft">
                      <th scope="row" className="sticky left-0 bg-white px-3 py-1.5 text-left font-semibold text-ink">
                        {c.name}
                        <span className="block text-[11px] font-normal text-muted">{c.code || c.id}</span>
                      </th>
                      {GROUPS.flatMap((g) => g.cells.map(([k, who]) => (
                        <td key={k} className="px-2 py-1.5">
                          <input
                            type="number" inputMode="decimal" min={0} step="0.01" value={(form.rows[c.id] ?? blank())[k]} disabled={locked}
                            onChange={(e) => setCell(c.id, k, e.target.value)} aria-label={`${c.name} · ${who} ${g.title.toLowerCase()} (${g.unit})`}
                            placeholder="Not set" className={`${inputCls} w-[104px] tabular-nums`}
                          />
                        </td>
                      )))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-faint">Rows are your real vehicle categories. Categories that are inactive keep their saved charges and are not shown. When a charge is saved for a category it is the rate shown to customers for waiting, hill travel and roof carrier on that category&rsquo;s quotes.</p>

            <div className="grid gap-3 max-w-[640px]">
              <Field label="Reason for this change" required hint="Recorded with the new version.">
                <input value={reason} disabled={locked} maxLength={300} onChange={(e) => { setReason(e.target.value); setMsg(null); }} className={inputCls} placeholder="For example: revised waiting rates after review" />
              </Field>
              {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
              {problem && dirty && <p className="text-xs font-semibold text-bad" role="alert">{problem}</p>}
              <div>
                <button type="button" className={primaryBtn} disabled={locked || !dirty || !!problem || !reasonOk || stale} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save charge version"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
