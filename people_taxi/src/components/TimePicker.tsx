// A 12-hour AM/PM clock scroller that matches native mobile and web clock pickers.
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { scheduleProblem } from '@core/utils/bookingRules';
import { Button, Dialog } from './ui';
import { combineDateTime } from '@/lib/schedule';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MERIDIEMS = ['AM', 'PM'] as const;
const ITEM_H = 44;

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime12(value: string): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return value;
  const [h24, m] = value.split(':').map(Number) as [number, number];
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

const parse12 = (val: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } => {
  if (!val || !/^\d{2}:\d{2}$/.test(val)) return { hour: 9, minute: 0, ampm: 'AM' };
  const [h24, m] = val.split(':').map(Number) as [number, number];
  return {
    hour: h24 % 12 || 12,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
    ampm: h24 >= 12 ? 'PM' : 'AM',
  };
};

/** One vertically scrolling column snapped to the centre highlight band. */
function Wheel<T extends string | number>({
  label,
  items,
  value,
  format = String,
  onChange,
}: {
  label: string;
  items: readonly T[] | T[];
  value: T;
  format?: (item: T) => string;
  onChange: (item: T) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const idx = (items as T[]).indexOf(value);
    if (idx >= 0 && ref.current) {
      ref.current.scrollTop = idx * ITEM_H;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const next = items[Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))] as T;
    if (next !== value) onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number | undefined> = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 };
    const step = steps[e.key];
    const at = (items as T[]).indexOf(value);
    const to = step !== undefined ? at + step : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const i = Math.min(items.length - 1, Math.max(0, to));
    ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
    onChange(items[i] as T);
  };

  return (
    <div
      ref={ref}
      className="timepick__wheel"
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => (
        <div
          key={item}
          role="option"
          aria-selected={item === value}
          className={item === value ? 'is-on' : ''}
          onClick={() => {
            ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
            onChange(item);
          }}
        >
          {format(item)}
        </div>
      ))}
    </div>
  );
}

export function TimePicker({
  value,
  date,
  title = 'Select Pickup Time',
  minTime,
  onPick,
  onConfirm,
  onClose,
}: {
  value: string;
  date?: string;
  title?: string;
  minTime?: string;
  onPick?: (val: string) => void;
  onConfirm?: (val: string) => void;
  onClose: () => void;
}) {
  const initial = useMemo(() => parse12(value), [value]);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(initial.ampm);
  const [error, setError] = useState('');

  const to24 = (h12: number, am: 'AM' | 'PM'): number => {
    if (am === 'AM') return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  };

  const preview = `${pad(to24(hour, ampm))}:${pad(minute)}`;

  const handleConfirm = () => {
    if (date) {
      const dt = combineDateTime(date, preview);
      if (dt) {
        const problem = scheduleProblem(dt);
        if (problem) {
          setError(problem);
          return;
        }
      }
    }
    if (minTime && preview < minTime) {
      setError('Please choose a time after pickup');
      return;
    }
    (onPick ?? onConfirm)?.(preview);
    onClose?.();
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      variant="sheet"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Set time
          </Button>
        </>
      }
    >
      <div className="timepick">
        <p className="timepick__now">
          {hour}:{pad(minute)} <span>{ampm}</span>
        </p>

        <div className="timepick__wheels">
          <Wheel
            label="Hour"
            items={HOURS}
            value={hour}
            onChange={(h) => {
              setHour(h);
              setError('');
            }}
          />
          <Wheel
            label="Minute"
            items={MINUTES}
            value={minute}
            format={pad}
            onChange={(m) => {
              setMinute(m);
              setError('');
            }}
          />
          <Wheel
            label="Period"
            items={MERIDIEMS}
            value={ampm}
            onChange={(p) => {
              setAmpm(p);
              setError('');
            }}
          />
        </div>

        {error ? <p className="bf-error">{error}</p> : null}
      </div>
    </Dialog>
  );
}
export default TimePicker;
