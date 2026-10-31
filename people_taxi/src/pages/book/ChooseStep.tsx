// Step 2 — choose your cab: every vehicle category priced with the server's authoritative fare.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RideCategory } from '@core/types';
import { quotedInclusionLine } from '@core/utils/bookingRules';
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

  const handleNext = () => {
    if (canContinue) navigate('/book/confirm');
  };

  return (
    <div className="flow-page flow-page--choose">
      <div className="wrap flow-page__wrap">
        <PageHead
          back={<Button variant="secondary" size="sm" onClick={() => navigate('/book')} icon="arrow-left">Edit Route</Button>}
          eyebrow="Step 2 of 3 · Choose Vehicle"
          title={
            <span className="route-title">
              <span>{pickup.name}</span>
              <Icon name="arrow-right" size={20} />
              <span>{drop.id === 'place-local-disposal' ? 'Local City Disposal' : drop.name}</span>
            </span>
          }
        >
          {route ? `${formatDistance(route.distanceKm)} · approx. ${formatDuration(route.durationMin)}` : 'Pricing authoritatively via server'}
        </PageHead>

        <FlowSteps total={3} current={2} />

        <div className="choose">
          <div className="choose__main">
            <section className="trip-sum" aria-label="Trip summary">
              <div className="trip-sum__top">
                <Badge variant="blue">{tripTypeLabel(tripType)}</Badge>
                {scheduledAt ? (
                  <span className="trip-sum__when">
                    <Icon name="calendar" size={14} /> {formatDate(scheduledAt)}, {formatTime(scheduledAt)}
                    {tripEndAt ? ` → Return: ${formatDate(tripEndAt)}` : ''}
                  </span>
                ) : null}
              </div>
              <div className="trip-sum__route">
                <div>
                  <strong>{pickup.name}</strong> → <strong>{drop.id === 'place-local-disposal' ? 'Within city' : drop.name}</strong>
                </div>
                <Link to="/book" className="btn btn--text btn--sm">
                  Change
                </Link>
              </div>
            </section>

            <div className="choose__notices">
              {!online ? (
                <Notice variant="error" icon="warning">
                  You are offline right now. Vehicle prices will update automatically once connection is restored.
                </Notice>
              ) : null}

              {routeStatus === 'error' ? (
                <Notice
                  variant="warning"
                  icon="warning"
                  action={
                    <Button variant="secondary" size="sm" onClick={retryRoute}>
                      Retry Route
                    </Button>
                  }
                >
                  We couldn't get highway routing right now. Fares use direct distance until road routing reconnects.
                </Notice>
              ) : null}

              {tooFar ? (
                <Notice variant="warning" icon="warning">
                  Journeys over {TOO_FAR_KM} km require a custom multi-day itinerary.{' '}
                  <a href={`tel:${SUPPORT_PHONE}`}>Call {SUPPORT_PHONE_DISPLAY}</a> to plan with dispatch.
                </Notice>
              ) : null}
            </div>

            <div className="cab-tools">
              <div className="cab-tools__filters" role="tablist" aria-label="Filter vehicle categories">
                <button
                  type="button"
                  className={`chip ${group === 'All' ? 'is-active' : ''}`}
                  onClick={() => setGroup('All')}
                >
                  All Vehicles ({categories.length})
                </button>
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`chip ${group === g ? 'is-active' : ''}`}
                    onClick={() => setGroup(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <label className="cab-tools__sort">
                <span>Sort by:</span>
                <select className="select select--sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="recommended">Recommended</option>
                  <option value="low">Price: Low to High</option>
                  <option value="high">Price: High to Low</option>
                </select>
              </label>
            </div>

            <p className="choose__count">
              Showing {shown.length} available {shown.length === 1 ? 'vehicle' : 'vehicles'}
            </p>

            <div className="cabs" role="radiogroup" aria-label="Available cabs">
              {categoryStatus === 'loading' && categories.length === 0 ? (
                <>
                  <div className="skeleton cab-skel" />
                  <div className="skeleton cab-skel" />
                  <div className="skeleton cab-skel" />
                </>
              ) : null}

              {shown.map((c) => {
                const isSelected = c.id === categoryId;
                const fare = q.quotes.get(c.id);
                const unavailable = q.unavailable.has(c.id);
                const disabled = unavailable || tooFar;
                const photo = categoryPhoto(c);
                const name = categoryName(c);
                const b = breakupFor(c);
                const incl = quotedInclusionLine(q.entries.get(c.id), c, q.outstation);

                return (
                  <div
                    key={c.id}
                    className={`cab ${isSelected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
                    onClick={() => !disabled && update({ categoryId: c.id })}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={(e) => {
                      if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
                        e.preventDefault();
                        update({ categoryId: c.id });
                      }
                    }}
                  >
                    <span className="cab__tick" aria-hidden="true">
                      {isSelected ? <Icon name="check" size={14} /> : null}
                    </span>

                    <div className="cab__photo">
                      <img src={photo} alt={c.name} loading="lazy" />
                    </div>

                    <div className="cab__info">
                      <h3 className="cab__name">{name}</h3>
                      <p className="cab__model">{c.description || `${c.seats} comfortable passenger seats · All AC fleet`}</p>

                      <div className="cab__badges">
                        <span className="feat feat--ac">
                          <Icon name="snowflake" size={12} /> AC
                        </span>
                        <span className="feat">
                          <Icon name="user" size={12} /> {c.seats} Seats
                        </span>
                        <span className="feat">
                          <Icon name="luggage" size={12} /> {((c as any).luggage ?? (c.seats >= 6 ? 4 : 2))} Bags
                        </span>
                      </div>

                      {incl ? <p className="cab__incl">{incl}</p> : null}
                    </div>

                    <div className="cab__price">
                      {fare ? (
                        <>
                          <small className="muted">Upfront total</small>
                          <strong>{formatINR(fare.total)}</strong>
                          {fare.discount > 0 ? (
                            <small className="green">Saved {formatINR(fare.discount)}</small>
                          ) : (
                            <small className="muted">Tolls &amp; taxes extra</small>
                          )}
                        </>
                      ) : unavailable ? (
                        <span className="cab__na">Unavailable for this route</span>
                      ) : (
                        <span className="cab__price-skel skeleton" />
                      )}
                    </div>

                    <div className="cab__foot">
                      <button
                        type="button"
                        className="btn btn--text btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFareFor(c);
                        }}
                      >
                        <Icon name="info" size={14} /> View Fare Breakup
                      </button>

                      <Button
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!disabled) update({ categoryId: c.id });
                        }}
                      >
                        {isSelected ? 'Selected' : 'Select Ride'}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {shown.length === 0 && categoryStatus === 'ready' ? (
                <EmptyState
                  title="No vehicles match this filter"
                  action={
                    <Button variant="secondary" onClick={() => setGroup('All')}>
                      Show All Vehicles
                    </Button>
                  }
                >
                  Try selecting "All Vehicles" to browse our complete chauffeur fleet.
                </EmptyState>
              ) : null}
            </div>
          </div>

          <aside className="choose__aside">
            <div className="sel-card">
              <div className="sel-card__top">
                <span className="sel-card__eyebrow">Trip Summary</span>
                <Badge variant="blue">{tripTypeLabel(tripType)}</Badge>
              </div>

              {selected ? (
                <div className="sel-card__car">
                  <div>
                    <strong>{categoryName(selected)}</strong>
                    <small className="muted">{selected.seats} seats · AC</small>
                  </div>
                  <img src={categoryPhoto(selected)} alt={selected.name} />
                </div>
              ) : (
                <div className="sel-card__placeholder muted">Please choose a vehicle category from the list.</div>
              )}

              <dl className="sel-card__trip">
                <div>
                  <dt>Pickup Point</dt>
                  <dd>{pickup.name}</dd>
                </div>
                <div>
                  <dt>Destination</dt>
                  <dd>{drop.id === 'place-local-disposal' ? 'Within City Disposal' : drop.name}</dd>
                </div>
                {scheduledAt ? (
                  <div>
                    <dt>Pickup Schedule</dt>
                    <dd>{formatDate(scheduledAt)}, {formatTime(scheduledAt)}</dd>
                  </div>
                ) : null}
              </dl>

              <PromoControl
                code={draft.promoCode}
                applied={!!quote && quote.discount > 0}
                onApply={(code) => update({ promoCode: code })}
                onRemove={() => update({ promoCode: '' })}
              />

              {quote ? (
                <>
                  <div className="sel-card__total">
                    <div>
                      <span>Estimated Upfront Fare</span>
                      {quote.discount > 0 ? (
                        <p className="sel-card__saving">Promo applied: -{formatINR(quote.discount)}</p>
                      ) : null}
                    </div>
                    <strong>{formatINR(quote.total)}</strong>
                  </div>

                  <p className="sel-card__fine">
                    * Exact transparent fare. You pay your driver directly via Cash or UPI at the destination.
                  </p>

                  <Button
                    variant="primary"
                    size="lg"
                    block
                    disabled={!canContinue}
                    onClick={handleNext}
                    iconTrailing="arrow-right"
                  >
                    Proceed to Review
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="lg" block disabled>
                  Select a Cab
                </Button>
              )}
            </div>
          </aside>
        </div>
      </div>

      <FlowBar
        onBack={() => navigate('/book')}
        onNext={handleNext}
        backLabel="Back"
        nextLabel="Review Booking"
        nextDisabled={!canContinue}
        total={quote?.total}
      />

      {fareFor && breakupFor(fareFor) ? (
        <FareDialog fare={breakupFor(fareFor)!} onClose={() => setFareFor(null)} />
      ) : null}
    </div>
  );
}
export default ChooseStep;
