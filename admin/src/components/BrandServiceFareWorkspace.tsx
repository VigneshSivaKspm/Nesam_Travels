import { useEffect, useMemo, useRef, useState } from "react";
import {
  BRANDS,
  BRAND_LABELS,
  BRAND_SUPPORTED_SERVICES,
  BrandFareOverride,
  BrandId,
  CLASS_LABEL,
  DEFAULT_RENTAL_MIN_HOURS,
  RENTAL_HOURS,
  RateValue,
  TARIFF_CLASSES,
  Tariff,
  TariffClass,
  WORKSPACE_SERVICES,
  WorkspaceService,
  getInheritingBrands,
  inr,
  outstationExtraFor,
  resolveRate,
  useTariff,
} from "../services/tariffService";
import { saveTariffSection } from "../services/bookingOpsService";
import { ActionError } from "../services/callables";
import { useCan } from "./AccessContext";
import { Badge, Button, Icon, PageHeader } from "./ui";
import { Modal, Toast, useToast } from "./Feedback";

type ScopeBrand = "common" | BrandId;

interface FormFields {
  customerRate: string;
  partnerRate: string;
  customerBase: string;
  partnerBase: string;
  minKm: string;
  minKmPerDay: string;
  customerBata: string;
  partnerBata: string;
  extraKmRate: string;
  waitingPerHour: string;
  hillCharge: string;
  carrierCharge: string;
  minRentalHours: string;
  rentalCustomerFare: Record<number, string>;
  rentalPartnerPayout: Record<number, string>;
  rentalIncludedKm: Record<number, string>;
  rentalExtraKm: Record<number, string>;
  rentalExtraHour: Record<number, string>;
}

const emptyForm = (): FormFields => ({
  customerRate: "",
  partnerRate: "",
  customerBase: "",
  partnerBase: "",
  minKm: "",
  minKmPerDay: "",
  customerBata: "",
  partnerBata: "",
  extraKmRate: "",
  waitingPerHour: "",
  hillCharge: "",
  carrierCharge: "",
  minRentalHours: "",
  rentalCustomerFare: {},
  rentalPartnerPayout: {},
  rentalIncludedKm: {},
  rentalExtraKm: {},
  rentalExtraHour: {},
});

