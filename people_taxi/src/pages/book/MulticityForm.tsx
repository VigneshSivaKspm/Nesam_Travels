// Multicity & Custom Tour Itinerary Form for People Taxi.
// Allows riders to build multi-stop road trip itineraries with reorderable intermediate stops,
// departure and return schedules.
// Submits a validated itinerary enquiry (submitMulticityEnquiry) with stable submissionId.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GeoPlace } from '@core/types';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { scheduleProblem } from '@core/utils/bookingRules';
import { callFunction, newId } from '@core/services/callables';
import { useCustomerData } from '@/state/customer';
import { useAuth } from '@/state/Auth';
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

const MAX_CITIES = 10;

/** The boxes the form shows: every city chosen so far, then one empty box for the next city (until the limit). */
function withNextSlot(stops: StoredMulticityState['stops']): StoredMulticityState['stops'] {
  const filled = stops.filter((s) => s.place);
  const empty = stops.find((s) => !s.place);
  return filled.length < MAX_CITIES ? [...filled, empty ?? { id: newId('stop'), place: null }] : filled;
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

  // Keep exactly one empty "next city" box after the chosen cities: City 2 appears once City 1 is chosen.
  useEffect(() => {
    const next = withNextSlot(state.stops);
    if (next.length !== state.stops.length || next.some((st, i) => st.id !== state.stops[i]!.id)) setState((s) => ({ ...s, stops: withNextSlot(s.stops) }));
  }, [state.stops]);

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
  const removeStop = (id: string) => {
    setState((s) => ({ ...s, stops: withNextSlot(s.stops.filter((st) => st.id !== id)) }));
  };

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
        title: 'Choose Pickup Location',
        allowCurrent: true,
        popular: QUICK_CITIES,
        popularLabel: 'Major Cities',
        pinMode: 'pickup',
      };
    }
    if (pickerTarget === 'drop') {
      return {
        title: 'Choose Drop Location',
        allowCurrent: false,
        popular: QUICK_CITIES,
        popularLabel: 'Popular Destinations',
        pinMode: 'drop',
      };
    }
    const idx = state.stops.findIndex((s) => s.id === pickerTarget);
    return {
      title: `Choose City ${idx + 1}`,
      allowCurrent: false,
      popular: QUICK_CITIES,
      popularLabel: 'Popular Cities',
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
      err.stops = 'Choose City 1, the first stop between pickup and drop.';
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

    if (filledStops.some((stop) => !validMulticityPlace(stop.place))) err.stops = 'Choose a valid location for every city.';

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
      }, { id: string; code: string; status: string; message: string }>('submitMulticityEnquiry', {
        submissionId: state.submissionId,
        brand: 'people_taxi',
        source: 'peopletaxi_web',
        pickup: state.pickup!,
        drop: state.drop!,
        stops: filledStops,
        scheduledAt: scheduled!.toISOString(),
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

  return (
    <form className="jd-form jd-multicity-form" onSubmit={onSubmit} noValidate>
      <fieldset className="jd-fieldset" disabled={submitting}>
      {/* Route & Intermediate Stops Section */}
      <div className="jd-section" role="group" aria-label="Route and stops">
        {/* 1. Pickup Point */}
        <div className={`jd-field-box ${errors.pickup ? 'is-invalid' : ''}`}>
          <div className="jd-field-box__head">
            <span className="jd-box-dot is-pickup" aria-hidden="true" />
            <label htmlFor="mc-pickup-btn" className="jd-field-box__label">
              Pickup location
            </label>
          </div>
          <button
            id="mc-pickup-btn"
            type="button"
            className={`jd-value ${!state.pickup ? 'is-empty' : ''}`}
            onClick={() => setPickerTarget('pickup')}
          >
            <span className="jd-value__text">
              {state.pickup?.name ?? ''}
            </span>
            {state.pickup?.address && state.pickup.address !== state.pickup.name ? (
              <span className="jd-value__addr">{state.pickup.address}</span>
            ) : null}
          </button>
          {errors.pickup ? <p className="jd-error">{errors.pickup}</p> : null}
        </div>

        {/* 2. Cities along the way: one box at a time; the next one appears once this one is chosen */}
        {state.stops.map((stop, index) => (
          <div key={stop.id} className={`jd-field-box ${errors.stops && index === 0 ? 'is-invalid' : ''}`}>
            <div className="jd-field-box__head">
              <span className="jd-box-dot is-via" aria-hidden="true" />
              <span className="jd-field-box__label">City {index + 1}</span>
              {stop.place ? (
                <button type="button" className="jd-stop-remove" aria-label={`Remove City ${index + 1}`} onClick={() => removeStop(stop.id)}>
                  <Icon name="trash" size={15} />
                </button>
              ) : null}
            </div>
            <button type="button" className={`jd-value ${stop.place ? '' : 'is-empty'}`} aria-label={`City ${index + 1}${stop.place ? `: ${stop.place.name}` : ''}`} onClick={() => setPickerTarget(stop.id)}>
              <span className="jd-value__text">{stop.place?.name ?? ''}</span>
              {stop.place?.address && stop.place.address !== stop.place.name ? <span className="jd-value__addr">{stop.place.address}</span> : null}
            </button>
          </div>
        ))}
        {errors.stops ? <p className="jd-error">{errors.stops}</p> : null}

        {/* 3. Final Drop Destination */}
        <div className={`jd-field-box ${errors.drop ? 'is-invalid' : ''}`}>
          <div className="jd-field-box__head">
            <span className="jd-box-dot is-drop" aria-hidden="true" />
            <label htmlFor="mc-drop-btn" className="jd-field-box__label">
              Drop location
            </label>
          </div>
          <button
            id="mc-drop-btn"
            type="button"
            className={`jd-value ${!state.drop ? 'is-empty' : ''}`}
            onClick={() => setPickerTarget('drop')}
          >
            <span className="jd-value__text">
              {state.drop?.name ?? ''}
            </span>
            {state.drop?.address && state.drop.address !== state.drop.name ? (
              <span className="jd-value__addr">{state.drop.address}</span>
            ) : null}
          </button>
          {errors.drop ? <p className="jd-error">{errors.drop}</p> : null}
        </div>
        {errors.itinerary ? <p className="jd-error">{errors.itinerary}</p> : null}

      </div>

      {/* Schedule Section */}
      <div className="jd-section" role="group" aria-label="Trip schedule">        <div className="jd-pair">
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
              <span>{state.time ? formatTime12(state.time) : ''}</span>
              <Icon name="clock" size={18} />
            </button>
            {errors.time ? <p className="jd-error">{errors.time}</p> : null}
          </div>
        </div>
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
          Search Cabs & View Fares
        </Button>
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
