// Step 3 — review & confirm: trip, vehicle, contact, payment and booking request submission.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { FREE_CANCEL_WINDOW, PolicyLinks } from '@/pages/PolicySections';
import { categoryName, categoryPhoto } from '@/lib/categories';
import { FareDialog, FlowBar, PaymentChoice, PromoControl } from './parts';

export function ReviewStep() {
  const navigate = useNavigate();
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
  const [justSignedIn, setJustSignedIn] = useState(false);
  const submittingRef = useRef(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const {
    pickup,
    drop,
    tripType,
    scheduledAt,
    tripEndAt,
    payment,
    notes,
    waSame,
    waCode,
    waNumber,
    email,
    forOther,
    passengerName,
    passengerMobile,
    flight,
  } = draft;
  const category = q.category;

  const hadProfile = useRef(!!profile);
  useEffect(() => {
    if (profile && !hadProfile.current) setJustSignedIn(true);
    hadProfile.current = !!profile;
  }, [profile]);

  if (!pickup || !drop || !category || !q.quote) {
    return (
      <div className="flow-page">
        <div className="wrap flow-page__wrap review-missing">
          <PageHead
            back={<Button variant="secondary" size="sm" onClick={() => navigate('/book/ride')} icon="arrow-left">Choose Vehicle</Button>}
            title="Review & Confirm"
          />
          {q.quoteLoading ? (
            <Notice>Confirming fare with People Taxi server…</Notice>
          ) : (
            <Notice
              variant="warning"
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

  const priceKey = JSON.stringify([
    pickup.lat,
    pickup.lng,
    drop.lat,
    drop.lng,
    tripType,
    scheduledAt?.toISOString() ?? null,
    category.id,
    q.coupon?.code,
    adjustment?.id,
    adjustment?.percent,
  ]);
  const quote = serverQuote?.key === priceKey ? serverQuote.fare : q.quote;
  const breakup = q.breakup ?? buildFareBreakup(category, quote, q.outstation);
  const airport = tripType === 'Airport Taxi';

  const emailError = email.trim() && !isValidEmail(email) ? 'Enter a valid email address or leave it blank.' : '';
  const waError = whatsappProblem(waSame, waCode, waNumber);
  const passengerError = forOther
    ? !passengerName.trim()
      ? 'Enter the passenger’s name.'
      : !isValidIndianMobile(passengerMobile.replace(/\s+/g, ''))
        ? 'Enter the passenger’s 10-digit mobile number.'
        : ''
    : '';
  const room = notesRoom({
    flight: airport ? flight : '',
    passengerName: forOther ? passengerName : '',
    passengerMobile: forOther ? passengerMobile : '',
  });
  const termsError = tried && !termsAccepted ? 'Please accept the fare and cancellation terms to confirm.' : '';
  const blocker = !online
    ? 'You’re offline. Reconnect to book.'
    : scheduleProblem(scheduledAt) ||
      (!q.authoritative
        ? q.quoteLoading
          ? 'Confirming fare with People Taxi…'
          : q.quoteError || 'Fare confirmation required.'
        : '') ||
      (waError || emailError || passengerError ? 'Check your contact details below.' : '');

  const submit = async () => {
    setTried(true);
    if (!termsAccepted) {
      termsRef.current?.querySelector('input')?.focus();
      return;
    }
    if (!profile) {
      openLoginModal({
        title: 'Sign in to complete booking',
        subtitle: 'Enter your mobile number to send your ride request.',
      });
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
        paymentMethod: payment,
        couponCode: q.coupon?.code ?? '',
        notes: fullNotes,
        scheduledAt,
        tripEndAt: tripType === 'Round Trip' ? tripEndAt : null,
        termsAccepted,
        whatsapp: waSame ? { sameAsMobile: true } : { sameAsMobile: false, countryCode: waCode.trim(), number: waNumber.replace(/[\s()-]/g, '') },
        email: email.trim(),
        source: 'people_taxi',
        bookingSource: 'peopletaxi',
        brand: 'peopletaxi',
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

  return (
    <div className="flow-page flow-page--review">
      <div className="wrap flow-page__wrap">
        <PageHead
          back={<Button variant="secondary" size="sm" onClick={() => navigate('/book/ride')} icon="arrow-left">Choose Vehicle</Button>}
          eyebrow="Step 3 of 3 · Final Review"
          title="Review &amp; Confirm Booking"
        >
          Verify your itinerary, passenger details and payment mode before confirmation.
        </PageHead>

        <FlowSteps total={3} current={3} />

        <div className="review">
          <div className="review__main">
            <section className="card rv-sum" aria-labelledby="rv-trip-head">
              <div className="trip-sum__top">
                <h2 id="rv-trip-head" className="route-title route-title--lg">
                  <span>{pickup.name}</span>
                  <Icon name="arrow-right" size={18} />
                  <span>{drop.id === 'place-local-disposal' ? 'Within City' : drop.name}</span>
                </h2>
                <Link to="/book" className="btn btn--text btn--sm">
                  Edit
                </Link>
              </div>

              {scheduledAt ? (
                <p className="rv-sum__when">
                  <Icon name="calendar" size={15} /> <strong>Pickup:</strong> {formatDate(scheduledAt)}, {formatTime(scheduledAt)}
                  {tripEndAt ? ` · Return: ${formatDate(tripEndAt)}` : ''}
                </p>
              ) : null}

              {route ? (
                <p className="trip-sum__meta">
                  Distance: {formatDistance(route.distanceKm)} · Approx. {formatDuration(route.durationMin)} drive
                </p>
              ) : null}

              <div className="rv-sum__car">
                <div>
                  <strong>{categoryName(category)}</strong>
                  <small className="muted">{category.description || `${category.seats} seats · AC fleet`}</small>
                </div>
                <Link to="/book/ride" className="btn btn--text btn--sm">
                  Change Cab
                </Link>
              </div>

              <div className="rv-sum__total">
                <div>
                  <strong>Authoritative Server Fare</strong>
                  <small className="muted">All inclusions &amp; discounts accounted for</small>
                </div>
                <strong className="rv-sum__amount num">{formatINR(quote.total)}</strong>
              </div>
            </section>

            <section className="card" aria-labelledby="rv-who-head">
              <h2 id="rv-who-head">Passenger &amp; Contact Details</h2>

              <div className="rv-grid">
                <TextField
                  label="Contact Mobile (for Driver & SMS)"
                  value={profile?.phone ? formatPhone(profile.phone) : 'Sign in on booking'}
                  readOnly
                  disabled
                />
                <TextField
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com (optional)"
                  value={email}
                  error={emailError}
                  onChange={(e) => update({ email: e.target.value })}
                />
              </div>

              <div className="rv-fold">
                <Checkbox
                  label="Receive trip updates on WhatsApp"
                  description="Real-time chauffeur assignment, OTP and live arrival updates."
                  checked={waSame}
                  onChange={(checked) => update({ waSame: checked })}
                />
                {!waSame ? (
                  <div className="rv-grid rv-grid--wa" style={{ marginTop: 10 }}>
                    <TextField label="Code" value={waCode} onChange={(e) => update({ waCode: e.target.value })} />
                    <TextField
                      label="WhatsApp Number"
                      value={waNumber}
                      error={waError}
                      placeholder="9876543210"
                      onChange={(e) => update({ waNumber: e.target.value })}
                    />
                  </div>
                ) : null}
              </div>

              <div className="rv-fold">
                <Checkbox
                  label="Booking this ride for someone else?"
                  description="We will share chauffeur & cab details with the passenger directly."
                  checked={forOther}
                  onChange={(checked) => update({ forOther: checked })}
                />
                {forOther ? <PolicyLinks lead="Add a passenger’s or another WhatsApp number only with their permission." ids={['privacy']} newTab /> : null}
                {forOther ? (
                  <div className="rv-grid" style={{ marginTop: 10 }}>
                    <TextField
                      label="Passenger Name"
                      placeholder="Full name"
                      value={passengerName}
                      error={forOther && !passengerName.trim() ? 'Passenger name is required' : ''}
                      onChange={(e) => update({ passengerName: e.target.value })}
                    />
                    <TextField
                      label="Passenger 10-digit Mobile"
                      placeholder="9876543210"
                      value={passengerMobile}
                      error={passengerError}
                      onChange={(e) => update({ passengerMobile: e.target.value })}
                    />
                  </div>
                ) : null}
              </div>

              {airport ? (
                <div className="rv-fold">
                  <TextField
                    label="Flight Number (Optional)"
                    placeholder="e.g. 6E 214"
                    value={flight}
                    hint="Our chauffeur will track flight delays and adjust pickup time automatically."
                    onChange={(e) => update({ flight: e.target.value.toUpperCase() })}
                  />
                </div>
              ) : null}

              <div className="rv-fold">
                <TextArea
                  label="Chauffeur Instructions / Landmarks"
                  placeholder="e.g. Apartment gate number, landmark near house, luggage count…"
                  value={notes}
                  rows={2}
                  hint={`${room} characters left`}
                  onChange={(e) => update({ notes: e.target.value.slice(0, 300) })}
                />
              </div>
            </section>

            <section className="card" aria-labelledby="rv-pay-head">
              <h2 id="rv-pay-head">Payment Method</h2>
              <p className="muted small" style={{ marginBottom: 12 }}>
                You do not pay anything right now. Pay your chauffeur directly at the end of the trip.
              </p>
              <PaymentChoice value={payment} onChange={(p) => update({ payment: p })} />
            </section>

            <section className="card rv-policy" ref={termsRef}>
              <Checkbox
                label="I agree to the Fare and Cancellation Terms"
                description={
                  <span>
                    Free cancellation while the booking is pending or more than {FREE_CANCEL_WINDOW} before pickup.
                    After that, a {formatINR(SCHEDULED_CANCELLATION_FEE)} cancellation fee applies. Tolls, parking and permits are paid separately.
                  </span>
                }
                checked={termsAccepted}
                onChange={setTermsAccepted}
              />
              <PolicyLinks ids={['terms', 'payment', 'cancellation', 'refund']} newTab />
              {termsError ? <p className="bf-error">{termsError}</p> : null}
            </section>

            {submitError ? (
              <Notice variant="error" icon="warning">
                {submitError}
              </Notice>
            ) : null}
          </div>

          <aside className="review__sticky">
            <div className="card sel-card">
              <span className="sel-card__eyebrow">Price Summary</span>

              <div className="sel-card__total">
                <div>
                  <span>Total Amount Due</span>
                  <small className="muted">To be paid directly to chauffeur</small>
                </div>
                <strong className="num">{formatINR(quote.total)}</strong>
              </div>

              <PromoControl
                code={draft.promoCode}
                applied={quote.discount > 0}
                onApply={(code) => update({ promoCode: code })}
                onRemove={() => update({ promoCode: '' })}
              />

              <Button
                variant="secondary"
                size="sm"
                block
                icon="info"
                onClick={() => setShowFare(true)}
              >
                View Detailed Fare Breakup
              </Button>

              <div className="rv-act">
                <Button
                  variant="primary"
                  size="lg"
                  block
                  disabled={submitting}
                  loading={submitting}
                  onClick={submit}
                  iconTrailing="check"
                >
                  {profile ? 'Confirm & Book Ride' : 'Sign in to Confirm'}
                </Button>
                <p className="rv-act__note">
                  <Icon name="shield-check" size={14} /> Immediate booking request · 24/7 Support: {SUPPORT_PHONE_DISPLAY}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <FlowBar
        onBack={() => navigate('/book/ride')}
        onNext={submit}
        backLabel="Change Cab"
        nextLabel={profile ? 'Confirm & Book' : 'Sign in & Book'}
        nextDisabled={submitting}
        nextLoading={submitting}
        total={quote.total}
      />

      {showFare ? <FareDialog fare={breakup} onClose={() => setShowFare(false)} /> : null}
    </div>
  );
}
export default ReviewStep;
