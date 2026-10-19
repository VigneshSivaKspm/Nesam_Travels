// Step 3 — review and confirm: route, time, vehicle, payment, contact, the final fare
// breakup and the booking itself. The server re-prices and refuses a fare that changed.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FareBreakdown as Fare } from '@core/types';
import { useCustomerData } from '@core/context/CustomerData';
import { createRideRequest } from '@core/services/rideService';
import { buildFareBreakup } from '@core/utils/fareBreakup';
import { inclusionLine, scheduleProblem, whatsappProblem } from '@core/utils/bookingRules';
import { formatDate, formatDistance, formatDuration, formatINR, formatPhone, formatTime, isValidEmail } from '@core/utils/format';
import { describeError } from '@core/utils/retry';
import { SCHEDULED_CANCELLATION_FEE, SCHEDULED_FREE_CANCEL_BEFORE_MS } from '@core/config/constants';
import { Button, Checkbox, Dialog, Notice, TextArea, TextField } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FareBreakdown } from '@/components/FareBreakdown';
import { RoutePoints } from '@/components/RoutePoints';
import { RouteMap } from '@/components/RouteMap';
import { useBooking, useBookingQuote } from '@/state/Booking';
import { useToasts } from '@/state/Toasts';
import { useAuth } from '@/state/Auth';
import { useOnline } from '@/lib/hooks';
import { vehicleArtUrl } from '@/lib/vehicleArt';
import { PaymentChoice, PromoControl, StepHead } from './parts';

interface ConfirmedBooking {
  id: string;
  pickupName: string;
  dropName: string;
  categoryName: string;
  total: number;
  when: string;
  tripType: string;
  payment: string;
}

