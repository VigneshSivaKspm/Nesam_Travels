import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { MasterLocation, TravelService, VehicleCategory } from "../../types";
import { subscribeLocations, subscribeServices, subscribeVehicleCategories } from "../../services/adminFirestoreService";
import {
  bookableCategories, bookableLocations, emptyManualBooking, newRequestId, pointFromLocation, quoteAdminBooking,
  type FareQuote, type ManualBookingForm,
} from "../../services/adminBookingService";
import { ActionError } from "../../services/callables";
import { saveEnquiry, type Enquiry } from "../../services/enquiryService";
import MapLocationPicker, { type PickedPoint } from "../MapLocationPicker";
import { Modal } from "../Feedback";
import { Button, Icon } from "../ui";
import { FareBreakupCard } from "./Enquiries";
import { isoDateIST } from "../../utils/time";
import { refDateTime, rupee } from "../../domain/officeStage";
import { subscribeBusinessAccounts, type BusinessAccount } from "../../services/businessService";

/** The trip half of a booking: everything the estimate depends on, no customer details. */
export interface QuickTrip {
  businessId: string;
  serviceId: string;
  tripType: ManualBookingForm["tripType"] | "Local Rental" | "Airport Taxi";
  pickupText: string;
  dropText: string;
  pickup: PickedPoint | null;
  drop: PickedPoint | null;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  /** Extras & terms the office records with the booking. */
  hill: boolean;
  carrier: boolean;
  waitingMin: string;
  priceEntered: "Excluding GST" | "Including GST";
}

export const emptyTrip = (): QuickTrip => ({
  businessId: "", serviceId: "", tripType: "One Way", pickupText: "", dropText: "", pickup: null, drop: null,
  date: isoDateIST(new Date(Date.now() + 86400000)), time: "08:00", endDate: "", endTime: "20:00",
  hill: false, carrier: false, waitingMin: "0", priceEntered: "Excluding GST",
});

export interface CategoryEstimate {
  category: VehicleCategory;
  quote: FareQuote | null;
  error: string | null;
}

/** Local "YYYY-MM-DDTHH:mm" India time → the value the booking form expects. */
export const tripPickupAt = (t: QuickTrip) => (t.date && t.time ? `${t.date}T${t.time}` : "");
export const tripEndAt = (t: QuickTrip) => (t.tripType === "Round Trip" && t.endDate ? `${t.endDate}T${t.endTime || "20:00"}` : "");

/** The booking-form view of a trip (customer fields left empty for a quote). */
export function tripToForm(t: QuickTrip, categoryId: string, base: ManualBookingForm = emptyManualBooking()): ManualBookingForm {
  return {
    ...base,
    serviceId: t.serviceId,
    pickup: t.pickup,
    drop: t.drop,
    categoryId,
    tripType: t.tripType === "Round Trip" ? "Round Trip" : "One Way",
    pickupAt: tripPickupAt(t),
    tripEndAt: tripEndAt(t),
  };
}

/** Pickup instant shown on cards. Inputs are India time. */
export function tripPickupDate(t: QuickTrip): Date | null {
  const v = tripPickupAt(t);
  return v ? new Date(Date.parse(`${v}:00Z`) - 330 * 60000) : null;
}

export function useQuickData() {
  const [services, setServices] = useState<TravelService[]>([]);
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [business, setBusiness] = useState<BusinessAccount[]>([]);
  useEffect(() => {
    const u = [subscribeServices(setServices), subscribeLocations(setLocations), subscribeVehicleCategories(setCategories), subscribeBusinessAccounts(setBusiness, () => undefined)];
    return () => u.forEach((x) => x());
  }, []);
  const activeServices = useMemo(() => services.filter((s) => s.status === "Active" && s.adminBookingEnabled !== false), [services]);
  const pickups = useMemo(() => bookableLocations(locations, "pickup"), [locations]);
  const drops = useMemo(() => bookableLocations(locations, "drop"), [locations]);
  const cats = useMemo(() => bookableCategories(categories).sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)), [categories]);
  return { services: activeServices, pickups, drops, categories: cats, business: business.filter((b) => b.status === "Active") };
}
export type QuickData = ReturnType<typeof useQuickData>;

