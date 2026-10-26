// The full-height "workspace" used by choosing a ride, reviewing a booking and following a ride:
// a title block, a scrolling panel of cards and a pinned action bar on one side, with the route map
// filling the rest (desktop) or sitting bounded under the title (phones).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { GeoPlace, RouteInfo } from '@core/types';
import { formatDistance, formatDuration } from '@core/utils/format';
import { Icon } from './Icon';
import { RouteMap, type MapPadding } from './RouteMap';

export function Workspace({ label, head, children, foot, map }: { label: string; head?: ReactNode; children: ReactNode; foot?: ReactNode; map: ReactNode }) {
  return (
    <div className="work">
      {head ? <div className="work__top">{head}</div> : null}
      <div className="work__map">{map}</div>
      <section className="work__panel" aria-label={label}>
        <div className="work__scroll">{children}</div>
      </section>
      {foot ? <div className="work__foot">{foot}</div> : null}
    </div>
  );
}

const PAD: MapPadding = { top: 90, right: 64, bottom: 64, left: 64 };

export function TripMap({ pickup, drop, route, label = 'Trip route', children }: { pickup: GeoPlace | null; drop: GeoPlace | null; route?: RouteInfo | null; label?: string; children?: ReactNode }) {
  return (
    <>
      <RouteMap className="work__canvas" label={label} pickup={pickup} drop={drop} path={route?.path ?? null} padding={PAD} />
      {route ? (
        <div className="map-chip" aria-label="Route summary">
          <Icon name="route" size={18} />
          <strong className="num">{formatDistance(route.distanceKm)}</strong>
          <span aria-hidden="true">·</span>
          <span className="num">{formatDuration(route.durationMin)}</span>
          {route.estimated ? <span className="map-chip__est">estimate</span> : null}
        </div>
      ) : null}
      {children}
    </>
  );
}

const STEPS = [
  { n: 1, label: 'Plan trip', to: '/book' },
  { n: 2, label: 'Choose ride', to: '/book/ride' },
  { n: 3, label: 'Review & book', to: '/book/confirm' },
] as const;

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav className="stepper" aria-label="Booking steps">
      <ol>
        {STEPS.map((s) => {
          const state = s.n < current ? 'done' : s.n === current ? 'current' : 'todo';
          const body = (
            <>
              <span className="stepper__dot">{state === 'done' ? <Icon name="check" size={14} /> : s.n}</span>
              <span className="stepper__label">{s.label}</span>
            </>
          );
          return (
            <li key={s.n} className={`stepper__step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              {state === 'done' ? <Link to={s.to}>{body}</Link> : <span>{body}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
