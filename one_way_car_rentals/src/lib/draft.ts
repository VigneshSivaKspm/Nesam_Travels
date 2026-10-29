// The booking draft and its tab-lifetime persistence (kept free of React and Firebase so it can be tested).
import type { GeoPlace, TripType } from '@core/types';
import { isValidLatLng } from '@core/utils/geo';

export interface BookingDraft {
  pickup: GeoPlace | null;
  drop: GeoPlace | null;
  tripType: TripType;
  /** Pickup instant. Required to continue: every booking is an advance booking. */
  scheduledAt: Date | null;
  /** Round trips only: when the trip ends (billing counts Indian calendar dates from pickup to here). */
  tripEndAt: Date | null;
  categoryId: string;
  /** A code the rider has applied (re-validated against every fare). */
  promoCode: string;
  notes: string;
  waSame: boolean;
  waCode: string;
  waNumber: string;
  email: string;
  /** Booking for someone else: who travels (sent to the server inside the notes). */
  forOther: boolean;
  passengerName: string;
  passengerMobile: string;
  /** Airport transfers: optional flight number (sent inside the notes). */
  flight: string;
}

export const EMPTY_DRAFT: BookingDraft = {
  pickup: null,
  drop: null,
  tripType: 'One Way',
  scheduledAt: null,
  tripEndAt: null,
  categoryId: '',
  promoCode: '',
  notes: '',
  waSame: true,
  waCode: '+91',
  waNumber: '',
  email: '',
  forOther: false,
  passengerName: '',
  passengerMobile: '',
  flight: '',
};

const STORAGE_KEY = 'ow.booking.v1';

function validPlace(p: unknown): GeoPlace | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (!isValidLatLng(o as { lat?: number; lng?: number }) || typeof o.name !== 'string') return null;
  return {
    id: String(o.id ?? 'draft'),
    name: o.name,
    address: String(o.address ?? o.name),
    type: (o.type as GeoPlace['type']) ?? 'other',
    lat: o.lat as number,
    lng: o.lng as number,
  };
}

export function loadDraft(): BookingDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const d = JSON.parse(raw) as Record<string, unknown>;
    const at = typeof d.scheduledAt === 'string' ? new Date(d.scheduledAt) : null;
    const endAt = typeof d.tripEndAt === 'string' ? new Date(d.tripEndAt) : null;
    const scheduled = at && !Number.isNaN(at.getTime()) && at.getTime() > Date.now() ? at : null;
    return {
      ...EMPTY_DRAFT,
      pickup: validPlace(d.pickup),
      drop: validPlace(d.drop),
      tripType: (['One Way', 'Round Trip', 'Local Rental', 'Airport Taxi'] as const).includes(d.tripType as TripType)
        ? (d.tripType as TripType)
        : 'One Way',
      // A schedule that has already passed is dropped rather than kept as a blocker.
      scheduledAt: scheduled,
      // The end only makes sense after a still-valid pickup.
      tripEndAt: scheduled && endAt && !Number.isNaN(endAt.getTime()) && endAt.getTime() >= scheduled.getTime() ? endAt : null,
      categoryId: typeof d.categoryId === 'string' ? d.categoryId : '',
      promoCode: typeof d.promoCode === 'string' ? d.promoCode : '',
      notes: typeof d.notes === 'string' ? d.notes.slice(0, 300) : '',
      waSame: d.waSame !== false,
      waCode: typeof d.waCode === 'string' ? d.waCode : '+91',
      waNumber: typeof d.waNumber === 'string' ? d.waNumber : '',
      email: typeof d.email === 'string' ? d.email : '',
      forOther: d.forOther === true,
      passengerName: typeof d.passengerName === 'string' ? d.passengerName.slice(0, 60) : '',
      passengerMobile: typeof d.passengerMobile === 'string' ? d.passengerMobile.slice(0, 16) : '',
      flight: typeof d.flight === 'string' ? d.flight.slice(0, 12) : '',
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(d: BookingDraft): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...d, scheduledAt: d.scheduledAt?.toISOString() ?? null, tripEndAt: d.tripEndAt?.toISOString() ?? null }),
    );
  } catch {
    /* storage unavailable (private mode): the draft just lives in memory */
  }
}
