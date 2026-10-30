// Multicity & Custom Tour Itinerary Form for One Way Car Rentals.
// Allows riders to build multi-stop road trip itineraries with reorderable intermediate stops,
// departure and return schedules, preferred cab category and custom notes.
// Submits a validated itinerary enquiry (submitMulticityEnquiry) with stable submissionId and onewaycarrentals brand.
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

const STORAGE_KEY = 'onewaycarrentals.multicity.v1';

function loadStoredState(): StoredMulticityState {
  try { return loadMulticityDraft(sessionStorage.getItem(STORAGE_KEY)); }
  catch { return loadMulticityDraft(null); }
}

function saveStoredState(state: StoredMulticityState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write issues
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

  // Synchronize draft changes into sessionStorage
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

  // Stop list mutations with stable IDs
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

  const onPickPlace = (p: GeoPlace) => {
    if (pickerTarget === 'pickup') {
      setState((s) => ({ ...s, pickup: p }));
      setErrors((e) => {
        const next = { ...e };
        delete next.pickup;
        delete next.itinerary;
        return next;
      });
    } else if (pickerTarget === 'drop') {
      setState((s) => ({ ...s, drop: p }));
      setErrors((e) => {
        const next = { ...e };
        delete next.drop;
        delete next.itinerary;
        return next;
      });
    } else if (pickerTarget) {
      setState((s) => ({
        ...s,
        stops: s.stops.map((st) => (st.id === pickerTarget ? { ...st, place: p } : st)),
      }));
      setErrors((e) => {
        const next = { ...e };
        delete next[`stop_${pickerTarget}`];
        delete next.stops;
        delete next.itinerary;
        return next;
      });
    }
    setPickerTarget(null);
  };

  const pickerConfig: PickerConfig = useMemo(() => {
    if (pickerTarget === 'pickup') {
      return {
        title: 'Choose Starting Pickup Location',
        allowCurrent: true,
        popular: QUICK_CITIES,
        popularLabel: 'Major Cities',
        pinMode: 'pickup',
      };
    }
    if (pickerTarget === 'drop') {
      return {
        title: 'Choose Final Destination Point',
        allowCurrent: false,
        popular: QUICK_CITIES,
        popularLabel: 'Popular Destinations',
        pinMode: 'drop',
      };
    }
    const idx = state.stops.findIndex((s) => s.id === pickerTarget);
    return {
      title: `Choose Intermediate Stop #${idx + 1} (City, Landmark or Temple)`,
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
      err.drop = 'Please select a final destination drop point.';
    }

    const filledStops = state.stops.filter((s) => s.place !== null);
    if (filledStops.length === 0) {
      err.stops = 'Please add at least one intermediate stop along your tour route.';
    }

    // Verify consecutive duplicates across the ordered itinerary
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

    if (state.endDate && (!validMulticityDate(state.endDate) || state.endDate < state.date)) {
      err.endDate = 'Tour end date cannot be earlier than departure date.';
    }

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
        brand: 'onewaycarrentals',
        source: 'onewaycarrentals_web',
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

      // Clear draft on successful submission
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Submission succeeded even if storage is unavailable. */ }
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to submit itinerary quote. Please try again.' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const resetState = () => {
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
    setErrors({});
  };

  // ── Success State ──────────────────────────────────────────────────────────
  if (submittedQuote) {
    return (
      <div className="bf-success" role="region" aria-label="Itinerary quote confirmation">
        <div className="bf-success__icon" aria-hidden="true">
          <Icon name="circle-check" size={52} />
        </div>
        <h3 className="text-xl font-bold text-ink">Quote Request Received!</h3>
        <p className="bf-success__code">
          Reference: <strong>{submittedQuote.code}</strong>
        </p>
        <div className="bf-success__status">
          <Icon name="clock-3" size={14} /> Status: <span>Under Travel Desk Review</span>
        </div>
        <p className="bf-success__desc">
          Our travel desk is calculating exact highway route distance, state permit charges and custom tour package pricing.
          The travel desk will contact you after reviewing your itinerary and preparing a quote.
        </p>

        <div className="bf-success__itinerary">
          <span className="bf-route-summary__title">Requested Itinerary:</span>
          <div className="bf-route-flow">
            <span className="bf-route-flow__stop">{state.pickup?.name}</span>
            {state.stops.filter((s) => s.place).map((s) => (
              <span key={s.id} className="bf-route-flow__stop">
                <Icon name="arrow-right" size={12} className="bf-route-flow__arrow" /> {s.place?.name}
              </span>
            ))}
            <span className="bf-route-flow__stop">
              <Icon name="arrow-right" size={12} className="bf-route-flow__arrow" /> {state.drop?.name}
            </span>
          </div>
        </div>

        <div className="bf-success__actions">
          <Button type="button" variant="secondary" size="md" onClick={resetState}>
            Plan Another Tour
          </Button>
          <Link to="/trips" className="btn btn--primary btn--md">
            View My Trips
          </Link>
        </div>

        <div className="bf-success__support">
          <span>Need immediate travel desk assistance?</span>
          <a href={`tel:${SUPPORT_PHONE}`} className="bf-call-link">
            <Icon name="phone" size={14} /> Call {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    );
  }

  const filledStopsCount = state.stops.filter((s) => s.place !== null).length;

  return (
    <form className="bf-multicity" onSubmit={onSubmit} noValidate>
      <fieldset disabled={submitting} style={{ display: 'contents', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {/* ── Route & Stops Section ── */}
      <div className="bf-section" role="group" aria-labelledby="mc-route-title">
        <p className="bf-section__title" id="mc-route-title">
          <Icon name="route" size={16} /> Tour Itinerary &amp; Stops
        </p>

        {/* 1. Starting Pickup Point */}
        <div className={`bf-field ${errors.pickup ? 'is-invalid' : ''}`}>
          <span className="bf-pin" aria-hidden="true" />
          <div className="bf-field__main">
            <span className="bf-label" id="mc-pickup-label">
              Starting Pickup Location
            </span>
            <button
              id="mc-pickup-btn"
              type="button"
              className={`bf-trigger ${!state.pickup ? 'is-empty' : ''}`}
              aria-labelledby="mc-pickup-label mc-pickup-val"
              onClick={() => setPickerTarget('pickup')}
            >
              <span id="mc-pickup-val" className="bf-trigger__text">
                {state.pickup?.name ?? 'Select starting city, hotel or pickup point'}
              </span>
            </button>
            {state.pickup?.address && state.pickup.address !== state.pickup.name ? (
              <small className="bf-addr">{state.pickup.address}</small>
            ) : null}
          </div>
          <Icon name="chevron-right" size={16} className="bf-chev" />
        </div>
        {errors.pickup ? <p className="bf-error">{errors.pickup}</p> : null}

        {/* 2. Intermediate Stops List */}
        <div className="bf-stops">
          <div className="bf-stops__head">
            <span className="bf-stops__count">
              Intermediate Stops / Sightseeing ({state.stops.length}/10)
            </span>
            <button
              type="button"
              className="bf-stops__add"
              disabled={state.stops.length >= 10}
              onClick={addStop}
            >
              <Icon name="plus" size={13} /> Add Stop
            </button>
          </div>

          {state.stops.map((stop, index) => {
            const stopErr = errors[`stop_${stop.id}`];
            return (
              <div key={stop.id} className={`bf-stop-row ${stopErr ? 'is-invalid' : ''}`}>
                <span className="bf-stop-badge">Stop #{index + 1}</span>
                <button
                  type="button"
                  className="bf-stop-trigger"
                  onClick={() => setPickerTarget(stop.id)}
                >
                  <span className={`bf-stop-name ${!stop.place ? 'is-empty' : ''}`}>
                    {stop.place?.name ?? `Choose stop #${index + 1} (city, temple or landmark)`}
                  </span>
                  {stop.place?.address && stop.place.address !== stop.place.name ? (
                    <span className="bf-stop-addr">{stop.place.address}</span>
                  ) : null}
                </button>
                <div className="bf-stop-actions">
                  <button
                    type="button"
                    className="bf-btn-icon"
                    disabled={index === 0}
                    title="Move stop up"
                    aria-label={`Move stop ${index + 1} up`}
                    onClick={() => moveStop(index, 'up')}
                  >
                    <Icon name="chevron-up" size={14} />
                  </button>
                  <button
                    type="button"
                    className="bf-btn-icon"
                    disabled={index === state.stops.length - 1}
                    title="Move stop down"
                    aria-label={`Move stop ${index + 1} down`}
                    onClick={() => moveStop(index, 'down')}
                  >
                    <Icon name="chevron-down" size={14} />
                  </button>
                  <button
                    type="button"
                    className="bf-btn-icon bf-btn-icon--delete"
                    title="Remove stop"
                    aria-label={`Remove stop ${index + 1}`}
                    onClick={() => removeStop(stop.id)}
                  >
                    <Icon name="trash-2" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {errors.stops ? <p className="bf-error">{errors.stops}</p> : null}
        </div>

        {/* 3. Final Drop Point */}
        <div className={`bf-field ${errors.drop ? 'is-invalid' : ''}`}>
          <span className="bf-pin bf-pin--drop" aria-hidden="true" />
          <div className="bf-field__main">
            <span className="bf-label" id="mc-drop-label">
              Final Destination Drop Point
            </span>
            <button
              id="mc-drop-btn"
              type="button"
              className={`bf-trigger ${!state.drop ? 'is-empty' : ''}`}
              aria-labelledby="mc-drop-label mc-drop-val"
              onClick={() => setPickerTarget('drop')}
            >
              <span id="mc-drop-val" className="bf-trigger__text">
                {state.drop?.name ?? 'Select final city or return drop point'}
              </span>
            </button>
            {state.drop?.address && state.drop.address !== state.drop.name ? (
              <small className="bf-addr">{state.drop.address}</small>
            ) : null}
          </div>
          <Icon name="chevron-right" size={16} className="bf-chev" />
        </div>
        {errors.drop ? <p className="bf-error">{errors.drop}</p> : null}

        {/* 4. Ordered Route Summary Card */}
        {(state.pickup || filledStopsCount > 0 || state.drop) ? (
          <div className="bf-route-summary">
            <span className="bf-route-summary__title">Ordered Itinerary Summary</span>
            <div className="bf-route-flow">
              <span className="bf-route-flow__stop">{state.pickup?.name || 'Start'}</span>
              {state.stops.filter((s) => s.place).map((s) => (
                <span key={s.id} className="bf-route-flow__stop">
                  <Icon name="arrow-right" size={12} className="bf-route-flow__arrow" /> {s.place?.name}
                </span>
              ))}
              <span className="bf-route-flow__stop">
                <Icon name="arrow-right" size={12} className="bf-route-flow__arrow" /> {state.drop?.name || 'Destination'}
              </span>
            </div>
            {errors.itinerary ? <p className="bf-error mt-2">{errors.itinerary}</p> : null}
          </div>
        ) : null}
      </div>

      {/* ── Schedule Section ── */}
      <div className="bf-section" role="group" aria-labelledby="mc-sched-title">
        <p className="bf-section__title" id="mc-sched-title">
          <Icon name="calendar-days" size={16} /> Trip Schedule
        </p>

        <div className="bf-row">
          <div className="bf-cell">
            <label className="bf-label bf-label--out" htmlFor="mc-date">
              Departure date
            </label>
            <input
              id="mc-date"
              type="date"
              className="input bf-input"
              min={todayStr}
              max={maxDateStr}
              value={state.date}
              onChange={(e) => {
                setState((s) => ({ ...s, date: e.target.value }));
                setErrors((x) => ({ ...x, date: '', time: '' }));
              }}
              required
            />
            {errors.date ? <p className="bf-error">{errors.date}</p> : null}
          </div>

          <div className="bf-cell">
            <span className="bf-label bf-label--out" id="mc-time-label">
              Departure time
            </span>
            <button
              id="mc-time-btn"
              type="button"
              className={`bf-time ${state.time ? '' : 'is-empty'}`}
              aria-labelledby="mc-time-label mc-time-val"
              onClick={() => setTimePickerOpen(true)}
            >
              <span id="mc-time-val">{state.time ? formatTime12(state.time) : 'Select time'}</span>
              <Icon name="clock-3" size={16} />
            </button>
            {errors.time ? <p className="bf-error">{errors.time}</p> : null}
          </div>
        </div>

        <div className="bf-cell mt-3">
          <label className="bf-label bf-label--out" htmlFor="mc-end-date">
            Expected tour return date (optional)
          </label>
          <input
            id="mc-end-date"
            type="date"
            className="input bf-input"
            min={state.date || todayStr}
            max={maxDateStr}
            value={state.endDate}
            onChange={(e) => {
              setState((s) => ({ ...s, endDate: e.target.value }));
              setErrors((x) => ({ ...x, endDate: '' }));
            }}
          />
          {errors.endDate ? <p className="bf-error">{errors.endDate}</p> : null}
        </div>
      </div>

      {/* ── Vehicle Preference Section ── */}
      <div className="bf-section" role="group" aria-labelledby="mc-cat-title">
        <p className="bf-section__title" id="mc-cat-title">
          <Icon name="car" size={16} /> Preferred Vehicle Category
        </p>
        <p role="status">{categoryStatus === 'loading' ? 'Loading configured categories…' : categoryStatus === 'error' ? 'Categories could not be loaded. You can continue with No preference.' : !categories.length ? 'No categories configured. You can continue with No preference.' : ''}</p>
        <div className="bf-cat-chips" role="radiogroup" aria-label="Vehicle preference">
          <button
            type="button"
            role="radio"
            aria-checked={!state.categoryId}
            className={`bf-cat-chip ${!state.categoryId ? 'is-active' : ''}`}
            onClick={() => setState((s) => ({ ...s, categoryId: '' }))}
          >
            No preference
          </button>
          {categories.map((cat) => {
            const isSelected = state.categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`bf-cat-chip ${isSelected ? 'is-active' : ''}`}
                onClick={() => setState((s) => ({ ...s, categoryId: isSelected ? '' : cat.id }))}
              >
                <span>{cat.name}</span>
                {cat.seats ? <span className="bf-cat-chip__seats">({cat.seats} seats)</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tour Notes Section ── */}
      <div className="bf-section">
        <label className="bf-label bf-label--out" htmlFor="mc-notes">
          Tour notes &amp; custom requirements (optional)
        </label>
        <textarea
          maxLength={500}
          id="mc-notes"
          className="bf-textarea"
          rows={3}
          placeholder="e.g. 4 adults with 3 suitcases; temple darshan schedule; senior citizen pickup; specific highway halts..."
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
        />
      </div>

      {errors.form ? (
        <p className="bf-error bf-error--form" role="alert">
          {errors.form}
        </p>
      ) : null}

      {/* ── Action Buttons ── */}
      <div className="bf-actions">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={submitting}
          className="bf-submit"
          trailing="arrow-right"
        >
          Get Trip Quote
        </Button>
        <p className="bf-trust">
          <Icon name="shield-check" size={14} /> Clear upfront package quotes. No hidden extras. 24/7 highway support.
        </p>

        <a href={`tel:${SUPPORT_PHONE}`} className="bf-call-secondary">
          <Icon name="phone" size={14} /> Prefer speaking with our tour coordinator? Call {SUPPORT_PHONE_DISPLAY}
        </a>
      </div>

      {/* ── Place Picker Modal ── */}
      {pickerTarget ? (
        <LocationPicker
          config={pickerConfig}
          saved={savedPlaces}
          recent={recentPlaces}
          onSelect={onPickPlace}
          onClose={() => setPickerTarget(null)}
        />
      ) : null}

      {/* ── Time Picker Modal ── */}
      {timePickerOpen ? (
        <TimePicker
          title="Departure time"
          date={state.date}
          value={state.time}
          validate="pickup"
          onClose={() => setTimePickerOpen(false)}
          onConfirm={(t) => {
            setState((s) => ({ ...s, time: t }));
            setErrors((x) => ({ ...x, time: '' }));
            setTimePickerOpen(false);
          }}
        />
      ) : null}
      </fieldset>
    </form>
  );
}

