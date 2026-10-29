import { ReviewsSection, CatalogSection } from '../../../../user/web/src/components/PublicContentSections';
import { useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import type { TripType } from '@core/types';
import { useCustomerData } from '@core/context/CustomerData';
import { useAuth } from '@/state/Auth';
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

const OUTSTATION_KEY = 'peopletaxi.outstation.trip';
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
        <Icon name="route" size={16} /> Friendly City &amp; Outstation Taxi
      </p>
      <h1>
        Any journey, <em>priced with a friendly smile.</em>
      </h1>
      <p className="hero-copy__sub">
        Verified chauffeurs, clean air-conditioned cars, and 100% upfront transparent fares with no hidden costs across Tamil Nadu, Bangalore and Pondicherry.
      </p>
      <ul className="hero-points">
        <li>
          <Icon name="check" size={18} /> Exact upfront fares before you book
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
  const service: ServiceId = fromUrl ?? (tripParam === 'round-trip' ? 'round-trip' : serviceOfTrip(draft.tripType));

  useEffect(() => {
    const wanted: TripType =
      service === 'airport'
        ? 'Airport Taxi'
        : service === 'rental'
          ? 'Local Rental'
          : service === 'round-trip'
            ? 'Round Trip'
            : 'One Way';
    if (wanted === draft.tripType) return;
    update((d) => ({
      tripType: wanted,
      drop: d.drop?.id === 'place-local-disposal' && wanted !== 'Local Rental' ? null : d.drop,
      tripEndAt: wanted === 'Round Trip' ? d.tripEndAt : null,
    }));
  }, [service]); // eslint-disable-line react-hooks/exhaustive-deps

  const onService = useCallback(
    (s: ServiceId) => {
      setParams({ service: s }, { replace: true });
    },
    [setParams],
  );

  const scrollToConsole = () => {
    const el = document.getElementById('book-console');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const onRoute = (c: Corridor) => {
    update({ pickup: c.pickup, drop: c.drop, tripType: 'One Way' });
    setParams({ service: 'one-way' }, { replace: true });
    scrollToConsole();
    window.setTimeout(() => document.getElementById('bf-date')?.focus({ preventScroll: true }), 400);
  };

  const onDestination = (d: Destination) => {
    update({ drop: d.place, tripType: 'One Way' });
    setParams({ service: 'one-way' }, { replace: true });
    scrollToConsole();
  };

  const onServiceCard = (s: Service) => {
    if (s.id === 'airport') onService('airport');
    else if (s.id === 'local-rental') onService('rental');
    else if (s.id === 'round-trip') onService('round-trip');
    else onService('one-way');
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
        <ReviewsSection />
        <CatalogSection />
        <FaqSection />
      </div>
    </div>
  );
}

export function BookPage({ step }: { step: BookStep }) {
  useSeo(
    step === 'plan'
      ? {
          title: 'People Taxi — Outstation Cabs & One Way Drop Taxi in Tamil Nadu | Upfront Fares',
          description:
            'Book outstation cabs, one-way drop taxis & round trips across Tamil Nadu, Bangalore & Pondicherry. Verified chauffeurs, clean AC cars, upfront fares & 24/7 support.',
          canonical: '/book',
        }
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