const locLabel = (l: MasterLocation) => [l.name, l.area && l.area !== l.name ? l.area : "", l.city && l.city !== l.name ? l.city : ""].filter(Boolean).join(", ");

/** Trip type implied by a service name (One Way / Round Trip / Local Rental / Airport). */
export function tripTypeForService(s?: TravelService): QuickTrip["tripType"] {
  const n = `${s?.name ?? ""} ${(s as { category?: string } | undefined)?.category ?? ""}`;
  if (/round/i.test(n)) return "Round Trip";
  if (/rental|hour/i.test(n)) return "Local Rental";
  if (/airport/i.test(n)) return "Airport Taxi";
  return "One Way";
}

export function validateTrip(t: QuickTrip): string | null {
  if (!t.pickup) return "Select the locations and calculate the route, or record an authorised manual distance with a reason.";
  if (!t.drop) return "Select the locations and calculate the route, or record an authorised manual distance with a reason.";
  if (!t.date || !t.time) return "Choose the pickup date and time.";
  const at = tripPickupDate(t);
  if (!at || at.getTime() < Date.now() + 30 * 60000) return "Pickup must be at least 30 minutes from now.";
  if (t.tripType === "Round Trip" && !t.endDate) return "Choose when the round trip ends.";
  return null;
}

/** One quote per bookable category, in parallel. Each category that cannot be priced carries its error. */
export async function estimateAll(t: QuickTrip, categories: VehicleCategory[]): Promise<CategoryEstimate[]> {
  return Promise.all(
    categories.map(async (category) => {
      try {
        const quote = await quoteAdminBooking(tripToForm(t, category.id), newRequestId());
        return { category, quote, error: null };
      } catch (e) {
        return { category, quote: null, error: e instanceof ActionError ? e.message : "This category could not be priced." };
      }
    }),
  );
}

/** Breakup lines of a quote, in the reference order. */
export function breakupLines(q: FareQuote): { label: string; amount: number }[] {
  const f = q.quote;
  const lines: { label: string; amount: number }[] = [];
  const base = (f.baseFare || 0) + (f.distanceFare || 0) + (f.timeFare || 0) + (f.minimumFareAdjustment || 0);
  if (base) lines.push({ label: "Base fare", amount: base });
  if (f.driverAllowance) lines.push({ label: "Driver allowance", amount: f.driverAllowance });
  if (f.nightCharge) lines.push({ label: "Night charge", amount: f.nightCharge });
  if (f.globalAdjustment?.amount) lines.push({ label: f.globalAdjustment.name || "Fare adjustment", amount: f.globalAdjustment.direction === "decrease" ? -f.globalAdjustment.amount : f.globalAdjustment.amount });
  if (f.discount) lines.push({ label: "Discount", amount: -f.discount });
  return lines;
}

const partnerPayoutOf = (q: FareQuote | null) => {
  const p = (q as { pricing?: { partner?: { basePaise?: number } | null } } | null)?.pricing?.partner;
  return p?.basePaise ? Math.round(p.basePaise) / 100 : null;
};
const includedKmOf = (q: FareQuote | null) => {
  const p = (q as { pricing?: { includedKm?: number; quotedKm?: number } } | null)?.pricing;
  return p?.includedKm || p?.quotedKm || Math.round(q?.quote.distanceKm ?? 0);
};
const extraKmRateOf = (q: FareQuote | null) => {
  const p = (q as { pricing?: { extraKmRatePaise?: number } } | null)?.pricing;
  return p?.extraKmRatePaise ? p.extraKmRatePaise / 100 : undefined;
};
export const estimateFacts = { partnerPayoutOf, includedKmOf, extraKmRateOf };

// ── Trip fields ───────────────────────────────────────────────────────────

