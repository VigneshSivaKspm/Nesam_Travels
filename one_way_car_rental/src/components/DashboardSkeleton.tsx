// Named exports are shared by the app startup screen and Shell's lazy-page fallback.
// Loading placeholders shaped like the booking home (header, hero copy, booking card) so the
// page does not jump between unrelated layouts when the real screen replaces them.
import type { ReactNode } from 'react';

export function DashboardMainSkeleton() {
  return (
    <div className="home sk-main" aria-busy="true">
      <div className="wrap home__wrap">
        <div className="home-hero">
          <div className="sk-hero-copy" aria-hidden="true">
            <span className="sk-line sk-line--short" />
            <span className="sk-line sk-line--title" />
            <span className="sk-line sk-line--title" />
            <span className="sk-line" />
            <span className="sk-line sk-line--short" />
          </div>
          <div className="bf" aria-hidden="true">
            <div className="sk-tabs">
              <span className="sk-block sk-tab" />
              <span className="sk-block sk-tab" />
              <span className="sk-block sk-tab" />
              <span className="sk-block sk-tab" />
            </div>
            <div className="bf-form">
              <span className="sk-block sk-field" />
              <span className="sk-block sk-field" />
              <div className="bf-row">
                <span className="sk-block sk-tab" />
                <span className="sk-block sk-tab" />
              </div>
              <span className="sk-block sk-go" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ label = 'Loading…', children }: { label?: string; children?: ReactNode }) {
  return (
    <div className="shell-skeleton" aria-busy="true">
      <div className="shell-skeleton__bar" aria-hidden="true">
        <div className="wrap">
          <span className="sk-block sk-tab" style={{ width: 44 }} />
          <span className="sk-line" style={{ width: 120 }} />
        </div>
      </div>
      <p className="sr-only" role="status">
        {label}
      </p>
      <main id="main" tabIndex={-1} className="shell-skeleton__body">
        {children ?? <DashboardMainSkeleton />}
      </main>
    </div>
  );
}
