// Service taxonomy for People Taxi: Outstation, Airport Taxi, Local Rental, Multi-city tours.
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
    tagline: 'Intercity one-way drops & round trips',
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
    label: 'Tour Packages',
    tagline: 'Multi-day temple & vacation tours',
    tripType: null,
    online: false,
    icon: 'sparkles',
  },
] as const;

export const SERVICE_TITLE: Record<ServiceId, string> = {
  outstation: 'Outstation Cabs',
  airport: 'Airport Taxi',
  rental: 'Local City Rental',
  multicity: 'Tour Packages',
};

export const parseService = (raw: string | null): ServiceId | null => {
  if (raw === 'outstation' || raw === 'airport' || raw === 'rental' || raw === 'multicity') return raw;
  return null;
};

export const serviceOfTrip = (t: TripType): ServiceId => {
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

export const serviceHref = (s: ServiceId, trip?: 'one-way' | 'round-trip') =>
  `/book?service=${s}${trip ? `&trip=${trip}` : ''}`;
