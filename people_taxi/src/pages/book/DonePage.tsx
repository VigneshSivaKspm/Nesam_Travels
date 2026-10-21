// Confirmation page after a booking request is saved.
// Shows the journey art, a printable ticket card with trip id, route, schedule and live status.
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCustomerData } from '@/state/customer';
import { formatDate, formatTime } from '@core/utils/format';
import { Button, PageLoader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { TripRecord, TripType } from '@core/types';

function JourneyArt({ done }: { done: boolean }) {
  return (
    <div className={`journey-art ${done ? 'is-done' : ''}`} aria-hidden="true">
      <div className="journey-art__track">
        <span className="journey-art__start" />
        <span className="journey-art__line" />
        <span className="journey-art__car">
          <Icon name="car" size={26} />
        </span>
      </div>
      <div className="journey-art__badge">
        <Icon name={done ? 'check' : 'clock'} size={28} />
      </div>
    </div>
  );
}

const tripTypeLabel = (t: TripType): string => {
  if (t === 'One Way') return 'One Way Drop';
  if (t === 'Round Trip') return 'Round Trip';
  if (t === 'Local Rental') return 'Local Rental';
  return 'Airport Taxi';
};

const headline = (t: TripRecord): { title: string; text: string; tone: 'pending' | 'ok' | 'bad' } => {
  if (t.status === 'Cancelled' || t.status === 'Rejected') {
    return {
      title: 'Booking request cancelled',
      text: t.cancelReason || 'This booking has been cancelled.',
      tone: 'bad',
    };
  }
  if (t.status === 'Approved' || t.status === 'Assigned') {
    return {
      title: 'Your ride is confirmed',
      text: 'Our chauffeur will arrive at your pickup location on time.',
      tone: 'ok',
    };
  }
  return {
    title: 'Booking Request Received',
    text: 'Our dispatch team is assigning your chauffeur. You will receive updates shortly.',
    tone: 'pending',
  };
};

export function DonePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trips } = useCustomerData();
  const trip = trips.find((t) => t.id === id);

  if (!trip) return <PageLoader label="Loading your booking details…" />;

  const h = headline(trip);
  const at = trip.scheduledAt;

  return (
    <div className="flow-page flow-page--done">
      <div className="wrap flow-page__wrap">
        <div className="done">
          <div className="done__hero">
            <JourneyArt done={h.tone === 'ok'} />
            <h1>{h.title}</h1>
            <p>{h.text}</p>
            <p className="done__saved">
              <Icon name="shield-check" size={14} /> Your trip is saved in My Bookings.
            </p>
          </div>

          <section className="ticket" aria-label="Trip summary">
            <header className="ticket__head">
              <span className="ticket__brand">PEOPLE TAXI</span>
              <span>Trip Summary</span>
            </header>
            <div className="ticket__body">
              <div className="ticket__id">
                <span>Booking ID</span>
                <strong className="num">{trip.bookingId || `#${trip.id.slice(-6).toUpperCase()}`}</strong>
              </div>
              <ol className="ticket__route">
                <li>
                  <span className="ticket__dot" aria-hidden="true" />
                  <small>Pickup location</small>
                  <strong>{trip.pickup.name}</strong>
                </li>
                <li>
                  <span className="ticket__dot ticket__dot--drop" aria-hidden="true" />
                  <small>Drop location</small>
                  <strong>{trip.drop.id === 'place-local-disposal' ? 'Within the city' : trip.drop.name}</strong>
                </li>
              </ol>
              <div className="ticket__cut" aria-hidden="true" />
              <div className="ticket__grid">
                <div>
                  <Icon name="calendar" size={17} />
                  <span>
                    <small>Pickup date</small>
                    <strong>{at ? formatDate(at) : '—'}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="clock" size={17} />
                  <span>
                    <small>Pickup time</small>
                    <strong>{at ? formatTime(at) : '—'}</strong>
                  </span>
                </div>
              </div>
              <div className="ticket__car">
                <Icon name="car" size={17} />
                <span>
                  <strong>{trip.categoryName}</strong>
                  <small>{trip.paymentMethod === 'UPI' ? 'Pay chauffeur by UPI' : 'Pay chauffeur in cash'}</small>
                </span>
                <span className="badge badge--brand">{tripTypeLabel(trip.tripType)}</span>
              </div>
              <p className={`ticket__status ticket__status--${h.tone}`}>
                <Icon name={h.tone === 'ok' ? 'check' : h.tone === 'bad' ? 'circle-xmark' : 'clock'} size={15} /> Status:{' '}
                {h.tone === 'pending' ? 'Awaiting Dispatch Review' : h.title}
              </p>
            </div>
          </section>
        </div>
      </div>
      <div className="done-actions">
        <Button size="lg" icon="home" onClick={() => navigate('/book')}>
          Back to Home
        </Button>
        <Link className="btn btn--text btn--lg" to={`/trips/${trip.id}`}>
          <Icon name="arrow-right" size={16} /> View Booking
        </Link>
      </div>
    </div>
  );
}
export default DonePage;
