import type { TripType } from '@core/types';

export type ServiceId = 'airport' | 'multicity' | 'outstation' | 'rental';

export const SERVICES: { id: ServiceId; label: string; icon: string }[] = [
  { id: 'outstation', label: 'Outstation', icon: 'travel-outstation' },
  { id: 'airport', label: 'Airport', icon: 'travel-airport' },
  { id: 'rental', label: 'Local Rental', icon: 'travel-rental' },
  { id: 'multicity', label: 'Multicity', icon: 'travel-multicity' },
];

export const SERVICE_TITLE: Record<ServiceId, string> = {
  outstation: 'Outstation',
  airport: 'Airport Transfer',
  rental: 'Local Rental',
  multicity: 'Multicity',
};

export const isOnlineService = (s: ServiceId) => s !== 'multicity';

export function serviceOfTrip(t: TripType): ServiceId {
  if (t === 'Airport Taxi') return 'airport';
  if (t === 'Local Rental') return 'rental';
  return 'outstation';
}

export function parseService(v: string | null): ServiceId | null {
  if (v === 'airport' || v === 'multicity' || v === 'outstation' || v === 'rental') return v;
  if (v === 'one-way' || v === 'round-trip') return 'outstation';
  return null;
}

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

export const serviceHref = (s: ServiceId | 'one-way' | 'round-trip', trip?: 'one-way' | 'round-trip') => {
  if (s === 'one-way') return '/book?service=one-way';
  if (s === 'round-trip') return '/book?service=round-trip';
  return `/book?service=${s}${trip ? `&trip=${trip}` : ''}`;
};
