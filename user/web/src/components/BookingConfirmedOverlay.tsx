import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './bookingConfirmed.css';

// The full-screen "Booking confirmed" moment shown right after a booking is made: the brand logo drops in, a tick draws
// itself inside expanding rings, confetti falls, then the booking ID and the next steps rise into place. Shared by NESAM,
// One Way Car Rentals and People Taxi (each passes its own logo; colours come from the site's own accent), so it imports
// nothing from any site.

const PIECES = 40;

export function BookingConfirmedOverlay({
  logo,
  code,
  title = 'Booking confirmed!',
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onClose,
}: {
  logo?: { src: string; alt: string };
  code?: string;
  title?: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onClose: () => void;
}) {
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="bcx" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bcx__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="bcx__confetti" aria-hidden="true">
        {Array.from({ length: PIECES }, (_, i) => (
          <i
            key={i}
            className={`bcx__bit bcx__bit--${i % 5} ${i % 3 === 0 ? 'is-round' : ''}`}
            style={
              {
                '--x': `${(i * 37) % 100}%`,
                '--d': `${((i * 53) % 90) / 100 + 0.25}s`,
                '--t': `${2.2 + ((i * 29) % 16) / 10}s`,
                '--r': `${((i * 71) % 720) - 360}deg`,
                '--s': `${7 + ((i * 13) % 7)}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="bcx__card">
        {logo ? (
          <div className="bcx__logo">
            <img src={logo.src} alt={logo.alt} height={56} />
          </div>
        ) : null}

        <div className="bcx__check" aria-hidden="true">
          <span className="bcx__pulse" />
          <svg viewBox="0 0 120 120" focusable="false">
            <circle className="bcx__disc" cx="60" cy="60" r="46" />
            <path className="bcx__tick" d="M38 62l15 15 30-34" pathLength="100" />
          </svg>
        </div>

        <h2 className="bcx__title">{title}</h2>
        {code ? (
          <p className="bcx__code">
            <span>Booking ID</span>
            <strong>{code}</strong>
          </p>
        ) : null}
        <p className="bcx__msg">{message}</p>

        <div className="bcx__actions">
          <button ref={primary} type="button" className="bcx__btn bcx__btn--primary" onClick={onPrimary}>
            {primaryLabel}
          </button>
          <button type="button" className="bcx__btn bcx__btn--ghost" onClick={onClose}>
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
