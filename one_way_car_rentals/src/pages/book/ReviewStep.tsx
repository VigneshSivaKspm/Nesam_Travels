// Step 3 — review & confirm: trip, vehicle, contact, payment and booking request submission.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { FareBreakdown as Fare } from '@core/types';
import { useCustomerData } from '@/state/customer';
import { createRideRequest } from '@core/services/rideService';
import { buildFareBreakup } from '@core/utils/fareBreakup';
import { scheduleProblem, whatsappProblem } from '@core/utils/bookingRules';
import { formatDate, formatDistance, formatDuration, formatINR, formatPhone, formatTime, isValidEmail, isValidIndianMobile } from '@core/utils/format';
import { describeError } from '@core/utils/retry';
import { SCHEDULED_CANCELLATION_FEE, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { Button, Checkbox, FlowSteps, Notice, PageHead, TextArea, TextField } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useBooking, useBookingQuote } from '@/state/Booking';
import { useAuth } from '@/state/Auth';
import { useOnline } from '@/lib/hooks';
import { composeNotes, notesRoom } from '@/lib/notes';
import { setPendingReturn } from '@/lib/pendingReturn';
import { FREE_CANCEL_WINDOW, PolicyLinks } from '@/pages/PolicySections';
import { categoryName, categoryPhoto } from '@/lib/categories';
import { FareDialog, FlowBar, PromoControl } from './parts';

