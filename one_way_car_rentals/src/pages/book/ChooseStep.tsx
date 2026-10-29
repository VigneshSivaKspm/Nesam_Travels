// Step 2 — choose your cab: every vehicle category priced with the server's authoritative fare.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RideCategory } from '@core/types';
import { inclusionLine } from '@core/utils/bookingRules';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { buildFareBreakup } from '@core/utils/fareBreakup';
import { formatDate, formatDistance, formatDuration, formatINR, formatTime } from '@core/utils/format';
import { Badge, Button, EmptyState, FlowSteps, Notice, PageHead } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useBooking, useBookingQuote } from '@/state/Booking';
import { useOnline } from '@/lib/hooks';
import { categoryGroup, categoryName, categoryPhoto, type CategoryGroup } from '@/lib/categories';
import { tripTypeLabel } from '@/lib/services';
import { FareDialog, FlowBar, PromoControl } from './parts';

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
  const breakupFor = (c: RideCategory) => {
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
  const summaryLabel = canContinue ? 'Total upfront fare' : q.quoteLoading ? 'Confirming fare with server…' : 'Estimated fare';

  return (
    <div className="flow-page">
      <div className="wrap flow-page__wrap">
        <div className="choose">
          <div className="choose__main">
            <PageHead backTo="/book" title="Choose your vehicle">
              Compare vehicle categories and upfront fares for your trip.
            </PageHead>
            <FlowSteps current={2} />

            <section className="trip-sum" aria-label="Your trip">
              <div className="trip-sum__top">
                <Badge tone="green">{tripTypeLabel(tripType)}</Badge>
                <Link to="/book" className="link-btn">
                  <Icon name="edit" size={14} /> Edit
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
                {route ? `${formatDistance(route.distanceKm)} · about ${formatDuration(route.durationMin)}${route.estimated ? ' (estimate)' : ''}` : routeStatus === 'error' ? 'Route distance unavailable' : 'Calculating distance…'}
                {tripType === 'Round Trip' && tripEndAt ? ` · Return ${formatDate(tripEndAt)}, ${formatTime(tripEndAt)}` : ''}
              </p>
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
                <p className="choose__intro">Fares shown are upfront, transparent, and include GST.</p>
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
                {groups.length > 1 || categories.length > 2 ? (
                  <div className="cab-tools">
                    <div className="cab-tools__filters" role="group" aria-label="Filter cabs">
                      {(['All', ...groups] as const).map((g) => (
                        <button key={g} type="button" className={`chip ${group === g ? 'is-active' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>
                          {g === 'All' ? 'All vehicles' : g}
                        </button>
                      ))}
                    </div>
                    <label className="cab-tools__sort">
                      <span>Sort by</span>
                      <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                        <option value="recommended">Recommended</option>
                        <option value="low">Price: low to high</option>
                        <option value="high">Price: high to low</option>
                      </select>
                    </label>
                  </div>
                ) : null}
                <p className="choose__count" aria-live="polite">
                  {shown.length} vehicle option{shown.length === 1 ? '' : 's'} available
                  {selectedHidden ? ` · selected category (${categoryName(selected!)}) is hidden by active filter` : ''}
                </p>
                <h2 className="sr-only" id="cabs-h">
                  Available cabs
                </h2>
                <ul className="cabs" role="radiogroup" aria-labelledby="cabs-h">
                  {shown.map((c) => {
                    const fare = q.quotes.get(c.id);
                    const on = c.id === categoryId;
                    const reason = q.unavailable.get(c.id) ?? '';
                    const blocked = tooFar || !!reason;
                    const incl = inclusionLine(c, q.outstation);
                    return (
                      <li key={c.id} className={`cab ${on ? 'is-selected' : ''} ${blocked ? 'is-disabled' : ''}`}>
                        <input id={`cab-${c.id}`} type="radio" name="cab" className="cab__radio" checked={on} disabled={blocked} onChange={() => update({ categoryId: c.id })} />
                        <label className="cab__label" htmlFor={`cab-${c.id}`}>
                          <span className="cab__tick" aria-hidden="true">
                            <Icon name="check" size={12} />
                          </span>
                          <span className="cab__photo">
                            <img src={categoryPhoto(c)} alt="" width={360} height={220} loading="lazy" />
                          </span>
                          <span className="cab__info">
                            <strong className="cab__name">{categoryName(c)}</strong>
                            {c.description ? <span className="cab__model">{c.description}</span> : null}
                            <span className="cab__badges">
                              <span className="feat feat--seats">
                                <Icon name="passengers" size={13} /> {c.seats} passengers
                              </span>
                              <span className="feat feat--ac">
                                <Icon name="air-conditioning" size={13} /> AC
                              </span>
                            </span>
                            {fare?.distanceKm ? <span className="cab__incl">{formatDistance(fare.distanceKm)} trip distance</span> : null}
                          </span>
                          <span className="cab__price">
                            {reason ? (
                              <span className="cab__na">{reason}</span>
                            ) : fare ? (
                              <>
                                <strong className="num">{formatINR(fare.total)}</strong>
                                <small>{q.quoteLoading ? 'Confirming fare…' : 'Total fare'}</small>
                                <small>GST included</small>
                              </>
                            ) : q.quoteLoading ? (
                              <span className="skeleton cab__price-skel" />
                            ) : (
                              <small>Fare unavailable</small>
                            )}
                          </span>
                        </label>
                        <div className="cab__foot">
                          <span>{incl || 'Fare as per route distance'}</span>
                          {fare ? (
                            <button type="button" className="link-btn" onClick={() => setFareFor(c)}>
                              <Icon name="chevron-right" size={13} /> View fare breakup
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="choose__fine">Vehicle images are representative. Specific car models may vary within the booked category.</p>
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
                {selected && summaryFare ? `Continue · ${formatINR(summaryFare)}` : 'Select a vehicle'}
              </Button>
            </div>
          </aside>
        </div>

        <FlowBar className="only-narrow">
          <div className="flow-bar__summary">
            {summaryFare && selected ? (
              <div>
                <span className="muted small">{categoryName(selected)}</span>
                <strong className="num">{formatINR(summaryFare)}</strong>
              </div>
            ) : (
              <span className="muted small">Choose a vehicle</span>
            )}
            <Button size="lg" trailing="arrow-right" disabled={!canContinue} onClick={() => navigate('/book/confirm')}>
              Continue
            </Button>
          </div>
        </FlowBar>
      </div>

      {fareFor ? (
        <FareDialog
          title={`${categoryName(fareFor)} fare breakup`}
          lines={breakupFor(fareFor)?.lines ?? []}
          total={q.quotes.get(fareFor.id)?.total ?? 0}
          estimated={!q.authoritative}
          note={inclusionLine(fareFor, q.outstation)}
          onClose={() => setFareFor(null)}
        />
      ) : null}
    </div>
  );
}
