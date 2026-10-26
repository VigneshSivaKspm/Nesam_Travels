// The ride workspace: a title block, the cards, a pinned primary action and the route map. On desktop the
// map is a bounded sticky card beside the cards; on phones it sits under the title (see styles/ride.css).
import type { ReactNode } from 'react';

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
