// The pickup-time sheet: 12-hour clock, quarter-hour minutes and AM/PM. The chosen time is checked
// again when confirmed, so a time that became too soon while the sheet was open is refused.
import { useLayoutEffect, useRef, useState } from 'react';
import { scheduleProblem } from '@core/utils/bookingRules';
import { Button, Dialog } from './ui';
import { combineDateTime } from '@/lib/schedule';

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 15, 30, 45];
const MERIDIEMS = ['AM', 'PM'];
const ITEM_H = 44;

export const formatTime12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

function split(hhmm: string) {
  const [h, m] = hhmm ? (hhmm.split(':').map(Number) as [number, number]) : [18, 0];
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: MINUTES.includes(m) ? m : Math.min(45, Math.ceil(m / 15) * 15), pm: h >= 12 };
}

/** One vertically scrolling column; the item snapped to the centre band is the selected value. */
function Wheel<T extends string | number>({ label, items, value, format = String, onChange }: { label: string; items: T[]; value: T; format?: (item: T) => string; onChange: (item: T) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.scrollTo({ top: items.indexOf(value) * ITEM_H });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const next = items[Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))] as T;
    if (next !== value) onChange(next);
  };

  return (
    <div ref={ref} className="timepick__wheel" role="listbox" aria-label={label} tabIndex={0} onScroll={onScroll}>
      {items.map((item, i) => (
        <div key={item} role="option" aria-selected={item === value} className={item === value ? 'is-on' : ''} onClick={() => ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })}>
          {format(item)}
        </div>
      ))}
    </div>
  );
}

export function TimePicker({
  title = 'Pickup time',
  date,
  value,
  onConfirm,
  onClose,
  validate = 'pickup',
  notBefore,
}: {
  title?: string;
  date: string;
  value: string;
  onConfirm: (hhmm: string) => void;
  onClose: () => void;
  validate?: 'pickup' | 'after';
  notBefore?: Date | null;
}) {
  const init = split(value);
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const [pm, setPm] = useState(init.pm);
  const [error, setError] = useState('');

  const pick = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError('');
  };

  const hhmm = () => `${String((hour % 12) + (pm ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const confirm = () => {
    const t = hhmm();
    const at = date ? combineDateTime(date, t) : null;
    if (at) {
      const problem = validate === 'pickup' ? scheduleProblem(at) : notBefore && at.getTime() <= notBefore.getTime() ? 'The return must be after the pickup.' : '';
      if (problem) {
        setError(problem);
        return;
      }
    }
    onConfirm(t);
  };

  return (
    <Dialog
      title={title}
      subtitle="Times are in IST."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button icon="check" onClick={confirm}>
            Confirm time
          </Button>
        </>
      }
    >
      <div className="timepick">
        <p className="timepick__now num" aria-live="polite">
          {hour}:{String(minute).padStart(2, '0')} <span>{pm ? 'PM' : 'AM'}</span>
        </p>
        <div className="timepick__wheels">
          <Wheel label="Hour" items={HOURS} value={hour} onChange={pick(setHour)} />
          <Wheel label="Minutes" items={MINUTES} value={minute} format={(m) => String(m).padStart(2, '0')} onChange={pick(setMinute)} />
          <Wheel label="AM or PM" items={MERIDIEMS} value={pm ? 'PM' : 'AM'} onChange={pick<string>((m) => setPm(m === 'PM'))} />
        </div>
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
