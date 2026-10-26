// Live ride and trip details: map, status timeline, driver and vehicle, boarding code,
// what to pay, support — then the receipt and rating once the trip is done. Everything
// shown comes from the booking document and the driver's own live location; nothing is
// estimated beyond the ETA the routing service computes from that location.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { LatLng, RouteInfo, TripRecord } from '@core/types';
import { useCustomerData } from '@/state/customer';
import { cancellationQuote, subscribeToBoardingOtp, subscribeToBooking } from '@core/services/rideService';
import { getRoute } from '@core/services/geoService';
import { PRESENCE_STALE_MS, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { formatDate, formatDateTime, formatDistance, formatDuration, formatINR, formatPhone, formatTime, localMobile, timeAgo } from '@core/utils/format';
import { haversineKm, isValidLatLng } from '@core/utils/geo';
import { describeError } from '@core/utils/retry';
import { customerStatus, tripStatusChip } from '@core/utils/tripView';
import { Avatar, Badge, Button, IconButton, Notice, PageLoader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { RoutePoints } from '@/components/RoutePoints';
import { RouteMap } from '@/components/RouteMap';
import { Workspace } from '@/components/Workspace';
import { FareBreakdown } from '@/components/FareBreakdown';
import { tripFareLines } from '@/lib/fareLines';
import { amountDue, isPaid, payableAmount, upiLink } from '@/lib/tripMoney';
import { buildTripShareText, shareText } from '@/lib/share';
import { printReceipt } from '@/lib/receipt';
import { useDeviceLocation, useOnline } from '@/lib/hooks';
import { useSeo } from '@/lib/seo';
import { useToasts } from '@/state/Toasts';
import { useBooking } from '@/state/Booking';
import { CancelDialog, SafetyDialog } from './dialogs';
import { RatingCard } from './Rating';
import { markRideDismissed, unmarkRideDismissed } from '@/state/rideFocus';
import { vehicleArtUrl } from '@/lib/vehicleArt';

const PHASE_TITLE: Record<TripRecord['phase'], string> = {
  awaiting_review: 'Booking under review',
  arranging: 'Booking approved',
  partner_confirmed: 'Vendor assigned',
  driver_assigned: 'Driver and vehicle assigned',
  driver_en_route: 'Driver on the way',
  driver_arrived: 'Your driver has arrived',
  in_trip: 'On your way',
  completed: 'Trip completed',
  cancelled: 'Ride cancelled',
};

function titleOf(t: TripRecord): string {
  if (t.status === 'Pending') return 'Booking under review';
  if (t.status === 'Rejected') return 'Booking not accepted';
  return PHASE_TITLE[t.phase];
}

type StepState = 'done' | 'current' | 'todo';

interface TimelineStep {
  key: string;
  label: string;
  detail?: string;
  state: StepState;
}

function buildTimeline(trip: TripRecord): TimelineStep[] {
  const at = (d: Date | null) => (d ? formatTime(d) : '');
  const phase = trip.phase;
  const pending = trip.status === 'Pending';
  const order = ['requested', 'approved', 'assigned', 'arrived', 'ontrip', 'done'] as const;
  // Index of the step the ride is currently on.
  let current = 0;
  if (pending) current = 1;
  else if (phase === 'awaiting_review') current = 1;
  else if (phase === 'arranging') current = 2;
  else if (phase === 'partner_confirmed') current = 2;
  else if (phase === 'driver_assigned') current = 3;
  else if (phase === 'driver_en_route') current = 3;
  else if (phase === 'driver_arrived') current = 4;
  else if (phase === 'in_trip') current = 4;
  else if (phase === 'completed') current = 6;

  const label: Record<(typeof order)[number], { done: string; now: string; todo: string; detail: string }> = {
    requested: { done: 'Booking received', now: 'Booking received', todo: 'Booking received', detail: at(trip.createdAt) },
    approved: { done: 'Approved by One Way Car Rental', now: 'Waiting for One Way Car Rental approval', todo: 'One Way Car Rental approval', detail: at(trip.approvedAt) },
    assigned: {
      done: 'Driver and vehicle assigned',
      now: phase === 'partner_confirmed' ? 'Vendor assigned — driver details pending' : 'Arranging your vehicle',
      todo: 'Driver and vehicle assigned',
      detail: at(trip.assignedAt),
    },
    arrived: { done: 'Driver at pickup', now: phase === 'driver_en_route' ? 'Driver on the way' : 'Pickup at your scheduled time', todo: 'Driver arrives', detail: '' },
    ontrip: { done: 'Trip started', now: phase === 'driver_arrived' ? 'Share your code to start' : 'On your way', todo: 'Trip starts', detail: at(trip.startedAt) },
    done: { done: 'Trip completed', now: 'Trip completed', todo: 'Trip completed', detail: at(trip.completedAt) },
  };

  return order.map((key, i) => {
    const state: StepState = i < current ? 'done' : i === current ? 'current' : 'todo';
    const l = label[key];
    return { key, label: state === 'done' ? l.done : state === 'current' ? l.now : l.todo, detail: state === 'todo' ? '' : l.detail, state };
  });
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="timeline" aria-label="Ride progress">
      {steps.map((s) => (
        <li key={s.key} className={`timeline__step is-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span className="timeline__dot" aria-hidden="true">
            {s.state === 'done' ? <Icon name="check" size={14} /> : null}
          </span>
          <span className="timeline__label">
            {s.label}
            <span className="sr-only">{s.state === 'done' ? ' (done)' : s.state === 'current' ? ' (current)' : ' (upcoming)'}</span>
          </span>
          {s.detail ? <time className="timeline__time">{s.detail}</time> : null}
        </li>
      ))}
    </ol>
  );
}

export function RidePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useCustomerData();
  const { startFrom } = useBooking();
  const { push } = useToasts();
  const { online } = useOnline();
  const { position } = useDeviceLocation(true);

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [vanished, setVanished] = useState(false);
  const [subKey, setSubKey] = useState(0);
  const [otp, setOtp] = useState<string | null>(null);
  // The ETA is tagged with its target so a stale one never shows after a phase change.
  const [etaState, setEtaState] = useState<{ target: string; info: RouteInfo } | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [printing, setPrinting] = useState('');
  const [tripRoute, setTripRoute] = useState<{ key: string; info: RouteInfo } | null>(null);

  useSeo({ title: trip ? titleOf(trip) : 'Your ride', noindex: true });

  // Leaving this page (back, minimise) stops it re-opening automatically.
  useEffect(() => {
    unmarkRideDismissed(id);
    return () => markRideDismissed(id);
  }, [id]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  // The booking document is the source of truth for every phase.
  useEffect(() => {
    setTrip(null);
    setVanished(false);
    return subscribeToBooking(
      id,
      (s) => {
        setPending(s.pending);
        setFromCache(s.fromCache);
        if (s.trip) {
          setTrip(s.trip);
          setVanished(false);
        } else if (!s.fromCache) {
          // Gone on the server: a rejected request or a booking removed by an admin.
          setVanished(true);
          setTrip(null);
        }
      },
      (e) => setLoadError(describeError(e, 'We couldn’t load this ride.')),
    );
  }, [id, subKey]);

  // The whole pickup → destination route, for the map (same cached lookup the booking used).
  const routeKey = trip && isValidLatLng(trip.pickup) && isValidLatLng(trip.drop) ? `${trip.pickup.lat},${trip.pickup.lng}>${trip.drop.lat},${trip.drop.lng}` : '';
  useEffect(() => {
    if (!trip || !routeKey) return undefined;
    const controller = new AbortController();
    getRoute(trip.pickup, trip.drop, controller.signal)
      .then((info) => !controller.signal.aborted && setTripRoute({ key: routeKey, info }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps -- endpoints are encoded in the key

  // The boarding code lives in booking_secrets, readable only by the rider who booked.
  useEffect(() => subscribeToBoardingOtp(id, setOtp), [id]);

  const tracking = !!trip && ['driver_en_route', 'driver_arrived', 'in_trip'].includes(trip.phase);
  const driverLoc = tracking ? (trip?.driverLocation ?? null) : null;
  const driverFresh = !!driverLoc?.updatedAt && now - driverLoc.updatedAt.getTime() < PRESENCE_STALE_MS;

  // ETA: driver → pickup before the trip, driver → drop during it. Re-routed when the
  // driver has moved ~150 m or every 45 s, whichever comes first.
  const etaAnchor = useRef<{ at: number; from: LatLng | null; target: string }>({ at: 0, from: null, target: '' });
  useEffect(() => {
    if (!trip || !driverLoc) return undefined;
    const target = trip.phase === 'in_trip' ? trip.drop : trip.pickup;
    if (!isValidLatLng(target)) return undefined;
    const key = trip.phase === 'in_trip' ? 'drop' : 'pickup';
    const a = etaAnchor.current;
    const moved = a.from ? haversineKm(a.from, driverLoc) : Infinity;
    if (a.target === key && moved < 0.15 && Date.now() - a.at < 45000) return undefined;
    etaAnchor.current = { at: Date.now(), from: driverLoc, target: key };
    const controller = new AbortController();
    getRoute(driverLoc, target, controller.signal)
      .then((r) => !controller.signal.aborted && setEtaState({ target: key, info: r }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [driverLoc?.lat, driverLoc?.lng, trip?.phase]); // eslint-disable-line react-hooks/exhaustive-deps -- throttled on position/phase

  const etaTarget = trip?.phase === 'in_trip' ? 'drop' : 'pickup';
  const eta = driverLoc && etaState?.target === etaTarget ? etaState.info : null;



  if (loadError && !trip) {
    return (
      <div className="page">
        <Notice
          tone="error"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setLoadError('');
                setSubKey((k) => k + 1);
              }}
            >
              Try again
            </Button>
          }
        >
          {loadError}
        </Notice>
        <p className="page__after">
          <Link className="btn btn--secondary" to="/trips">
            Back to my trips
          </Link>
        </p>
      </div>
    );
  }
  if (vanished) {
    return (
      <div className="page">
        <Notice tone="warning">
          This ride is no longer available. If you just requested it, our servers did not accept the request and nothing was charged — please try again, or contact support if it keeps happening.
        </Notice>
        <p className="page__after">
          <Link className="btn btn--primary" to="/book">
            Back to booking
          </Link>
        </p>
      </div>
    );
  }
  if (!trip) return <PageLoader label={pending ? 'Sending your ride request…' : 'Loading your ride…'} />;

  const phase = trip.phase;
  const canCancel = cancellationQuote(trip).allowed;
  const minutesAway = eta ? Math.max(1, Math.round(eta.durationMin)) : null;
  const straightKm = driverLoc && isValidLatLng(trip.pickup) ? haversineKm(driverLoc, trip.pickup) : null;
  const sharePoint: LatLng | null = phase === 'in_trip' && driverLoc ? driverLoc : position;
  const driverPhone = trip.driver ? localMobile(trip.driver.phone) : '';
  const chip = tripStatusChip(trip);
  const title = titleOf(trip);
  const finished = phase === 'completed' || phase === 'cancelled';
  const due = amountDue(trip);
  const mapPickup = phase === 'in_trip' ? null : trip.pickup;
  const streamingNote = tracking && driverLoc && !driverFresh ? `Driver location last updated ${timeAgo(driverLoc.updatedAt, now)}.` : '';

  const doShare = async () => {
    const r = await shareText(`One Way Car Rental ride ${trip.bookingId}`, buildTripShareText(trip, sharePoint));
    if (r === 'copied') push({ title: 'Trip details copied', message: 'Paste them into a message to share.', tone: 'success' });
  };
  const bookAgain = () => {
    if (isValidLatLng(trip.pickup) && isValidLatLng(trip.drop)) startFrom(trip.pickup, trip.drop);
    navigate('/book');
  };
  const doPrint = () => {
    try {
      printReceipt(trip, profile?.name || 'Customer');
    } catch {
      setPrinting('We couldn’t open the print dialog. Please try again.');
    }
  };

  const stepsNow = buildTimeline(trip);
  const status = customerStatus(trip, now);
  const hero =
    phase === 'driver_en_route' && tracking
      ? { big: minutesAway != null ? `${minutesAway} min` : '—', small: 'until your driver arrives' }
      : phase === 'in_trip'
        ? { big: minutesAway != null ? formatDuration(minutesAway) : '—', small: `until you reach ${trip.drop.name}` }
        : null;

  // The driver's leg is drawn over the whole trip, which stays quietly underneath.
  const legPath = tracking && eta ? eta.path : null;
  const wholePath = tripRoute?.key === routeKey ? tripRoute.info.path : null;

  const tripCard = (
    <section className="rcard" aria-labelledby="trip-h">
      <header>
        <h2 id="trip-h">Trip</h2>
      </header>
      <RoutePoints pickup={trip.pickup.name} drop={trip.drop.name} pickupAddress={trip.pickup.address} dropAddress={trip.drop.address} />
      <div className="mini-ride">
        <img src={vehicleArtUrl({ name: trip.categoryName, seats: 4 })} alt="" width={96} height={63} />
        <div className="mini-ride__info">
          <strong>{trip.categoryName}</strong>
          <small className="muted">
            {trip.tripType} · {trip.service}
            {trip.distanceKm ? ` · ${formatDistance(trip.distanceKm)}` : ''}
          </small>
        </div>
        <div className="mini-ride__fare">
          <small>Fare</small>
          <strong className="num">{formatINR(trip.fareBreakdown?.total ?? trip.fare)}</strong>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>{trip.scheduledAt ? 'Pickup' : 'Booked'}</dt>
          <dd>{trip.scheduledAt ? `${formatDate(trip.scheduledAt)}, ${formatTime(trip.scheduledAt)}` : formatDateTime(trip.createdAt)}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>
            {trip.paymentMethod} · {isPaid(trip) ? 'Paid' : trip.paymentStatus}
          </dd>
        </div>
        {trip.notes ? (
          <div>
            <dt>Your note</dt>
            <dd>{trip.notes}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );

  const moneyBox =
    phase !== 'cancelled' && trip.status !== 'Pending' ? (
      isPaid(trip) ? (
        <div className="pay-box pay-box--paid">
          <Icon name="success" size={24} />
          <div>
            <strong>Paid {formatINR(trip.paid?.totalPaid || payableAmount(trip))}</strong>
            <small>via {trip.paymentMethod}. Thank you!</small>
          </div>
        </div>
      ) : (
        <div className="pay-box">
          <div>
            <small className="eyebrow">{trip.paymentMethod === 'UPI' ? 'Pay by UPI' : 'Pay your driver in cash'}</small>
            <strong className="num pay-box__amount">{formatINR(due)}</strong>
            <small>
              {trip.paid && trip.paid.totalPaid > 0 ? `Balance after ${formatINR(trip.paid.totalPaid)} paid. ` : ''}
              {phase === 'completed' ? 'Your driver confirms the payment once collected.' : 'Collected by your driver at the end of the trip. Tolls and parking, if any, are added at actuals.'}
            </small>
          </div>
          {trip.paymentMethod === 'UPI' && upiLink(trip) ? (
            <a className="btn btn--secondary btn--sm" href={upiLink(trip)!}>
              Open UPI app
            </a>
          ) : null}
        </div>
      )
    ) : null;

  const timeline = (
    <section className="rcard" aria-labelledby="progress-h">
      <header>
        <h2 id="progress-h">Progress</h2>
      </header>
      <Timeline steps={stepsNow} />
    </section>
  );

  const foot =
    finished || (tracking && driverPhone) ? (
      finished ? (
        <Button size="lg" block onClick={bookAgain}>
          {phase === 'completed' ? 'Book this trip again' : 'Book another ride'}
        </Button>
      ) : (
        <a className="btn btn--primary btn--lg btn--block" href={`tel:+91${driverPhone}`}>
          <Icon name="phone" /> Call {trip.driver?.name.split(' ')[0] ?? 'driver'}
        </a>
      )
    ) : undefined;

  return (
    <Workspace
      label="Ride details"
      foot={foot}
      head={
        <header className="work__head">
          <div className="work__head-row">
            <IconButton icon="arrow-left" label="Back" outline onClick={() => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/trips'))} />
            <span className="status-chip" style={{ color: chip.fg, background: chip.bg }}>
              {chip.label}
            </span>
          </div>
          <div>
            <p className="work__ref">
              Booking <strong className="num">{trip.bookingId}</strong>
              {pending ? <span>sending…</span> : fromCache && !online ? <span>offline</span> : null}
            </p>
            <h1 className="work__title">{title}</h1>
          </div>
        </header>
      }
      map={
        <RouteMap
          className="work__canvas"
          label="Ride map"
          pickup={mapPickup}
          drop={trip.drop}
          driver={driverLoc ? { lat: driverLoc.lat, lng: driverLoc.lng, label: trip.driver?.name, stale: !driverFresh } : null}
          userLocation={position}
          path={legPath ?? wholePath}
          basePath={legPath ? wholePath : null}
          padding={{ top: 56, right: 48, bottom: 48, left: 48 }}
        />
      }
    >
      {/* Awaiting review / approved / vendor assigned: a status, never a search or an arrival promise */}
      {phase === 'awaiting_review' || phase === 'arranging' || phase === 'partner_confirmed' ? (
        <div className="status-card">
          <img src="/art/account-review.webp" alt="" width={96} height={96} />
          <div>
            <strong>{status.label}</strong>
            <p>{pending ? 'Sending your request…' : status.detail}</p>
            {trip.scheduledAt ? <p className="muted small">Pickup: {formatDateTime(trip.scheduledAt)}</p> : null}
          </div>
        </div>
      ) : null}
      {phase === 'driver_assigned' ? (
        <Notice tone="success">
          <strong>{status.label}.</strong> {status.detail}
        </Notice>
      ) : null}

      {/* Live: ETA, code, driver */}
      {tracking && hero ? (
        <div className="eta">
          <span className="eta__big num">{hero.big}</span>
          <span className="eta__small">{hero.small}</span>
          {phase === 'driver_en_route' && straightKm != null && !eta ? <span className="eta__small">Driver is {formatDistance(straightKm)} from your pickup.</span> : null}
        </div>
      ) : null}
      {streamingNote ? <p className="muted small">{streamingNote}</p> : null}
      {tracking && !driverLoc ? <p className="muted small">Live location appears once your driver’s app shares it.</p> : null}

      {(phase === 'driver_assigned' || phase === 'driver_en_route' || phase === 'driver_arrived') && trip.driver ? (
        <div className={`otp-card ${phase === 'driver_arrived' ? 'is-arrived' : ''}`}>
          <div>
            <strong>{phase === 'driver_arrived' ? 'Share this code to start your ride' : 'Your start-of-ride code'}</strong>
            <small>
              {phase === 'driver_arrived' ? `Meet your driver at ${trip.pickup.name}. Only share the code once you’re in the car.` : 'Give it to your driver once you’re in the car.'}
            </small>
          </div>
          <span className="otp-card__code num" aria-label={`Ride code ${otp ? otp.split('').join(' ') : 'unavailable'}`}>
            {otp ?? '····'}
          </span>
        </div>
      ) : null}

      {trip.driver && (tracking || phase === 'driver_assigned') ? (
        <section className="driver-card" aria-label="Your driver">
          <Avatar name={trip.driver.name} photoUrl={trip.driver.photoUrl} size={60} />
          <div className="driver-card__text">
            <strong>{trip.driver.name}</strong>
            <small className="muted">
              {trip.driver.rating != null ? `★ ${trip.driver.rating.toFixed(1)} · ` : ''}
              {trip.driver.vehicleModel || trip.categoryName}
            </small>
          </div>
          {trip.driver.vehicleNumber ? <span className="plate">{trip.driver.vehicleNumber}</span> : null}
        </section>
      ) : null}
      {driverPhone && (tracking || phase === 'driver_assigned') ? (
        <div className="driver-actions">
          <a className="btn btn--dark btn--sm" href={`tel:+91${driverPhone}`}>
            <Icon name="phone" /> Call driver
          </a>
          <a className="btn btn--secondary btn--sm" href={`https://wa.me/91${driverPhone}`} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" /> WhatsApp
          </a>
          <p className="muted small driver-actions__note">Calls go to {formatPhone(driverPhone)}.</p>
        </div>
      ) : (tracking || phase === 'driver_assigned') && trip.driver ? (
        <Badge>No phone number on file for this driver</Badge>
      ) : null}

      {/* Cancelled */}
      {phase === 'cancelled' ? (
        <Notice tone={trip.cancellationFee > 0 ? 'warning' : 'info'}>
          <strong>
            {trip.status === 'Rejected' ? 'This booking was not accepted' : trip.cancelledBy === 'customer' ? 'You cancelled this ride' : 'This ride was cancelled'}
            {trip.cancelReason ? ` — “${trip.cancelReason}”` : ''}.
          </strong>{' '}
          {trip.cancellationFee > 0 ? `A cancellation fee of ${formatINR(trip.cancellationFee)} applies per our policy.` : 'No cancellation fee was charged.'}
          {trip.refund && trip.refund.amount > 0 ? ` Refund ${trip.refund.status.toLowerCase()}: ${formatINR(trip.refund.amount)}.` : ''}
        </Notice>
      ) : null}

      {phase === 'completed' ? (
        <>
          <section className="done-card">
            <img src="/art/trip-completed.webp" alt="" width={120} height={120} />
            <div>
              <h2>You’ve arrived at {trip.drop.name}</h2>
              <p className="muted">{formatDateTime(trip.completedAt)}</p>
            </div>
          </section>
          {moneyBox}
          <section className="rcard" aria-labelledby="receipt-h">
            <header>
              <h2 id="receipt-h">Receipt</h2>
              <Button size="sm" variant="secondary" icon="download" onClick={doPrint}>
                Save or print
              </Button>
            </header>
            {printing ? <Notice tone="error">{printing}</Notice> : null}
            <FareBreakdown lines={tripFareLines(trip)} total={trip.fareBreakdown?.total ?? trip.fare} tolls={trip.tollCharges} />
            {trip.paid && trip.paid.totalPaid > 0 ? (
              <p className="muted small">
                Paid so far {formatINR(trip.paid.totalPaid)} · Balance {formatINR(trip.paid.balanceDue)}
              </p>
            ) : null}
          </section>
          {profile ? <RatingCard trip={trip} profile={profile} /> : null}
          {tripCard}
          <details className="rcard rcard--fold">
            <summary>
              <h2>Trip timeline</h2>
              <Icon name="chevron-down" size={18} />
            </summary>
            <Timeline steps={stepsNow} />
          </details>
        </>
      ) : (
        <>
          {phase !== 'cancelled' ? timeline : null}
          {tripCard}
          {moneyBox}
        </>
      )}

      {/* Options */}
      <section className="options" aria-label="Trip options">
        {!finished ? (
          <button type="button" className="option" onClick={() => void doShare()}>
            <Icon name="share" /> Share trip details
          </button>
        ) : null}
        <Link className="option" to={`/support?booking=${encodeURIComponent(trip.bookingId)}`}>
          <Icon name="support" /> Get help with this trip
        </Link>
        {tracking ? (
          <button type="button" className="option option--danger" onClick={() => setShowSafety(true)}>
            <Icon name="emergency" /> Safety centre · SOS
          </button>
        ) : null}
        {canCancel ? (
          <button type="button" className="option option--danger" onClick={() => setShowCancel(true)}>
            <Icon name="cancellation" /> Cancel booking
          </button>
        ) : null}
        <a className="option" href={`tel:${SUPPORT_PHONE}`}>
          <Icon name="phone" /> Call One Way Car Rental · {SUPPORT_PHONE_DISPLAY}
        </a>
      </section>

      {showCancel ? <CancelDialog trip={trip} onClose={() => setShowCancel(false)} /> : null}
      {showSafety && profile ? <SafetyDialog trip={trip} profile={profile} location={sharePoint} onClose={() => setShowSafety(false)} /> : null}
    </Workspace>
  );
}