export function ReviewStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useCustomerData();
  const { openLoginModal } = useAuth();
  const { draft, update, reset, route, adjustment } = useBooking();
  const q = useBookingQuote();
  const { online } = useOnline();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverQuote, setServerQuote] = useState<{ key: string; fare: Fare } | null>(null);
  const [showFare, setShowFare] = useState(false);
  const submittingRef = useRef(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const { pickup, drop, tripType, scheduledAt, tripEndAt, notes, waSame, waCode, waNumber, email, forOther, passengerName, passengerMobile, flight } = draft;
  const category = q.category;

  // Back from the sign-in popup: the rider had already accepted the terms before signing in.
  const justSignedIn = !!profile && (location.state as { resumed?: boolean } | null)?.resumed === true;
  useEffect(() => {
    if (justSignedIn) setTermsAccepted(true);
  }, [justSignedIn]);

  if (!pickup || !drop || !category || !q.quote) {
    return (
      <div className="flow-page">
        <div className="wrap flow-page__wrap review-missing">
          <PageHead backTo="/book/ride" title="Review & confirm" />
          {q.quoteLoading ? (
            <Notice>Confirming fare with One Way Car Rentals server…</Notice>
          ) : (
            <Notice
              tone="warning"
              action={
                <Button size="sm" variant="secondary" onClick={() => navigate('/book/ride')}>
                  Choose your vehicle
                </Button>
              }
            >
              Your trip details changed. Please go back and select your vehicle again.
            </Notice>
          )}
        </div>
      </div>
    );
  }

  const priceKey = JSON.stringify([pickup.lat, pickup.lng, drop.lat, drop.lng, tripType, scheduledAt?.toISOString() ?? null, category.id, q.coupon?.code, adjustment?.id, adjustment?.percent]);
  const quote = serverQuote?.key === priceKey ? serverQuote.fare : q.quote;
  const breakup = q.breakup ?? buildFareBreakup(category, quote, q.outstation);
  const airport = tripType === 'Airport Taxi';

  const emailError = email.trim() && !isValidEmail(email) ? 'Enter a valid email address or leave it blank.' : '';
  const waError = whatsappProblem(waSame, waCode, waNumber);
  const passengerError = forOther ? (!passengerName.trim() ? 'Enter the passenger’s name.' : !isValidIndianMobile(passengerMobile.replace(/\s+/g, '')) ? 'Enter the passenger’s 10-digit mobile number.' : '') : '';
  const room = notesRoom({ flight: airport ? flight : '', passengerName: forOther ? passengerName : '', passengerMobile: forOther ? passengerMobile : '' });
  const termsError = tried && !termsAccepted ? 'Please accept the fare and cancellation terms to confirm.' : '';
  const blocker = !online
    ? 'You’re offline. Reconnect to book.'
    : scheduleProblem(scheduledAt) ||
      (!q.authoritative ? (q.quoteLoading ? 'Confirming fare with One Way Car Rentals…' : q.quoteError || 'Fare confirmation required.') : '') ||
      (waError || emailError || passengerError ? 'Check your contact details below.' : '');

  const submit = async () => {
    setTried(true);
    if (!termsAccepted) {
      termsRef.current?.querySelector('input')?.focus();
      return;
    }
    if (!profile) {
      setPendingReturn('/book/confirm');
      openLoginModal({ title: 'Sign in to complete booking', subtitle: 'Enter your mobile number to send your ride request.' });
      return;
    }
    if (blocker || submittingRef.current || !route) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const fullNotes = composeNotes({
        flight: airport ? flight : '',
        passengerName: forOther ? passengerName : '',
        passengerMobile: forOther ? passengerMobile : '',
        notes,
      });
      const res = await createRideRequest({
        profile,
        pickup,
        drop,
        category,
        route,
        fare: quote,
        tripType,
        paymentMethod: 'Cash',
        couponCode: q.coupon?.code ?? '',
        notes: fullNotes,
        scheduledAt,
        tripEndAt: tripType === 'Round Trip' ? tripEndAt : null,
        termsAccepted,
        whatsapp: waSame ? { sameAsMobile: true } : { sameAsMobile: false, countryCode: waCode.trim(), number: waNumber.replace(/[\s()-]/g, '') },
        email: email.trim(),
        source: 'onewaycarrentals',
        bookingSource: 'onewaycarrentals',
        brand: 'onewaycarrentals',
      });
      reset();
      navigate(`/book/done/${res.id}`, { state: { confirmed: true } });
    } catch (e: unknown) {
      const err = e as { code?: string; fare?: Fare };
      if (err.code === 'fare-changed' && err.fare) {
        setServerQuote({ key: priceKey, fare: err.fare });
        setSubmitError('The fare for this route has updated. Review the updated amount and tap Confirm Booking to proceed.');
        return;
      }
      setSubmitError(describeError(e, 'We couldn’t submit your booking request. Please check your connection and try again.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const when = scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Pickup time';

  return (
    <div className="flow-page">
      <div className="wrap flow-page__wrap">
        <div className="choose">
          <div className="choose__main">
            <PageHead backTo="/book/ride" title="Review & confirm">
              Check trip itinerary and contact information before submitting. You pay your driver after the trip.
            </PageHead>
            <FlowSteps current={3} />

            {justSignedIn ? (
              <Notice tone="success">You’re signed in as {profile?.name}. Tap Confirm Booking to submit your ride request.</Notice>
            ) : null}

            <section className="trip-sum" aria-label="Route summary">
              <div className="trip-sum__top">
                <span className="badge badge--green">{tripType}</span>
                <Link to="/book" className="link-btn">
                  <Icon name="edit" size={14} /> Edit route
                </Link>
              </div>
              <div className="trip-sum__route">
                <p className="route-title">
                  <span>{pickup.name}</span>
                  <Icon name="arrow-right" size={16} />
                  <span>{drop.id === 'place-local-disposal' ? 'Within city limits' : drop.name}</span>
                </p>
                <p className="trip-sum__when">{when}</p>
              </div>
              <p className="trip-sum__meta">
                {route ? `${formatDistance(route.distanceKm)} · about ${formatDuration(route.durationMin)}` : ''}
                {tripType === 'Round Trip' && tripEndAt ? ` · Return ${formatDate(tripEndAt)}, ${formatTime(tripEndAt)}` : ''}
              </p>
            </section>

            <section className="card" style={{ marginTop: 20 }}>
              <header className="card__head">
                <h2>Selected Vehicle</h2>
                <Link to="/book/ride" className="link-btn">
                  <Icon name="edit" size={14} /> Change
                </Link>
              </header>
              <div className="review-car">
                <img src={categoryPhoto(category)} alt="" className="review-car__img" width={120} height={75} />
                <div className="review-car__info">
                  <strong>{categoryName(category)}</strong>
                  <p className="muted small">{category.seats} passengers · AC · Chauffeur driven</p>
                  <p className="review-car__price num">
                    <strong>{formatINR(quote.total)}</strong> <small>all-inclusive</small>
                  </p>
                </div>
              </div>
            </section>

            <section className="card" style={{ marginTop: 20 }}>
              <header className="card__head">
                <h2>Contact Information</h2>
              </header>
              <div className="card__body">
                {profile ? (
                  <div className="review-user">
                    <Icon name="profile" size={20} />
                    <div>
                      <strong>{profile.name}</strong>
                      <p className="muted small">{formatPhone(profile.phone)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="review-guest">
                    <p className="muted small">We’ll verify your mobile number via OTP when confirming your booking.</p>
                  </div>
                )}

                <div style={{ marginTop: 14 }}>
                  <Checkbox checked={forOther} onChange={(v) => update({ forOther: v })}>
                    Booking for someone else?
                  </Checkbox>
                  {forOther ? <PolicyLinks lead="Add a passenger’s or another WhatsApp number only with their permission." ids={['privacy']} newTab /> : null}
                  {forOther ? (
                    <div className="grid-2" style={{ marginTop: 12 }}>
                      <TextField
                        label="Passenger name"
                        value={passengerName}
                        onChange={(e) => update({ passengerName: e.target.value })}
                        error={tried && passengerError.includes('name') ? passengerError : undefined}
                      />
                      <TextField
                        label="Passenger mobile"
                        value={passengerMobile}
                        placeholder="10-digit mobile"
                        onChange={(e) => update({ passengerMobile: e.target.value })}
                        error={tried && passengerError.includes('mobile') ? passengerError : undefined}
                      />
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 14 }}>
                  <Checkbox checked={waSame} onChange={(v) => update({ waSame: v })}>
                    Receive booking updates on WhatsApp
                  </Checkbox>
                  {!waSame ? (
                    <TextField
                      wrapperClassName="mt-sm"
                      label="WhatsApp number"
                      value={waNumber}
                      placeholder="10-digit number"
                      onChange={(e) => update({ waNumber: e.target.value })}
                      error={tried ? waError : undefined}
                    />
                  ) : null}
                </div>

                <div style={{ marginTop: 14 }}>
                  <TextField
                    label="Email address (optional)"
                    hint="For tax invoices and trip receipts"
                    value={email}
                    type="email"
                    onChange={(e) => update({ email: e.target.value })}
                    error={tried ? emailError : undefined}
                  />
                </div>

                {airport ? (
                  <div style={{ marginTop: 14 }}>
                    <TextField
                      label="Flight number (optional)"
                      hint="Helps your driver monitor arrival delays"
                      value={flight}
                      onChange={(e) => update({ flight: e.target.value.toUpperCase() })}
                    />
                  </div>
                ) : null}

                <div style={{ marginTop: 14 }}>
                  <TextArea
                    label="Pickup notes or instructions (optional)"
                    hint={`${room} characters left`}
                    maxLength={room}
                    value={notes}
                    placeholder="Landmark, building gate, or special luggage details"
                    onChange={(e) => update({ notes: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <div ref={termsRef} className={`card terms-card ${termsError ? 'is-invalid' : ''}`} style={{ marginTop: 20 }}>
              <Checkbox checked={termsAccepted} onChange={(v) => setTermsAccepted(v)} invalid={!!termsError}>
                I accept the fare breakdown and that tolls, parking and permits are paid separately. Cancellation is free while the booking is pending or more than {FREE_CANCEL_WINDOW} before pickup; after that a {formatINR(SCHEDULED_CANCELLATION_FEE)} fee applies.
              </Checkbox>
              <PolicyLinks ids={['terms', 'payment', 'cancellation', 'refund']} newTab />
              {termsError ? <p className="field__error" role="alert" style={{ marginTop: 8 }}>{termsError}</p> : null}
            </div>

            {submitError ? (
              <Notice tone="error" action={<Button size="sm" onClick={() => void submit()}>Retry</Button>}>
                {submitError}
              </Notice>
            ) : null}
          </div>

          <aside className="choose__side" aria-label="Review sidebar">
            <div className="flow-card">
              <h3 className="flow-card__title">Total Payable</h3>
              <div className="flow-card__price-row">
                <span>Trip Fare</span>
                <strong className="num">{formatINR(quote.total)}</strong>
              </div>
              <p className="muted small">Tolls, parking and state permits paid separately to the driver against physical slips.</p>

              <button type="button" className="link-btn" onClick={() => setShowFare(true)} style={{ marginTop: 10 }}>
                <Icon name="chevron-right" size={14} /> View detailed fare breakup
              </button>

              <div style={{ marginTop: 20 }}>
                <Button
                  block
                  size="lg"
                  loading={submitting}
                  trailing="arrow-right"
                  onClick={() => void submit()}
                >
                  Confirm Booking Request
                </Button>
              </div>

              <p className="bf-trust" style={{ marginTop: 12 }}>
                <Icon name="shield-check" size={14} /> Pay ₹0 now. Pay driver in cash or UPI.
              </p>
            </div>
          </aside>
        </div>

        <FlowBar className="only-narrow">
          <div className="flow-bar__summary">
            <div>
              <span className="muted small">Total</span>
              <strong className="num">{formatINR(quote.total)}</strong>
            </div>
            <Button size="lg" loading={submitting} trailing="arrow-right" onClick={() => void submit()}>
              Confirm Booking
            </Button>
          </div>
        </FlowBar>
      </div>

      {showFare ? (
        <FareDialog
          title={`${categoryName(category)} fare breakup`}
          lines={breakup.lines}
          total={quote.total}
          estimated={!q.authoritative}
          onClose={() => setShowFare(false)}
        />
      ) : null}
    </div>
  );
}
