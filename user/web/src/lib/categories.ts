// Presentation of the admin-managed vehicle categories: which photo represents a category and
// which filter group it belongs to. Names, seats, descriptions and fares always come from the server.
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

/**
 * The reference's white studio photos where one fits the category, otherwise the site's own
 * illustration. A category image is representative only: the assigned model may vary.
 */
export function categoryPhoto(c: Pick<RideCategory, 'name' | 'seats'> & { imageUrl?: string }): string {
  const n = c.name.toLowerCase();
  if (/crysta|hycross/.test(n)) return '/nesam/cars/crysta.webp';
  if (/innova/.test(n)) return '/nesam/cars/innova.webp';
  if (/carens|xl6/.test(n)) return '/nesam/cars/carens.webp';
  if (/ertiga/.test(n)) return '/nesam/cars/ertiga.webp';
  const art = vehicleArtFor(c);
  if (art === 'sedan' || art === 'premium-sedan' || art === 'hatchback') return art === 'hatchback' ? '/vehicles/hatchback.webp' : '/nesam/cars/sedan.webp';
  if (art === 'mpv') return c.seats >= 7 ? '/nesam/cars/innova.webp' : '/nesam/cars/ertiga.webp';
  if (art === 'suv') return '/nesam/cars/carens.webp';
  return `/vehicles/${art}.webp`;
}
