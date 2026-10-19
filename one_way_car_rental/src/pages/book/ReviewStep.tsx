// Step 3 — review and confirm: route, time, vehicle, payment, contact, the final fare
// breakup and the booking itself. The server re-prices and refuses a fare that changed.
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FareBreakdown as Fare } from '@core/types';
import { useCustomerData } from '@core/context/CustomerData';
import { createRideRequest } from '@core/services/rideService';
import { buildFareBreakup } from '@core/utils/fareBreakup';
import { inclusionLine, scheduleProblem, whatsappProblem } from '@core/utils/bookingRules';
import { formatDate, formatDistance, formatDuration, formatINR, formatTime, isValidEmail } from '@core/utils/format';
import { describeError } from '@core/utils/retry';
import { SCHEDULED_CANCELLATION_FEE, SCHEDULED_FREE_CANCEL_BEFORE_MS } from '@core/config/constants';
import { Button, Checkbox, Notice, TextArea, TextField } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FareBreakdown } from '@/components/FareBreakdown';
import { RoutePoints } from '@/components/RoutePoints';
import { TripMap, Workspace } from '@/components/Workspace';
import { useBooking, useBookingQuote } from '@/state/Booking';
import { useToasts } from '@/state/Toasts';
import { useOnline } from '@/lib/hooks';
import { vehicleArtUrl } from '@/lib/vehicleArt';
import { PaymentChoice, PromoControl, StepHead } from './parts';

