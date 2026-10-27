// Confirmation page after a booking request is saved.
// Shows the journey art, a printable ticket card with trip id, route, schedule and live status.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCustomerData } from '@/state/customer';
import { formatDate, formatTime } from '@core/utils/format';
import { Button, Dialog, LinkButton, PageLoader } from '@/components/ui';
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

const bookingRef = (t: TripRecord) => t.bookingId || `#${t.id.slice(-6).toUpperCase()}`;

/** Shown once, right after the booking server accepted the request (never on a revisit). */
function BookedDialog({ trip, onClose }: { trip: TripRecord; onClose: () => void }) {
  const at = trip.scheduledAt;
  return (
    <Dialog
      title="Booking confirmed"
      onClose={onClose}
      className="booked-dialog"
      footer={
        <div className="booked__actions">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          <LinkButton variant="primary" to={`/trips/${trip.id}`} trailing="arrow-right">
            View Booking
          </LinkButton>
        </div>
      }
    >
      <div className="booked">
        <svg className="booked__mark" viewBox="0 0 64 64" aria-hidden="true">
          <circle className="booked__ring" cx="32" cy="32" r="29" />
          <path className="booked__tick" d="M19 33.5l9 9 17-19" />
        </svg>
        <p className="booked__lead">Your ride request is saved. Our dispatch team will assign your chauffeur and keep you updated.</p>
        <div className="booked__id">
          <span>Booking ID</span>
          <strong className="num">{bookingRef(trip)}</strong>
        </div>
        <dl className="booked__trip">
          <div>
            <dt>Route</dt>
            <dd>
              {trip.pickup.name} → {trip.drop.id === 'place-local-disposal' ? 'Within the city' : trip.drop.name}
            </dd>
          </div>
          <div>
            <dt>Pickup</dt>
            <dd>{at ? `${formatDate(at)} · ${formatTime(at)}` : '—'}</dd>
          </div>
          <div>
            <dt>Vehicle</dt>
            <dd>
              {trip.categoryName} · {tripTypeLabel(trip.tripType)}
            </dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}

export function DonePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trips } = useCustomerData();
  const trip = trips.find((t) => t.id === id);
  const [booked, setBooked] = useState(() => (location.state as { confirmed?: boolean } | null)?.confirmed === true);

  // The flag is consumed: reloading or coming back to this page never shows the dialog again.
  useEffect(() => {
    if (booked) navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
              <span className="ticket__brand">ONE WAY CAR RENTAL</span>
              <span>Trip Summary</span>
            </header>
            <div className="ticket__body">
              <div className="ticket__id">
                <span>Booking ID</span>
                <strong className="num">{bookingRef(trip)}</strong>
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
                <span className="badge badge--green">{tripTypeLabel(trip.tripType)}</span>
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
      {booked ? <BookedDialog trip={trip} onClose={() => setBooked(false)} /> : null}
    </div>
  );
}
export default DonePage;
