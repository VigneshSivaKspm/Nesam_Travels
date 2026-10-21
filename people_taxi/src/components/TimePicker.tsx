// A 12-hour AM/PM time picker that matches how riders speak ("7:30 PM", "9:00 AM").
// Native <input type="time"> is buggy and inconsistent across browsers/phones.
import { useMemo, useState } from 'react';
import { scheduleProblem } from '@core/utils/bookingRules';
import { Button, Dialog } from './ui';
import { combineDateTime } from '@/lib/schedule';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

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
    minute: MINUTES.reduce((closest, curr) => (Math.abs(curr - m) < Math.abs(closest - m) ? curr : closest), 0),
    ampm: h24 >= 12 ? 'PM' : 'AM',
  };
};

export function TimePicker({
  value,
  date,
  title = 'Pickup Time',
  minTime,
  onPick,
  onClose,
}: {
  value: string;
  date?: string;
  title?: string;
  minTime?: string;
  onPick: (val: string) => void;
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
    onPick(preview);
    onClose();
  };

  return (
    <Dialog title={title} onClose={onClose} variant="sheet">
      <div className="timepick">
        <p className="timepick__now">
          {hour}:{pad(minute)} <span>{ampm}</span>
        </p>

        <div>
          <label className="bf-label">Hour</label>
          <div className="timepick__group">
            {HOURS.map((h) => (
              <button key={h} type="button" className={hour === h ? 'is-on' : ''} onClick={() => setHour(h)}>
                {h}
              </button>
            ))}
          </div>
        </div>

        <div className="timepick__row">
          <div>
            <label className="bf-label">Minute</label>
            <div className="timepick__group timepick__group--min">
              {MINUTES.map((m) => (
                <button key={m} type="button" className={minute === m ? 'is-on' : ''} onClick={() => setMinute(m)}>
                  :{pad(m)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="bf-label">Period</label>
            <div className="timepick__group timepick__group--ampm">
              {(['AM', 'PM'] as const).map((p) => (
                <button key={p} type="button" className={ampm === p ? 'is-on' : ''} onClick={() => setAmpm(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="bf-error">{error}</p> : null}

        <div className="dialog__foot">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Set time
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
export default TimePicker;
