// The booking form on the People Taxi home page: service, route, schedule and "Search Cabs".
// Places are real coordinates (search, device location, saved/recent places, map pin); the
// schedule follows the booking server's rules; fares are only ever priced by the server.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GeoPlace } from '@core/types';
import { useCustomerData } from '@/state/customer';
import { reverseGeocode } from '@core/services/geoService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { scheduleProblem } from '@core/utils/bookingRules';
import { haversineKm, isValidLatLng } from '@core/utils/geo';
import { Button, Tabs } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { LocationPicker, type PickerConfig } from '@/components/LocationPicker';
import { TimePicker, formatTime12 } from '@/components/TimePicker';
import { useBooking } from '@/state/Booking';
import { useDeviceLocation, useOnline } from '@/lib/hooks';
import { combineDateTime, latestPickup, toDateInput, toTimeInput } from '@/lib/schedule';
import { SERVICES, SERVICE_TITLE, type ServiceId } from '@/lib/services';
import { AIRPORTS, QUICK_CITIES, isAirportPlace } from './content';

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

export function BookingForm({
  service,
  onService,
  outstationTrip,
  onOutstationTrip,
}: {
  service: ServiceId;
  onService: (s: ServiceId) => void;
  outstationTrip: 'One Way' | 'Round Trip';
  onOutstationTrip: (t: 'One Way' | 'Round Trip') => void;
}) {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (outstationTrip === 'Round Trip' && scheduled && scheduledEnd) {
      if (scheduledEnd.getTime() < scheduled.getTime()) {
        setErrors((e) => ({ ...e, endTime: 'Return time must be after departure time' }));
      } else {
        setErrors((e) => ({ ...e, endTime: undefined }));
        update({ tripEndAt: scheduledEnd });
      }
    }
  }, [outstationTrip, scheduled, scheduledEnd]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const swapPlaces = () => {
    if (!draft.pickup && !draft.drop) return;
    update((d) => ({ pickup: d.drop, drop: d.pickup }));
    if (service === 'airport') {
      setAirportDir((dir) => (dir === 'to' ? 'from' : 'to'));
    }
  };

  const onAirportDirChange = (next: AirportDirection) => {
    setAirportDir(next);
    if (next === 'to' && isAirportPlace(draft.pickup)) {
      update((d) => ({ pickup: isAirportPlace(d.drop) ? null : d.drop, drop: d.pickup }));
    } else if (next === 'from' && isAirportPlace(draft.drop)) {
      update((d) => ({ pickup: d.drop, drop: isAirportPlace(d.pickup) ? null : d.pickup }));
    }
  };

  const onLocateDevice = async () => {
    const coords = await device.locate();
    if (!coords) return;
    try {
      const p = await reverseGeocode({ lat: coords.lat, lng: coords.lng });
      setPickup({ ...p, type: 'current' });
    } catch {
      setPickup({
        id: `device-${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`,
        name: 'Current location',
        address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
        lat: coords.lat,
        lng: coords.lng,
        type: 'current',
      });
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

    if (outstationTrip === 'Round Trip' && service === 'outstation') {
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
    navigate('/book/ride');
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

  return (
    <div className="bf" id="book-console">
      <div className="bf-head">
        <h2>{SERVICE_TITLE[service]}</h2>
        <p>Compare fares across all vehicle categories before booking</p>
      </div>

      <nav className="bf-services" aria-label="Booking services">
        {SERVICES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`bf-service ${service === s.id ? 'is-active' : ''}`}
            onClick={() => onService(s.id)}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      {service === 'outstation' ? (
        <div className="bf-journey">
          <Tabs
            variant="boxed"
            active={outstationTrip}
            onChange={(id) => onOutstationTrip(id as 'One Way' | 'Round Trip')}
            items={[
              { id: 'One Way', label: 'One Way Drop' },
              { id: 'Round Trip', label: 'Round Trip' },
            ]}
          />
        </div>
      ) : null}

      {service === 'airport' ? (
        <div className="bf-journey">
          <Tabs
            variant="boxed"
            active={airportDir}
            onChange={(id) => onAirportDirChange(id as AirportDirection)}
            items={[
              { id: 'to', label: 'Going to Airport' },
              { id: 'from', label: 'Pickup from Airport' },
            ]}
          />
        </div>
      ) : null}

      {service === 'multicity' ? (
        <div className="bf-offline-service">
          <div className="bf-offline-service__icon">
            <Icon name="sparkles" size={24} />
          </div>
          <h3>Custom Multi-Day &amp; Vacation Packages</h3>
          <p>
            Tailored itineraries for family vacations, temple tours, hill station getaways and corporate events with dedicated chauffeurs.
          </p>
          <div className="bf-offline-service__actions">
            <a href={`tel:${SUPPORT_PHONE}`} className="btn btn--primary btn--lg">
              <Icon name="phone" size={18} /> Call {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
          <small className="muted">24/7 dedicated travel concierge</small>
        </div>
      ) : (
        <form className="bf-form" onSubmit={onSubmit} noValidate>
          <div className={`bf-route ${service === 'rental' ? 'bf-route--single' : ''}`}>
            <div className="bf-route__cell">
              <label htmlFor="bf-pickup" className="bf-label">
                {service === 'airport' && airportDir === 'from' ? 'Airport Pickup' : 'Pickup Location'}
              </label>
              <div className={`bf-field ${errors.pickup ? 'is-invalid' : ''}`}>
                <span className="bf-pin" aria-hidden="true" />
                <div className="bf-field__main">
                  <button
                    ref={pickupInputRef}
                    id="bf-pickup"
                    type="button"
                    className={`bf-trigger ${!draft.pickup ? 'is-empty' : ''}`}
                    onClick={() => setPickerField('pickup')}
                  >
                    <span className="bf-trigger__text">
                      {draft.pickup?.name ?? (service === 'airport' && airportDir === 'from' ? 'Select departure airport…' : 'Enter pickup city, area or landmark…')}
                    </span>
                  </button>
                  {draft.pickup?.address ? <span className="bf-addr">{draft.pickup.address}</span> : null}
                </div>
                <Icon name="chevron-down" size={16} className="bf-chev" />
              </div>
              {errors.pickup ? <p className="bf-error">{errors.pickup}</p> : null}
            </div>

            {service !== 'rental' ? (
              <button
                type="button"
                className="bf-swap"
                title="Swap pickup and drop"
                aria-label="Swap pickup and drop"
                onClick={swapPlaces}
              >
                <Icon name="swap" size={16} />
              </button>
            ) : null}

            {service !== 'rental' ? (
              <div className="bf-route__cell">
                <label htmlFor="bf-drop" className="bf-label">
                  {service === 'airport' && airportDir === 'to' ? 'Airport Destination' : 'Drop Location'}
                </label>
                <div className={`bf-field ${errors.drop ? 'is-invalid' : ''}`}>
                  <span className="bf-pin bf-pin--drop" aria-hidden="true" />
                  <div className="bf-field__main">
                    <button
                      ref={dropInputRef}
                      id="bf-drop"
                      type="button"
                      className={`bf-trigger ${!draft.drop ? 'is-empty' : ''}`}
                      onClick={() => setPickerField('drop')}
                    >
                      <span className="bf-trigger__text">
                        {draft.drop?.name ?? (service === 'airport' && airportDir === 'to' ? 'Select destination airport…' : 'Enter destination city or landmark…')}
                      </span>
                    </button>
                    {draft.drop?.address ? <span className="bf-addr">{draft.drop.address}</span> : null}
                  </div>
                  <Icon name="chevron-down" size={16} className="bf-chev" />
                </div>
                {errors.drop ? <p className="bf-error">{errors.drop}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="bf-row">
            <div className="bf-cell">
              <label htmlFor="bf-date" className="bf-label">
                Pickup Date
              </label>
              <input
                id="bf-date"
                type="date"
                className="input bf-input"
                min={todayStr}
                max={maxDateStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              {errors.date ? <p className="bf-error">{errors.date}</p> : null}
            </div>

            <div className="bf-cell">
              <label htmlFor="bf-time" className="bf-label">
                Pickup Time
              </label>
              <button
                id="bf-time"
                type="button"
                className={`bf-time ${!time ? 'is-empty' : ''}`}
                onClick={() => setTimeField('pickup')}
              >
                <span>{time ? formatTime12(time) : 'Choose time…'}</span>
                <Icon name="clock" size={16} />
              </button>
              {errors.time ? <p className="bf-error">{errors.time}</p> : null}
            </div>
          </div>

          {service === 'outstation' && outstationTrip === 'Round Trip' ? (
            <div className="bf-row">
              <div className="bf-cell">
                <label htmlFor="bf-end-date" className="bf-label">
                  Return Date
                </label>
                <input
                  id="bf-end-date"
                  type="date"
                  className="input bf-input"
                  min={date || todayStr}
                  max={maxDateStr}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
                {errors.endDate ? <p className="bf-error">{errors.endDate}</p> : null}
              </div>

              <div className="bf-cell">
                <label htmlFor="bf-end-time" className="bf-label">
                  Return Time
                </label>
                <button
                  id="bf-end-time"
                  type="button"
                  className={`bf-time ${!endTime ? 'is-empty' : ''}`}
                  onClick={() => setTimeField('return')}
                >
                  <span>{endTime ? formatTime12(endTime) : 'Choose return time…'}</span>
                  <Icon name="clock" size={16} />
                </button>
                {errors.endTime ? <p className="bf-error">{errors.endTime}</p> : null}
              </div>
            </div>
          ) : null}

          {errors.form ? <p className="bf-error bf-error--form">{errors.form}</p> : null}

          <Button type="submit" variant="primary" size="lg" block className="bf-submit" iconTrailing="arrow-right">
            Search Cabs &amp; View Fares
          </Button>

          <p className="bf-trust">
            <Icon name="shield-check" size={14} /> Fares are 100% upfront · Zero hidden fees · Pay driver directly
          </p>
        </form>
      )}

      {pickerField ? (
        <LocationPicker
          config={pickerField === 'pickup' ? pickupConfig : dropConfig}
          saved={savedPlaces}
          recent={recentPlaces}
          onPick={pickerField === 'pickup' ? setPickup : setDrop}
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
