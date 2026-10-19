import type { FareLine } from '@core/types';
import { formatINR } from '@core/utils/format';
import { Badge } from './ui';

const money = (n: number) => (n < 0 ? `−${formatINR(-n)}` : formatINR(n));

/**
 * Fare breakup in three groups, each line labelled: what the total includes, what is
 * payable separately (at a rate or at actuals) and what does not apply. The total is
 * always the package total — extras are never silently added to it.
 */
export function FareBreakdown({ lines, total, tolls = 0, estimated = false }: { lines: FareLine[]; total: number; tolls?: number; estimated?: boolean }) {
  const included = lines.filter((l) => l.treatment === 'included');
  const extra = lines.filter((l) => l.treatment === 'extra');
  const na = lines.filter((l) => l.treatment === 'not_applicable');
  return (
    <div className="fare">
      <p className="eyebrow">Included in the {estimated ? 'estimate' : 'fare'}</p>
      <ul className="fare__rows">
        {included.map((l) => (
          <li key={l.key} className="fare__row">
            <div>
              <span className="fare__label">{l.label}</span>
              {l.detail ? <small>{l.detail}</small> : null}
            </div>
            <span className={`fare__value num ${(l.amount ?? 0) < 0 ? 'is-saving' : ''}`}>{l.amount === null ? 'Included' : money(l.amount)}</span>
          </li>
        ))}
        {tolls > 0 ? (
          <li className="fare__row">
            <div>
              <span className="fare__label">Tolls &amp; parking recorded</span>
              <small>Paid by the driver during the trip</small>
            </div>
            <span className="fare__value num">{money(tolls)}</span>
          </li>
        ) : null}
      </ul>
      <div className="fare__total">
        <span>{estimated ? 'Estimated total' : 'Total'}</span>
        <span className="num">{formatINR(total + tolls)}</span>
      </div>

      {extra.length ? (
        <>
          <p className="eyebrow fare__sep">Payable separately — not in the total</p>
          <ul className="fare__rows">
            {extra.map((l) => (
              <li key={l.key} className="fare__row">
                <div>
                  <span className="fare__label">
                    {l.label} <Badge tone="amber">Extra</Badge>
                  </span>
                  {l.detail ? <small>{l.detail}</small> : null}
                </div>
                <span className="fare__value num">{l.amount === null ? 'At actuals' : money(l.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {na.length ? <p className="fare__na">Not applicable: {na.map((l) => l.label).join(', ')}.</p> : null}
    </div>
  );
}
