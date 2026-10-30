// Multicity & Custom Tour Itinerary Form for People Taxi.
// Allows riders to build multi-stop road trip itineraries with reorderable intermediate stops,
// departure and return schedules, preferred cab category and custom notes.
// Submits a validated itinerary enquiry (submitMulticityEnquiry) with stable submissionId.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GeoPlace, RideCategory } from '@core/types';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { scheduleProblem } from '@core/utils/bookingRules';
import { callFunction, newId } from '@core/services/callables';
import { useCustomerData } from '@/state/customer';
import { useAuth } from '@/state/Auth';
import { subscribeToRideCategories, type RideCategoryStatus } from '@core/services/pricingService';
import { loadMulticityDraft, multicityInstant, validMulticityDate, validMulticityPlace, type MulticityDraft } from '@core/utils/multicityDraft';
import { useOnline } from '@/lib/hooks';
import { latestPickup, toDateInput } from '@/lib/schedule';
import { Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { LocationPicker, type PickerConfig } from '@/components/LocationPicker';
import { TimePicker, formatTime12 } from '@/components/TimePicker';
import { QUICK_CITIES } from './content';

type StoredMulticityState = MulticityDraft;

const STORAGE_KEY = 'peopletaxi.multicity.v1';

function loadStoredState(): StoredMulticityState {
  try { return loadMulticityDraft(sessionStorage.getItem(STORAGE_KEY)); }
  catch { return loadMulticityDraft(null); }
}

function saveStoredState(state: StoredMulticityState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write errors
  }
}

