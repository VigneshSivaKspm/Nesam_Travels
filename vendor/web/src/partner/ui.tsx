// Reference building blocks (vB, vT, qB, vBadge, vNotice, vTabs, vEmpty, vKV, wDialog …) as React components
// that emit the same markup, so the reference stylesheet (styles/partner.css) applies unchanged.
import React, { useEffect, useRef } from 'react';
import { Icon, type IconName } from './Icon';

type Style = 'primary' | 'secondary' | 'text' | 'bid';

/** vB / qB: `q` adds the q-button class (icon first, label in a span). */
export const Btn: React.FC<{
  style?: Style; icon?: IconName; q?: boolean; full?: boolean; submit?: boolean; disabled?: boolean; busy?: boolean;
  onClick?: () => void; children: React.ReactNode; label?: string; className?: string;
}> = ({ style = 'primary', icon, q = true, full, submit, disabled, busy, onClick, children, label, className = '' }) => (
  <button
    type={submit ? 'submit' : 'button'}
    className={`v-button ${q ? 'q-button ' : ''}v-${style}${full ? ' v-full' : ''}${className ? ` ${className}` : ''}`}
    onClick={onClick}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    aria-label={label}
  >
    {icon && <Icon name={icon} />}
    <span>{busy ? 'Please wait…' : children}</span>
  </button>
);

/** vT: text button with a chevron. */
export const TextBtn: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <Btn style="text" icon="chevron-right" onClick={onClick}>{children}</Btn>
);

export type BadgeKind = 'neutral' | 'green' | 'amber' | 'red';
export const Badge: React.FC<{ kind?: BadgeKind; className?: string; children: React.ReactNode }> = ({ kind = 'neutral', className, children }) => (
  <span className={`v-badge v-${kind}${className ? ` ${className}` : ''}`}>{children}</span>
);

export const Notice: React.FC<{ title: React.ReactNode; kind?: '' | BadgeKind; icon?: IconName; children?: React.ReactNode }> = ({ title, kind = '', icon = 'info', children }) => (
  <div className={`v-notice v-${kind}`}>
    <Icon name={icon} />
    <div><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>
  </div>
);

export function Tabs<T extends string>({ items, value, onChange, className = 'v-tabs', label }: {
  items: { id: T; label: React.ReactNode; count?: number }[]; value: T; onChange: (id: T) => void; className?: string; label?: string;
}) {
  return (
    <div className={className} role="group" aria-label={label}>
      {items.map((t) => (
        <button key={t.id} type="button" aria-pressed={value === t.id} onClick={() => onChange(t.id)}>
          {t.count === undefined ? t.label : <>{t.label} <small>{t.count}</small></>}
        </button>
      ))}
    </div>
  );
}

/** Booking tabs put the label in a span and the count in small. */
export function CountTabs<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string; count: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="v-tabs v-booking-tabs" role="group" aria-label={label}>
      {items.map((t) => (
        <button key={t.id} type="button" aria-pressed={value === t.id} onClick={() => onChange(t.id)}>
          <span>{t.label}</span><small>{t.count}</small>
        </button>
      ))}
    </div>
  );
}

export const Empty: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <div className="v-empty"><Icon name="clipboard-list" /><h2>{title}</h2><p>{children}</p>{action}</div>
);

export const KV: React.FC<{ rows: [React.ReactNode, React.ReactNode][]; mt?: boolean }> = ({ rows, mt }) => (
  <dl className={`v-key-values${mt ? ' v-mt' : ''}`}>
    {rows.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
  </dl>
);

export const PageHeading: React.FC<{ title: string; subtitle?: React.ReactNode; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="v-page-heading"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div>
);

/** Back / Home row the reference shows on every inner page. */
export const PageControls: React.FC<{ onBack: () => void; onHome: () => void }> = ({ onBack, onHome }) => (
  <div className="s-page-controls">
    <button type="button" onClick={onBack}><Icon name="arrow-left" /><span>Back</span></button>
    <button type="button" onClick={onHome}><Icon name="house" /><span>Home</span></button>
  </div>
);

export const ExtraTag: React.FC = () => (
  <p className="u-extra-tag"><Icon name="receipt-text" /><span>Toll · Parking · State tax <strong>Extra</strong></span></p>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = 'v-field' }) => (
  <label className={className}><span>{label}</span>{children}</label>
);

export const Check: React.FC<{ checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }> = ({ checked, onChange, children }) => (
  <label className="v-check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required /><span>{children}</span></label>
);

export const ErrorLine: React.FC<{ message: string }> = ({ message }) => (message ? <div className="v-error" role="alert">{message}</div> : null);

/** wDialog: overlay + sheet. Escape and the ✕ close it; focus moves into the sheet and returns afterwards. */
export const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; busy?: boolean }> = ({ title, onClose, children, busy }) => {
  const sheet = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    document.body.classList.add('v-modal-open');
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) closeRef.current(); };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.classList.remove('v-modal-open');
      opener?.focus?.();
    };
  }, [busy]);
  return (
    <div className="nx-sheet-overlay v-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section ref={sheet} className="nx-sheet v-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="v-dialog-heading">
          <h2>{title}</h2>
          <button type="button" className="v-close" aria-label="Close" onClick={onClose} disabled={busy}><Icon name="x" /></button>
        </div>
        <div className="v-dialog-content">{children}</div>
      </section>
    </div>
  );
};

/** u-duty-obligation: assignment deadline, missed-deadline charge and the extras rule. */
export const Obligation: React.FC<{ deadline: React.ReactNode; deadlineLabel?: string; help?: string; penalty: number }> = ({ deadline, deadlineLabel = 'Assign by', help, penalty }) => (
  <section className="u-duty-obligation">
    <div className="u-obligation-row"><Icon name="clock-3" /><span>{deadlineLabel}<strong>{deadline}</strong></span></div>
    {help ? <p className="u-window-help">{help}</p> : null}
    <div className="u-obligation-row"><Icon name="triangle-alert" /><span>Missed assignment deadline<strong>₹{penalty.toLocaleString('en-IN')}</strong></span></div>
    <p className="u-window-help">Confirm a verified driver and matching vehicle by the deadline. The duty stays accepted if overdue; an office-confirmed penalty is recorded in Wallet.</p>
    <ExtraTag />
  </section>
);
