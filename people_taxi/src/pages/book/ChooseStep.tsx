// Step 2 — choose a ride: every bookable category priced for this route by the same
// engine the booking server uses, then payment and the next action.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inclusionLine } from '@core/utils/bookingRules';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { buildFareBreakup } from '@core/utils/fareBreakup';
import { formatDate, formatDistance, formatDuration, formatINR, formatTime } from '@core/utils/format';
import { Button, Notice } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FareBreakdown } from '@/components/FareBreakdown';
import { RoutePoints } from '@/components/RoutePoints';
import { TripMap, Workspace } from '@/components/Workspace';
import { vehicleArtUrl } from '@/lib/vehicleArt';
import { useBooking, useBookingQuote } from '@/state/Booking';
import { PaymentChoice, PromoControl, StepHead } from './parts';

const TOO_FAR_KM = 1500;

export function ChooseStep() {
  const navigate = useNavigate();
  const { draft, update, route, routeStatus, retryRoute, categories, categoryStatus, adjustment } = useBooking();
  const q = useBookingQuote();
  const [showFare, setShowFare] = useState(false);
  const { pickup, drop, tripType, scheduledAt, categoryId, payment } = draft;
  if (!pickup || !drop) return null;

  const tooFar = !!route && route.distanceKm > TOO_FAR_KM;
  const categoryNotice =
    categories.length === 0 && categoryStatus === 'unavailable'
      ? `Online booking isn’t available right now. Please call ${SUPPORT_PHONE_DISPLAY} to book.`
      : categories.length === 0 && categoryStatus === 'error'
        ? 'We couldn’t load ride types. Check your connection and try again.'
        : '';
  const selected = q.category;
  const quote = q.quote;
  // The server prices the route itself, so a slow client-side route lookup never blocks booking.
  const canContinue = (!!route || q.authoritative) && !!quote && !tooFar && q.authoritative;
  const breakup = q.breakup ?? (selected && quote ? buildFareBreakup(selected, quote, q.outstation) : null);
  const when = scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Pickup time not chosen';

  const foot = (
    <>
      <div className="foot-row">
        <PaymentChoice compact value={payment} onChange={(m) => update({ payment: m })} />
        <PromoControl />
      </div>
      <Button block size="lg" disabled={!canContinue} onClick={() => navigate('/book/confirm')}>
        {selected && quote ? (
          <>
            <span>Continue with {selected.name}</span>
            <span className="btn__price num">{formatINR(quote.total)}</span>
          </>
        ) : (
          'Choose a ride'
        )}
      </Button>
    </>
  );

  return (
    <Workspace label="Choose a ride" foot={foot} map={<TripMap pickup={pickup} drop={drop} route={route} />}>
      <StepHead title="Choose your ride" step={2} onBack={() => navigate('/book')} />

      <section className="brief" aria-label="Your trip">
        <RoutePoints compact pickup={pickup.name} drop={drop.name} />
        <div className="brief__meta">
          <span>
            <Icon name="calendar" size={16} /> {when}
          </span>
          <span>
            <Icon name="route" size={16} />{' '}
            {route ? `${formatDistance(route.distanceKm)} · ${formatDuration(route.durationMin)}` : routeStatus === 'error' ? 'Route unavailable' : 'Calculating…'}
          </span>
          <span>
            <Icon
              name={
                tripType === 'Round Trip'
                  ? 'round-trip'
                  : tripType === 'Airport Taxi'
                  ? 'plane'
                  : tripType === 'Local Rental'
                  ? 'clock'
                  : 'one-way'
              }
              size={16}
            />{' '}
            {tripType === 'Round Trip'
              ? 'Round trip'
              : tripType === 'Airport Taxi'
              ? 'Airport taxi'
              : tripType === 'Local Rental'
              ? 'Local rental'
              : 'One way'}
          </span>
          <Link to="/book" className="brief__edit">
            Edit trip
          </Link>
        </div>
      </section>

      {routeStatus === 'error' ? (
        <Notice
          tone="error"
          action={
            <Button size="sm" variant="secondary" onClick={retryRoute}>
              Try again
            </Button>
          }
        >
          We couldn’t calculate the route. Check your connection and try again.
        </Notice>
      ) : null}
      {route?.estimated ? <Notice tone="warning">Live routing is unavailable, so fares use a straight-line estimate. The booking server confirms the final fare.</Notice> : null}
      {tooFar ? (
        <Notice tone="warning">
          That trip is too long to book online — please <a href={`tel:${SUPPORT_PHONE}`}>call {SUPPORT_PHONE_DISPLAY}</a>.
        </Notice>
      ) : null}
      {categoryNotice ? <Notice tone={categoryStatus === 'error' ? 'error' : 'warning'}>{categoryNotice}</Notice> : null}
      {q.quoteError ? (
        <Notice
          tone="error"
          action={
            <Button size="sm" variant="secondary" onClick={q.retryQuote}>
              Try again
            </Button>
          }
        >
          {q.quoteError}
        </Notice>
      ) : null}
      {q.days ? (
        <p className="adjust-note">
          <Icon name="information" size={16} /> Round trip: {q.days} chargeable calendar day{q.days === 1 ? '' : 's'} (Indian dates from pickup to return). Daily minimum kilometres and
          driver bata apply to each day.
        </p>
      ) : null}
      {adjustment ? (
        <p className="adjust-note">
          <Icon name="information" size={16} /> {adjustment.name}: fares include a {adjustment.percent}% {adjustment.direction === 'increase' ? 'increase' : 'reduction'}.
        </p>
      ) : null}

      <h2 className="sr-only" id="rides">
        Available rides
      </h2>
      {categoryStatus === 'loading' ? (
        <ul className="rides" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="skeleton" style={{ height: 112 }} />
          ))}
        </ul>
      ) : (
        <ul className="rides" role="radiogroup" aria-labelledby="rides">
          {categories.map((c) => {
            const fare = q.quotes.get(c.id);
            const on = c.id === categoryId;
            const reason = q.unavailable.get(c.id) ?? '';
            const blocked = tooFar || !!reason;
            return (
              <li key={c.id}>
                <label className={`ride ${on ? 'is-selected' : ''} ${blocked ? 'is-disabled' : ''}`}>
                  <input type="radio" name="ride" className="sr-only" checked={on} disabled={blocked} onChange={() => update({ categoryId: c.id })} />
                  <span className="ride__art">
                    <img src={vehicleArtUrl(c)} alt="" width={132} height={86} loading="lazy" />
                  </span>
                  <span className="ride__main">
                    <strong>{c.name}</strong>
                    <span className="ride__seats">
                      <Icon name="passengers" size={15} /> {c.seats} seats
                    </span>
                    <small className="ride__desc">{reason ? reason : blocked ? 'Too far to book online' : c.description || inclusionLine(c, q.outstation)}</small>
                  </span>
                  <span className="ride__fare num">{fare ? formatINR(fare.total) : q.quoteLoading ? <span className="skeleton ride__fare-skel" /> : '—'}</span>
                  <span className="ride__tick" aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selected && quote ? (
        <div className="fare-peek">
          <p className="fare-peek__line">
            <Icon name="information" size={16} />
            {inclusionLine(selected, q.outstation) || 'Fare as per the route distance'}
          </p>
          <button type="button" className="link-btn" aria-expanded={showFare} onClick={() => setShowFare((s) => !s)}>
            {showFare ? 'Hide fare details' : 'Fare details'}
            <Icon name={showFare ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          {showFare && breakup ? <FareBreakdown lines={breakup.lines} total={quote.total} estimated={!q.authoritative} /> : null}
        </div>
      ) : null}
    </Workspace>
  );
}
