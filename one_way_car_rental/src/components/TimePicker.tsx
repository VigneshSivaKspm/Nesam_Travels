// The pickup-time sheet: 12-hour clock, quarter-hour minutes and AM/PM. The chosen time is checked
// again when confirmed, so a time that became too soon while the sheet was open is refused.
import { useState } from 'react';
import { scheduleProblem } from '@core/utils/bookingRules';
import { Button, Dialog } from './ui';
import { combineDateTime } from '@/lib/schedule';

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 15, 30, 45];

export const formatTime12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

function split(hhmm: string) {
  const [h, m] = hhmm ? (hhmm.split(':').map(Number) as [number, number]) : [18, 0];
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: MINUTES.includes(m) ? m : Math.min(45, Math.ceil(m / 15) * 15), pm: h >= 12 };
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
        <div className="timepick__group" role="radiogroup" aria-label="Hour">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={hour === h}
              className={hour === h ? 'is-on' : ''}
              onClick={() => {
                setHour(h);
                setError('');
              }}
            >
              {h}
            </button>
          ))}
        </div>
        <div className="timepick__row">
          <div className="timepick__group timepick__group--min" role="radiogroup" aria-label="Minutes">
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={minute === m}
                className={minute === m ? 'is-on' : ''}
                onClick={() => {
                  setMinute(m);
                  setError('');
                }}
              >
                :{String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
          <div className="timepick__group timepick__group--ampm" role="radiogroup" aria-label="AM or PM">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                role="radio"
                aria-checked={pm === p}
                className={pm === p ? 'is-on' : ''}
                onClick={() => {
                  setPm(p);
                  setError('');
                }}
              >
                {p ? 'PM' : 'AM'}
              </button>
            ))}
          </div>
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