export function ReviewStep() {
  const navigate = useNavigate();
  const { profile } = useCustomerData();
  const { draft, update, reset, route, adjustment } = useBooking();
  const q = useBookingQuote();
  const { online } = useOnline();
  const { push } = useToasts();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [serverQuote, setServerQuote] = useState<{ key: string; fare: Fare } | null>(null);
  const submittingRef = useRef(false);

  const { pickup, drop, tripType, scheduledAt, tripEndAt, payment, notes, waSame, waCode, waNumber, email } = draft;
  const category = q.category;

  if (!pickup || !drop || !route || !category || !q.quote) {
    return (
      <Workspace label="Review and confirm" map={<TripMap pickup={pickup} drop={drop} route={route} />}>
        <StepHead title="Review and confirm" step={3} onBack={() => navigate('/book/ride')} />
        <Notice tone="warning">Your trip details changed. Go back and choose your ride again.</Notice>
        <Button block variant="secondary" onClick={() => navigate('/book/ride')}>
          Back to rides
        </Button>
      </Workspace>
    );
  }

  const priceKey = JSON.stringify([pickup.lat, pickup.lng, drop.lat, drop.lng, tripType, scheduledAt?.toISOString() ?? null, category.id, q.coupon?.code, adjustment?.id, adjustment?.percent]);
  const quote = serverQuote?.key === priceKey ? serverQuote.fare : q.quote;
  const breakup = q.breakup ?? buildFareBreakup(category, quote, q.outstation);

  const emailError = email.trim() && !isValidEmail(email) ? 'Enter a valid email address or leave it blank.' : '';
  const waError = whatsappProblem(waSame, waCode, waNumber);
  const blocker = !online
    ? 'You’re offline. Reconnect to book.'
    : scheduleProblem(scheduledAt) || (!q.authoritative ? (q.quoteLoading ? 'Confirming your fare with One Way Car Rental…' : q.quoteError || 'We need to confirm your fare before you can submit.') : '') || (waError || emailError ? 'Check your contact details below.' : '') || (!termsAccepted ? 'Accept the booking terms to submit your request.' : '');

  const submit = async () => {
    if (blocker || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await createRideRequest({
        profile,
        pickup,
        drop,
        category,
        route,
        fare: quote,
        tripType,
        paymentMethod: payment,
        couponCode: q.coupon?.code ?? '',
        notes,
        scheduledAt,
        tripEndAt: tripType === 'Round Trip' ? tripEndAt : null,
        termsAccepted,
        whatsapp: waSame ? { sameAsMobile: true } : { sameAsMobile: false, countryCode: waCode.trim(), number: waNumber.replace(/[\s()-]/g, '') },
        email: email.trim(),
      });
      reset();
      push({ title: 'Booking request submitted', message: 'One Way Car Rental will review it and confirm here. Nothing is dispatched until then.', tone: 'success' });
      navigate(`/ride/${res.id}`, { replace: true });
    } catch (e) {
      const currentFare = (e as { details?: { fare?: Fare } }).details?.fare;
      if (currentFare && Number.isFinite(currentFare.total)) setServerQuote({ key: priceKey, fare: currentFare });
      setSubmitError(
        currentFare ? `The fare is now ${formatINR(currentFare.total)}. Review it and submit your booking request again.` : describeError(e, 'We couldn’t place your booking. Please try again.'),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const freeHours = Math.round(SCHEDULED_FREE_CANCEL_BEFORE_MS / 3600000);
  const when = scheduledAt ? `${formatDate(scheduledAt)}, ${formatTime(scheduledAt)}` : 'Not chosen';

  const foot = (
    <>
      {submitError ? <Notice tone="error">{submitError}</Notice> : blocker ? <Notice tone="warning">{blocker}</Notice> : null}
      <Button block size="lg" loading={submitting} disabled={!!blocker} onClick={() => void submit()}>
        <span>{submitting ? 'Submitting…' : 'Submit booking request'}</span>
        {!submitting ? <span className="btn__price num">{formatINR(quote.total)}</span> : null}
      </Button>
      <p className="foot-note">
        <Icon name="lock" size={14} /> No payment now · {payment === 'Cash' ? 'pay cash' : 'pay by UPI'} to the driver after your trip
      </p>
    </>
  );

  return (
    <Workspace label="Review and confirm" foot={foot} map={<TripMap pickup={pickup} drop={drop} route={route} />}>
      <StepHead title="Review and confirm" step={3} onBack={() => navigate('/book/ride')} />

      <section className="rcard" aria-labelledby="rv-trip">
        <header>
          <h2 id="rv-trip">Trip</h2>
          <Link to="/book" className="link-btn">
            Edit
          </Link>
        </header>
        <RoutePoints pickup={pickup.name} drop={drop.name} pickupAddress={pickup.address} dropAddress={drop.address} />
        <dl className="facts">
          <div>
            <dt>Pickup time</dt>
            <dd>{when}</dd>
          </div>
          {tripType === 'Round Trip' && tripEndAt ? (
            <div>
              <dt>Return</dt>
              <dd>{`${formatDate(tripEndAt)}, ${formatTime(tripEndAt)}`}</dd>
            </div>
          ) : null}
          <div>
            <dt>Distance</dt>
            <dd>
              {formatDistance(route.distanceKm)} · {formatDuration(route.durationMin)}
              {route.estimated ? ' (estimate)' : ''}
            </dd>
          </div>
          <div>
            <dt>Trip type</dt>
            <dd>
              {tripType === 'Round Trip'
                ? 'Round trip'
                : tripType === 'Airport Taxi'
                ? 'Airport taxi'
                : tripType === 'Local Rental'
                ? 'Local rental'
                : 'One way'}{' '}
              · {q.service}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rcard" aria-labelledby="rv-ride">
        <header>
          <h2 id="rv-ride">Vehicle</h2>
          <Link to="/book/ride" className="link-btn">
            Change
          </Link>
        </header>
        <div className="mini-ride">
          <img src={vehicleArtUrl(category)} alt="" width={112} height={73} />
          <div>
            <strong>{category.name}</strong>
            <small className="muted">
              Up to {category.seats} passengers · {inclusionLine(category, q.outstation) || 'Fare as per route distance'}
            </small>
          </div>
          <strong className="num">{formatINR(quote.total)}</strong>
        </div>
      </section>

      <section className="rcard" aria-labelledby="rv-fare">
        <header>
          <h2 id="rv-fare">Fare breakup</h2>
        </header>
        <FareBreakdown lines={breakup.lines} total={quote.total} estimated />
      </section>

      <section className="rcard" aria-labelledby="rv-pay">
        <header>
          <h2 id="rv-pay">Payment</h2>
        </header>
        <PaymentChoice value={payment} onChange={(m) => update({ payment: m })} />
        <p className="muted small">
          {payment === 'Cash' ? 'Pay your driver in cash when you reach your destination.' : 'Pay your driver by UPI when you reach your destination.'} No payment is taken now.
        </p>
        <div className="promo-row">
          <PromoControl />
        </div>
      </section>

      <section className="rcard" aria-labelledby="rv-contact">
        <header>
          <h2 id="rv-contact">Contact &amp; notes</h2>
        </header>
        <div className="stack">
          <Checkbox checked={waSame} onChange={(v) => update({ waSame: v })}>
            Send WhatsApp updates to my mobile number <span className="muted">({profile.phone || 'not set'})</span>
          </Checkbox>
          {!waSame ? (
            <div className="wa-row">
              <TextField label="Code" value={waCode} onChange={(e) => update({ waCode: e.target.value })} inputMode="tel" autoComplete="off" maxLength={4} />
              <TextField
                label="WhatsApp number"
                value={waNumber}
                onChange={(e) => update({ waNumber: e.target.value })}
                inputMode="tel"
                autoComplete="off"
                maxLength={16}
                placeholder="10-digit number"
                error={waError}
              />
            </div>
          ) : null}
          <TextField
            label="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => update({ email: e.target.value })}
            autoComplete="email"
            placeholder={profile.email || 'name@example.com'}
            hint={profile.email ? 'Leave blank to use your account email.' : 'For your booking confirmation and GST receipt.'}
            error={emailError}
          />
          <TextArea
            label="Note for the driver (optional)"
            value={notes}
            onChange={(e) => update({ notes: e.target.value.slice(0, 300) })}
            placeholder="Gate number, building name, luggage…"
            hint={`${notes.length}/300`}
          />
        </div>
      </section>

      <section className="rcard rcard--policy" aria-labelledby="rv-policy">
        <header>
          <h2 id="rv-policy">Cancellation &amp; terms</h2>
        </header>
        <p>
          Free to cancel until {freeHours} hour before pickup; after that a {formatINR(SCHEDULED_CANCELLATION_FEE)} fee applies. Tolls, parking and permits are charged at actuals
          unless listed as included. This is a booking request: One Way Car Rental reviews it first, then arranges your vehicle and driver.
        </p>
        <Checkbox checked={termsAccepted} onChange={setTermsAccepted}>
          I accept the booking terms and the One Way Car Rental <Link to="/legal">terms and privacy policy</Link>, and understand this request is subject to One Way Car Rental review.
        </Checkbox>
      </section>
    </Workspace>
  );
}
