// Pieces shared by the "choose" and "review" steps.
import { useMemo, useState } from 'react';
import type { PaymentMethod } from '@core/types';
import { isCouponLive } from '@core/services/pricingService';
import { formatINR } from '@core/utils/format';
import { Button, Dialog, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Stepper } from '@/components/Workspace';
import { useBooking, useBookingQuote } from '@/state/Booking';

export function StepHead({ title, step, onBack, aside }: { title: string; step: 1 | 2 | 3; onBack: () => void; aside?: React.ReactNode }) {
  return (
    <header className="work__head">
      <div className="work__head-row">
        <IconButton icon="arrow-left" label="Back" outline onClick={onBack} />
        <Stepper current={step} />
        {aside}
      </div>
      <h1 className="work__title">{title}</h1>
    </header>
  );
}

const PAYMENTS: { id: PaymentMethod; label: string; hint: string; icon: string }[] = [
  { id: 'Cash', label: 'Cash', hint: 'Pay your driver at drop', icon: 'wallet' },
  { id: 'UPI', label: 'UPI', hint: 'GPay, PhonePe, Paytm', icon: 'payment-card' },
];

/** The booking server records Cash or UPI only, so nothing else is offered. */
export function PaymentChoice({ value, onChange, compact = false }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; compact?: boolean }) {
  return (
    <div className={`pay ${compact ? 'pay--compact' : ''}`} role="radiogroup" aria-label="Payment method">
      {PAYMENTS.map((p) => (
        <label key={p.id} className={`pay__opt ${value === p.id ? 'is-selected' : ''}`}>
          <input type="radio" name="payment" className="sr-only" checked={value === p.id} onChange={() => onChange(p.id)} />
          <Icon name={p.icon} size={compact ? 18 : 22} />
          <span className="pay__text">
            <strong>{p.label}</strong>
            {compact ? null : <small>{p.hint}</small>}
          </span>
          {!compact ? <span className="pay__tick" aria-hidden="true">{value === p.id ? <Icon name="check" size={16} /> : null}</span> : null}
        </label>
      ))}
    </div>
  );
}

/** Applied promo (neat chip) or an "Add promo code" button that opens the code dialog. */
export function PromoControl() {
  const { draft, update } = useBooking();
  const q = useBookingQuote();
  const [open, setOpen] = useState(false);
  const code = draft.promoCode;
  const applied = q.coupon;
  const rejected = code && q.couponCheck && !q.couponCheck.ok ? q.couponCheck.message : '';

  return (
    <>
      {applied ? (
        <span className="promo-chip" role="status">
          <Icon name="offers" size={18} />
          <span>
            <strong>{applied.code}</strong>
            <small>−{formatINR(applied.discount)}</small>
          </span>
          <button type="button" aria-label={`Remove promo code ${applied.code}`} onClick={() => update({ promoCode: '' })}>
            <Icon name="close" size={16} />
          </button>
        </span>
      ) : (
        <button type="button" className="promo-add" onClick={() => setOpen(true)}>
          <Icon name="offers" size={18} />
          {code ? 'Promo not valid' : 'Promo code'}
        </button>
      )}
      {rejected && !open ? (
        <p className="field__error" role="alert">
          {rejected}
        </p>
      ) : null}
      {open ? <PromoDialog onClose={() => setOpen(false)} /> : null}
    </>
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
    <Dialog title="Promo code" onClose={onClose}>
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
        />
        <Button type="submit" variant="dark">
          Apply
        </Button>
      </form>
      {error ? (
        <p className="field__error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      {live.length ? (
        <>
          <p className="eyebrow" style={{ margin: '20px 0 8px' }}>
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
