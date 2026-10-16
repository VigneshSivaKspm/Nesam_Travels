import { useEffect, useState } from "react";
import { subscribeToDocument } from "../services/adminFirestoreService";
import { saveTariffConfig } from "../services/bookingOpsService";
import { ActionError } from "../services/callables";
import { useCan } from "./AccessContext";
import { Field, Notice, inputCls, primaryBtn, secondaryBtn } from "./FormKit";

interface Rates { [k: string]: number }
interface Zone { id: string; name: string; lat: number; lng: number; radiusKm: number }
interface Tariff {
  version?: number;
  enabled?: boolean;
  gstRate?: number;
  oneWay?: { minKm?: number; classes?: Record<string, Rates> };
  roundTrip?: { maxDays?: number; classes?: Record<string, Rates> };
  rental?: { classes?: Record<string, Rates> };
  cityDrop?: { baseKm?: number; zones?: Zone[]; classes?: Record<string, Rates> };
}

const CLASSES = ["sedan", "suv", "crysta"] as const;
const LABEL: Record<string, string> = { sedan: "Sedan", suv: "SUV / Innova", crysta: "Innova Crysta" };
const inr = (n: unknown) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—");

/**
 * The confirmed customer and normal-partner tariff (Tariff & Operations v2.0). Saved only through the
 * server, versioned and audited. Switching it on affects NEW bookings; a confirmed booking keeps the
 * pricing snapshot it was quoted with.
 */
export default function TariffConfigCard() {
  const canEdit = useCan("pricing");
  const [t, setT] = useState<Tariff | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [zone, setZone] = useState({ name: "", lat: "", lng: "", radius: "" });

  useEffect(() => subscribeToDocument<Tariff>("business_config/tariff_v2", setT, setLoadError), []);

  const zones = t?.cityDrop?.zones ?? [];
  const save = async (over: { enabled: boolean; zones?: Zone[] }) => {
    if (busy) return;
    if (reason.trim().length < 5) return setMsg({ tone: "error", text: "Give a short reason for the change." });
    setBusy(true);
    setMsg(null);
    try {
      const r = await saveTariffConfig({ useConfirmedDefaults: true, enabled: over.enabled, reason: reason.trim(), expectedVersion: t?.version ?? 0, cityDrop: { zones: over.zones ?? zones } });
      setMsg({ tone: "ok", text: `Saved as version ${r.version}. ${r.enabled ? "New bookings are priced by the confirmed tariff." : "The confirmed tariff is off; vehicle category fares apply."}` });
      setReason("");
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ActionError ? e.message : "The tariff was not saved." });
    } finally {
      setBusy(false);
    }
  };

  const addZone = () => {
    const lat = Number(zone.lat), lng = Number(zone.lng), r = Number(zone.radius);
    if (!zone.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || !(r > 0)) return setMsg({ tone: "error", text: "Enter the city name, its centre latitude / longitude and a radius in km." });
    const id = zone.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    void save({ enabled: t?.enabled === true, zones: [...zones.filter((z) => z.id !== id), { id, name: zone.name.trim(), lat, lng, radiusKm: r }] });
    setZone({ name: "", lat: "", lng: "", radius: "" });
  };

  return (
    <section className="bg-white rounded-xl border border-[#E5E5E5] p-5 space-y-4" aria-labelledby="tariff-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="tariff-h" className="text-[15px] font-bold text-[#111]">Confirmed tariff (customer and normal partner rates)</h2>
          <p className="text-sm text-[#555]">One-way (130 km floor + bata), round trip by Indian calendar day, local rental time fare and city-drop packages. Partner rates replace the older percentage commission for these duties.</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${t?.enabled ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-gray-100 text-gray-700 border-gray-300"}`}>
          {t === undefined ? "Loading…" : t?.enabled ? `On · v${t.version}` : "Off — category fares apply"}
        </span>
      </div>
      {loadError && <Notice tone="error">{loadError}</Notice>}

      {t && (
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <table className="w-full text-left">
            <caption className="text-xs font-semibold text-[#555] uppercase text-left mb-1">One-way (minimum {t.oneWay?.minKm ?? 130} km)</caption>
            <thead><tr className="text-xs text-[#555]"><th>Class</th><th>Customer /km</th><th>Bata</th><th>Partner /km</th><th>Bata</th></tr></thead>
            <tbody>{CLASSES.map((c) => { const r = t.oneWay?.classes?.[c]; return <tr key={c} className="border-t border-[#F0F0F0]"><td className="py-1 font-semibold">{LABEL[c]}</td><td>{inr(r?.customerRate)}</td><td>{inr(r?.customerBata)}</td><td>{inr(r?.partnerRate)}</td><td>{inr(r?.partnerBata)}</td></tr>; })}</tbody>
          </table>
          <table className="w-full text-left">
            <caption className="text-xs font-semibold text-[#555] uppercase text-left mb-1">Round trip (per calendar day)</caption>
            <thead><tr className="text-xs text-[#555]"><th>Class</th><th>Customer /km</th><th>Bata/day</th><th>Partner /km</th><th>Min km/day</th></tr></thead>
            <tbody>{CLASSES.map((c) => { const r = t.roundTrip?.classes?.[c]; return <tr key={c} className="border-t border-[#F0F0F0]"><td className="py-1 font-semibold">{LABEL[c]}</td><td>{inr(r?.customerRate)}</td><td>{inr(r?.customerBata)}</td><td>{inr(r?.partnerRate)}</td><td>{r?.minKmPerDay ?? "—"}</td></tr>; })}</tbody>
          </table>
        </div>
      )}

      <Notice tone="info">
        <div className="text-xs space-y-1">
          <div><strong>Not quoted as bookable (decision pending):</strong> local rental distance (D01/D02), state entry charges where a rate is missing (D06), same-day multi-city (D07), fixed-route zones (D08). Tax is configured separately (D04).</div>
          <div><strong>City drop:</strong> priced only inside a configured city zone ({zones.length ? zones.map((z) => z.name).join(", ") : "none configured, so local trips use vehicle category fares"}).</div>
        </div>
      </Notice>

      {canEdit ? (
        <div className="space-y-3">
          <Field label="Reason for this change" required><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="e.g. Confirmed rates of 09 Oct 2026" /></Field>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => save({ enabled: true })} className={primaryBtn}>{t?.enabled ? "Reload confirmed values (keep on)" : "Load confirmed values and turn on"}</button>
            {t?.enabled && <button disabled={busy} onClick={() => save({ enabled: false })} className={secondaryBtn}>Turn off</button>}
          </div>
          <details className="rounded-lg border border-[#E5E5E5] p-3">
            <summary className="text-sm font-semibold cursor-pointer">Add a city zone for local city-drop packages</summary>
            <div className="grid sm:grid-cols-4 gap-2 mt-2">
              <Field label="City"><input value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Centre latitude"><input value={zone.lat} onChange={(e) => setZone({ ...zone, lat: e.target.value })} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Centre longitude"><input value={zone.lng} onChange={(e) => setZone({ ...zone, lng: e.target.value })} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Radius (km)"><input value={zone.radius} onChange={(e) => setZone({ ...zone, radius: e.target.value })} inputMode="decimal" className={inputCls} /></Field>
            </div>
            <button disabled={busy} onClick={addZone} className={`${secondaryBtn} mt-2`}>Save zone</button>
          </details>
        </div>
      ) : (
        <p className="text-sm text-[#555]">Changing the tariff needs pricing access.</p>
      )}
      {msg && <Notice tone={msg.tone === "ok" ? "ok" : "error"}>{msg.text}</Notice>}
    </section>
  );
}