const str = (v: unknown): string => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const toNumOrNull = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export default function BrandServiceFareWorkspace() {
  const canEdit = useCan("pricing");
  const { tariff: t, error: loadError } = useTariff();
  const { toast, show: showToast } = useToast(6000);

  // Scope hierarchy selection
  const [selectedBrand, setSelectedBrand] = useState<ScopeBrand>("common");
  const [selectedService, setSelectedService] = useState<WorkspaceService>("One Way");
  const [selectedClass, setSelectedClass] = useState<TariffClass>("sedan");

  // Form edit state
  const [form, setForm] = useState<FormFields>(emptyForm);
  const scopeBaseline = useRef<string>("");
  const [busy, setBusy] = useState(false);

  // Save Confirmation Modal
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [saveReason, setSaveReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Supported services for currently selected brand
  const availableServices = useMemo<readonly WorkspaceService[]>(() => {
    if (selectedBrand === "common") return WORKSPACE_SERVICES;
    return BRAND_SUPPORTED_SERVICES[selectedBrand] ?? WORKSPACE_SERVICES;
  }, [selectedBrand]);

  // Adjust selected service if unsupported for brand
  useEffect(() => {
    if (!availableServices.includes(selectedService)) {
      setSelectedService(availableServices[0] ?? "One Way");
    }
  }, [availableServices, selectedService]);

  // Helper to load form values from current tariff for selected scope
  const loadScopeValues = (
    tariff: Tariff | null | undefined,
    brand: ScopeBrand,
    svc: WorkspaceService,
    cls: TariffClass
  ): FormFields => {
    const f = emptyForm();
    if (!tariff) return f;

    const commonOW = tariff.oneWay?.classes?.[cls];
    const commonRT = tariff.roundTrip?.classes?.[cls];
    const commonExtras = svc === "One Way" ? outstationExtraFor(tariff, cls, "One Way") : tariff.outstationExtras?.[cls];
    const commonAirport = tariff.airport;
    const commonExtraCharges = tariff.extraCharges?.categories?.[`cat-${cls}`] || tariff.extraCharges?.categories?.[cls];

    if (brand === "common") {
      f.minKm = str(tariff.oneWay?.minKm) || "130";
      f.customerRate = str(commonOW?.customerRate);
      f.partnerRate = str(commonOW?.partnerRate);
      f.customerBata = str(commonOW?.customerBata);
      f.partnerBata = str(commonOW?.partnerBata);
      f.extraKmRate = str(commonExtras?.extraKmRate);
      f.waitingPerHour = str(commonExtras?.waitingPerHour);

      f.customerBase = str(commonAirport?.customerBase);
      f.partnerBase = str(commonAirport?.partnerBase);

      f.minKmPerDay = str(commonRT?.minKmPerDay) || "300";
      f.hillCharge = str(commonExtraCharges?.customer?.hill);
      f.carrierCharge = str(commonExtraCharges?.customer?.carrier);

      const pkgCfg = tariff.rentalPackages?.[cls];
      f.minRentalHours = str(pkgCfg?.minHours ?? DEFAULT_RENTAL_MIN_HOURS[cls]);
      for (const h of RENTAL_HOURS) {
        const p = pkgCfg?.packages?.[String(h)];
        f.rentalCustomerFare[h] = str(p?.customerFare);
        f.rentalPartnerPayout[h] = str(p?.partnerPayout);
        f.rentalIncludedKm[h] = str(p?.includedKm);
        f.rentalExtraKm[h] = str(p?.extraKmRate);
        f.rentalExtraHour[h] = str(p?.extraHourRate);
      }
    } else {
      const ov = tariff.brandOverrides?.[brand]?.[svc]?.[cls];
      if (ov) {
        f.customerRate = str(ov.customerRate);
        f.partnerRate = str(ov.partnerRate);
        f.customerBase = str(ov.customerBase);
        f.partnerBase = str(ov.partnerBase);
        f.minKm = str(ov.minKm);
        f.minKmPerDay = str(ov.minKmPerDay);
        f.customerBata = str(ov.customerBata);
        f.partnerBata = str(ov.partnerBata);
        f.extraKmRate = str(ov.extraKmRate);
        f.waitingPerHour = str(ov.waitingPerHour);
        f.hillCharge = str(ov.hillCharge);
        f.carrierCharge = str(ov.carrierCharge);
        f.minRentalHours = str(ov.minRentalHours);
        if (ov.rentalPackages) {
          for (const h of RENTAL_HOURS) {
            const p = ov.rentalPackages[String(h)];
            f.rentalCustomerFare[h] = str(p?.customerFare);
            f.rentalPartnerPayout[h] = str(p?.partnerPayout);
            f.rentalIncludedKm[h] = str(p?.includedKm);
            f.rentalExtraKm[h] = str(p?.extraKmRate);
            f.rentalExtraHour[h] = str(p?.extraHourRate);
          }
        }
      }
    }
    return f;
  };

  const serializeForm = (f: FormFields): string => JSON.stringify(f);

  // Initialize or re-sync form when tariff or scope changes
  useEffect(() => {
    if (t === undefined) return;
    const loaded = loadScopeValues(t, selectedBrand, selectedService, selectedClass);
    setForm(loaded);
    scopeBaseline.current = serializeForm(loaded);
  }, [t, selectedBrand, selectedService, selectedClass]);

  const isDirty = useMemo(() => serializeForm(form) !== scopeBaseline.current, [form]);

  // Safe scope navigation guard: prevents discarding unsaved edits
  const handleScopeChange = (nextBrand: ScopeBrand, nextService: WorkspaceService, nextClass: TariffClass) => {
    if (isDirty) {
      const scopeName = `${selectedBrand === "common" ? "Common" : BRAND_LABELS[selectedBrand]} → ${selectedService} → ${CLASS_LABEL[selectedClass]}`;
      const confirmed = window.confirm(`You have unsaved changes in ${scopeName}. Discard them to switch scope?`);
      if (!confirmed) return;
    }
    setSelectedBrand(nextBrand);
    setSelectedService(nextService);
    setSelectedClass(nextClass);
  };

  // Field change handler
  const setField = (key: keyof Omit<FormFields, "rentalCustomerFare" | "rentalPartnerPayout" | "rentalIncludedKm" | "rentalExtraKm" | "rentalExtraHour">, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const setRentalField = (hour: number, field: "customerFare" | "partnerPayout" | "includedKm" | "extraKm" | "extraHour", val: string) => {
    setForm((prev) => {
      const mapKey = field === "customerFare" ? "rentalCustomerFare"
        : field === "partnerPayout" ? "rentalPartnerPayout"
        : field === "includedKm" ? "rentalIncludedKm"
        : field === "extraKm" ? "rentalExtraKm"
        : "rentalExtraHour";
      return {
        ...prev,
        [mapKey]: { ...prev[mapKey], [hour]: val },
      };
    });
  };

  // Revert / Clear override
  const handleClearOverride = (field: keyof Omit<FormFields, "rentalCustomerFare" | "rentalPartnerPayout" | "rentalIncludedKm" | "rentalExtraKm" | "rentalExtraHour">) => {
    setField(field, "");
  };

  // Compute common baseline reference values for comparison
  const commonOW = t?.oneWay?.classes?.[selectedClass];
  const commonRT = t?.roundTrip?.classes?.[selectedClass];
  const commonExtras = selectedService === "One Way" ? outstationExtraFor(t, selectedClass, "One Way") : t?.outstationExtras?.[selectedClass];
  const commonAirport = t?.airport;
  const commonExtraCharges = t?.extraCharges?.categories?.[`cat-${selectedClass}`] || t?.extraCharges?.categories?.[selectedClass];

  // Helper for single field effective evaluation
  const evalField = (field: keyof BrandFareOverride, commonVal: number | undefined): RateValue => {
    return resolveRate(t, selectedBrand, selectedService, selectedClass, field, commonVal);
  };

  // Save execution
  const executeSave = async () => {
    if (!canEdit || busy || t === undefined) return;
    if (saveReason.trim().length < 5) {
      setSaveError("Please provide a short change reason (at least 5 characters) for audit tracking.");
      return;
    }

    setBusy(true);
    setSaveError(null);

    try {
      if (selectedBrand === "common") {
        // Saving Common rate updates the baseline section
        const classesPayload: Record<string, unknown> = {};
        for (const cls of TARIFF_CLASSES) {
          const isTarget = cls === selectedClass;
          const ow = t?.oneWay?.classes?.[cls];
          const rt = t?.roundTrip?.classes?.[cls];
          const x = selectedService === "One Way" ? outstationExtraFor(t, cls, "One Way") : t?.outstationExtras?.[cls];

          const cOW = isTarget ? toNumOrNull(form.customerRate) ?? ow?.customerRate ?? 15 : ow?.customerRate ?? 15;
          const pOW = isTarget ? toNumOrNull(form.partnerRate) ?? ow?.partnerRate ?? 13.5 : ow?.partnerRate ?? 13.5;
          const cAllowOW = isTarget ? toNumOrNull(form.customerBata) ?? ow?.customerBata ?? 400 : ow?.customerBata ?? 400;
          const pAllowOW = isTarget ? toNumOrNull(form.partnerBata) ?? ow?.partnerBata ?? 300 : ow?.partnerBata ?? 300;

          const cRT = isTarget && selectedService === "Multicity" ? toNumOrNull(form.customerRate) ?? rt?.customerRate ?? 15 : rt?.customerRate ?? 15;
          const pRT = isTarget && selectedService === "Multicity" ? toNumOrNull(form.partnerRate) ?? rt?.partnerRate ?? 13.5 : rt?.partnerRate ?? 13.5;
          const cAllowRT = isTarget && selectedService === "Multicity" ? toNumOrNull(form.customerBata) ?? rt?.customerBata ?? 400 : rt?.customerBata ?? 400;
          const pAllowRT = isTarget && selectedService === "Multicity" ? toNumOrNull(form.partnerBata) ?? rt?.partnerBata ?? 300 : rt?.partnerBata ?? 300;
          const rtMin = isTarget && selectedService === "Multicity" ? toNumOrNull(form.minKmPerDay) ?? rt?.minKmPerDay ?? 300 : rt?.minKmPerDay ?? 300;

          const extraKm = isTarget ? toNumOrNull(form.extraKmRate) ?? x?.extraKmRate ?? cOW : x?.extraKmRate ?? cOW;
          const waiting = isTarget ? toNumOrNull(form.waitingPerHour) ?? x?.waitingPerHour ?? 0 : x?.waitingPerHour ?? 0;

          classesPayload[cls] = {
            oneWay: { customerRate: cOW, partnerRate: pOW, customerBata: cAllowOW, partnerBata: pAllowOW },
            roundTrip: { customerRate: cRT, partnerRate: pRT, customerBata: cAllowRT, partnerBata: pAllowRT, minKmPerDay: rtMin },
            ...(selectedService === "One Way"
              ? { oneWayExtra: { extraKmRate: extraKm, waitingPerHour: waiting } }
              : { outstationExtra: { extraKmRate: extraKm, waitingPerHour: waiting } }),
          };
        }

        const airC = selectedService === "Airport Taxi" && form.customerBase.trim() ? Number(form.customerBase) : t?.airport?.customerBase;
        const airP = selectedService === "Airport Taxi" && form.partnerBase.trim() ? Number(form.partnerBase) : t?.airport?.partnerBase;

        await saveTariffSection({
          section: "baseRates",
          expectedVersion: t?.version ?? 0,
          reason: saveReason.trim(),
          data: {
            oneWayMinKm: selectedService === "One Way" && form.minKm.trim() ? Number(form.minKm) : t?.oneWay?.minKm ?? 130,
            ...(airC && airP ? { airport: { customerBase: airC, partnerBase: airP } } : {}),
            classes: classesPayload,
          },
        });
      } else {
        // Saving a Brand Override for the selected Brand -> Service -> Category
        const overrideData: Record<string, unknown> = {};

        if (form.customerRate.trim()) overrideData.customerRate = Number(form.customerRate);
        if (form.partnerRate.trim()) overrideData.partnerRate = Number(form.partnerRate);
        if (form.customerBase.trim()) overrideData.customerBase = Number(form.customerBase);
        if (form.partnerBase.trim()) overrideData.partnerBase = Number(form.partnerBase);
        if (form.minKm.trim()) overrideData.minKm = Number(form.minKm);
        if (form.minKmPerDay.trim()) overrideData.minKmPerDay = Number(form.minKmPerDay);
        if (form.customerBata.trim()) overrideData.customerBata = Number(form.customerBata);
        if (form.partnerBata.trim()) overrideData.partnerBata = Number(form.partnerBata);
        if (form.extraKmRate.trim()) overrideData.extraKmRate = Number(form.extraKmRate);
        if (form.waitingPerHour.trim()) overrideData.waitingPerHour = Number(form.waitingPerHour);
        if (form.hillCharge.trim()) overrideData.hillCharge = Number(form.hillCharge);
        if (form.carrierCharge.trim()) overrideData.carrierCharge = Number(form.carrierCharge);
        if (form.minRentalHours.trim()) overrideData.minRentalHours = Number(form.minRentalHours);

        if (selectedService === "Local Rental") {
          const rentalPkgs: Record<string, unknown> = {};
          for (const h of RENTAL_HOURS) {
            const cFare = form.rentalCustomerFare[h]?.trim();
            const pPayout = form.rentalPartnerPayout[h]?.trim();
            const incKm = form.rentalIncludedKm[h]?.trim();
            const exKm = form.rentalExtraKm[h]?.trim();
            const exHr = form.rentalExtraHour[h]?.trim();

            if (cFare || pPayout || incKm || exKm || exHr) {
              rentalPkgs[String(h)] = {
                ...(cFare ? { customerFare: Number(cFare) } : {}),
                ...(pPayout ? { partnerPayout: Number(pPayout) } : {}),
                ...(incKm ? { includedKm: Number(incKm) } : {}),
                ...(exKm ? { extraKmRate: Number(exKm) } : {}),
                ...(exHr ? { extraHourRate: Number(exHr) } : {}),
              };
            }
          }
          if (Object.keys(rentalPkgs).length) {
            overrideData.rentalPackages = rentalPkgs;
          }
        }

        const isClearingAll = Object.keys(overrideData).length === 0;

        await saveTariffSection({
          section: "brandOverride",
          brand: selectedBrand,
          service: selectedService,
          class: selectedClass,
          expectedVersion: t?.version ?? 0,
          reason: saveReason.trim(),
          clearOverride: isClearingAll,
          data: overrideData,
        });
      }

      setConfirmSaveOpen(false);
      setSaveReason("");
      showToast(`Successfully saved fare settings for ${scopeSummary}. New quotes immediately use these rates.`);
    } catch (err) {
      setSaveError(err instanceof ActionError ? err.message : "Failed to save settings. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const scopeSummary = `${selectedBrand === "common" ? "Common (Shared Baseline)" : BRAND_LABELS[selectedBrand]} → ${selectedService} → ${CLASS_LABEL[selectedClass]}`;
  const brandOverrideActive = selectedBrand !== "common" && !!t?.brandOverrides?.[selectedBrand]?.[selectedService]?.[selectedClass];

  return (
    <div className="ds-fare-workspace">
      <Toast toast={toast} />

      {loadError && (
        <div className="ds-error mb-4" role="alert">
          <Icon name="circle-alert" /> Tariff configuration could not be loaded: {loadError}
        </div>
      )}

      {/* Scope Selector Header */}
      <section className="ds-panel ds-panel-pad mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <span className="ds-eyebrow">FARE MANAGEMENT WORKSPACE</span>
            <h2 className="text-[18px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Brand &amp; Service Fare Settings
            </h2>
            <p className="text-[12px] text-muted">
              Select Brand, Supported Service, and Vehicle Category to manage customer rates, partner payouts and allowances.
            </p>
          </div>
          {isDirty && (
            <Badge tone="amber">
              <Icon name="clock" size={14} /> Unsaved changes in current scope
            </Badge>
          )}
        </div>

        {/* 1. Brand Hierarchy */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
            1. Select Brand
          </label>
          <div className="ds-chip-row">
            <Button
              size="sm"
              variant={selectedBrand === "common" ? "primary" : "secondary"}
              onClick={() => handleScopeChange("common", selectedService, selectedClass)}
            >
              <Icon name="layers-2" size={14} /> Common Baseline (Shared)
            </Button>
            {BRANDS.map((b) => (
              <Button
                key={b.id}
                size="sm"
                variant={selectedBrand === b.id ? "primary" : "secondary"}
                onClick={() => handleScopeChange(b.id, selectedService, selectedClass)}
              >
                {b.name}
              </Button>
            ))}
          </div>
        </div>

        {/* 2. Service Hierarchy */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
            2. Select Supported Service
          </label>
          <div className="ds-chip-row">
            {availableServices.map((svc) => (
              <Button
                key={svc}
                size="sm"
                variant={selectedService === svc ? "primary" : "secondary"}
                onClick={() => handleScopeChange(selectedBrand, svc, selectedClass)}
              >
                {svc}
              </Button>
            ))}
          </div>
          {/* Business constraint guidance note */}
          <p className="text-[11px] text-faint mt-1.5">
            Multi-stop itineraries and tour packages are managed under <strong>Multicity</strong>. (Round Trip is not an offered service in this workspace).
          </p>
        </div>

        {/* 3. Category Hierarchy */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
            3. Select Vehicle Category
          </label>
          <div className="ds-chip-row">
            {TARIFF_CLASSES.map((cls) => (
              <Button
                key={cls}
                size="sm"
                variant={selectedClass === cls ? "primary" : "secondary"}
                onClick={() => handleScopeChange(selectedBrand, selectedService, cls)}
              >
                {CLASS_LABEL[cls]}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Persistent Scope Summary Banner */}
      <div className="ds-panel ds-panel-pad mb-4 bg-slate-50 border-l-4 border-l-brand flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-bold uppercase tracking-wider text-muted">Active Scope:</span>
          <span className="text-[15px] font-black text-ink">{scopeSummary}</span>
          {selectedBrand === "common" ? (
            <Badge tone="neutral">Common Baseline</Badge>
          ) : brandOverrideActive ? (
            <Badge tone="blue">Brand Override Active</Badge>
          ) : (
            <Badge tone="neutral">Inheriting Common Baseline</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="primary"
              disabled={!isDirty || busy}
              onClick={() => setConfirmSaveOpen(true)}
            >
              <Icon name="check" size={14} /> Save {selectedBrand === "common" ? "Common Rates" : "Brand Overrides"}
            </Button>
          )}
        </div>
      </div>

      {/* Scope Editor Controls */}
      <section className="ds-panel ds-panel-pad">
        <h3 className="text-[16px] font-bold text-ink mb-1">
          {selectedService} Rates for {CLASS_LABEL[selectedClass]}
        </h3>
        <p className="text-[12px] text-muted mb-4">
          {selectedBrand === "common"
            ? "Editing Common rates sets the fallback baseline for all brands."
            : `Set brand-specific overrides for ${BRAND_LABELS[selectedBrand]}. Unset fields cleanly inherit from Common rates.`}
        </p>

        {/* SERVICE-SPECIFIC CONTROLS */}
        {selectedService === "One Way" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RateField
              label="Customer Fare Rate"
              unit="₹/km"
              value={form.customerRate}
              commonValue={commonOW?.customerRate}
              resolved={evalField("customerRate", commonOW?.customerRate)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("customerRate", v)}
              onClear={() => handleClearOverride("customerRate")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="customerRate"
            />
            <RateField
              label="Partner Payout Rate"
              unit="₹/km"
              value={form.partnerRate}
              commonValue={commonOW?.partnerRate}
              resolved={evalField("partnerRate", commonOW?.partnerRate)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("partnerRate", v)}
              onClear={() => handleClearOverride("partnerRate")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="partnerRate"
            />
            <RateField
              label="Minimum Billable Distance"
              unit="km"
              value={form.minKm}
              commonValue={t?.oneWay?.minKm ?? 130}
              resolved={evalField("minKm", t?.oneWay?.minKm ?? 130)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("minKm", v)}
              onClear={() => handleClearOverride("minKm")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="minKm"
            />
            <RateField
              label="Customer Allowance (Driver Bata)"
              unit="₹/trip"
              value={form.customerBata}
              commonValue={commonOW?.customerBata}
              resolved={evalField("customerBata", commonOW?.customerBata)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("customerBata", v)}
              onClear={() => handleClearOverride("customerBata")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="customerBata"
              zeroAllowed
            />
            <RateField
              label="Partner Allowance (Driver Bata)"
              unit="₹/trip"
              value={form.partnerBata}
              commonValue={commonOW?.partnerBata}
              resolved={evalField("partnerBata", commonOW?.partnerBata)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("partnerBata", v)}
              onClear={() => handleClearOverride("partnerBata")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="partnerBata"
              zeroAllowed
            />
            <RateField
              label="Extra Kilometre Charge"
              unit="₹/km"
              value={form.extraKmRate}
              commonValue={commonExtras?.extraKmRate ?? commonOW?.customerRate}
              resolved={evalField("extraKmRate", commonExtras?.extraKmRate ?? commonOW?.customerRate)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("extraKmRate", v)}
              onClear={() => handleClearOverride("extraKmRate")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="extraKmRate"
            />
            <RateField
              label="Waiting Charge"
              unit="₹/hour"
              value={form.waitingPerHour}
              commonValue={commonExtras?.waitingPerHour ?? 0}
              resolved={evalField("waitingPerHour", commonExtras?.waitingPerHour ?? 0)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("waitingPerHour", v)}
              onClear={() => handleClearOverride("waitingPerHour")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="waitingPerHour"
              zeroAllowed
            />
            <RateField
              label="Hill Station Charge"
              unit="₹/trip"
              value={form.hillCharge}
              commonValue={commonExtraCharges?.customer?.hill}
              resolved={evalField("hillCharge", commonExtraCharges?.customer?.hill)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("hillCharge", v)}
              onClear={() => handleClearOverride("hillCharge")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="hillCharge"
              zeroAllowed
            />
            <RateField
              label="Roof Carrier Charge"
              unit="₹/trip"
              value={form.carrierCharge}
              commonValue={commonExtraCharges?.customer?.carrier}
              resolved={evalField("carrierCharge", commonExtraCharges?.customer?.carrier)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("carrierCharge", v)}
              onClear={() => handleClearOverride("carrierCharge")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="carrierCharge"
              zeroAllowed
            />
          </div>
        )}

        {selectedService === "Airport Taxi" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RateField
              label="Airport Customer Base Fare"
              unit="₹ base"
              value={form.customerBase}
              commonValue={commonAirport?.customerBase}
              resolved={evalField("customerBase", commonAirport?.customerBase)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("customerBase", v)}
              onClear={() => handleClearOverride("customerBase")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="customerBase"
            />
            <RateField
              label="Airport Partner Base Payout"
              unit="₹ base"
              value={form.partnerBase}
              commonValue={commonAirport?.partnerBase}
              resolved={evalField("partnerBase", commonAirport?.partnerBase)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("partnerBase", v)}
              onClear={() => handleClearOverride("partnerBase")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="partnerBase"
            />
            <RateField
              label="Extra Kilometre Rate"
              unit="₹/km"
              value={form.extraKmRate}
              commonValue={commonExtras?.extraKmRate ?? commonOW?.customerRate}
              resolved={evalField("extraKmRate", commonExtras?.extraKmRate ?? commonOW?.customerRate)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("extraKmRate", v)}
              onClear={() => handleClearOverride("extraKmRate")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="extraKmRate"
            />
            <RateField
              label="Waiting Charge"
              unit="₹/hour"
              value={form.waitingPerHour}
              commonValue={commonExtras?.waitingPerHour ?? 0}
              resolved={evalField("waitingPerHour", commonExtras?.waitingPerHour ?? 0)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("waitingPerHour", v)}
              onClear={() => handleClearOverride("waitingPerHour")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="waitingPerHour"
              zeroAllowed
            />
            <RateField
              label="Luggage / Roof Carrier Charge"
              unit="₹/trip"
              value={form.carrierCharge}
              commonValue={commonExtraCharges?.customer?.carrier}
              resolved={evalField("carrierCharge", commonExtraCharges?.customer?.carrier)}
              scopeBrand={selectedBrand}
              onChange={(v) => setField("carrierCharge", v)}
              onClear={() => handleClearOverride("carrierCharge")}
              tariff={t}
              service={selectedService}
              cls={selectedClass}
              fieldKey="carrierCharge"
              zeroAllowed
            />
          </div>
        )}

        {selectedService === "Local Rental" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RateField
                label="Minimum Rental Duration"
                unit="hours"
                value={form.minRentalHours}
                commonValue={t?.rentalPackages?.[selectedClass]?.minHours ?? DEFAULT_RENTAL_MIN_HOURS[selectedClass]}
                resolved={evalField("minRentalHours", t?.rentalPackages?.[selectedClass]?.minHours ?? DEFAULT_RENTAL_MIN_HOURS[selectedClass])}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("minRentalHours", v)}
                onClear={() => handleClearOverride("minRentalHours")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="minRentalHours"
              />
              <RateField
                label="Hill Station Charge"
                unit="₹/trip"
                value={form.hillCharge}
                commonValue={commonExtraCharges?.customer?.hill}
                resolved={evalField("hillCharge", commonExtraCharges?.customer?.hill)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("hillCharge", v)}
                onClear={() => handleClearOverride("hillCharge")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="hillCharge"
                zeroAllowed
              />
              <RateField
                label="Roof Carrier Charge"
                unit="₹/trip"
                value={form.carrierCharge}
                commonValue={commonExtraCharges?.customer?.carrier}
                resolved={evalField("carrierCharge", commonExtraCharges?.customer?.carrier)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("carrierCharge", v)}
                onClear={() => handleClearOverride("carrierCharge")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="carrierCharge"
                zeroAllowed
              />
            </div>

            <h4 className="text-[14px] font-bold text-ink mt-3">Rental Packages by Duration</h4>
            <div className="overflow-x-auto">
              <table className="ds-table w-full text-[13px]">
                <thead>
                  <tr>
                    <th>PACKAGE</th>
                    <th>CUSTOMER FARE (₹)</th>
                    <th>PARTNER PAYOUT (₹)</th>
                    <th>INCLUDED KM</th>
                    <th>EXTRA KM RATE (₹/km)</th>
                    <th>EXTRA HOUR RATE (₹/hr)</th>
                  </tr>
                </thead>
                <tbody>
                  {RENTAL_HOURS.map((h) => {
                    const commonPkg = t?.rentalPackages?.[selectedClass]?.packages?.[String(h)];
                    return (
                      <tr key={h}>
                        <td>
                          <strong>{h} Hours</strong>
                          <small className="block text-muted">{commonPkg?.includedKm ?? h * 10} km</small>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="ds-input text-right w-24"
                            placeholder={str(commonPkg?.customerFare) || "—"}
                            value={form.rentalCustomerFare[h] ?? ""}
                            onChange={(e) => setRentalField(h, "customerFare", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="ds-input text-right w-24"
                            placeholder={str(commonPkg?.partnerPayout) || "—"}
                            value={form.rentalPartnerPayout[h] ?? ""}
                            onChange={(e) => setRentalField(h, "partnerPayout", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="ds-input text-right w-20"
                            placeholder={str(commonPkg?.includedKm) || String(h * 10)}
                            value={form.rentalIncludedKm[h] ?? ""}
                            onChange={(e) => setRentalField(h, "includedKm", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="ds-input text-right w-20"
                            placeholder={str(commonPkg?.extraKmRate) || "—"}
                            value={form.rentalExtraKm[h] ?? ""}
                            onChange={(e) => setRentalField(h, "extraKm", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="ds-input text-right w-20"
                            placeholder={str(commonPkg?.extraHourRate) || "—"}
                            value={form.rentalExtraHour[h] ?? ""}
                            onChange={(e) => setRentalField(h, "extraHour", e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedService === "Multicity" && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[12px] text-amber-900 flex items-start gap-2">
              <Icon name="info" size={16} className="mt-0.5 text-amber-700 flex-shrink-0" />
              <div>
                <strong>Multicity Operational Billing Policy:</strong>
                <p className="mt-0.5">
                  Multicity itineraries are multi-stop road tours requested by customers and quoted by the travel desk.
                  These settings define the per-km rates, daily minimum billable distance, and daily driver batta used by
                  operations when authoring and converting Multicity quotes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <RateField
                label="Customer Distance Rate"
                unit="₹/km"
                value={form.customerRate}
                commonValue={commonRT?.customerRate ?? commonOW?.customerRate}
                resolved={evalField("customerRate", commonRT?.customerRate ?? commonOW?.customerRate)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("customerRate", v)}
                onClear={() => handleClearOverride("customerRate")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="customerRate"
              />
              <RateField
                label="Partner Payout Rate"
                unit="₹/km"
                value={form.partnerRate}
                commonValue={commonRT?.partnerRate ?? commonOW?.partnerRate}
                resolved={evalField("partnerRate", commonRT?.partnerRate ?? commonOW?.partnerRate)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("partnerRate", v)}
                onClear={() => handleClearOverride("partnerRate")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="partnerRate"
              />
              <RateField
                label="Minimum Daily Billable Distance"
                unit="km/day"
                value={form.minKmPerDay}
                commonValue={commonRT?.minKmPerDay ?? 300}
                resolved={evalField("minKmPerDay", commonRT?.minKmPerDay ?? 300)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("minKmPerDay", v)}
                onClear={() => handleClearOverride("minKmPerDay")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="minKmPerDay"
              />
              <RateField
                label="Customer Daily Allowance (Driver Bata)"
                unit="₹/day"
                value={form.customerBata}
                commonValue={commonRT?.customerBata ?? commonOW?.customerBata}
                resolved={evalField("customerBata", commonRT?.customerBata ?? commonOW?.customerBata)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("customerBata", v)}
                onClear={() => handleClearOverride("customerBata")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="customerBata"
                zeroAllowed
              />
              <RateField
                label="Partner Daily Allowance (Driver Bata)"
                unit="₹/day"
                value={form.partnerBata}
                commonValue={commonRT?.partnerBata ?? commonOW?.partnerBata}
                resolved={evalField("partnerBata", commonRT?.partnerBata ?? commonOW?.partnerBata)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("partnerBata", v)}
                onClear={() => handleClearOverride("partnerBata")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="partnerBata"
                zeroAllowed
              />
              <RateField
                label="Extra Kilometre Charge"
                unit="₹/km"
                value={form.extraKmRate}
                commonValue={commonExtras?.extraKmRate ?? commonRT?.customerRate}
                resolved={evalField("extraKmRate", commonExtras?.extraKmRate ?? commonRT?.customerRate)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("extraKmRate", v)}
                onClear={() => handleClearOverride("extraKmRate")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="extraKmRate"
              />
              <RateField
                label="Waiting Charge"
                unit="₹/hour"
                value={form.waitingPerHour}
                commonValue={commonExtras?.waitingPerHour ?? 0}
                resolved={evalField("waitingPerHour", commonExtras?.waitingPerHour ?? 0)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("waitingPerHour", v)}
                onClear={() => handleClearOverride("waitingPerHour")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="waitingPerHour"
                zeroAllowed
              />
              <RateField
                label="Hill Station Charge"
                unit="₹/trip"
                value={form.hillCharge}
                commonValue={commonExtraCharges?.customer?.hill}
                resolved={evalField("hillCharge", commonExtraCharges?.customer?.hill)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("hillCharge", v)}
                onClear={() => handleClearOverride("hillCharge")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="hillCharge"
                zeroAllowed
              />
              <RateField
                label="Roof Carrier Charge"
                unit="₹/trip"
                value={form.carrierCharge}
                commonValue={commonExtraCharges?.customer?.carrier}
                resolved={evalField("carrierCharge", commonExtraCharges?.customer?.carrier)}
                scopeBrand={selectedBrand}
                onChange={(v) => setField("carrierCharge", v)}
                onClear={() => handleClearOverride("carrierCharge")}
                tariff={t}
                service={selectedService}
                cls={selectedClass}
                fieldKey="carrierCharge"
                zeroAllowed
              />
            </div>
          </div>
        )}
      </section>

      {/* Save Confirmation Dialog */}
      {confirmSaveOpen && (
        <Modal
          title={`Confirm Changes for ${scopeSummary}`}
          onClose={() => setConfirmSaveOpen(false)}
          busy={busy}
        >
          <div className="space-y-4">
            <p className="text-[13px] text-muted">
              Review the exact scope and changes before updating the authoritative tariff.
            </p>

            <div className="p-3 bg-slate-50 border rounded text-[13px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted block text-[11px] font-bold">BRAND</span>
                  <strong>{selectedBrand === "common" ? "Common (Shared Baseline)" : BRAND_LABELS[selectedBrand]}</strong>
                </div>
                <div>
                  <span className="text-muted block text-[11px] font-bold">SERVICE</span>
                  <strong>{selectedService}</strong>
                </div>
                <div>
                  <span className="text-muted block text-[11px] font-bold">VEHICLE CATEGORY</span>
                  <strong>{CLASS_LABEL[selectedClass]}</strong>
                </div>
                <div>
                  <span className="text-muted block text-[11px] font-bold">TARIFF VERSION</span>
                  <strong>v{t?.version ?? 0} → v{(t?.version ?? 0) + 1}</strong>
                </div>
              </div>
            </div>

            {selectedBrand === "common" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[12px] text-blue-900">
                <Icon name="info" size={14} className="inline mr-1" />
                Updating the <strong>Common Baseline</strong> affects all brands that do not have explicit overrides.
              </div>
            )}

            <label className="ds-field">
              <span>Change Reason (Required for audit history, min 5 chars)</span>
              <input
                type="text"
                className="ds-input"
                placeholder="e.g. Seasonal diesel price adjustment for People Taxi sedan drops"
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
              />
            </label>

            {saveError && (
              <div className="ds-error" role="alert">
                <Icon name="circle-alert" /> {saveError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setConfirmSaveOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={executeSave}
                disabled={busy || saveReason.trim().length < 5}
              >
                {busy ? "Saving Tariff..." : "Confirm & Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Reusable individual rate field with explicit source badges and inheritance tracking */
function RateField({
  label,
  unit,
  value,
  commonValue,
  resolved,
  scopeBrand,
  onChange,
  onClear,
  tariff,
  service,
  cls,
  fieldKey,
  zeroAllowed,
}: {
  label: string;
  unit: string;
  value: string;
  commonValue: number | undefined;
  resolved: RateValue;
  scopeBrand: ScopeBrand;
  onChange: (v: string) => void;
  onClear: () => void;
  tariff: Tariff | null | undefined;
  service: WorkspaceService;
  cls: TariffClass;
  fieldKey: keyof BrandFareOverride;
  zeroAllowed?: boolean;
}) {
  const isOverridden = scopeBrand !== "common" && value.trim() !== "";
  const inherits = getInheritingBrands(tariff, service, cls, fieldKey);

  return (
    <div className="ds-field p-2.5 border rounded bg-white">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[12px] font-bold text-ink">{label}</span>
        <span className="text-[11px] text-muted">{unit}</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          className="ds-input flex-1 font-semibold"
          placeholder={commonValue !== undefined ? String(commonValue) : "—"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {scopeBrand !== "common" && isOverridden && (
          <Button size="sm" variant="ghost" title="Revert to common baseline" onClick={onClear}>
            <Icon name="rotate-ccw" size={13} />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
        {scopeBrand === "common" ? (
          <div className="text-muted leading-tight">
            <span>Inherited by: {inherits.inheriting.join(", ") || "None"}</span>
            {inherits.overridden.length > 0 && (
              <span className="block text-blue-700">
                Overrides: {inherits.overridden.map((o) => `${o.brand} (₹${o.value})`).join(", ")}
              </span>
            )}
          </div>
        ) : isOverridden ? (
          <div className="flex items-center gap-1.5 text-blue-800">
            <Badge tone="blue">Override</Badge>
            <span>Active: {inr(Number(value))}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted">
            <Badge tone="neutral">Common rate</Badge>
            <span>Inherited: {commonValue !== undefined ? inr(commonValue) : "—"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
