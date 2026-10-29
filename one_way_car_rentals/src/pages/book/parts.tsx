// Pieces shared by the booking steps, the confirmation and trip details.
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FareLine } from '@core/types';
import { isCouponLive } from '@core/services/pricingService';
import { formatINR } from '@core/utils/format';
import { Button, Dialog } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FareBreakdown } from '@/components/FareBreakdown';
import { useBooking, useBookingQuote } from '@/state/Booking';

/** Applied promo (chip) or an "Apply a promo code" link that opens the code dialog. */
export function PromoControl() {
  const { draft, update } = useBooking();
  const q = useBookingQuote();
  const [open, setOpen] = useState(false);
  const code = draft.promoCode;
  const applied = q.coupon;
  const rejected = code && q.couponCheck && !q.couponCheck.ok ? q.couponCheck.message : '';

  return (
    <div className="promo">
      {applied ? (
        <span className="promo-chip" role="status">
          <Icon name="offers" size={16} />
          <span>
            <strong>{applied.code}</strong> applied · <span className="num">−{formatINR(applied.discount)}</span>
          </span>
          <button type="button" aria-label={`Remove promo code ${applied.code}`} onClick={() => update({ promoCode: '' })}>
            <Icon name="close" size={14} />
          </button>
        </span>
      ) : (
        <button type="button" className="link-btn" onClick={() => setOpen(true)}>
          <Icon name="offers" size={15} />
          {code ? 'Promo code not valid — try another' : 'Apply a promo code'}
        </button>
      )}
      {rejected && !open ? (
        <p className="field__error" role="alert">
          {rejected}
        </p>
      ) : null}
      {open ? <PromoDialog onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function PromoDialog({ onClose }: { onClose: () => void }) {
  const { draft, update, coupons } = useBooking();
  const q = useBookingQuote();
  const [input, setInput] = useState(draft.promoCode);
  const [error, setError] = useState('');
  const live = useMemo(() => coupons.filter((c) => isCouponLive(c)), [coupons]);

  const apply = (raw: string) => {
    const code = raw.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) {
      setError('Enter a promo code.');
      return;
    }
    const res = q.checkCoupon(code);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    update({ promoCode: res.coupon.code });
    onClose();
  };

  return (
    <Dialog title="Promo code" subtitle="The booking server verifies every code against your fare." onClose={onClose}>
      <form
        className="promo-form"
        onSubmit={(e) => {
          e.preventDefault();
          apply(input);
        }}
      >
        <label className="sr-only" htmlFor="promo-input">
          Promo code
        </label>
        <input
          id="promo-input"
          data-autofocus
          className="input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value.toUpperCase());
            setError('');
          }}
          placeholder="Enter code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'promo-err' : undefined}
        />
        <Button type="submit">Apply</Button>
      </form>
      {error ? (
        <p className="field__error" id="promo-err" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      {live.length ? (
        <>
          <p className="picker__head" style={{ marginTop: 20 }}>
            Available offers
          </p>
          <ul className="offer-list">
            {live.map((c) => (
              <li key={c.id}>
                <button type="button" className="offer-pick" onClick={() => apply(c.code)}>
                  <strong>{c.code}</strong>
                  <span>{c.description || c.name}</span>
                  <small className="muted">
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off${c.maximumDiscount ? ` up to ${formatINR(c.maximumDiscount)}` : ''}` : `${formatINR(c.discountValue)} off`}
                    {c.minimumBookingAmount ? ` · min fare ${formatINR(c.minimumBookingAmount)}` : ''}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Dialog>
  );
}

/** The full fare breakup in a dialog ("View fare"). */
export function FareDialog({ title, lines, total, estimated, note, onClose }: { title: string; lines: FareLine[]; total: number; estimated?: boolean; note?: ReactNode; onClose: () => void }) {
  return (
    <Dialog title={title} subtitle={estimated ? 'Estimate — the booking server confirms the final fare.' : 'Confirmed upfront fare for this trip.'} onClose={onClose}>
      <FareBreakdown lines={lines} total={total} estimated={estimated} />
      {note ? <p className="fare-note">{note}</p> : null}
      <p className="fare-note">Category images are illustrative. The assigned model may vary within the booked category.</p>
    </Dialog>
  );
}

/** Bottom flow action bar for mobile or sidebar action container */
export function FlowBar({ children, back, className = '' }: { children?: ReactNode; back?: () => void; className?: string }) {
  const navigate = useNavigate();
  return (
    <div className={`flow-bar ${className}`}>
      {children}
      <div className="flow-bar__nav">
        <Button variant="secondary" icon="arrow-left" onClick={back ?? (() => navigate(-1))}>
          Back
        </Button>
        <Button variant="secondary" icon="home" onClick={() => navigate('/book')}>
          Home
        </Button>
      </div>
    </div>
  );
}
