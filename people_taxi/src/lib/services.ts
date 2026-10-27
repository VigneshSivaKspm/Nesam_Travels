// Service taxonomy for People Taxi: One Way, Round Trip, Airport Taxi, Local Rental.
import type { TripType } from '@core/types';

export type ServiceId = 'one-way' | 'round-trip' | 'airport' | 'rental';

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
    id: 'one-way',
    label: 'One Way',
    tagline: 'Intercity one-way drops at flat rates',
    tripType: 'One Way',
    online: true,
    icon: 'one-way',
  },
  {
    id: 'round-trip',
    label: 'Round Trip',
    tagline: 'Out and back round trips with chauffeur',
    tripType: 'Round Trip',
    online: true,
    icon: 'round-trip',
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
] as const;

export const SERVICE_TITLE: Record<ServiceId, string> = {
  'one-way': 'One Way Drop Taxi',
  'round-trip': 'Round Trip Taxi',
  airport: 'Airport Taxi',
  rental: 'Local City Rental',
};

export const parseService = (raw: string | null): ServiceId | null => {
  if (raw === 'one-way' || raw === 'round-trip' || raw === 'airport' || raw === 'rental') return raw;
  if (raw === 'outstation') return 'one-way';
  return null;
};

export const serviceOfTrip = (t: TripType | null | undefined): ServiceId => {
  if (t === 'Airport Taxi') return 'airport';
  if (t === 'Local Rental') return 'rental';
  if (t === 'Round Trip') return 'round-trip';
  return 'one-way';
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
