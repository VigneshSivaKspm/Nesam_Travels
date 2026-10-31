import { ReviewsSection, CatalogSection } from '../../../../user/web/src/components/PublicContentSections';
import { useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import type { TripType } from '@core/types';
import { useCustomerData } from '@core/context/CustomerData';
import { useAuth } from '@/state/Auth';
import { useBooking } from '@/state/Booking';
import { useSeo } from '@/lib/seo';
import { scrollToBookingForm } from '@/lib/scrollToForm';
import { HOME_SEO } from '@/seo/pages';
import { Icon } from '@/components/Icon';
import { parseService, serviceOfTrip, type ServiceId } from '@/lib/services';
import { BookingForm } from './BookingForm';
import { ChooseStep } from './ChooseStep';
import { ReviewStep } from './ReviewStep';
import {
  AssuranceSection,
  Banners,
  DestinationsSection,
  FaqSection,
  FleetSection,
  HowSection,
  RoutesSection,
  ServicesSection,
  TrustStrip,
} from './HomeSections';
import { type Corridor, type Destination, type Service } from './content';

export type BookStep = 'plan' | 'choose' | 'review';

const OUTSTATION_KEY = 'peopletaxi.outstation.trip';
const readOutstation = (): 'One Way' | 'Round Trip' => {
  try {
    return sessionStorage.getItem(OUTSTATION_KEY) === 'Round Trip' ? 'Round Trip' : 'One Way';
  } catch {
    return 'One Way';
  }
};
const writeOutstation = (t: 'One Way' | 'Round Trip') => {
  try {
    sessionStorage.setItem(OUTSTATION_KEY, t);
  } catch {
    // ignore
  }
};

/** A ride in progress or one awaiting rating. */
function RideBanner() {
  const { liveRide, unratedTrip } = useCustomerData();
  const trip = liveRide ?? unratedTrip;
  if (!trip) return null;
  const live = !!liveRide;
  return (
    <div className={`ride-banner ${live ? '' : 'ride-banner--soft'}`}>
      <div className="wrap">
        <div className="ride-banner__inner">
          <span className="ride-banner__icon" aria-hidden="true">
            <Icon name={live ? 'car' : 'star'} size={18} />
          </span>
          <p>
            <strong>{live ? (trip.status === 'Ongoing' ? 'Trip in progress' : 'Upcoming booking') : 'How was your journey?'}</strong>
            <span className="truncate">
              {' '}
              · {trip.pickup.name} → {trip.drop.name}
            </span>
          </p>
          <Link className="ride-banner__link btn btn--sm btn--primary" to={`/ride/${trip.id}`}>
            {live ? 'View booking' : 'Rate trip'} <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeroCopy() {
  return (
    <div className="hero-copy">
      <h1>
        Any journey,{' '}<br />
        <span className="hero-accent">priced with a friendly smile.</span>
      </h1>
    </div>
  );
}

function Home() {
  const { draft, update } = useBooking();
  const [params, setParams] = useSearchParams();
  const rawService = params.get('service');
  const tripParam = params.get('trip');

  // Parse service, mapping legacy 'one-way' / 'round-trip' to 'outstation'
  const service: ServiceId = parseService(rawService) ?? serviceOfTrip(draft.tripType);

  // Determine outstation trip ('One Way' | 'Round Trip')
  const outstationTrip: 'One Way' | 'Round Trip' =
    tripParam === 'round-trip' || rawService === 'round-trip'
      ? 'Round Trip'
      : tripParam === 'one-way' || rawService === 'one-way'
        ? 'One Way'
        : draft.tripType === 'Round Trip'
          ? 'Round Trip'
          : readOutstation();

  useEffect(() => {
    if (service === 'multicity') return;
    const wanted: TripType =
      service === 'airport'
        ? 'Airport Taxi'
        : service === 'rental'
          ? 'Local Rental'
          : outstationTrip === 'Round Trip'
            ? 'Round Trip'
            : 'One Way';
    if (wanted === draft.tripType) return;
    update((d) => ({
      tripType: wanted,
      drop: d.drop?.id === 'place-local-disposal' && wanted !== 'Local Rental' ? null : d.drop,
      tripEndAt: wanted === 'Round Trip' ? d.tripEndAt : null,
    }));
  }, [service, outstationTrip]); // eslint-disable-line react-hooks/exhaustive-deps

  const onService = useCallback(
    (s: ServiceId) => {
      if (s === 'outstation') {
        setParams({ service: 'outstation', trip: outstationTrip === 'Round Trip' ? 'round-trip' : 'one-way' }, { replace: true });
      } else {
        setParams({ service: s }, { replace: true });
      }
    },
    [setParams, outstationTrip],
  );

  const onOutstationTrip = useCallback(
    (t: 'One Way' | 'Round Trip') => {
      writeOutstation(t);
      update((d) => ({
        tripType: t,
        tripEndAt: t === 'Round Trip' ? d.tripEndAt : null,
      }));
      setParams({ service: 'outstation', trip: t === 'Round Trip' ? 'round-trip' : 'one-way' }, { replace: true });
    },
    [setParams, update],
  );

  const scrollToConsole = useCallback(() => scrollToBookingForm(), []);

  // When a service or outstation trip type is selected via URL query params, sync preference and scroll up to the console
  useEffect(() => {
    if (tripParam === 'round-trip' || rawService === 'round-trip') {
      writeOutstation('Round Trip');
    } else if (tripParam === 'one-way' || rawService === 'one-way') {
      writeOutstation('One Way');
    }
    if (rawService || tripParam) {
      scrollToConsole();
      const timer = window.setTimeout(() => {
        scrollToConsole();
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [rawService, tripParam, scrollToConsole]);

  const onRoute = (c: Corridor) => {
    update({ pickup: c.pickup, drop: c.drop, tripType: 'One Way' });
    writeOutstation('One Way');
    setParams({ service: 'outstation', trip: 'one-way' }, { replace: true });
    scrollToConsole();
    window.setTimeout(() => document.getElementById('bf-date')?.focus({ preventScroll: true }), 400);
  };

  const onDestination = (d: Destination) => {
    update({ drop: d.place, tripType: 'One Way' });
    writeOutstation('One Way');
    setParams({ service: 'outstation', trip: 'one-way' }, { replace: true });
    scrollToConsole();
  };

  const onServiceCard = (s: Service) => {
    if (s.id === 'airport') onService('airport');
    else if (s.id === 'local-rental') onService('rental');
    else if (s.id === 'round-trip') onOutstationTrip('Round Trip');
    else if (s.id === 'multicity') onService('multicity');
    else onOutstationTrip('One Way');
    scrollToConsole();
  };

  return (
    <div className="home">
      <RideBanner />
      <div className="wrap home__wrap">
        <div className="home-hero">
          <HeroCopy />
          <BookingForm
            service={service}
            onService={onService}
            outstationTrip={outstationTrip}
            onOutstationTrip={onOutstationTrip}
          />
        </div>
      </div>

      <div className="hero-after">
        <TrustStrip />
        <ServicesSection onPick={onServiceCard} />
        <RoutesSection onRoute={onRoute} />
        <DestinationsSection onPick={onDestination} />
        <FleetSection onPick={scrollToConsole} />
        <HowSection />
        <AssuranceSection />
        <Banners />
        <ReviewsSection brand="People Taxi" />
        <CatalogSection brand="People Taxi" />
        <FaqSection />
      </div>
    </div>
  );
}

export function BookPage({ step }: { step: BookStep }) {
  useSeo(
    step === 'plan'
      ? HOME_SEO
      : step === 'choose'
        ? {
            title: 'Choose Vehicle & Upfront Fares · People Taxi',
            description: 'Compare every vehicle category with its upfront fare before you book.',
            canonical: '/book/ride',
            noindex: true,
          }
        : {
            title: 'Review and Confirm Booking · People Taxi',
            description: 'Review your trip itinerary, passenger details and transparent fare before submission.',
            canonical: '/book/confirm',
            noindex: true,
          },
  );

  const { draft } = useBooking();
  const { state: auth } = useAuth();
  const { pickup, drop } = draft;

  if (step !== 'plan' && (!pickup || !drop)) return <Navigate to="/book" replace />;
  // Fares need a signed-in account: a guest on a later step goes back to the form (draft intact),
  // where "Search Cabs" asks them to sign in and then resumes vehicle selection.
  if (step !== 'plan' && auth.status !== 'ready') return <Navigate to="/book" replace />;
  if (step === 'review' && !draft.categoryId) return <Navigate to="/book/ride" replace />;

  if (step === 'choose') return <ChooseStep />;
  if (step === 'review') return <ReviewStep />;
  return <Home />;
}
export default BookPage;
