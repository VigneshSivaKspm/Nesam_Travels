import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const btnClass = (variant: Variant, size: Size, block?: boolean, extra?: string) =>
  ['btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', extra].filter(Boolean).join(' ');

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={btnClass(variant, size, block, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
});

export function LinkButton({ variant = 'secondary', size = 'md', block, icon, className, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; block?: boolean; icon?: string }) {
  return (
    <Link className={btnClass(variant, size, block, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export function IconButton({ icon, label, outline, className = '', ...rest }: { icon: string; label: string; outline?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={`icon-btn ${outline ? 'icon-btn--outline' : ''} ${className}`} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

// ── Fields ────────────────────────────────────────────────────────────────

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

export function FieldShell({ label, hint, error, children, className = '' }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p className="field__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
  wrapperClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, hint, error, prefix, wrapperClassName, className = '', ...rest }, ref) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => {
        const input = <input ref={ref} id={id} className={`input ${className}`} aria-invalid={invalid || undefined} aria-describedby={describedBy} {...rest} />;
        return prefix ? (
          <div className="input-affix">
            <span aria-hidden="true">{prefix}</span>
            {input}
          </div>
        ) : (
          input
        );
      }}
    </FieldShell>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export function TextArea({ label, hint, error, className = '', ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => <textarea id={id} className={`textarea ${className}`} aria-invalid={invalid || undefined} aria-describedby={describedBy} {...rest} />}
    </FieldShell>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

// ── Segmented control (radio semantics) ───────────────────────────────────

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Feedback ──────────────────────────────────────────────────────────────

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'warning' | 'error' | 'success'; children: ReactNode; action?: ReactNode }) {
  const icon = tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'information';
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={20} />
      <div className="notice__body">
        {children}
        {action}
      </div>
    </div>
  );
}

export function Badge({ tone, dot, children }: { tone?: 'red' | 'green' | 'amber' | 'blue'; dot?: boolean; children: ReactNode }) {
  return <span className={['badge', tone && `badge--${tone}`, dot && 'badge--dot'].filter(Boolean).join(' ')}>{children}</span>;
}

export function EmptyState({ art, title, children, action }: { art?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {art ? <img src={`/art/${art}.webp`} alt="" width={220} height={220} loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} /> : null}
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="page-loader" role="status">
      <div className="page-loader__inner">
        <Spinner />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?';
  if (photoUrl) {
    return <img className="avatar" style={{ ['--size' as string]: `${size}px` }} src={photoUrl} alt="" referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar" style={{ ['--size' as string]: `${size}px` }} aria-hidden="true">
      {initials}
    </span>
  );
}

// ── Dialog (modal; centred on desktop, bottom sheet on phones) ─────────────

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({ title, onClose, children, footer, dismissible = true, wide = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; dismissible?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose()} onKeyDown={onKey}>
      <div className={`dialog ${wide ? 'dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="dialog__head">
          <h2 id={titleId}>{title}</h2>
          {dismissible ? <IconButton icon="close" label="Close" onClick={onClose} /> : null}
        </div>
        <div className="dialog__body">{children}</div>
        {footer ? <div className="dialog__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

// ── Page header: a full-width band that opens every page outside the booking flow ──

export function PageHead({ eyebrow, title, children, actions, back }: { eyebrow?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head__inner">
        <div className="page-head__text">
          {back}
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {children ? <p>{children}</p> : null}
        </div>
        {actions ? <div className="page-head__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