export function ReviewStep() {
  const navigate = useNavigate();
  const { profile } = useCustomerData();
  const { openLoginModal } = useAuth();
  const { draft, update, reset, route, adjustment } = useBooking();
  const q = useBookingQuote();
  const { online } = useOnline();
  const { push } = useToasts();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [serverQuote, setServerQuote] = useState<{ key: string; fare: Fare } | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const submittingRef = useRef(false);
  const pendingSubmitRef = useRef(false);

  const { pickup, drop, tripType, scheduledAt, tripEndAt, payment, notes, waSame, waCode, waNumber, email } = draft;
  const category = q.category;

  const goToTrips = () => {
    reset();
    navigate('/trips', { replace: true });
  };

  useEffect(() => {
    if (!confirmedBooking) return undefined;
    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          goToTrips();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [confirmedBooking]);

  if (!pickup || !drop || !route || !category || !q.quote) {
    return (
      <div className="review-page">
        <div className="review-page__inner" style={{ maxWidth: 640 }}>
          <StepHead title="Review and confirm" step={3} onBack={() => navigate('/book/ride')} />
          <Notice tone="warning">Your trip details changed. Go back and choose your ride again.</Notice>
          <Button block variant="secondary" onClick={() => navigate('/book/ride')}>
            Back to rides
          </Button>
        </div>
      </div>
    );
  }

  const priceKey = JSON.stringify([pickup.lat, pickup.lng, drop.lat, drop.lng, tripType, scheduledAt?.toISOString() ?? null, category.id, q.coupon?.code, adjustment?.id, adjustment?.percent]);
  const quote = serverQuote?.key === priceKey ? serverQuote.fare : q.quote;
  const breakup = q.breakup ?? buildFareBreakup(category, quote, q.outstation);

  const emailError = email.trim() && !isValidEmail(email) ? 'Enter a valid email address or leave it blank.' : '';
  const waError = whatsappProblem(waSame, waCode, waNumber);
  const blocker = !online
    ? 'You’re offline. Reconnect to book.'
    : scheduleProblem(scheduledAt) || (!q.authoritative ? (q.quoteLoading ? 'Confirming your fare with People Taxi…' : q.quoteError || 'We need to confirm your fare before you can submit.') : '') || (waError || emailError ? 'Check your contact details below.' : '') || (!termsAccepted ? 'Accept the booking terms to submit your request.' : '');

  const submit = async () => {
    if (!profile) {
      pendingSubmitRef.current = true;
      openLoginModal({
        title: 'Sign in to complete booking',
        subtitle: 'Enter your mobile number to confirm your ride request.',
        onSuccess: () => {
          pendingSubmitRef.current = true;
        },
      });
      return;
    }
    if (blocker || submittingRef.current || !pickup || !drop || !category || !route || !quote) return;
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
      setConfirmedBooking({
        id: res.id,
        pickupName: pickup.name,
        dropName: drop.name,
        categoryName: category.name,
        total: quote.total,
        when: scheduledAt ? `${formatDate(scheduledAt)}, ${formatTime(scheduledAt)}` : 'Not chosen',
        tripType:
          tripType === 'Round Trip'
            ? 'Round trip'
            : tripType === 'Airport Taxi'
            ? 'Airport taxi'
            : tripType === 'Local Rental'
            ? 'Local rental'
            : 'One way',
        payment: payment === 'Cash' ? 'Cash' : 'UPI',
      });
      push({ title: 'Booking confirmed!', message: 'Your booking has been placed. Redirecting to My Trips…', tone: 'success' });
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

  // If user signed in via login popup while trying to book, auto-submit once profile is ready
  useEffect(() => {
    if (profile && pendingSubmitRef.current && !blocker && !submittingRef.current) {
      pendingSubmitRef.current = false;
      void submit();
    }
  }, [profile, blocker]);

  const freeHours = Math.round(SCHEDULED_FREE_CANCEL_BEFORE_MS / 3600000);
  const when = scheduledAt ? `${formatDate(scheduledAt)}, ${formatTime(scheduledAt)}` : 'Not chosen';

  const submitButtonText = submitting ? 'Submitting…' : profile ? 'Submit booking request' : 'Sign in & submit booking';

  return (
    <div className="review-page">
      <div className="review-page__inner">
        <div className="review-page__head">
          <StepHead title="Review and confirm" step={3} onBack={() => navigate('/book/ride')} />
          <p className="review-page__subhead">Review your route, vehicle, fare breakup, and contact details before confirming.</p>
        </div>

        <div className="review-page__grid">
          {/* Trip Card */}
          <section className="rcard rcard--trip" aria-labelledby="rv-trip">
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

          {/* Reference Map Card (Compact container for reference) */}
          <section className="rcard rcard--ref-map" aria-labelledby="rv-map">
            <header>
              <div className="ref-map__title-group">
                <h2 id="rv-map">Route preview</h2>
                <span className="ref-map__pill">Reference only</span>
              </div>
              <Link to="/book" className="link-btn">
                Change route
              </Link>
            </header>
            <div className="ref-map__frame">
              <RouteMap
                className="ref-map__canvas"
                label="Route preview for reference"
                pickup={pickup}
                drop={drop}
                path={route?.path ?? null}
                padding={{ top: 24, right: 24, bottom: 24, left: 24 }}
              />
              {route ? (
                <div className="map-chip" aria-label="Route summary">
                  <Icon name="route" size={15} />
                  <strong className="num">{formatDistance(route.distanceKm)}</strong>
                  <span aria-hidden="true">·</span>
                  <span className="num">{formatDuration(route.durationMin)}</span>
                  {route.estimated ? <span className="map-chip__est">estimate</span> : null}
                </div>
              ) : null}
            </div>
            <p className="ref-map__note">
              <Icon name="information" size={14} /> Map route shown for visual reference. Driver follows optimal live traffic route.
            </p>
          </section>

          {/* Vehicle Card */}
          <section className="rcard rcard--ride" aria-labelledby="rv-ride">
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

          {/* Booking Summary & Action Card (Sticky sidebar on desktop) */}
          <section className="rcard rcard--action" aria-labelledby="rv-action">
            <header>
              <h2 id="rv-action">Booking summary</h2>
              <span className="summary-status">Final step</span>
            </header>

            <div className="summary-specs">
              <div className="summary-spec-row">
                <span className="muted">Vehicle</span>
                <strong>{category.name}</strong>
              </div>
              <div className="summary-spec-row">
                <span className="muted">Trip type</span>
                <strong>
                  {tripType === 'Round Trip'
                    ? 'Round trip'
                    : tripType === 'Airport Taxi'
                    ? 'Airport taxi'
                    : tripType === 'Local Rental'
                    ? 'Local rental'
                    : 'One way'}
                </strong>
              </div>
              <div className="summary-spec-row">
                <span className="muted">Pickup</span>
                <strong>{when}</strong>
              </div>
              <div className="summary-spec-row">
                <span className="muted">Payment</span>
                <strong>{payment === 'Cash' ? 'Cash on drop' : 'UPI to driver'}</strong>
              </div>
            </div>

            <div className="summary-total-box">
              <div className="summary-total-label">
                <span>Total Fare</span>
                <small className="muted">All taxes &amp; allowances included</small>
              </div>
              <strong className="summary-total-val num">{formatINR(quote.total)}</strong>
            </div>

            {submitError ? <Notice tone="error">{submitError}</Notice> : blocker ? <Notice tone="warning">{blocker}</Notice> : null}

            <Button block size="lg" loading={submitting} disabled={!!blocker} onClick={() => void submit()}>
              <span>{submitButtonText}</span>
              {!submitting ? <span className="btn__price num">{formatINR(quote.total)}</span> : null}
            </Button>

            <p className="foot-note">
              <Icon name="lock" size={14} /> No payment now · {payment === 'Cash' ? 'pay cash' : 'pay by UPI'} to the driver after your trip
            </p>
          </section>

          {/* Fare Breakup Card */}
          <section className="rcard rcard--fare" aria-labelledby="rv-fare">
            <header>
              <h2 id="rv-fare">Fare breakup</h2>
            </header>
            <FareBreakdown lines={breakup.lines} total={quote.total} estimated />
          </section>

          {/* Payment Card */}
          <section className="rcard rcard--pay" aria-labelledby="rv-pay">
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

          {/* Contact & Notes Card */}
          <section className="rcard rcard--contact" aria-labelledby="rv-contact">
            <header>
              <h2 id="rv-contact">Contact &amp; notes</h2>
            </header>
            <div className="stack">
              <Checkbox checked={waSame} onChange={(v) => update({ waSame: v })}>
                Send WhatsApp updates to my mobile number <span className="muted">({profile?.phone ? formatPhone(profile.phone) : 'verified at sign-in'})</span>
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
                placeholder={profile?.email || 'name@example.com'}
                hint={profile?.email ? 'Leave blank to use your account email.' : 'For your booking confirmation and GST receipt.'}
                error={emailError}
              />
              <TextArea
                label="Note for the driver (optional)"
                value={notes}
                onChange={(e) => update({ notes: e.target.value.slice(0, 300) })}
                placeholder="Gate number, building name, luggage…"
                hint={`${notes.length}/300`}
              />
              {!profile ? (
                <p className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 0' }}>
                  <Icon name="information" size={14} /> You’ll verify your mobile number when you submit this booking.
                </p>
              ) : null}
            </div>
          </section>

          {/* Cancellation Policy & Terms Card */}
          <section className="rcard rcard--policy" aria-labelledby="rv-policy">
            <header>
              <h2 id="rv-policy">Cancellation &amp; terms</h2>
            </header>
            <p>
              Free to cancel until {freeHours} hour before pickup; after that a {formatINR(SCHEDULED_CANCELLATION_FEE)} fee applies. Tolls, parking and permits are charged at actuals
              unless listed as included. This is a booking request: People Taxi reviews it first, then arranges your vehicle and driver.
            </p>
            <Checkbox checked={termsAccepted} onChange={setTermsAccepted}>
              I accept the booking terms and the People Taxi <Link to="/legal">terms and privacy policy</Link>, and understand this request is subject to People Taxi review.
            </Checkbox>
          </section>
        </div>

        {/* Floating sticky bar for mobile users */}
        <div className="review-page__foot-sticky">
          {submitError ? (
            <Notice tone="error">{submitError}</Notice>
          ) : blocker && termsAccepted ? (
            <Notice tone="warning">{blocker}</Notice>
          ) : null}
          <Button block size="lg" loading={submitting} disabled={!!blocker} onClick={() => void submit()}>
            <span>{submitButtonText}</span>
            {!submitting ? <span className="btn__price num">{formatINR(quote?.total ?? 0)}</span> : null}
          </Button>
        </div>

        {/* Booking Confirmed Popup Dialog */}
        {confirmedBooking ? (
          <Dialog
            title="Booking Confirmed"
            onClose={goToTrips}
            footer={
              <Button block size="lg" variant="primary" onClick={goToTrips}>
                <span>View in My Trips</span>
                <Icon name="arrow-right" size={18} />
              </Button>
            }
          >
            <div className="booking-confirmed-modal">
              <div className="bcm-hero">
                <div className="bcm-icon">
                  <Icon name="check" size={32} />
                </div>
                <h3>Ride Request Placed!</h3>
                <p className="bcm-subtitle">
                  Your booking has been successfully confirmed. People Taxi is arranging your vehicle and driver.
                </p>
              </div>

              <div className="bcm-card">
                <div className="bcm-row">
                  <span className="muted">Booking ID</span>
                  <strong className="num">#{confirmedBooking.id.slice(0, 8).toUpperCase()}</strong>
                </div>
                <div className="bcm-route">
                  <div className="bcm-point">
                    <span className="bcm-dot bcm-dot--pickup" />
                    <span className="truncate">{confirmedBooking.pickupName}</span>
                  </div>
                  <div className="bcm-line" />
                  <div className="bcm-point">
                    <span className="bcm-dot bcm-dot--drop" />
                    <span className="truncate">{confirmedBooking.dropName}</span>
                  </div>
                </div>
                <div className="bcm-grid">
                  <div>
                    <dt>Pickup time</dt>
                    <dd>{confirmedBooking.when}</dd>
                  </div>
                  <div>
                    <dt>Vehicle</dt>
                    <dd>{confirmedBooking.categoryName}</dd>
                  </div>
                  <div>
                    <dt>Trip type</dt>
                    <dd>{confirmedBooking.tripType}</dd>
                  </div>
                  <div>
                    <dt>Total Fare</dt>
                    <dd className="num">
                      {formatINR(confirmedBooking.total)} ({confirmedBooking.payment})
                    </dd>
                  </div>
                </div>
              </div>

              <p className="bcm-note">
                <Icon name="information" size={16} />
                <span>
                  You will receive live driver details via SMS &amp; WhatsApp prior to pickup. You can manage or track this ride anytime in{' '}
                  <strong>My Trips</strong>.
                </span>
              </p>

              <div className="bcm-redirect-timer">Redirecting to My Trips in {redirectCountdown}s…</div>
            </div>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}
