// Step 2 — choose your cab. Every bookable category with the booking server's own fare for this
// exact trip; while the server is answering, the cards wait (no invented prices). Filters and
// sorting only change what is shown, never the fare.
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
import { categoryGroup, categoryPhoto, type CategoryGroup } from '@/lib/categories';
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

  const summaryFare = canContinue && quote ? quote.total : null;

  return (
    <div className="flow-page">
      <div className="wrap flow-page__wrap">
        <div className="choose">
          <div className="choose__main">
            <PageHead backTo="/book" title="Choose your cab">
              Your journey. Your choice of comfort.
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
                  <span>{drop.id === 'place-local-disposal' ? 'Within the city' : drop.name}</span>
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
                  We couldn’t calculate the route on this device. Fares still come from NESAM’s booking server.
                </Notice>
              ) : null}
              {tooFar ? (
                <Notice tone="warning">
                  That trip is too long to book online — please <a href={`tel:${SUPPORT_PHONE}`}>call {SUPPORT_PHONE_DISPLAY}</a>.
                </Notice>
              ) : null}
              {q.days ? (
                <Notice>
                  Round trip: {q.days} chargeable calendar day{q.days === 1 ? '' : 's'} (Indian dates from pickup to return). Daily minimum kilometres and driver allowance apply to each day.
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
                  {categoryStatus === 'error' ? 'Check your connection and try again, or call NESAM to book.' : `Please call ${SUPPORT_PHONE_DISPLAY} and our team will book your trip.`}
                </EmptyState>
              </div>
            ) : connection ? (
              <div className="card state-card" role="alert">
                <EmptyState
                  icon="offline"
                  title="We couldn’t reach NESAM"
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
                  <span className="spinner" aria-hidden="true" /> Finding cabs for your journey…
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
                  title="No cabs available for this trip"
                  action={
                    <div className="state-card__actions">
                      <Button icon="clock" onClick={() => navigate('/book')}>
                        Change time
                      </Button>
                      <a className="btn btn--secondary" href={`tel:${SUPPORT_PHONE}`}>
                        <Icon name="phone" size={17} /> Call NESAM
                      </a>
                    </div>
                  }
                >
                  {q.unavailable.get(categories[0]!.id) || 'Try a different pickup time, or call NESAM and we’ll help you plan it.'}
                </EmptyState>
              </div>
            ) : (
              <>
                <p className="choose__intro">Fares are confirmed by NESAM’s booking server for this exact trip and include GST.</p>
                {groups.length > 1 || categories.length > 2 ? (
                  <div className="cab-tools">
                    <div className="cab-tools__filters" role="group" aria-label="Filter cabs">
                      {(['All', ...groups] as const).map((g) => (
                        <button key={g} type="button" className={`chip ${group === g ? 'is-active' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>
                          {g === 'All' ? 'All cabs' : g}
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
                  {shown.length} cab option{shown.length === 1 ? '' : 's'} for your journey
                  {selectedHidden ? ` · your selection (${selected!.name}) is hidden by this filter` : ''}
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
                      <li key={c.id}>
                        <label className={`cab ${on ? 'is-selected' : ''} ${blocked ? 'is-disabled' : ''}`}>
                          <input type="radio" name="cab" className="cab__radio" checked={on} disabled={blocked} onChange={() => update({ categoryId: c.id })} />
                          <span className="cab__tick" aria-hidden="true">
                            <Icon name="check" size={12} />
                          </span>
                          <span className="cab__photo">
                            <img src={categoryPhoto(c)} alt="" width={360} height={220} loading="lazy" />
                          </span>
                          <span className="cab__info">
                            <strong className="cab__name">{c.name}</strong>
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
                                <small>{q.quoteLoading || q.quoteError ? 'Estimate · confirming fare' : 'Total fare'}</small>
                                <small>GST included</small>
                              </>
                            ) : q.quoteLoading ? (
                              <span className="skeleton cab__price-skel" />
                            ) : (
                              <small>Fare unavailable</small>
                            )}
                          </span>
                          <span className="cab__foot">
                            <span>{incl || 'Fare as per route distance'}</span>
                            {fare ? (
                              <button
                                type="button"
                                className="link-btn"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setFareFor(c);
                                }}
                              >
                                <Icon name="chevron-right" size={13} /> View fare
                              </button>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="choose__fine">Category images are illustrative. The assigned model may vary within the booked category.</p>
                <Notice tone="warning">Toll, parking and state permits are paid separately, against receipts.</Notice>
              </>
            )}
          </div>

          <aside className="choose__aside" aria-label="Your selection">
            <div className="sel-card">
              <div className="sel-card__top">
                <span className="sel-card__eyebrow">Your selection</span>
                <Icon name="shield-check" size={16} />
              </div>
              {selected ? (
                <>
                  <div className="sel-card__car">
                    <div>
                      <strong>{selected.name}</strong>
                      {selected.description ? <small>{selected.description}</small> : null}
                    </div>
                    <img src={categoryPhoto(selected)} alt="" width={180} height={110} />
                  </div>
                  <div className="cab__badges">
                    <span className="feat feat--seats">
                      <Icon name="passengers" size={13} /> {selected.seats} passengers
                    </span>
                    <span className="feat feat--ac">
                      <Icon name="air-conditioning" size={13} /> AC
                    </span>
                  </div>
                </>
              ) : (
                <p className="muted small">Choose a cab to see its fare.</p>
              )}
              <dl className="sel-card__trip">
                <div>
                  <dt>Pickup location</dt>
                  <dd>{pickup.name}</dd>
                </div>
                <div>
                  <dt>Drop location</dt>
                  <dd>{drop.id === 'place-local-disposal' ? 'Within the city' : drop.name}</dd>
                </div>
                <div className="sel-card__when">
                  <Icon name="calendar" size={14} /> {when}
                </div>
              </dl>
              <div className="sel-card__total">
                <span>Total fare</span>
                <strong className="num">{summaryFare != null ? formatINR(summaryFare) : q.quoteLoading ? '…' : '—'}</strong>
              </div>
              {q.coupon ? <p className="sel-card__saving">Includes {q.coupon.code}: −{formatINR(q.coupon.discount)}</p> : null}
              <p className="sel-card__fine">Toll, parking &amp; state tax are extra, paid separately against receipts.</p>
              <PromoControl />
              <Button block size="lg" icon="arrow-right" disabled={!canContinue} onClick={() => navigate('/book/confirm')}>
                Continue
              </Button>
              {selected && breakupFor(selected) ? (
                <button type="button" className="link-btn sel-card__fare" onClick={() => setFareFor(selected)}>
                  View fare details
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <FlowBar back={() => navigate('/book')} className="flow-bar--choose">
        <div className="flow-bar__total">
          <div>
            <small>Total fare</small>
            <strong className="num">{summaryFare != null ? formatINR(summaryFare) : q.quoteLoading ? '…' : '—'}</strong>
          </div>
          <Button size="lg" icon="arrow-right" disabled={!canContinue} onClick={() => navigate('/book/confirm')}>
            Continue
          </Button>
        </div>
      </FlowBar>

      {fareFor && breakupFor(fareFor) && q.quotes.get(fareFor.id) ? (
        <FareDialog title={`${fareFor.name} · fare details`} lines={breakupFor(fareFor)!.lines} total={q.quotes.get(fareFor.id)!.total} estimated={!q.authoritative} onClose={() => setFareFor(null)} />
      ) : null}
    </div>
  );
}
