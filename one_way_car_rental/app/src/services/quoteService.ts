// The authoritative fare. The booking server prices every category with the same engine that
// creates the booking (confirmed tariff, calendar-day round trips, coupons), so the amount a
// customer reviews is the amount charged. The local calculator in pricingService.ts remains only
// as a labelled estimate while a quote is loading or unreachable — it can never be submitted.
import type { FareBreakdown } from '../types';
import type { FareBreakup } from '../utils/fareBreakup';
import { callFunction } from './callables';

export interface ServerCategoryQuote {
  categoryId: string;
  ok: boolean;
  fare?: FareBreakdown;
  breakup?: FareBreakup;
  service?: string;
  model?: string;
  /** Chargeable calendar days (round trips). */
  days?: number;
  includedKm?: number;
  couponMessage?: string;
  couponApplied?: boolean;
  error?: string;
}

export interface ServerQuoteResponse {
  route: { distanceKm: number; durationMin: number };
  service: string;
  quotes: ServerCategoryQuote[];
}

import type { TripType } from '../types';

export interface QuoteRequest {
  pickup: { name: string; address: string; lat: number; lng: number; type?: string };
  drop: { name: string; address: string; lat: number; lng: number; type?: string };
  tripType: TripType;
  /** ISO-8601 with an offset. */
  scheduledAt: string;
  tripEndAt?: string | null;
  couponCode?: string;
}

export const fetchQuotes = (req: QuoteRequest): Promise<ServerQuoteResponse> => callFunction<QuoteRequest, ServerQuoteResponse>('quoteBooking', req, 30000);

/** Identity of a request, so a stale answer is never used for a changed trip. */
export const quoteKeyOf = (r: QuoteRequest | null): string => (r ? JSON.stringify([r.pickup.lat, r.pickup.lng, r.drop.lat, r.drop.lng, r.tripType, r.scheduledAt, r.tripEndAt ?? '', r.couponCode ?? '']) : '');
