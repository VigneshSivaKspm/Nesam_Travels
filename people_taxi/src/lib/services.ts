// Service taxonomy for People Taxi: Outstation, Airport Taxi, Local Rental, Multicity.
import type { TripType } from '@core/types';

export type ServiceId = 'outstation' | 'airport' | 'rental' | 'multicity';

export interface ServiceMeta {
  id: ServiceId;
  label: string;
  tagline: string;
  tripType: TripType | null;
  online: boolean;
  icon: string;
}

export const SERVICES: readonly ServiceMeta[] = [
  {
    id: 'outstation',
    label: 'Outstation',
    tagline: 'One-way drops & round trips at fixed rates',
    tripType: 'One Way',
    online: true,
    icon: 'car',
  },
  {
    id: 'airport',
    label: 'Airport Taxi',
    tagline: 'Pickup & drop at all South India airports',
    tripType: 'Airport Taxi',
    online: true,
    icon: 'plane',
  },
  {
    id: 'rental',
    label: 'Local Rental',
    tagline: 'Hourly city disposal packages with chauffeur',
    tripType: 'Local Rental',
    online: true,
    icon: 'clock',
  },
  {
    id: 'multicity',
    label: 'Multicity',
    tagline: 'Custom multi-stop itineraries & tour packages',
    tripType: null,
    online: true,
    icon: 'multicity',
  },
] as const;

export const SERVICE_TITLE: Record<ServiceId, string> = {
  outstation: 'Outstation Cabs',
  airport: 'Airport Taxi',
  rental: 'Local City Rental',
  multicity: 'Multicity Tour & Itinerary',
};

export const parseService = (raw: string | null): ServiceId | null => {
  if (raw === 'outstation' || raw === 'airport' || raw === 'rental' || raw === 'multicity') return raw;
  if (raw === 'one-way' || raw === 'round-trip') return 'outstation';
  return null;
};

export const serviceOfTrip = (t: TripType | null | undefined): ServiceId => {
  if (t === 'Airport Taxi') return 'airport';
  if (t === 'Local Rental') return 'rental';
  return 'outstation';
};

export function tripTypeLabel(t: TripType | string): string {
  switch (t) {
    case 'Round Trip':
      return 'Round Trip';
    case 'Airport Taxi':
      return 'Airport';
    case 'Local Rental':
      return 'Local Rental';
    default:
      return 'One Way';
  }
}

export const serviceHref = (s: ServiceId) => `/book?service=${s}`;
