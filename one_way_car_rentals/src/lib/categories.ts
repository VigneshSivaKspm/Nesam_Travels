import type { RideCategory } from '@core/types';
import { vehicleArtFor } from './vehicleArt';

export type CategoryGroup = 'Sedan' | 'SUV' | 'Innova' | 'Van & bus';

export function categoryGroup(c: Pick<RideCategory, 'name' | 'seats'>): CategoryGroup {
  const n = c.name.toLowerCase();
  if (/innova|crysta|hycross/.test(n)) return 'Innova';
  const art = vehicleArtFor(c);
  if (art === 'passenger-van' || art === 'minibus' || art === 'tourist-coach') return 'Van & bus';
  if (art === 'suv' || art === 'mpv') return 'SUV';
  return 'Sedan';
}

export function categoryPhoto(c: Pick<RideCategory, 'name' | 'seats'> & { imageUrl?: string }): string {
  if (c.imageUrl) return c.imageUrl;
  const art = vehicleArtFor(c);
  return `/vehicles/${art}.webp`;
}

export const categoryName = (c: Pick<RideCategory, 'name'>) => c.name.replace(/\s*\d+\s*\+\s*\d+\s*$/, '').trim() || c.name;
