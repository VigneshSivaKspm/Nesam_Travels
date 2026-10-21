import { useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useCustomerData } from '@/state/customer';
import { useBooking } from '@/state/Booking';
import { useSeo } from '@/lib/seo';
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

const OUTSTATION_KEY = 'ow.outstation.trip';
const readOutstation = (): 'One Way' | 'Round Trip' => {
  try {
    return sessionStorage.getItem(OUTSTATION_KEY) === 'Round Trip' ? 'Round Trip' : 'One Way';
  } catch {
    return 'One Way';
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
      <p className="eyebrow eyebrow--brand">
        <Icon name="route" size={16} /> Premium Outstation &amp; Intercity Cabs
      </p>
      <h1>
        Outstation rides, <em>priced before you book.</em>
      </h1>
      <p className="hero-copy__sub">
        Verified chauffeurs, clean air-conditioned cars, and upfront transparent fares with no hidden costs across Tamil Nadu, Bangalore and Pondicherry.
      </p>
      <ul className="hero-points">
        <li>
          <Icon name="check" size={18} /> Exact upfront fares before booking
        </li>
        <li>
          <Icon name="check" size={18} /> Professional, verified chauffeurs
        </li>
        <li>
          <Icon name="check" size={18} /> Pay your driver directly via Cash or UPI
        </li>
      </ul>
      <div className="hero-trust-badges">
        <div className="badge-pill">
          <Icon name="shield-check" size={16} /> 24/7 Helpline
        </div>
        <div className="badge-pill">
          <Icon name="snowflake" size={16} /> 100% AC Fleet
        </div>
        <div className="badge-pill">
          <Icon name="circle-check" size={16} /> Zero Surge Pricing
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { draft, update } = useBooking();
  const [params, setParams] = useSearchParams();
  const fromUrl = parseService(params.get('service'));
  const tripParam = params.get('trip');
  const service: ServiceId = fromUrl ?? serviceOfTrip(draft.tripType);
  const outstationTrip: 'One Way' | 'Round Trip' =
    draft.tripType === 'Round Trip' ? 'Round Trip' : draft.tripType === 'One Way' ? 'One Way' : readOutstation();
  const lastOutstation = useRef(outstationTrip);

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

  const scrollToConsole = () => {
    const el = document.getElementById('book-console');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
        <FaqSection />
      </div>
    </div>
  );
}

export function BookPage({ step }: { step: BookStep }) {
  useSeo(
    step === 'plan'
      ? {
          title: 'One Way Car Rental — Outstation Cabs & Drop Taxi in Tamil Nadu | Upfront Fares',
          description:
            'Book outstation cabs, one-way drop taxis & round trips across Tamil Nadu, Bangalore & Pondicherry. Verified chauffeurs, clean AC cars, upfront fares & 24/7 support.',
          canonical: '/book',
        }
      : step === 'choose'
        ? {
            title: 'Choose Vehicle & Upfront Fares · One Way Car Rental',
            description: 'Compare every vehicle category with its upfront fare before you book.',
            canonical: '/book/ride',
            noindex: true,
          }
        : {
            title: 'Review and Confirm Booking · One Way Car Rental',
            description: 'Review your trip itinerary, passenger details and transparent fare before submission.',
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
