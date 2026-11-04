// Step 2 — choose your cab: every vehicle category priced with the server's authoritative fare.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RideCategory } from '@core/types';
import { quotedInclusionLine } from '@core/utils/bookingRules';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { buildFareBreakup } from '@core/utils/fareBreakup';
import { formatDate, formatDistance, formatDuration, formatINR, formatTime } from '@core/utils/format';
import { BackButton, Badge, Button, EmptyState, Notice } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useBooking, useBookingQuote } from '@/state/Booking';
import { useOnline } from '@/lib/hooks';
import { categoryGroup, categoryName, categoryPhoto, type CategoryGroup } from '@/lib/categories';
import { tripTypeLabel } from '@/lib/services';
import { CabIcon, FuelPick, type FuelChoice } from '../../../../user/web/src/components/CabParts';
import { BarIconButton, FareDialog, FlowBar, PromoControl } from './parts';

const TOO_FAR_KM = 1500;
type Sort = 'recommended' | 'low' | 'high';

export function ChooseStep() {
  const navigate = useNavigate();
  const { draft, update, route, routeStatus, retryRoute, categories, categoryStatus, adjustment } = useBooking();
  const q = useBookingQuote();
  const { online } = useOnline();
  const [fareFor, setFareFor] = useState<RideCategory | null>(null);
  const [group, setGroup] = useState<'All' | CategoryGroup>('All');
  const [sort, setSort] = useState<Sort>('recommended');
  // The fuel chosen on each card (CNG is offered only on vehicles whose CNG rates the admin has saved).
  const [fuelPick, setFuelPick] = useState<Record<string, FuelChoice>>({});
  const { pickup, drop, tripType, scheduledAt, tripEndAt, categoryId } = draft;

  const groups = useMemo(() => {
    const present = new Set(categories.map(categoryGroup));
    return (['Sedan', 'SUV', 'Innova', 'Van & bus'] as CategoryGroup[]).filter((g) => present.has(g));
  }, [categories]);

  const shown = useMemo(() => {
    const list = categories.filter((c) => group === 'All' || categoryGroup(c) === group);
    if (sort === 'recommended') return list;
    const price = (c: RideCategory) => q.quotes.get(c.id)?.total ?? (sort === 'low' ? Infinity : -Infinity);
    return [...list].sort((a, b) => (sort === 'low' ? price(a) - price(b) : price(b) - price(a)));
  }, [categories, group, sort, q.quotes]);

  if (!pickup || !drop) return null;

  const tooFar = !!route && route.distanceKm > TOO_FAR_KM;
  const selected = q.category;
  const quote = q.quote;
  const canContinue = q.authoritative && !!quote && !tooFar && !!selected && !q.unavailable.has(selected.id);
  const cngOf = (c: RideCategory) => q.entries.get(c.id)?.cng ?? null;
  const fuelOf = (c: RideCategory): FuelChoice => (cngOf(c) ? fuelPick[c.id] ?? (c.id === categoryId && draft.fuelType === 'cng' ? 'cng' : 'diesel') : 'diesel');
  const chooseCategory = (c: RideCategory) => update({ categoryId: c.id, fuelType: fuelOf(c) === 'cng' ? 'cng' : '' });
  const chooseFuel = (c: RideCategory, f: FuelChoice) => {
    setFuelPick((p) => ({ ...p, [c.id]: f }));
    update({ categoryId: c.id, fuelType: f === 'cng' ? 'cng' : '' });
  };
  const breakupFor = (c: RideCategory) => {
    const alt = fuelOf(c) === 'cng' ? cngOf(c) : null;
    if (alt) return alt.breakup;
    if (c.id === selected?.id && q.breakup) return q.breakup;
    const f = q.quotes.get(c.id);
    return f ? buildFareBreakup(c, f, q.outstation) : null;
  };
  const when = scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Pickup time not chosen';
  const allUnavailable = !q.quoteLoading && categories.length > 0 && categories.every((c) => q.unavailable.has(c.id));
  const loading = categoryStatus === 'loading' || (q.quoteLoading && q.quotes.size === 0);
  const connection = !online || (!!q.quoteError && q.quotes.size === 0);
  const noCategories = categories.length === 0 && (categoryStatus === 'unavailable' || categoryStatus === 'error');
  const selectedHidden = !!selected && !shown.some((c) => c.id === selected.id);

  const summaryFare = quote && selected && !q.unavailable.has(selected.id) ? quote.total : null;
  const summaryLabel = canContinue ? 'Total fare' : q.quoteLoading ? 'Checking the fare…' : 'Estimated fare';

  return (
    <div className="flow-page">
      <div className="wrap flow-page__wrap">
        <div className="choose">
          <div className="choose__main">
            <section className="trip-sum trip-sum--compact" aria-label="Your trip">
              <h1 className="sr-only">Choose your vehicle</h1>
              <div className="trip-sum__body">
                <p className="route-title">
                  <span>{pickup.name}</span>
                  <Icon name="arrow-right" size={14} />
                  <span>{drop.id === 'place-local-disposal' ? 'Within city limits' : drop.name}</span>
                </p>
                {tripType === 'Round Trip' && draft.stops.length ? <p className="trip-sum__when">Via {draft.stops.map((stop) => stop.name).join(' → ')}</p> : null}
                <p className="trip-sum__meta">
                  <span>
                    <Badge tone="green">{tripTypeLabel(draft.multicity ? 'Multicity' : tripType)}</Badge>
                  </span>
                  <span className="trip-sum__when">{when}</span>
                  <span>{route ? `${formatDistance(route.distanceKm)} · about ${formatDuration(route.durationMin)}${route.estimated ? ' (estimate)' : ''}` : routeStatus === 'error' ? 'Distance unavailable' : 'Calculating distance…'}</span>
                  {tripType === 'Round Trip' && tripEndAt ? <span>Return {formatDate(tripEndAt)}, {formatTime(tripEndAt)}</span> : null}
                </p>
              </div>
            </section>

            <div className="choose__notices">
              {routeStatus === 'error' ? (
                <Notice
                  tone="warning"
                  action={
                    <Button size="sm" variant="secondary" onClick={retryRoute}>
                      Try again
                    </Button>
                  }
                >
                  We couldn’t calculate the map route on this device. Fares still come from the booking server.
                </Notice>
              ) : null}
              {tooFar ? (
                <Notice tone="warning">
                  That trip is too long to book online — please <a href={`tel:${SUPPORT_PHONE}`}>call {SUPPORT_PHONE_DISPLAY}</a>.
                </Notice>
              ) : null}
              {q.days ? (
                <Notice>
                  Round trip: {q.days} chargeable calendar day{q.days === 1 ? '' : 's'} (Indian dates from pickup to return). Daily minimum kilometres and driver allowance apply.
                </Notice>
              ) : null}
              {adjustment ? (
                <Notice>
                  {adjustment.name}: fares include a {adjustment.percent}% {adjustment.direction === 'increase' ? 'increase' : 'reduction'}.
                </Notice>
              ) : null}
            </div>

            {noCategories ? (
              <div className="card state-card">
                <EmptyState
                  icon="car"
                  title={categoryStatus === 'error' ? 'We couldn’t load cab types' : 'Online booking isn’t available right now'}
                  action={
                    <a className="btn btn--primary" href={`tel:${SUPPORT_PHONE}`}>
                      <Icon name="phone" size={17} /> Call {SUPPORT_PHONE_DISPLAY}
                    </a>
                  }
                >
                  {categoryStatus === 'error' ? 'Check your connection and try again, or call our team to book.' : `Please call ${SUPPORT_PHONE_DISPLAY} and our team will book your trip.`}
                </EmptyState>
              </div>
            ) : connection ? (
              <div className="card state-card" role="alert">
                <EmptyState
                  icon="offline"
                  title="We couldn’t reach the server"
                  action={
                    <div className="state-card__actions">
                      <Button icon="refresh" onClick={q.retryQuote} disabled={!online}>
                        Try again
                      </Button>
                      <Button variant="secondary" onClick={() => navigate('/book')}>
                        Change search
                      </Button>
                    </div>
                  }
                >
                  {!online ? 'You’re offline. Fares appear as soon as you reconnect.' : q.quoteError || 'Fares could not be loaded. Check your connection and try again.'}
                </EmptyState>
              </div>
            ) : loading ? (
              <div className="searching" role="status" aria-live="polite">
                <p className="searching__label">
                  <span className="spinner" aria-hidden="true" /> Finding available cabs and calculating exact fares…
                </p>
                <ul className="cabs" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="skeleton cab-skel" />
                  ))}
                </ul>
              </div>
            ) : allUnavailable ? (
              <div className="card state-card">
                <EmptyState
                  icon="clock"
                  title="No cabs available for this time"
                  action={
                    <div className="state-card__actions">
                      <Button icon="clock" onClick={() => navigate('/book')}>
                        Change time
                      </Button>
                      <a className="btn btn--secondary" href={`tel:${SUPPORT_PHONE}`}>
                        <Icon name="phone" size={17} /> Call Support
                      </a>
                    </div>
                  }
                >
                  {q.unavailable.get(categories[0]!.id) || 'Try an earlier or later pickup time, or call our support team.'}
                </EmptyState>
              </div>
            ) : (
              <>
                {q.quoteError ? (
                  <Notice
                    tone="error"
                    action={
                      <Button size="sm" variant="secondary" icon="refresh" onClick={q.retryQuote} disabled={!online}>
                        Try again
                      </Button>
                    }
                  >
                    We couldn’t confirm live fares. The amounts below are estimates; you can continue once confirmed.
                  </Notice>
                ) : null}
                <h2 className="sr-only" id="cabs-h">
                  Available cabs
                </h2>
                <ul className="cabs" role="radiogroup" aria-labelledby="cabs-h">
                  {shown.map((c) => {
                    const cngAlt = fuelOf(c) === 'cng' ? cngOf(c) : null;
                    const fare = cngAlt ? cngAlt.fare : q.quotes.get(c.id);
                    const on = c.id === categoryId;
                    const reason = q.unavailable.get(c.id) ?? '';
                    const blocked = tooFar || !!reason;
                    const entry = q.entries.get(c.id);
                    const incl = quotedInclusionLine(entry && cngAlt ? { ...entry, extraKmRate: cngAlt.extraKmRate } : entry, c, q.outstation);
                    return (
                      <li key={c.id} className={`cab ${on ? 'is-selected' : ''} ${blocked ? 'is-disabled' : ''}`}>
                        <input id={`cab-${c.id}`} type="radio" name="cab" className="cab__radio" checked={on} disabled={blocked} onChange={() => chooseCategory(c)} />
                        <label className="cab__label" htmlFor={`cab-${c.id}`}>
                          <span className="cab__tick" aria-hidden="true">
                            <Icon name="check" size={12} />
                          </span>
                          <span className="cab__photo">
                            <img src={categoryPhoto(c)} alt="" width={360} height={220} loading="lazy" />
                          </span>
                          <span className="cab__info">
                            <strong className="cab__name">{categoryName(c)}</strong>
                            <span className="cab__badges">
                              <span className="feat feat--seats">
                                <CabIcon kind="seat" size={18} /> {c.seats} passengers
                              </span>
                              <span className="feat feat--ac">
                                <CabIcon kind="ac" size={18} /> AC
                              </span>
                            </span>
                          </span>
                          <span className="cab__price">
                            {reason ? (
                              <span className="cab__na">{reason}</span>
                            ) : fare ? (
                              <>
                                <strong className="num">{formatINR(fare.taxableAmount)}</strong>
                                <small className="cab__tax">{q.quoteLoading ? 'Confirming fare…' : fare.gst > 0 ? `+ ${formatINR(fare.gst)} GST` : ''}</small>
                              </>
                            ) : q.quoteLoading ? (
                              <span className="skeleton cab__price-skel" />
                            ) : (
                              <small>Fare unavailable</small>
                            )}
                          </span>
                        </label>
                        {cngOf(c) && !blocked ? (
                          <div className="cab__fuel">
                            <FuelPick name={`fuel-${c.id}`} value={fuelOf(c)} onChange={(f) => chooseFuel(c, f)} />
                          </div>
                        ) : null}
                        <div className="cab__foot">
                          <span>{incl || 'Fare as per route distance'}</span>
                          {fare ? (
                            <button type="button" className="link-btn" onClick={() => setFareFor(c)}>
                              <Icon name="chevron-right" size={13} /> Fare breakup
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Notice tone="warning">
                  Tolls, parking fees and state entry permits are paid separately by the rider against physical receipts. <Link to="/legal#payment">Fare &amp; Payment Policy</Link>
                </Notice>
              </>
            )}
          </div>

          <aside className="choose__side" aria-label="Booking summary">
            <div className="flow-card">
              <h3 className="flow-card__title">Booking Summary</h3>
              {selected ? (
                <div className="flow-card__selected">
                  <img src={categoryPhoto(selected)} alt="" className="flow-card__car-thumb" />
                  <div>
                    <strong>{categoryName(selected)}</strong>
                    <p className="muted small">{selected.seats} seats · AC</p>
                  </div>
                </div>
              ) : (
                <p className="muted small">Select a vehicle from the list to continue.</p>
              )}

              <PromoControl />

              {summaryFare ? (
                <div className="flow-card__price-row">
                  <span>{summaryLabel}</span>
                  <strong className="num">{formatINR(summaryFare)}</strong>
                </div>
              ) : null}

              <Button
                block
                size="lg"
                trailing="arrow-right"
                disabled={!canContinue}
                onClick={() => navigate('/book/confirm')}
              >
                {selected && summaryFare ? `Book Now · ${formatINR(summaryFare)}` : 'Select a vehicle'}
              </Button>
            </div>
          </aside>
        </div>

        <FlowBar className="only-narrow">
          <div className="flow-bar__summary flow-bar__summary--icons">
            <BarIconButton icon="arrow-left" label="Back to trip details" onClick={() => navigate('/book')} />
            <Button size="lg" disabled={!canContinue} onClick={() => navigate('/book/confirm')}>
              Continue
            </Button>
            <BarIconButton icon="home" label="Home" onClick={() => navigate('/book')} />
          </div>
        </FlowBar>
      </div>

      {fareFor ? (
        <FareDialog
          title={`${categoryName(fareFor)} fare breakup`}
          lines={breakupFor(fareFor)?.lines ?? []}
          total={q.quotes.get(fareFor.id)?.total ?? 0}
          estimated={!q.authoritative}
          note={quotedInclusionLine(q.entries.get(fareFor.id), fareFor, q.outstation)}
          onClose={() => setFareFor(null)}
        />
      ) : null}
    </div>
  );
}