export function TripFields({ trip, set, data, compact, idPrefix, action }: { trip: QuickTrip; set: (p: Partial<QuickTrip>) => void; data: QuickData; compact?: boolean; idPrefix: string; action?: ReactNode }) {
  const [pin, setPin] = useState<"pickup" | "drop" | null>(null);
  const pickByText = (text: string, list: MasterLocation[]) => list.find((l) => locLabel(l).toLowerCase() === text.trim().toLowerCase() || l.name.toLowerCase() === text.trim().toLowerCase());
  const today = isoDateIST(new Date());
  const tomorrow = isoDateIST(new Date(Date.now() + 86400000));
  const service = data.services.find((s) => s.id === trip.serviceId);
  return (
    <>
      <div className={compact ? "ds-quick-grid" : "ds-form-grid"}>
        <label className="ds-field" data-span={compact ? undefined : "2"}>
          <span>Service</span>
          <select className="ds-select" value={trip.serviceId} onChange={(e) => { const s = data.services.find((x) => x.id === e.target.value); set({ serviceId: e.target.value, tripType: tripTypeForService(s) }); }}>
            <option value="">Outstation · One Way</option>
            {data.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="ds-field">
          <span>{compact ? "Pickup" : "Pickup location *"}</span>
          <input className="ds-input" list={`${idPrefix}-pickups`} placeholder="City / area" value={trip.pickupText} onChange={(e) => {
            const l = pickByText(e.target.value, data.pickups);
            set({ pickupText: e.target.value, pickup: l ? pointFromLocation(l) : null });
          }} />
          <datalist id={`${idPrefix}-pickups`}>{data.pickups.map((l) => <option key={l.id} value={locLabel(l)} />)}</datalist>
        </label>
        <label className="ds-field">
          <span>{compact ? "Drop" : "Drop location *"}</span>
          <input className="ds-input" list={`${idPrefix}-drops`} placeholder="City / area" value={trip.dropText} onChange={(e) => {
            const l = pickByText(e.target.value, data.drops);
            set({ dropText: e.target.value, drop: l ? pointFromLocation(l) : null });
          }} />
          <datalist id={`${idPrefix}-drops`}>{data.drops.map((l) => <option key={l.id} value={locLabel(l)} />)}</datalist>
        </label>
        <label className="ds-field">
          <span>{compact ? "Pickup date" : "Pickup date *"}</span>
          <input className="ds-input" type="date" min={today} value={trip.date} onChange={(e) => set({ date: e.target.value })} />
          <span className="flex gap-3 text-[10px]">
            <button type="button" className="ds-link" style={{ fontSize: 10 }} onClick={() => set({ date: today })}>Today</button>
            <button type="button" className="ds-link" style={{ fontSize: 10 }} onClick={() => set({ date: tomorrow })}>Tomorrow</button>
          </span>
        </label>
        <label className="ds-field">
          <span>{compact ? "Time · IST" : "Pickup time *"}</span>
          <input className="ds-input" type="time" step={900} value={trip.time} onChange={(e) => set({ time: e.target.value })} />
        </label>
        {trip.tripType === "Round Trip" && (
          <>
            <label className="ds-field"><span>Return date *</span><input className="ds-input" type="date" min={trip.date || today} value={trip.endDate} onChange={(e) => set({ endDate: e.target.value })} /></label>
            <label className="ds-field"><span>Return time</span><input className="ds-input" type="time" step={900} value={trip.endTime} onChange={(e) => set({ endTime: e.target.value })} /></label>
          </>
        )}
        {action && <div className="ds-quick-action">{action}</div>}
      </div>
      <div className="ds-route-note">
        <span className="ds-dot" aria-hidden="true" />
        <div>
          <strong>{trip.pickup && trip.drop ? `${trip.pickup.name || trip.pickupText} → ${trip.drop.name || trip.dropText}` : "Choose pickup & drop"}</strong>
          <small>{trip.pickup && trip.drop ? "Road distance is calculated with the estimate." : `City + area suggestions · ${data.pickups.length} saved locations available`}</small>
        </div>
        {service && <small>{service.name}</small>}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-faint">
        <span className="flex items-center gap-1.5"><Icon name="map-pin" size={13} />Location boundaries</span>
        <button type="button" className="ds-link" style={{ fontSize: 11 }} onClick={() => setPin("pickup")}>Pickup pin{trip.pickup?.confirmed ? " ✓" : ""}</button>
        <button type="button" className="ds-link" style={{ fontSize: 11 }} onClick={() => setPin("drop")}>Drop pin{trip.drop?.confirmed ? " ✓" : ""}</button>
      </div>
      {pin && (
        <Modal title="Verify location pin" onClose={() => setPin(null)} size="lg" footer={<Button variant="primary" onClick={() => setPin(null)}>Use verified pin</Button>}>
          <p className="text-[12px] text-muted mb-3">The pin must represent the selected pickup / drop address. Saved rule matching uses these coordinates.</p>
          <p className="text-[12px] font-semibold text-ink mb-3">{pin === "pickup" ? "Pickup" : "Drop"} · {compact ? "Dashboard Quick fare" : "New booking"}</p>
          <MapLocationPicker
            label={pin === "pickup" ? "Pickup" : "Drop"}
            tone={pin}
            value={pin === "pickup" ? trip.pickup : trip.drop}
            startNear={pin === "drop" ? trip.pickup : null}
            onChange={(p) => (pin === "pickup" ? set({ pickup: p, pickupText: p?.name || p?.address || trip.pickupText }) : set({ drop: p, dropText: p?.name || p?.address || trip.dropText }))}
          />
        </Modal>
      )}
    </>
  );
}

/** Extras & terms the office records for the trip (hill, carrier, waiting). */
export function ExtrasFields({ trip, set }: { trip: QuickTrip; set: (p: Partial<QuickTrip>) => void }) {
  return (
    <>
      <div className="flex flex-wrap gap-5 mb-3">
        <label className="ds-check"><input type="checkbox" checked={trip.hill} onChange={(e) => set({ hill: e.target.checked })} />Hill travel</label>
        <label className="ds-check"><input type="checkbox" checked={trip.carrier} onChange={(e) => set({ carrier: e.target.checked })} />Roof carrier required</label>
      </div>
      <label className="ds-field" style={{ maxWidth: 280 }}>
        <span>Expected waiting · minutes</span>
        <input className="ds-input" type="number" min={0} step={15} value={trip.waitingMin} onChange={(e) => set({ waitingMin: e.target.value })} />
      </label>
    </>
  );
}

export const extrasNote = (t: QuickTrip) =>
  [t.hill ? "Hill travel" : "", t.carrier ? "Roof carrier required" : "", Number(t.waitingMin) > 0 ? `Expected waiting ${t.waitingMin} min` : ""].filter(Boolean).join(" · ");

// ── Estimate list ─────────────────────────────────────────────────────────

export function EstimateList({ estimates, selected, onSelect, priceEntered }: { estimates: CategoryEstimate[]; selected: string; onSelect: (id: string) => void; priceEntered: string }) {
  return (
    <div className="ds-estimates">
      {estimates.map(({ category, quote, error }) => {
        const on = category.id === selected;
        const seats = (category as { seatingCapacity?: number; seats?: number }).seatingCapacity ?? (category as { seats?: number }).seats;
        return (
          <div key={category.id} className="ds-estimate" data-on={on ? "true" : undefined}>
            <button type="button" className="ds-estimate-head" onClick={() => quote && onSelect(category.id)} disabled={!quote} aria-pressed={on}>
              <span className="ds-radio" aria-hidden="true">{on && <Icon name="check" size={12} />}</span>
              <span className="min-w-0">
                <strong>{category.name}</strong>
                <small>{seats ? `${seats} passengers · ` : ""}AC</small>
              </span>
              <span className="ds-estimate-km">{quote ? `${estimateFacts.includedKmOf(quote)} km included` : error}</span>
              <span className="ds-estimate-price">
                <strong>{quote ? rupee(quote.quote.total) : "—"}</strong>
                <small>Estimated total</small>
              </span>
              <span className="ds-estimate-pick">{on ? "Selected" : "Select"}<Icon name={on ? "chevron-up" : "chevron-down"} size={13} /></span>
            </button>
            {on && quote && (
              <div className="ds-estimate-body">
                <FareBreakupCard
                  vehicle={category.name}
                  lines={breakupLines(quote)}
                  total={quote.quote.total}
                  gstRate={quote.quote.gstRate ?? 0}
                  extraKm={estimateFacts.extraKmRateOf(quote)}
                  payout={estimateFacts.partnerPayoutOf(quote)}
                  priceEntered={priceEntered}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Save for follow-up ────────────────────────────────────────────────────

export function SaveEnquiryDialog({ trip, estimate, serviceName, onClose, onSaved }: {
  trip: QuickTrip;
  estimate: CategoryEstimate;
  serviceName: string;
  onClose: () => void;
  onSaved: (e: Enquiry) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [callback, setCallback] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = isoDateIST(new Date());
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (phone && !/^[6-9]\d{9}$/.test(digits)) return setError("Enter a 10-digit mobile number or leave it blank.");
    const q = estimate.quote!;
    setBusy(true);
    try {
      const at = tripPickupDate(trip);
      const { Timestamp } = await import("firebase/firestore");
      const saved = await saveEnquiry({
        pickup: trip.pickup?.address || trip.pickupText,
        drop: trip.drop?.address || trip.dropText,
        pickupPoint: trip.pickup, dropPoint: trip.drop,
        pickupAt: at ? Timestamp.fromDate(at) : null,
        serviceId: trip.serviceId, service: serviceName, tripType: trip.tripType === "Airport Taxi" ? "Airport" : trip.tripType,
        categoryId: estimate.category.id, vehicle: estimate.category.name,
        includedKm: estimateFacts.includedKmOf(q), extraKmRate: estimateFacts.extraKmRateOf(q),
        estimate: q.quote.total, breakup: breakupLines(q), gstRate: q.quote.gstRate ?? 0, payout: estimateFacts.partnerPayoutOf(q),
        customerName: name.trim(), phone: digits ? `+91${digits}` : "", whatsapp: digits ? `+91 ${digits}` : "",
        followUpAt: callback ? Timestamp.fromDate(new Date(callback)) : null,
        note: [note.trim(), extrasNote(trip)].filter(Boolean).join(" · "), source: "Phone",
        validUntil: Timestamp.fromDate(new Date(Date.now() + 86400000)),
        handler: null, nextAction: "", due: null, handoverNote: "",
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The enquiry was not saved.");
      setBusy(false);
    }
  };
  return (
    <Modal eyebrow="NESAM" title="Save enquiry for follow-up" onClose={onClose} busy={busy} footer={<Button variant="primary" type="submit" form="save-enquiry" loading={busy}>Save enquiry</Button>}>
      <form id="save-enquiry" onSubmit={save} className="grid gap-4" noValidate>
        {error && <div className="ds-error" role="alert"><Icon name="circle-alert" />{error}</div>}
        <div className="ds-sheet-card" style={{ marginBottom: 0 }}>
          <strong style={{ marginTop: 0 }}>{trip.pickup?.name || trip.pickupText} → {trip.drop?.name || trip.dropText}</strong>
          <small>Estimate {rupee(estimate.quote?.quote.total ?? null)}</small>
        </div>
        <label className="ds-field"><span>Callback mobile · optional</span><input className="ds-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="ds-field"><span>Customer name · optional</span><input className="ds-input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="ds-field">
          <span>Callback time · optional</span>
          <input className="ds-input" type="datetime-local" value={callback} onChange={(e) => setCallback(e.target.value)} />
          <span className="flex gap-3 text-[10px]">
            <button type="button" className="ds-link" style={{ fontSize: 10 }} onClick={() => setCallback(`${today}T${(callback.slice(11) || "11:00")}`)}>Today</button>
            <button type="button" className="ds-link" style={{ fontSize: 10 }} onClick={() => setCallback(`${isoDateIST(new Date(Date.now() + 86400000))}T${(callback.slice(11) || "11:00")}`)}>Tomorrow</button>
          </span>
        </label>
        <label className="ds-field"><span>Enquiry note</span><textarea className="ds-input" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <p className="text-[11px] text-faint">With a callback number this becomes a follow-up. Without a contact it is saved as a draft enquiry.</p>
      </form>
    </Modal>
  );
}

// ── Dashboard card ────────────────────────────────────────────────────────

export function QuickFareCard({ onProceed, onSaved }: { onProceed: (trip: QuickTrip, categoryId: string, estimates: CategoryEstimate[]) => void; onSaved: (e: Enquiry) => void }) {
  const data = useQuickData();
  const [trip, setTrip] = useState<QuickTrip>(emptyTrip);
  const [estimates, setEstimates] = useState<CategoryEstimate[] | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useRef("");
  const set = (p: Partial<QuickTrip>) => setTrip((t) => ({ ...t, ...p }));
  const sig = JSON.stringify([trip.serviceId, trip.pickup?.lat, trip.pickup?.lng, trip.drop?.lat, trip.drop?.lng, trip.date, trip.time, trip.endDate, trip.endTime]);
  const stale = estimates !== null && key.current !== sig;

  const estimate = async (e: FormEvent) => {
    e.preventDefault();
    const why = validateTrip(trip);
    if (why) return setError(why);
    setBusy(true);
    setError(null);
    const list = await estimateAll(trip, data.categories);
    key.current = sig;
    setEstimates(list);
    const first = list.find((x) => x.quote);
    setSelected(first?.category.id ?? "");
    if (!first) setError(list[0]?.error ?? "No vehicle category could be priced for this route.");
    setBusy(false);
  };
  const chosen = estimates?.find((x) => x.category.id === selected && x.quote);
  const first = chosen?.quote;
  const service = data.services.find((s) => s.id === trip.serviceId);

  return (
    <section className="ds-panel ds-quick" aria-labelledby="quick-fare-title">
      <div className="ds-section-head">
        <div>
          <span className="ds-eyebrow" style={{ color: "var(--color-brand-ink)" }}>PHONE ENQUIRY</span>
          <h2 id="quick-fare-title">Quick fare</h2>
          <p>Get the estimate first. Customer details follow when booking.</p>
        </div>
      </div>
      <form className="ds-section-body" onSubmit={estimate} noValidate>
        <div className="flex flex-wrap items-center gap-3 mb-4 text-[11px]">
          <label className="flex items-center gap-2 text-[11px] text-muted">Booking for
            <select className="ds-select" style={{ minHeight: 30, fontSize: 11 }} value={trip.businessId} onChange={(e) => set({ businessId: e.target.value })}>
              <option value="">Direct customer</option>
              {data.business.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <span className="text-[10px] text-info">{trip.businessId ? "Business account contract pricing applies on the booking" : "Existing direct-customer pricing and booking flow"}</span>
        </div>
        {error && <div className="ds-error" role="alert" style={{ marginBottom: 12 }}><Icon name="circle-alert" />{error}</div>}
        <TripFields trip={trip} set={set} data={data} compact idPrefix="dash-quick" action={<Button variant="primary" icon="calculator" type="submit" loading={busy}>Get estimate</Button>} />
        <details className="ds-disclosure">
          <summary>Trip details &amp; extras{first ? ` · ${estimateFacts.includedKmOf(first)} km` : ""}</summary>
          <ExtrasFields trip={trip} set={set} />
          <p className="text-[11px] text-faint mt-3">Toll, parking and state tax are extra at actuals.</p>
        </details>
        {estimates && !stale && (
          <div className="mt-4">
            {first && (
              <div className="flex flex-wrap gap-6 mb-3 text-[12px]">
                <span><strong className="text-ink text-[15px]">{Math.round(first.quote.distanceKm)} km</strong><br /><small className="text-faint">Road distance</small></span>
                <span><strong className="text-ink text-[15px]">{Math.floor(first.quote.durationMin / 60)}h {Math.round(first.quote.durationMin % 60)}m</strong><br /><small className="text-faint">Estimated travel time</small></span>
              </div>
            )}
            <h3 className="text-[13px] font-bold text-ink mb-2">Estimated fares {chosen ? `· ${rupee(chosen.quote!.quote.total)} selected · ${chosen.category.name}` : ""}</h3>
            <EstimateList estimates={estimates} selected={selected} onSelect={setSelected} priceEntered={trip.priceEntered} />
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button variant="primary" icon="circle-check" disabled={!chosen} onClick={() => onProceed(trip, selected, estimates)}>Proceed to booking</Button>
              <Button icon="phone-forwarded" disabled={!chosen} onClick={() => setSaving(true)}>Save for follow-up</Button>
              <span className="text-[11px] text-faint ml-auto">Name / mobile are requested after the estimate.</span>
            </div>
          </div>
        )}
        {stale && <p className="text-[11px] text-warn mt-3">The trip changed. Get the estimate again.</p>}
      </form>
      {saving && chosen && (
        <SaveEnquiryDialog trip={trip} estimate={chosen} serviceName={service?.name || "Outstation · One Way"} onClose={() => setSaving(false)} onSaved={(e) => { setSaving(false); onSaved(e); }} />
      )}
    </section>
  );
}

export const refPickupLabel = (t: QuickTrip) => {
  const d = tripPickupDate(t);
  return d ? refDateTime(d) : "";
};