export function MulticityForm() {
  const { state: auth, openLoginModal } = useAuth();
  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [categoryStatus, setCategoryStatus] = useState<RideCategoryStatus>('loading');
  useEffect(() => subscribeToRideCategories((rows, status) => { setCategories(rows); setCategoryStatus(status); }, true), []);
  const { savedPlaces, trips } = useCustomerData();
  const { online } = useOnline();

  const [state, setState] = useState<StoredMulticityState>(loadStoredState);
  const [pickerTarget, setPickerTarget] = useState<'pickup' | 'drop' | string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submittedQuote, setSubmittedQuote] = useState<{ code: string; message: string } | null>(null);

  // Sync to session storage on change
  useEffect(() => {
    saveStoredState(state);
  }, [state]);

  const recentPlaces = useMemo<GeoPlace[]>(() => {
    const out: GeoPlace[] = [];
    const seen = new Set<string>();
    for (const t of trips) {
      for (const p of [t.drop, t.pickup]) {
        if (!p || !p.lat || !p.lng) continue;
        const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
        if (out.length >= 6) return out;
      }
    }
    return out;
  }, [trips]);

  const scheduled = useMemo(() => {
    if (!state.date || !state.time) return null;
    const instant = multicityInstant(state.date, state.time);
    return instant ? new Date(instant) : null;
  }, [state.date, state.time]);

  const todayStr = useMemo(() => toDateInput(new Date()), []);
  const maxDateStr = useMemo(() => toDateInput(latestPickup()), []);

  // Stop list mutations
  const addStop = () => {
    if (state.stops.length >= 10) return;
    setState((s) => ({
      ...s,
      stops: [...s.stops, { id: newId('stop'), place: null }],
    }));
  };

  const removeStop = (id: string) => {
    setState((s) => ({
      ...s,
      stops: s.stops.length > 1 ? s.stops.filter((st) => st.id !== id) : [{ id: newId('stop'), place: null }],
    }));
  };

  const moveStop = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= state.stops.length) return;
    setState((s) => {
      const next = [...s.stops];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return { ...s, stops: next };
    });
  };

  // Place picker callback
  const onPickPlace = (p: GeoPlace) => {
    if (pickerTarget === 'pickup') {
      setState((s) => ({ ...s, pickup: p }));
      setErrors((e) => {
        const next = { ...e };
        delete next.pickup;
        return next;
      });
    } else if (pickerTarget === 'drop') {
      setState((s) => ({ ...s, drop: p }));
      setErrors((e) => {
        const next = { ...e };
        delete next.drop;
        return next;
      });
    } else if (pickerTarget) {
      // It's a stop ID
      setState((s) => ({
        ...s,
        stops: s.stops.map((st) => (st.id === pickerTarget ? { ...st, place: p } : st)),
      }));
      setErrors((e) => {
        const next = { ...e };
        delete next[`stop_${pickerTarget}`];
        return next;
      });
    }
    setPickerTarget(null);
  };

  const pickerConfig: PickerConfig = useMemo(() => {
    if (pickerTarget === 'pickup') {
      return {
        title: 'Choose Starting City / Pickup Point',
        allowCurrent: true,
        popular: QUICK_CITIES,
        popularLabel: 'Major Cities',
        pinMode: 'pickup',
      };
    }
    if (pickerTarget === 'drop') {
      return {
        title: 'Choose Final Destination City',
        allowCurrent: false,
        popular: QUICK_CITIES,
        popularLabel: 'Popular Destinations',
        pinMode: 'drop',
      };
    }
    const idx = state.stops.findIndex((s) => s.id === pickerTarget);
    return {
      title: `Choose Intermediate Stop #${idx + 1}`,
      allowCurrent: false,
      popular: QUICK_CITIES,
      popularLabel: 'Popular Stops',
      pinMode: 'drop',
    };
  }, [pickerTarget, state.stops]);

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!validMulticityPlace(state.pickup)) {
      err.pickup = 'Please select a starting pickup location.';
    }
    if (!validMulticityPlace(state.drop)) {
      err.drop = 'Please select a final destination point.';
    }

    const filledStops = state.stops.filter((s) => s.place !== null);
    if (filledStops.length === 0) {
      err.stops = 'Please add at least one intermediate stop along your tour route.';
    }

    // Verify consecutive duplicates
    const allPoints = [state.pickup, ...filledStops.map((s) => s.place), state.drop].filter(Boolean) as GeoPlace[];
    for (let i = 0; i < allPoints.length - 1; i++) {
      if (allPoints[i].name.trim().toLowerCase() === allPoints[i + 1].name.trim().toLowerCase()) {
        err.itinerary = `Consecutive stop duplicate: "${allPoints[i].name}" cannot immediately follow itself.`;
        break;
      }
    }

    if (!validMulticityDate(state.date)) err.date = 'Select a valid departure date.';
    if (!scheduled) err.time = 'Select a valid departure date and time.';

    if (scheduled) {
      const prob = scheduleProblem(scheduled);
      if (prob) err.time = prob;
    }

    if (state.endDate && (!validMulticityDate(state.endDate) || state.endDate < state.date)) err.endDate = 'Select a valid trip end date on or after departure.';
    if (state.stops.some(stop => !validMulticityPlace(stop.place))) err.stops = 'Choose a location for every added stop, or remove the empty stop.';
    if (state.categoryId && (categoryStatus !== 'ready' || !categories.some(category => category.id === state.categoryId))) err.form = 'Choose an available category or No preference.';

    if (!online) {
      err.form = 'You are currently offline. Please check your internet connection.';
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || !validate()) return;

    if (auth.status !== 'ready') {
      openLoginModal({
        title: 'Sign in to request tour quote',
        subtitle: 'Sign in so our travel desk can link this itinerary quote directly to your account.',
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});

    try {
      const filledStops = state.stops.filter((s) => s.place !== null).map((s) => ({ ...s.place!, id: s.id }));
      const res = await callFunction<{
        submissionId: string;
        brand: string;
        source: string;
        pickup: GeoPlace;
        drop: GeoPlace;
        stops: GeoPlace[];
        scheduledAt: string;
        tripEndAt?: string;
        categoryId?: string;
        notes?: string;
      }, { id: string; code: string; status: string; message: string }>('submitMulticityEnquiry', {
        submissionId: state.submissionId,
        brand: 'people_taxi',
        source: 'peopletaxi_web',
        pickup: state.pickup!,
        drop: state.drop!,
        stops: filledStops,
        scheduledAt: scheduled!.toISOString(),
        ...(state.endDate ? { tripEndAt: multicityInstant(state.endDate, '23:59:59')! } : {}),
        ...(state.categoryId ? { categoryId: state.categoryId } : {}),
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
      });

      setSubmittedQuote({
        code: res.code || res.id,
        message: res.message || 'Your itinerary quote request has been received.',
      });

      // Clear stored draft upon success
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Submission succeeded even if storage is unavailable. */ }
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to submit itinerary quote. Please try again.' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // If successfully submitted, render success confirmation card
  if (submittedQuote) {
    return (
      <div className="jd jd-multicity-success" role="region" aria-label="Itinerary quote confirmation">
        <div className="jd-success-card">
          <div className="jd-success-card__icon" aria-hidden="true">
            <Icon name="circle-check" size={48} />
          </div>
          <h3>Quote Request Received!</h3>
          <p className="jd-success-card__code">
            Reference: <strong>{submittedQuote.code}</strong>
          </p>
          <div className="jd-success-card__badge">
            <Icon name="clock" size={16} /> Status: <span>Under Travel Desk Review</span>
          </div>
          <p className="jd-success-card__copy">
            Our travel desk is calculating exact highway route distance, state permit charges and custom tour package pricing.
            The travel desk will contact you after reviewing your itinerary and preparing a quote.
          </p>

          <div className="jd-success-card__itinerary">
            <span className="jd-preview-label">Requested Itinerary:</span>
            <div className="jd-itinerary-preview">
              <span className="jd-itinerary-stop is-start">{state.pickup?.name}</span>
              {state.stops.filter((s) => s.place).map((s, idx) => (
                <span key={s.id} className="jd-itinerary-stop is-mid">
                  <Icon name="arrow-right" size={12} /> {s.place?.name}
                </span>
              ))}
              <span className="jd-itinerary-stop is-end">
                <Icon name="arrow-right" size={12} /> {state.drop?.name}
              </span>
            </div>
          </div>

          <div className="jd-success-card__actions">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setSubmittedQuote(null);
                setState({
                  submissionId: newId('sub'),
                  pickup: null,
                  drop: null,
                  stops: [{ id: newId('stop'), place: null }],
                  date: '',
                  time: '',
                  endDate: '',
                  categoryId: '',
                  notes: '',
                });
              }}
            >
              Plan Another Tour
            </Button>
            <Link to="/trips" className="btn btn--primary btn--md">
              View My Trips
            </Link>
          </div>

          <div className="jd-support-strip">
            <span>Need immediate travel desk assistance?</span>
            <a href={`tel:${SUPPORT_PHONE}`} className="jd-tel-link">
              <Icon name="phone" size={16} /> Call {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const filledStopsCount = state.stops.filter((s) => s.place !== null).length;

  return (
    <form className="jd-form jd-multicity-form" onSubmit={onSubmit} noValidate>
      <fieldset disabled={submitting} style={{ display: 'contents', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {/* Route & Intermediate Stops Section */}
      <div className="jd-section" role="group" aria-labelledby="mc-route-title">
        <p className="jd-section__title" id="mc-route-title">
          <Icon name="route" size={16} /> Tour Itinerary &amp; Stops
        </p>

        {/* 1. Pickup Point */}
        <div className={`jd-field-box ${errors.pickup ? 'is-invalid' : ''}`}>
          <div className="jd-field-box__head">
            <span className="jd-box-dot is-pickup" aria-hidden="true" />
            <label htmlFor="mc-pickup-btn" className="jd-field-box__label">
              Starting Pickup Location
            </label>
          </div>
          <button
            id="mc-pickup-btn"
            type="button"
            className={`jd-value ${!state.pickup ? 'is-empty' : ''}`}
            onClick={() => setPickerTarget('pickup')}
          >
            <span className="jd-value__text">
              {state.pickup?.name ?? 'Enter starting city, hotel or pickup point'}
            </span>
            {state.pickup?.address && state.pickup.address !== state.pickup.name ? (
              <span className="jd-value__addr">{state.pickup.address}</span>
            ) : null}
          </button>
          {errors.pickup ? <p className="jd-error">{errors.pickup}</p> : null}
        </div>

        {/* 2. Intermediate Stops List */}
        <div className="jd-multicity-stops">
          <div className="jd-stops-header">
            <span className="jd-stops-header__label">Intermediate Stops / Sightseeing ({state.stops.length}/10)</span>
            <button
              type="button"
              className="btn-add-stop"
              disabled={state.stops.length >= 10}
              onClick={addStop}
            >
              <Icon name="plus" size={14} /> Add stop
            </button>
          </div>

          {state.stops.map((stop, index) => {
            const stopErr = errors[`stop_${stop.id}`];
            return (
              <div key={stop.id} className={`jd-stop-row ${stopErr ? 'is-invalid' : ''}`}>
                <div className="jd-stop-badge">Stop #{index + 1}</div>
                <div className="jd-stop-input-wrap">
                  <button
                    type="button"
                    className={`jd-value jd-value--stop ${!stop.place ? 'is-empty' : ''}`}
                    onClick={() => setPickerTarget(stop.id)}
                  >
                    <span className="jd-value__text">
                      {stop.place?.name ?? `Choose stop #${index + 1} (city, temple or landmark)`}
                    </span>
                    {stop.place?.address && stop.place.address !== stop.place.name ? (
                      <span className="jd-value__addr">{stop.place.address}</span>
                    ) : null}
                  </button>
                </div>
                <div className="jd-stop-actions">
                  <button
                    type="button"
                    className="btn-icon-action"
                    disabled={index === 0}
                    title="Move stop up"
                    aria-label={`Move stop ${index + 1} up`}
                    onClick={() => moveStop(index, 'up')}
                  >
                    <Icon name="arrow-up" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-action"
                    disabled={index === state.stops.length - 1}
                    title="Move stop down"
                    aria-label={`Move stop ${index + 1} down`}
                    onClick={() => moveStop(index, 'down')}
                  >
                    <Icon name="arrow-down" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-action is-delete"
                    title="Remove stop"
                    aria-label={`Remove stop ${index + 1}`}
                    onClick={() => removeStop(stop.id)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {errors.stops ? <p className="jd-error">{errors.stops}</p> : null}
        </div>

        {/* 3. Final Drop Destination */}
        <div className={`jd-field-box ${errors.drop ? 'is-invalid' : ''}`}>
          <div className="jd-field-box__head">
            <span className="jd-box-dot is-drop" aria-hidden="true" />
            <label htmlFor="mc-drop-btn" className="jd-field-box__label">
              Final Destination Drop Point
            </label>
          </div>
          <button
            id="mc-drop-btn"
            type="button"
            className={`jd-value ${!state.drop ? 'is-empty' : ''}`}
            onClick={() => setPickerTarget('drop')}
          >
            <span className="jd-value__text">
              {state.drop?.name ?? 'Enter final city or return drop point'}
            </span>
            {state.drop?.address && state.drop.address !== state.drop.name ? (
              <span className="jd-value__addr">{state.drop.address}</span>
            ) : null}
          </button>
          {errors.drop ? <p className="jd-error">{errors.drop}</p> : null}
        </div>

        {/* Visual Route Flow Summary */}
        {(state.pickup || filledStopsCount > 0 || state.drop) ? (
          <div className="jd-itinerary-preview-card">
            <span className="jd-preview-label">Itinerary summary:</span>
            <div className="jd-itinerary-preview">
              <span className="jd-itinerary-stop is-start">{state.pickup?.name || 'Start'}</span>
              {state.stops.filter((s) => s.place).map((s) => (
                <span key={s.id} className="jd-itinerary-stop is-mid">
                  <Icon name="arrow-right" size={12} /> {s.place?.name}
                </span>
              ))}
              <span className="jd-itinerary-stop is-end">
                <Icon name="arrow-right" size={12} /> {state.drop?.name || 'Destination'}
              </span>
            </div>
            {errors.itinerary ? <p className="jd-error">{errors.itinerary}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Schedule Section */}
      <div className="jd-section" role="group" aria-labelledby="mc-sched-title">
        <p className="jd-section__title" id="mc-sched-title">
          <Icon name="calendar" size={16} /> Trip Schedule
        </p>
        <div className="jd-pair">
          <div className="jd-field">
            <label htmlFor="mc-date" className="jd-label">
              Departure date
            </label>
            <input
              id="mc-date"
              type="date"
              className={`jd-control ${errors.date ? 'is-invalid' : ''}`}
              min={todayStr}
              max={maxDateStr}
              value={state.date}
              onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
              required
            />
            {errors.date ? <p className="jd-error">{errors.date}</p> : null}
          </div>
          <div className="jd-field">
            <label htmlFor="mc-time-btn" className="jd-label">
              Departure time
            </label>
            <button
              id="mc-time-btn"
              type="button"
              className={`jd-control jd-control--btn ${!state.time ? 'is-empty' : ''} ${errors.time ? 'is-invalid' : ''}`}
              onClick={() => setTimePickerOpen(true)}
            >
              <span>{state.time ? formatTime12(state.time) : 'Choose time'}</span>
              <Icon name="clock" size={18} />
            </button>
            {errors.time ? <p className="jd-error">{errors.time}</p> : null}
          </div>
        </div>

        <div className="jd-field" style={{ marginTop: '12px' }}>
          <label htmlFor="mc-end-date" className="jd-label">
            Expected tour end date (optional)
          </label>
          <input
            id="mc-end-date"
            type="date"
            className="jd-control"
            min={state.date || todayStr}
            max={maxDateStr}
            value={state.endDate}
            onChange={(e) => setState((s) => ({ ...s, endDate: e.target.value }))}
          />
          {errors.endDate ? <p className="jd-error">{errors.endDate}</p> : null}
        </div>
      </div>

      {/* Vehicle Category Preference */}
      <div className="jd-section" role="group" aria-labelledby="mc-cat-title">
        <p className="jd-section__title" id="mc-cat-title">
          <Icon name="car" size={16} /> Preferred Vehicle Category
        </p>
        <p role="status">{categoryStatus === 'loading' ? 'Loading configured categories…' : categoryStatus === 'error' ? 'Categories could not be loaded. You can continue with No preference.' : !categories.length ? 'No categories configured. You can continue with No preference.' : ''}</p>
        <div className="jd-category-chips" role="radiogroup" aria-label="Vehicle category">
          <button type="button" role="radio" aria-checked={!state.categoryId} className={`jd-cat-chip ${!state.categoryId ? 'is-selected' : ''}`} onClick={() => setState(s => ({ ...s, categoryId: '' }))}>No preference</button>
          {categories.map((cat) => {
            const isSelected = state.categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`jd-cat-chip ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setState((s) => ({ ...s, categoryId: isSelected ? '' : cat.id }))}
              >
                <span className="jd-cat-chip__name">{cat.name}</span>
                {cat.seats ? <span className="jd-cat-chip__seats">{cat.seats} Seats</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes / Special Instructions */}
      <div className="jd-section">
        <label htmlFor="mc-notes" className="jd-label">
          Tour notes &amp; special requirements (optional)
        </label>
        <textarea
          maxLength={500}
          id="mc-notes"
          className="jd-textarea"
          rows={3}
          placeholder="e.g. 4 adults, 2 kids with 3 suitcases; temple darshan schedule; returning to pickup point..."
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
        />
      </div>

      {errors.form ? (
        <p className="jd-error jd-error--form" role="alert">
          {errors.form}
        </p>
      ) : null}

      {/* Action Buttons */}
      <div className="jd-action">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={submitting}
          className="jd-submit"
          iconTrailing="arrow-right"
        >
          Get Trip Quote
        </Button>
        <p className="jd-trust">
          <Icon name="shield-check" size={16} /> Transparent custom tour package pricing · 24/7 dedicated travel desk
        </p>

        <div className="jd-offline-fallback">
          <span>Prefer speaking with our tour coordinator?</span>
          <a href={`tel:${SUPPORT_PHONE}`} className="jd-call-link">
            <Icon name="phone" size={15} /> Call {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      </div>

      {/* Place Picker Modal */}
      {pickerTarget ? (
        <LocationPicker
          config={pickerConfig}
          saved={savedPlaces}
          recent={recentPlaces}
          onPick={onPickPlace}
          onClose={() => setPickerTarget(null)}
        />
      ) : null}

      {/* Time Picker Modal */}
      {timePickerOpen ? (
        <TimePicker
          value={state.time}
          date={state.date}
          title="Select Departure Time"
          onPick={(val) => setState((s) => ({ ...s, time: val }))}
          onClose={() => setTimePickerOpen(false)}
        />
      ) : null}
      </fieldset>
    </form>
  );
}
