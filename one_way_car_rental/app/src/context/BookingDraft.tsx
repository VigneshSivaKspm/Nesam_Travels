// The booking being put together across the three booking steps
// (Plan journey → Choose your ride → Review & book), plus the live data every
// step prices with: bookable categories, the global fare adjustment and coupons.
// Subscribed once for the session so moving between steps never re-reads them.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Coupon, GeoPlace, RideCategory, RouteInfo, TripType } from '../types';
import { useServerQuotes, type ServerQuoteState } from '../hooks/useServerQuotes';
import { scheduleProblem } from '../utils/bookingRules';
import {
  subscribeToCoupons,
  subscribeToFareAdjustment,
  subscribeToRideCategories,
  type FareAdjustment,
  type RideCategoryStatus,
} from '../services/pricingService';

export interface BookingDraft {
  pickup: GeoPlace | null;
  drop: GeoPlace | null;
  tripType: TripType;
  /** Pickup instant; required — every booking is an advance booking. */
  scheduledAt: Date | null;
  /** Round trips: when the trip ends (billing counts Indian calendar dates from pickup to here). */
  tripEndAt: Date | null;
  categoryId: string;
}

interface BookingDraftValue {
  draft: BookingDraft;
  /** Merge a change; pass a function to decide from the current draft. */
  update: (patch: Partial<BookingDraft> | ((d: BookingDraft) => Partial<BookingDraft>)) => void;
  /** Clears the destination, schedule and ride choice after a booking (pickup is kept). */
  reset: () => void;
  /** The route for the current pickup → drop, once computed. */
  route: RouteInfo | null;
  setRoute: (key: string, route: RouteInfo) => void;
  routeKey: string;
  categories: RideCategory[];
  categoryStatus: RideCategoryStatus;
  adjustment: FareAdjustment | null;
  coupons: Coupon[];
  /** The booking server's own quotes for this trip — the only fare that can be booked. */
  serverQuote: ServerQuoteState;
}

const Ctx = createContext<BookingDraftValue | null>(null);

export function useBookingDraft(): BookingDraftValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('BookingDraftProvider is missing');
  return v;
}

export const routeKeyOf = (pickup: GeoPlace | null, drop: GeoPlace | null) => (pickup && drop ? `${pickup.lat},${pickup.lng}>${drop.lat},${drop.lng}` : '');

export function BookingDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>({ pickup: null, drop: null, tripType: 'One Way', scheduledAt: null, tripEndAt: null, categoryId: '' });
  // A route is tagged with the endpoints it was computed for; any other is stale.
  const [routeState, setRouteState] = useState<{ key: string; info: RouteInfo } | null>(null);
  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [categoryStatus, setCategoryStatus] = useState<RideCategoryStatus>('loading');
  const [adjustment, setAdjustment] = useState<FareAdjustment | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  useEffect(
    () =>
      subscribeToRideCategories((cats, status) => {
        setCategories(cats);
        setCategoryStatus(status);
        // Keep the rider's choice while it is still bookable; otherwise pre-select one.
        setDraft((d) => (cats.some((c) => c.id === d.categoryId) ? d : { ...d, categoryId: cats[Math.min(1, cats.length - 1)]?.id ?? '' }));
      }),
    [],
  );
  useEffect(() => subscribeToFareAdjustment(setAdjustment), []);
  useEffect(() => subscribeToCoupons(setCoupons), []);

  const update = useCallback(
    (patch: Partial<BookingDraft> | ((d: BookingDraft) => Partial<BookingDraft>)) => setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) })),
    [],
  );
  const reset = useCallback(() => setDraft((d) => ({ ...d, drop: null, scheduledAt: null, tripEndAt: null, tripType: 'One Way' })), []);
  const setRoute = useCallback((key: string, info: RouteInfo) => setRouteState({ key, info }), []);

  const routeKey = routeKeyOf(draft.pickup, draft.drop);
  const route = routeKey && routeState?.key === routeKey ? routeState.info : null;

  const quoteRequest = useMemo(() => {
    const { pickup, drop, scheduledAt, tripEndAt, tripType } = draft;
    if (!pickup || !drop || !scheduledAt || scheduleProblem(scheduledAt)) return null;
    if (tripType === 'Round Trip' && (!tripEndAt || tripEndAt.getTime() < scheduledAt.getTime())) return null;
    return {
      pickup: { name: pickup.name, address: pickup.address, lat: pickup.lat, lng: pickup.lng, type: pickup.type },
      drop: { name: drop.name, address: drop.address, lat: drop.lat, lng: drop.lng, type: drop.type },
      tripType,
      scheduledAt: scheduledAt.toISOString(),
      tripEndAt: tripType === 'Round Trip' && tripEndAt ? tripEndAt.toISOString() : null,
      couponCode: '',
    };
  }, [draft]);
  const serverQuote = useServerQuotes(quoteRequest);

  const value = useMemo<BookingDraftValue>(
    () => ({ draft, update, reset, route, setRoute, routeKey, categories, categoryStatus, adjustment, coupons, serverQuote }),
    [draft, update, reset, route, setRoute, routeKey, categories, categoryStatus, adjustment, coupons, serverQuote],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
