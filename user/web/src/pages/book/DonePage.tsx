// After "Submit booking request": a ticket for the booking that was just created. The headline follows
// the booking's real status — a new request is awaiting NESAM's review and is not called confirmed
// until NESAM approves it. Safe to reload: everything is read from the booking itself.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { TripRecord } from '@core/types';
import { subscribeToBooking } from '@core/services/rideService';
import { formatDate, formatTime } from '@core/utils/format';
import { describeError } from '@core/utils/retry';
import { Button, Notice, PageLoader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useSeo } from '@/lib/seo';
import { useBooking } from '@/state/Booking';
import { tripTypeLabel } from '@/lib/services';

function headline(t: TripRecord): { title: string; text: string; tone: 'pending' | 'ok' | 'bad' } {
  if (t.status === 'Rejected') return { title: 'Booking not accepted', text: 'NESAM could not accept this booking request. Nothing has been charged.', tone: 'bad' };
  if (t.status === 'Cancelled') return { title: 'Booking cancelled', text: 'This booking has been cancelled.', tone: 'bad' };
  if (t.status === 'Pending') return { title: 'Booking request received', text: 'NESAM is reviewing your request. We’ll confirm it here and by message once it is approved.', tone: 'pending' };
  return { title: 'Booking Confirmed', text: 'Your trip is confirmed. We will arrange your cab.', tone: 'ok' };
}

function JourneyArt({ done }: { done: boolean }) {
  return (
    <div className={`journey-art ${done ? 'is-done' : ''}`} aria-hidden="true">
      <span className="journey-art__track">
        <span className="journey-art__start" />
        <span className="journey-art__line" />
        <span className="journey-art__car">
          <Icon name="car" size={30} />
        </span>
      </span>
      <span className="journey-art__badge">
        <Icon name={done ? 'check' : 'clock'} size={26} />
      </span>
    </div>
  );
}

export function DonePage() {
  useSeo({ title: 'Booking request received', noindex: true });
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();
  const { reset } = useBooking();

  // Arriving straight from "Submit booking request": the draft has done its job.
  useEffect(() => {
    if ((location.state as { fresh?: boolean } | null)?.fresh) reset();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival

  useEffect(() => {
    setError('');
    return subscribeToBooking(
      id,
      (s) => {
        setPending(s.pending);
        if (s.trip) {
          setTrip(s.trip);
          setMissing(false);
        } else if (!s.fromCache) setMissing(true);
      },
      (e) => setError(describeError(e, 'We couldn’t load your booking.')),
    );
  }, [id, attempt]);

  if (error && !trip) {
    return (
      <div className="flow-page">
        <div className="wrap flow-page__wrap done-state">
          <Notice
            tone="error"
            action={
              <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            }
          >
            {error} Your request may still have been received — check My Bookings.
          </Notice>
          <Link className="btn btn--secondary" to="/trips">
            Open My Bookings
          </Link>
        </div>
      </div>
    );
  }
  if (missing) {
    return (
      <div className="flow-page">
        <div className="wrap flow-page__wrap done-state">
          <Notice tone="warning">We can’t find this booking. If you just submitted it, the request was not accepted and nothing was charged — please try again or call support.</Notice>
          <Link className="btn btn--primary" to="/book">
            Back to booking
          </Link>
        </div>
      </div>
    );
  }
  if (!trip) return <PageLoader label="Loading your booking…" />;

  const h = headline(trip);
  const at = trip.scheduledAt;
  return (
    <div className="flow-page flow-page--done">
      <div className="wrap flow-page__wrap">
        <div className="done">
          <div className="done__hero">
            <JourneyArt done={h.tone === 'ok'} />
            <h1>{h.title}</h1>
            <p>{pending ? 'Sending your request…' : h.text}</p>
            <p className="done__saved">
              <Icon name="shield-check" size={14} /> Your trip is saved in My Bookings.
            </p>
          </div>

          <section className="ticket" aria-label="Trip summary">
            <header className="ticket__head">
              <span className="ticket__brand">NESAM</span>
              <span>Trip summary</span>
            </header>
            <div className="ticket__body">
              <div className="ticket__id">
                <span>Booking ID</span>
                <strong className="num">{trip.bookingId}</strong>
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
                  <small>{trip.paymentMethod === 'UPI' ? 'Pay your driver by UPI' : 'Pay your driver in cash'}</small>
                </span>
                <span className="badge badge--red">{tripTypeLabel(trip.tripType)}</span>
              </div>
              <p className={`ticket__status ticket__status--${h.tone}`}>
                <Icon name={h.tone === 'ok' ? 'success' : h.tone === 'bad' ? 'warning' : 'clock'} size={15} /> Status: {h.tone === 'pending' ? 'Awaiting NESAM review' : h.title}
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
