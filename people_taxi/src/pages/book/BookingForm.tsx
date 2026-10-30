// The booking form on the People Taxi home page: service, route, schedule and "Search Cabs".
// Places are real coordinates (search, device location, saved/recent places, map pin); the
// schedule follows the booking server's rules; fares are only ever priced by the server.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GeoPlace, TripType } from '@core/types';
import { useCustomerData } from '@/state/customer';
import { reverseGeocode } from '@core/services/geoService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { scheduleProblem } from '@core/utils/bookingRules';
import { isValidLatLng } from '@core/utils/geo';
import { Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { LocationPicker, type PickerConfig } from '@/components/LocationPicker';
import { TimePicker, formatTime12 } from '@/components/TimePicker';
import { useAuth } from '@/state/Auth';
import { useBooking } from '@/state/Booking';
import { setPendingReturn } from '@/lib/pendingReturn';
import { useDeviceLocation, useOnline } from '@/lib/hooks';
import { combineDateTime, latestPickup, toDateInput, toTimeInput } from '@/lib/schedule';
import { SERVICES, SERVICE_TITLE, type ServiceId } from '@/lib/services';
import { AIRPORTS, QUICK_CITIES, isAirportPlace } from './content';
import { MulticityForm } from './MulticityForm';

type Field = 'pickup' | 'drop' | 'date' | 'time' | 'endDate' | 'endTime' | 'form';
type Errors = Partial<Record<Field, string>>;
export type AirportDirection = 'to' | 'from';

const disposalFor = (pickup: GeoPlace): GeoPlace => ({
  id: 'place-local-disposal',
  name: 'Local City Disposal',
  address: `${pickup.name} & City Limits (Within city disposal)`,
  lat: pickup.lat + 0.04,
  lng: pickup.lng + 0.04,
  type: 'other',
});

/** Airport direction follows the draft: whichever end is an airport. */
const directionOf = (pickup: GeoPlace | null, drop: GeoPlace | null): AirportDirection =>
  isAirportPlace(pickup) && !isAirportPlace(drop) ? 'from' : 'to';

/** Compact two-way switch (journey type, airport direction): a quiet radio group, not another set of tabs. */
function Segmented({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="jd-seg" role="radiogroup" aria-label={label}>
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          role="radio"
          aria-checked={value === i.id}
          className={`jd-seg__btn ${value === i.id ? 'is-on' : ''}`}
          onClick={() => onChange(i.id)}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function BookingForm({
  service,
  onService,
  outstationTrip = 'One Way',
  onOutstationTrip,
}: {
  service: ServiceId;
  onService: (s: ServiceId) => void;
  outstationTrip?: 'One Way' | 'Round Trip';
  onOutstationTrip?: (t: 'One Way' | 'Round Trip') => void;
}) {
  const navigate = useNavigate();
  const { state: auth, openLoginModal, isLoginModalOpen } = useAuth();
  const { draft, update } = useBooking();
  const { savedPlaces, trips } = useCustomerData();
  const { online } = useOnline();
  const device = useDeviceLocation();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [airportDir, setAirportDir] = useState<AirportDirection>('to');
  const [errors, setErrors] = useState<Errors>({});
  const [pickerField, setPickerField] = useState<'pickup' | 'drop' | null>(null);
  const [timeField, setTimeField] = useState<'pickup' | 'return' | null>(null);

  const pickupInputRef = useRef<HTMLButtonElement>(null);
  const dropInputRef = useRef<HTMLButtonElement>(null);

  const recentPlaces = useMemo<GeoPlace[]>(() => {
    const out: GeoPlace[] = [];
    const seen = new Set<string>();
    for (const t of trips) {
      for (const p of [t.drop, t.pickup]) {
        if (!p || !isValidLatLng(p)) continue;
        const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
        if (out.length >= 6) return out;
      }
    }
    return out;
  }, [trips]);

  useEffect(() => {
    if (draft.scheduledAt) {
      setDate(toDateInput(draft.scheduledAt));
      setTime(toTimeInput(draft.scheduledAt));
    }
    if (draft.tripEndAt) {
      setEndDate(toDateInput(draft.tripEndAt));
      setEndTime(toTimeInput(draft.tripEndAt));
    }
  }, [draft.scheduledAt, draft.tripEndAt]);

  const scheduled = useMemo(() => (date && time ? combineDateTime(date, time) : null), [date, time]);
  const scheduledEnd = useMemo(() => (endDate && endTime ? combineDateTime(endDate, endTime) : null), [endDate, endTime]);

  useEffect(() => {
    if (scheduled) {
      const problem = scheduleProblem(scheduled);
      setErrors((e) => ({ ...e, time: problem ?? undefined }));
      if (!problem) update({ scheduledAt: scheduled });
    }
  }, [scheduled]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRoundTrip = service === 'outstation' && outstationTrip === 'Round Trip';

  useEffect(() => {
    if (isRoundTrip && scheduled && scheduledEnd) {
      if (scheduledEnd.getTime() < scheduled.getTime()) {
        setErrors((e) => ({ ...e, endTime: 'Return time must be after departure time' }));
      } else {
        setErrors((e) => ({ ...e, endTime: undefined }));
        update({ tripEndAt: scheduledEnd });
      }
    }
  }, [isRoundTrip, scheduled, scheduledEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (service === 'rental' && draft.pickup && draft.drop?.id !== 'place-local-disposal') {
      update({ drop: disposalFor(draft.pickup) });
    }
  }, [service, draft.pickup]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (service === 'airport') {
      setAirportDir(directionOf(draft.pickup, draft.drop));
    }
  }, [service]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPickup = (p: GeoPlace) => {
    update((d) => ({
      pickup: p,
      drop: service === 'rental' ? disposalFor(p) : d.drop?.id === p.id ? null : d.drop,
    }));
    setErrors((e) => ({ ...e, pickup: undefined, form: undefined }));
    if (service !== 'rental' && !draft.drop) {
      window.setTimeout(() => dropInputRef.current?.focus(), 150);
    }
  };

  const setDrop = (p: GeoPlace) => {
    update((d) => ({
      drop: p,
      pickup: d.pickup?.id === p.id ? null : d.pickup,
    }));
    setErrors((e) => ({ ...e, drop: undefined, form: undefined }));
  };

  /** A confirmed place goes to the field that opened the picker, then the picker closes (focus returns to the form). */
  const onPickPlace = (p: GeoPlace) => {
    if (pickerField === 'pickup') setPickup(p);
    else if (pickerField === 'drop') setDrop(p);
    setPickerField(null);
  };

  const swapPlaces = () => {
    if (!draft.pickup && !draft.drop) return;
    update((d) => ({ pickup: d.drop, drop: d.pickup }));
    if (service === 'airport') {
      setAirportDir((dir) => (dir === 'to' ? 'from' : 'to'));
    }
    setErrors((e) => ({ ...e, pickup: undefined, drop: undefined }));
  };

  const onAirportDirChange = (next: AirportDirection) => {
    setAirportDir(next);
    if (next === 'to' && isAirportPlace(draft.pickup)) {
      update((d) => ({ pickup: isAirportPlace(d.drop) ? null : d.drop, drop: d.pickup }));
    } else if (next === 'from' && isAirportPlace(draft.drop)) {
      update((d) => ({ pickup: d.drop, drop: isAirportPlace(d.pickup) ? null : d.pickup }));
    }
  };

  const validate = (): boolean => {
    const err: Errors = {};
    if (!draft.pickup) err.pickup = 'Please choose a pickup location';
    if (!draft.drop) err.drop = service === 'rental' ? 'Please choose your city' : 'Please choose a drop location';

    if (draft.pickup && draft.drop && draft.pickup.id === draft.drop.id) {
      err.drop = 'Pickup and drop cannot be the exact same point';
    }

    if (!date) err.date = 'Select pickup date';
    if (!time) err.time = 'Select pickup time';

    if (scheduled) {
      const problem = scheduleProblem(scheduled);
      if (problem) err.time = problem;
    }

    if (isRoundTrip) {
      if (!endDate) err.endDate = 'Select return date';
      if (!endTime) err.endTime = 'Select return time';
      if (scheduled && scheduledEnd && scheduledEnd.getTime() < scheduled.getTime()) {
        err.endTime = 'Return time must be after departure time';
      }
    }

    if (!online) {
      err.form = 'You are currently offline. Check your internet connection.';
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const wantedTripType: TripType =
      service === 'airport'
        ? 'Airport Taxi'
        : service === 'rental'
          ? 'Local Rental'
          : isRoundTrip
            ? 'Round Trip'
            : 'One Way';

    update({
      tripType: wantedTripType,
      scheduledAt: scheduled,
      tripEndAt: isRoundTrip ? scheduledEnd : null,
    });

    if (auth.status === 'ready') {
      navigate('/book/ride');
      return;
    }

    if (isLoginModalOpen) return;
    setPendingReturn('/book/ride');
    openLoginModal({
      title: 'Sign in to see fares',
      subtitle: 'Sign-in is required to compare cabs and upfront fares. Your trip details are saved.',
    });
  };

  const todayStr = useMemo(() => toDateInput(new Date()), []);
  const maxDateStr = useMemo(() => toDateInput(latestPickup()), []);

  const pickupConfig: PickerConfig = useMemo(() => {
    if (service === 'airport' && airportDir === 'from') {
      return {
        title: 'Choose Departure Airport',
        allowCurrent: false,
        popular: AIRPORTS,
        popularLabel: 'Major Airports',
        pinMode: 'pickup',
      };
    }
    return {
      title: 'Choose Pickup Location',
      allowCurrent: true,
      popular: QUICK_CITIES,
      popularLabel: 'Popular Cities',
      pinMode: 'pickup',
    };
  }, [service, airportDir]);

  const dropConfig: PickerConfig = useMemo(() => {
    if (service === 'airport' && airportDir === 'to') {
      return {
        title: 'Choose Destination Airport',
        allowCurrent: false,
        popular: AIRPORTS,
        popularLabel: 'Major Airports',
        near: draft.pickup,
        pinMode: 'drop',
      };
    }
    return {
      title: service === 'rental' ? 'Choose Rental City' : 'Choose Drop Location',
      allowCurrent: false,
      popular: QUICK_CITIES,
      popularLabel: 'Popular Destinations',
      near: draft.pickup,
      pinMode: 'drop',
    };
  }, [service, airportDir, draft.pickup]);

  const isRental = service === 'rental';
  const fromAirport = service === 'airport' && airportDir === 'from';
  const toAirport = service === 'airport' && airportDir === 'to';

  return (
    <div className="jd" id="book-console">
      <header className="jd-head">
        <h2>{SERVICE_TITLE[service]}</h2>
        <p>
          {service === 'multicity'
            ? 'Build your custom multi-stop tour itinerary and get an exact upfront quote'
            : 'Compare fares across all vehicle categories before booking'}
        </p>
      </header>

      {/* Service rail: Outstation · Airport · Local Rental · Multicity */}
      <nav className="jd-rail" aria-label="Booking services">
        {SERVICES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`jd-tab ${service === s.id ? 'is-active' : ''}`}
            aria-current={service === s.id ? 'true' : undefined}
            onClick={() => onService(s.id)}
          >
            <Icon name={s.icon} size={18} />
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      {/* Outstation sub-toggle: One Way / Round Trip */}
      {service === 'outstation' ? (
        <Segmented
          label="Outstation journey type"
          value={outstationTrip}
          onChange={(t) => {
            if (onOutstationTrip) onOutstationTrip(t as 'One Way' | 'Round Trip');
            setErrors({});
          }}
          items={[
            { id: 'One Way', label: 'One Way Drop' },
            { id: 'Round Trip', label: 'Round Trip' },
          ]}
        />
      ) : null}

      {/* Airport direction sub-toggle */}
      {service === 'airport' ? (
        <Segmented
          label="Airport direction"
          value={airportDir}
          onChange={(id) => onAirportDirChange(id as AirportDirection)}
          items={[
            { id: 'to', label: 'Going to airport' },
            { id: 'from', label: 'Pickup from airport' },
          ]}
        />
      ) : null}

      {/* If Multicity, show the full interactive itinerary form */}
      {service === 'multicity' ? (
        <MulticityForm />
      ) : (
        <form className="jd-form" onSubmit={onSubmit} noValidate>
          {/* Separate Pickup and Drop boxes with central swap button */}
          <div className={`jd-route-separated ${isRental ? 'jd-route-separated--single' : ''}`}>
            {/* Pickup card */}
            <div className={`jd-route-card ${errors.pickup ? 'is-invalid' : ''}`}>
              <div className="jd-route-card__head">
                <span className="jd-stop__mark is-pickup" aria-hidden="true" />
                <label htmlFor="bf-pickup" className="jd-label">
                  {fromAirport ? 'Airport pickup' : isRental ? 'Pickup in your city' : 'Pickup location'}
                </label>
              </div>
              <button
                ref={pickupInputRef}
                id="bf-pickup"
                type="button"
                className={`jd-value ${!draft.pickup ? 'is-empty' : ''}`}
                aria-describedby={errors.pickup ? 'bf-pickup-error' : undefined}
                onClick={() => setPickerField('pickup')}
              >
                <span className="jd-value__text">
                  {draft.pickup?.name ?? (fromAirport ? 'Select departure airport' : 'Enter pickup city, area or landmark')}
                </span>
                {draft.pickup?.address && draft.pickup.address !== draft.pickup.name ? (
                  <span className="jd-value__addr">{draft.pickup.address}</span>
                ) : null}
              </button>
              {errors.pickup ? (
                <p id="bf-pickup-error" className="jd-error">
                  {errors.pickup}
                </p>
              ) : null}
            </div>

            {/* Swap button between pickup and drop */}
            {!isRental ? (
              <div className="jd-swap-divider">
                <button
                  type="button"
                  className="jd-swap-btn"
                  title="Swap pickup and drop"
                  aria-label="Swap pickup and drop"
                  disabled={!draft.pickup && !draft.drop}
                  onClick={swapPlaces}
                >
                  <Icon name="swap" size={18} />
                </button>
              </div>
            ) : null}

            {/* Drop card */}
            {!isRental ? (
              <div className={`jd-route-card ${errors.drop ? 'is-invalid' : ''}`}>
                <div className="jd-route-card__head">
                  <span className="jd-stop__mark is-drop" aria-hidden="true" />
                  <label htmlFor="bf-drop" className="jd-label">
                    {toAirport ? 'Airport destination' : 'Drop location'}
                  </label>
                </div>
                <button
                  ref={dropInputRef}
                  id="bf-drop"
                  type="button"
                  className={`jd-value ${!draft.drop ? 'is-empty' : ''}`}
                  aria-describedby={errors.drop ? 'bf-drop-error' : undefined}
                  onClick={() => setPickerField('drop')}
                >
                  <span className="jd-value__text">
                    {draft.drop?.name ?? (toAirport ? 'Select destination airport' : 'Enter destination city or landmark')}
                  </span>
                  {draft.drop?.address && draft.drop.address !== draft.drop.name ? (
                    <span className="jd-value__addr">{draft.drop.address}</span>
                  ) : null}
                </button>
                {errors.drop ? (
                  <p id="bf-drop-error" className="jd-error">
                    {errors.drop}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {isRental ? (
            <p className="jd-rental-note">
              <Icon name="info" size={14} /> Chauffeur and vehicle remain at your disposal within city limits. Hourly and km packages are shown on the next step.
            </p>
          ) : null}

          {/* Schedule Section */}
          <div className="jd-section" role="group" aria-labelledby="jd-sched">
            <p className="jd-section__title" id="jd-sched">
              Pickup schedule
            </p>
            <div className="jd-pair">
              <div className="jd-field">
                <label htmlFor="bf-date" className="jd-label">
                  Date
                </label>
                <input
                  id="bf-date"
                  type="date"
                  className={`jd-control ${errors.date ? 'is-invalid' : ''}`}
                  min={todayStr}
                  max={maxDateStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
                {errors.date ? <p className="jd-error">{errors.date}</p> : null}
              </div>
              <div className="jd-field">
                <label htmlFor="bf-time" className="jd-label">
                  Time
                </label>
                <button
                  id="bf-time"
                  type="button"
                  className={`jd-control jd-control--btn ${!time ? 'is-empty' : ''} ${errors.time ? 'is-invalid' : ''}`}
                  onClick={() => setTimeField('pickup')}
                >
                  <span>{time ? formatTime12(time) : 'Choose time'}</span>
                  <Icon name="clock" size={18} />
                </button>
                {errors.time ? <p className="jd-error">{errors.time}</p> : null}
              </div>
            </div>
          </div>

          {/* Return schedule for Round Trips */}
          {isRoundTrip ? (
            <div className="jd-section" role="group" aria-labelledby="jd-return">
              <p className="jd-section__title" id="jd-return">
                Return schedule
              </p>
              <div className="jd-pair">
                <div className="jd-field">
                  <label htmlFor="bf-end-date" className="jd-label">
                    Return date
                  </label>
                  <input
                    id="bf-end-date"
                    type="date"
                    className={`jd-control ${errors.endDate ? 'is-invalid' : ''}`}
                    min={date || todayStr}
                    max={maxDateStr}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                  {errors.endDate ? <p className="jd-error">{errors.endDate}</p> : null}
                </div>
                <div className="jd-field">
                  <label htmlFor="bf-end-time" className="jd-label">
                    Return time
                  </label>
                  <button
                    id="bf-end-time"
                    type="button"
                    className={`jd-control jd-control--btn ${!endTime ? 'is-empty' : ''} ${errors.endTime ? 'is-invalid' : ''}`}
                    onClick={() => setTimeField('return')}
                  >
                    <span>{endTime ? formatTime12(endTime) : 'Choose return time'}</span>
                    <Icon name="clock" size={18} />
                  </button>
                  {errors.endTime ? <p className="jd-error">{errors.endTime}</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {errors.form ? (
            <p className="jd-error jd-error--form" role="alert">
              {errors.form}
            </p>
          ) : null}

          <div className="jd-action">
            <Button type="submit" variant="primary" size="lg" block className="jd-submit" iconTrailing="arrow-right">
              Search Cabs &amp; View Fares
            </Button>
            <p className="jd-trust">
              <Icon name="shield-check" size={16} /> Fares are 100% upfront · Zero hidden fees · Pay driver directly
            </p>
          </div>
        </form>
      )}

      {pickerField ? (
        <LocationPicker
          config={pickerField === 'pickup' ? pickupConfig : dropConfig}
          saved={savedPlaces}
          recent={recentPlaces}
          onPick={onPickPlace}
          onClose={() => setPickerField(null)}
        />
      ) : null}

      {timeField ? (
        <TimePicker
          value={timeField === 'pickup' ? time : endTime}
          date={timeField === 'pickup' ? date : endDate}
          title={timeField === 'pickup' ? 'Select Pickup Time' : 'Select Return Time'}
          onPick={(val) => {
            if (timeField === 'pickup') setTime(val);
            else setEndTime(val);
          }}
          onClose={() => setTimeField(null)}
        />
      ) : null}
    </div>
  );
}
export default BookingForm;
