import type { FareLine } from '@core/types';
import { formatINR } from '@core/utils/format';
import { PolicyLinks, type PolicyId } from '@/pages/PolicySections';

const money = (n: number) => (n < 0 ? `−${formatINR(-n)}` : formatINR(n));

/**
 * Fare breakup: what the total includes and what does not apply. The total is always
 * the package total.
 */
export function FareBreakdown({ lines, total, tolls = 0, estimated = false, policies = ['payment'] }: { lines: FareLine[]; total: number; tolls?: number; estimated?: boolean; policies?: PolicyId[] }) {
  const included = lines.filter((l) => l.treatment === 'included');
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

      {na.length ? <p className="fare__na">Not applicable: {na.map((l) => l.label).join(', ')}.</p> : null}
      <PolicyLinks lead={tolls > 0 ? undefined : 'Tolls, parking and permits are not included.'} ids={policies} newTab />
    </div>
  );
}
