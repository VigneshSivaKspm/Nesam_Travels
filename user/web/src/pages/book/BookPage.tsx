import { useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useCustomerData } from '@/state/CustomerData';
import { useBooking } from '@/state/Booking';
import { useSeo } from '@/lib/seo';
import { Icon } from '@/components/Icon';
import { parseService, serviceOfTrip, type ServiceId } from '@/lib/services';
import { BookingForm } from './BookingForm';
import { ChooseStep } from './ChooseStep';
import { ReviewStep } from './ReviewStep';
import { AppSection, FaqSection, HeroCopy, PopularRoutes, ReviewsSection, WhySection } from './HomeSections';
import type { PopularRoute } from './content';

export type BookStep = 'plan' | 'choose' | 'review';

const OUTSTATION_KEY = 'nesam.outstation.trip';
const readOutstation = (): 'One Way' | 'Round Trip' => {
  try {
    return sessionStorage.getItem(OUTSTATION_KEY) === 'Round Trip' ? 'Round Trip' : 'One Way';
  } catch {
    return 'One Way';
  }
};

/** A ride in progress, or one waiting for a rating, surfaced above the booking form. */
function RideBanner() {
  const { liveRide, unratedTrip } = useCustomerData();
  const trip = liveRide ?? unratedTrip;
  if (!trip) return null;
  const live = !!liveRide;
  return (
    <div className={`ride-banner ${live ? '' : 'ride-banner--soft'}`}>
      <span className="ride-banner__icon" aria-hidden="true">
        <Icon name={live ? 'car' : 'star'} size={18} />
      </span>
      <p>
        <strong>{live ? (trip.status === 'Ongoing' ? 'Trip in progress' : 'Your upcoming booking') : 'How was your trip?'}</strong>
        <span className="truncate">
          {' '}
          · {trip.pickup.name} → {trip.drop.name}
        </span>
      </p>
      <Link className="ride-banner__link" to={`/ride/${trip.id}`}>
        {live ? 'View booking' : 'Rate trip'} <Icon name="arrow-right" size={14} />
      </Link>
    </div>
  );
}

function Home() {
  const { draft, update } = useBooking();
  const [params, setParams] = useSearchParams();
  const fromUrl = parseService(params.get('service'));
  const tripParam = params.get('trip');
  const service: ServiceId = fromUrl ?? serviceOfTrip(draft.tripType);
  const outstationTrip: 'One Way' | 'Round Trip' = draft.tripType === 'Round Trip' ? 'Round Trip' : draft.tripType === 'One Way' ? 'One Way' : readOutstation();
  const lastOutstation = useRef(outstationTrip);

  // Keep the draft's trip type in step with the chosen service (deep links included).
  useEffect(() => {
    const wanted =
      service === 'airport'
        ? 'Airport Taxi'
        : service === 'rental'
          ? 'Local Rental'
          : service === 'outstation'
            ? tripParam === 'round-trip'
              ? 'Round Trip'
              : tripParam === 'one-way'
                ? 'One Way'
                : draft.tripType === 'One Way' || draft.tripType === 'Round Trip'
                  ? draft.tripType
                  : lastOutstation.current
            : null;
    if (!wanted || wanted === draft.tripType) return;
    update((d) => ({
      tripType: wanted,
      // The rental placeholder destination never carries over to another service.
      drop: d.drop?.id === 'place-local-disposal' && wanted !== 'Local Rental' ? null : d.drop,
      tripEndAt: wanted === 'Round Trip' ? d.tripEndAt : null,
    }));
  }, [service, tripParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const onService = useCallback(
    (s: ServiceId) => {
      setParams({ service: s }, { replace: true });
    },
    [setParams],
  );
  const onOutstationTrip = (t: 'One Way' | 'Round Trip') => {
    lastOutstation.current = t;
    try {
      sessionStorage.setItem(OUTSTATION_KEY, t);
    } catch {
      /* private mode */
    }
    update({ tripType: t, tripEndAt: t === 'Round Trip' ? draft.tripEndAt : null });
    setParams({ service: 'outstation', trip: t === 'Round Trip' ? 'round-trip' : 'one-way' }, { replace: true });
  };

  const onRoute = (r: PopularRoute) => {
    update({ pickup: r.pickup, drop: r.drop, tripType: outstationTrip });
    setParams({ service: 'outstation' }, { replace: true });
    const el = document.getElementById('book-console');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => document.getElementById('bf-date')?.focus({ preventScroll: true }), 400);
  };

  return (
    <div className="home">
      <div className="wrap home__wrap">
        <RideBanner />
        <div className="home-hero">
          <HeroCopy />
          <BookingForm service={service} onService={onService} outstationTrip={outstationTrip} onOutstationTrip={onOutstationTrip} />
        </div>
        <PopularRoutes onPick={onRoute} />
        <WhySection />
        <ReviewsSection />
        <FaqSection />
        <AppSection />
      </div>
    </div>
  );
}

export function BookPage({ step }: { step: BookStep }) {
  useSeo(
    step === 'plan'
      ? {
          title: 'NESAM Cabs — Outstation Cabs & One Way Drop Taxi in Tamil Nadu | Upfront Fares',
          description:
            'Book outstation cabs, one-way drop taxis & round trips across Tamil Nadu, Bangalore & Pondicherry. Verified chauffeurs, clean AC cars, upfront fares & 24/7 support.',
          canonical: '/book',
        }
      : step === 'choose'
        ? {
            title: 'Choose your cab · NESAM Cabs',
            description: 'Compare every vehicle category with its fare before you book.',
            canonical: '/book/ride',
            noindex: true,
          }
        : {
            title: 'Review & book · NESAM Cabs',
            description: 'Review your trip, contact details and fare, then submit your booking request.',
            canonical: '/book/confirm',
            noindex: true,
          },
  );
  const { draft } = useBooking();
  const { pickup, drop } = draft;

  if (step !== 'plan' && (!pickup || !drop)) return <Navigate to="/book" replace />;
  if (step === 'review' && !draft.categoryId) return <Navigate to="/book/ride" replace />;

  if (step === 'choose') return <ChooseStep />;
  if (step === 'review') return <ReviewStep />;
  return <Home />;
}
