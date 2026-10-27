import { useEffect, useState } from "react";
import { subscribeToDocument } from "./adminFirestoreService";

/** Vehicle classes the tariff prices. Innova has its own rates only once saved; until then it is priced at the SUV rates. */
export type TariffClass = "sedan" | "suv" | "innova" | "crysta";
export const TARIFF_CLASSES: readonly TariffClass[] = ["sedan", "suv", "innova", "crysta"];
export const CLASS_LABEL: Record<TariffClass, string> = { sedan: "Sedan", suv: "SUV", innova: "Innova", crysta: "Innova Crysta" };

export const RENTAL_HOURS = [4, 6, 8, 10, 12] as const;
/** Minimum rental hours of a category that has none saved yet (the server applies the same default). */
export const DEFAULT_RENTAL_MIN_HOURS: Record<TariffClass, number> = { sedan: 4, suv: 4, innova: 4, crysta: 10 };

export interface OneWayRates { customerRate: number; customerBata: number; partnerRate: number; partnerBata: number }
export interface RoundTripRates extends OneWayRates { minKmPerDay: number }
export interface OutstationExtra { extraKmRate: number; waitingPerHour: number }
export interface LocalFare { minKm: number; customerRate: number; partnerRate: number; extraKmRate: number; waitingPerHour: number; enabled: boolean }
export interface RentalPackage { customerFare: number; partnerPayout: number; includedKm: number; extraKmRate: number; extraHourRate: number; gstMode: "included" | "excluded"; enabled: boolean }
export interface Zone { id: string; name: string; lat: number; lng: number; radiusKm: number }

/** business_config/tariff_v2 as stored. Anything absent is "not configured" — never zero. */
export interface Tariff {
  version?: number;
  enabled?: boolean;
  gstRate?: number;
  oneWay?: { minKm?: number; classes?: Partial<Record<TariffClass, Partial<OneWayRates>>> };
  roundTrip?: { maxDays?: number; classes?: Partial<Record<TariffClass, Partial<RoundTripRates>>> };
  cityDrop?: { baseKm?: number; zones?: Zone[] };
  outstationExtras?: Partial<Record<TariffClass, Partial<OutstationExtra>>>;
  airport?: { customerBase?: number; partnerBase?: number };
  localPickupDrop?: Record<string, { cityName?: string; classes?: Partial<Record<TariffClass, Partial<LocalFare>>> }>;
  rentalPackages?: Partial<Record<TariffClass, { minHours?: number; packages?: Partial<Record<string, Partial<RentalPackage>>> }>>;
}

/** Live tariff document: undefined = loading, null = nothing saved yet. */
export function useTariff(): { tariff: Tariff | null | undefined; error: string | null } {
  const [tariff, setTariff] = useState<Tariff | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => subscribeToDocument<Tariff>("business_config/tariff_v2", (t) => { setTariff(t); setError(null); }, setError), []);
  return { tariff, error };
}

export const rentalMinHours = (t: Tariff | null | undefined, cls: TariffClass): number => t?.rentalPackages?.[cls]?.minHours ?? DEFAULT_RENTAL_MIN_HOURS[cls];

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const inr = (n: unknown): string => (finite(n) ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—");

/** A saved local fare is usable only when every field is a valid number (the server drops anything else). */
export function validLocalFare(f: Partial<LocalFare> | undefined): f is LocalFare {
  return !!f && [f.minKm, f.customerRate, f.partnerRate, f.extraKmRate].every((v) => finite(v) && v > 0) && finite(f.waitingPerHour) && f.waitingPerHour >= 0 && typeof f.enabled === "boolean";
}

export function validPackage(p: Partial<RentalPackage> | undefined): p is RentalPackage {
  return !!p && [p.customerFare, p.partnerPayout, p.includedKm, p.extraKmRate, p.extraHourRate].every((v) => finite(v) && v > 0) && (p.gstMode === "included" || p.gstMode === "excluded") && typeof p.enabled === "boolean";
}
