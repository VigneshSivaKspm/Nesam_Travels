import { ReviewsSection, CatalogSection } from '../../../../user/web/src/components/PublicContentSections';
import { useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useCustomerData } from '@/state/customer';
import { useBooking } from '@/state/Booking';
import { useSeo } from '@/lib/seo';
import { scrollToBookingForm } from '@/lib/scrollToForm';
import { HOME_SEO } from '@/seo/pages';
import { Icon } from '@/components/Icon';
import { parseService, serviceOfTrip, type ServiceId } from '@/lib/services';
import { BookingForm } from './BookingForm';
import { ChooseStep } from './ChooseStep';
import { ReviewStep } from './ReviewStep';
import { SignInRequired } from './SignInRequired';
import { useAuth } from '@/state/Auth';
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

const OUTSTATION_KEY = 'ow.outstation.trip';
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
    /* private mode */
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
        Outstation rides,{' '}<br />
        <span className="hero-accent">priced before you book.</span>
      </h1>
    </div>
  );
}

function Home() {
  const { draft, update } = useBooking();
  const [params, setParams] = useSearchParams();
  const rawService = params.get('service');
  const fromUrl = parseService(rawService);
  const tripParam = params.get('trip');
  const service: ServiceId = fromUrl ?? serviceOfTrip(draft.tripType);
  const outstationTrip: 'One Way' | 'Round Trip' =
    tripParam === 'round-trip' || rawService === 'round-trip'
      ? 'Round Trip'
      : tripParam === 'one-way' || rawService === 'one-way'
        ? 'One Way'
        : draft.tripType === 'Round Trip'
          ? 'Round Trip'
          : draft.tripType === 'One Way'
            ? 'One Way'
            : readOutstation();
  const lastOutstation = useRef(outstationTrip);

  useEffect(() => {
    if (service === 'multicity') return;
    const wanted =
      service === 'airport'
        ? 'Airport Taxi'
        : service === 'rental'
          ? 'Local Rental'
          : outstationTrip === 'Round Trip'
            ? 'Round Trip'
            : 'One Way';
    if (!wanted || wanted === draft.tripType) return;
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

  const location = useLocation();
  const scrollToConsole = useCallback(() => scrollToBookingForm(), []);

  // When a service query param is present or changes, sync outstation preference and scroll to console
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
  }, [location.search, rawService, tripParam, scrollToConsole]);

  const onRoute = (c: Corridor) => {
    update({ pickup: c.pickup, drop: c.drop, tripType: outstationTrip });
    setParams({ service: 'outstation' }, { replace: true });
    scrollToConsole();
    window.setTimeout(() => document.getElementById('bf-date')?.focus({ preventScroll: true }), 400);
  };

  const onDestination = (d: Destination) => {
    update({ drop: d.place, tripType: outstationTrip });
    setParams({ service: 'outstation' }, { replace: true });
    scrollToConsole();
  };

  const onServiceCard = (s: Service) => {
    if (s.id === 'airport') onService('airport');
    else if (s.id === 'local-rental') onService('rental');
    else if (s.id === 'round-trip') onOutstationTrip('Round Trip');
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
        <ReviewsSection brand="One Way Car Rentals" />
        <CatalogSection brand="One Way Car Rentals" />
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
            title: 'Choose Vehicle & Upfront Fares · One Way Car Rentals',
            description: 'Compare every vehicle category with its upfront fare before you book.',
            canonical: '/book/ride',
            noindex: true,
          }
        : {
            title: 'Review and Confirm Booking · One Way Car Rentals',
            description: 'Review your trip itinerary, passenger details and transparent fare before submission.',
            canonical: '/book/confirm',
            noindex: true,
          },
  );

  const { draft } = useBooking();
  const { state: auth } = useAuth();
  const { pickup, drop } = draft;

  if (step !== 'plan' && (!pickup || !drop)) return <Navigate to="/book" replace />;
  if (step !== 'plan' && auth.status !== 'ready') return <SignInRequired />;
  if (step === 'review' && !draft.categoryId) return <Navigate to="/book/ride" replace />;

  if (step === 'choose') return <ChooseStep />;
  if (step === 'review') return <ReviewStep />;
  return <Home />;
}
