import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useCustomerData } from '@core/context/CustomerData';
import { useBooking } from '@/state/Booking';
import { usePageTitle } from '@/lib/hooks';
import { useSeo } from '@/lib/seo';
import { Icon } from '@/components/Icon';
import { PlanStep, type PlanIntent, type PlanUi } from './PlanStep';
import { ChooseStep } from './ChooseStep';
import { ReviewStep } from './ReviewStep';
import { AssuranceSection, Banners, DestinationsSection, FaqSection, FleetSection, HowSection, RoutesSection, ServicesSection, TrustStrip } from './HomeSections';
import { IMG, type Corridor, type Destination, type Service } from './content';

export type BookStep = 'plan' | 'choose' | 'review';

/** A ride in progress, or one waiting for a rating, surfaced above the hero. */
function RideBanner() {
  const { liveRide, unratedTrip } = useCustomerData();
  if (liveRide) {
    return (
      <div className="ride-banner">
        <div className="ride-banner__inner">
          <span className="ride-banner__pulse" aria-hidden="true" />
          <p>
            <strong>{liveRide.status === 'Ongoing' ? 'Trip in progress' : 'Upcoming booking'}</strong>
            <span className="truncate"> · to {liveRide.drop.name}</span>
          </p>
          <Link className="btn btn--sm ride-banner__btn" to={`/ride/${liveRide.id}`}>
            View booking <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </div>
    );
  }
  if (unratedTrip) {
    return (
      <div className="ride-banner ride-banner--soft">
        <div className="ride-banner__inner">
          <Icon name="star" size={18} />
          <p>
            <strong>How was your ride?</strong>
            <span className="truncate"> · rate your trip to {unratedTrip.drop.name}</span>
          </p>
          <Link className="btn btn--sm ride-banner__btn" to={`/ride/${unratedTrip.id}`}>
            Rate trip <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </div>
    );
  }
  return null;
}

function Home() {
  const { update, draft } = useBooking();
  const [ui, setUi] = useState<PlanUi>({ active: null, pin: null });
  const [intent, setIntent] = useState<PlanIntent | null>(null);

  const toConsole = () => document.getElementById('book-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const ask = (field: PlanIntent['field'], text = '') => setIntent({ n: Date.now(), field, text });

  const onRoute = (c: Corridor) => {
    update({ pickup: c.pickup, drop: c.drop });
    toConsole();
  };
  const onDestination = (d: Destination) => {
    update({ drop: d.place });
    toConsole();
    if (!draft.pickup) ask('pickup');
  };
  const onService = (s: Service) => {
    if (s.action.tripType) update({ tripType: s.action.tripType });
    toConsole();
    if (s.action.search) ask('drop', s.action.search);
    else if (!draft.drop) ask('drop');
  };

  return (
    <>
      <RideBanner />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__media">
          <picture>
            <source media="(max-width: 720px)" srcSet={IMG('heroes/hero-mobile')} />
            <img src={IMG('heroes/hero-desktop')} alt="One Way Car Rental outstation and intercity cab service across Tamil Nadu" width={1774} height={887} fetchPriority="high" />
          </picture>
          <span className="hero__shade" />
        </div>
        <div className="hero__inner">
          <div className="hero__copy">
            <p className="hero__eyebrow">
              <Icon name="route" size={16} /> Outstation &amp; intercity cabs
            </p>
            <h1 id="hero-title">Outstation rides, priced before you book.</h1>
            <p className="hero__lead">Verified chauffeurs, clean air-conditioned cars and the fare for every vehicle upfront — across Tamil Nadu and beyond.</p>
            <ul className="hero__points">
              <li>
                <Icon name="check" size={18} /> Fares shown upfront
              </li>
              <li>
                <Icon name="check" size={18} /> Verified chauffeurs
              </li>
              <li>
                <Icon name="check" size={18} /> Pay your driver in cash or UPI
              </li>
            </ul>
          </div>
        </div>
        <div className="hero__console">
          <PlanStep ui={ui} setUi={setUi} intent={intent} />
        </div>
      </section>

      <div className="hero-after">
        <TrustStrip />
        <ServicesSection onPick={onService} />
        <RoutesSection onRoute={onRoute} />
        <DestinationsSection onPick={onDestination} />
        <FleetSection onPick={toConsole} />
        <HowSection />
        <AssuranceSection />
        <Banners />
        <FaqSection />
      </div>
    </>
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
            description: 'Select your vehicle category and check exact upfront fare with verified chauffeurs.',
            canonical: '/book/ride',
            noindex: true,
          }
        : {
            title: 'Review and Confirm Booking · One Way Car Rental',
            description: 'Review ride details and scheduled pickup. Pay your driver directly in Cash or via UPI.',
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
