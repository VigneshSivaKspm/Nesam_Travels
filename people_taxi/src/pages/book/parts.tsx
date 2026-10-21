import { useState, type ReactNode } from 'react';
import type { FareBreakdown as Fare, FareLine, PaymentMethod } from '@core/types';
import type { FareBreakup } from '@core/utils/fareBreakup';
import { formatINR } from '@core/utils/format';
import { Button, Dialog } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FareBreakdown } from '@/components/FareBreakdown';

export function PaymentChoice({
  value,
  onChange,
  disabled,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pay-opts" role="radiogroup" aria-label="Payment mode">
      <label className={`pay-opt ${value === 'Cash' ? 'is-selected' : ''}`}>
        <input
          type="radio"
          name="pay"
          value="Cash"
          checked={value === 'Cash'}
          disabled={disabled}
          onChange={() => onChange('Cash')}
        />
        <div className="pay-opt__text">
          <strong>Pay Cash to Chauffeur</strong>
          <small>Pay your chauffeur in cash when your journey finishes.</small>
        </div>
        <Icon name="wallet" size={20} />
      </label>

      <label className={`pay-opt ${value === 'UPI' ? 'is-selected' : ''}`}>
        <input
          type="radio"
          name="pay"
          value="UPI"
          checked={value === 'UPI'}
          disabled={disabled}
          onChange={() => onChange('UPI')}
        />
        <div className="pay-opt__text">
          <strong>Pay Chauffeur via UPI / QR</strong>
          <small>Scan and pay your driver's UPI QR code (GPay, PhonePe, Paytm) at destination.</small>
        </div>
        <Icon name="sparkles" size={20} />
      </label>
    </div>
  );
}

export function PromoControl({
  code,
  applied,
  onApply,
  onRemove,
  disabled,
}: {
  code: string;
  applied: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(code);
  const [open, setOpen] = useState(false);

  if (applied && code) {
    return (
      <div className="promo">
        <span className="promo-chip">
          <Icon name="tag" size={14} />
          <strong>{code.toUpperCase()}</strong> applied
          <button type="button" onClick={onRemove} disabled={disabled} aria-label="Remove coupon">
            <Icon name="close" size={12} />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="promo">
      {!open ? (
        <button type="button" className="btn btn--text" onClick={() => setOpen(true)} disabled={disabled}>
          <Icon name="tag" size={14} /> Have a coupon code?
        </button>
      ) : (
        <form
          className="promo-form"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = val.trim();
            if (trimmed) onApply(trimmed);
          }}
        >
          <input
            type="text"
            className="input"
            placeholder="Enter promo code"
            value={val}
            onChange={(e) => setVal(e.target.value.toUpperCase())}
            autoFocus
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!val.trim() || disabled}>
            Apply
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}

export function FareDialog({
  title = 'Fare Breakup & Inclusions',
  lines,
  total,
  fare,
  estimated,
  note,
  onClose,
}: {
  title?: string;
  lines?: FareLine[];
  total?: number;
  fare?: FareBreakup | Fare | null;
  estimated?: boolean;
  note?: ReactNode;
  onClose: () => void;
}) {
  const finalLines: FareLine[] = lines ?? ((fare as any)?.lines ?? []);
  const finalTotal: number = total ?? ((fare as any)?.packageTotal ?? (fare as any)?.total ?? 0);
  return (
    <Dialog title={title} subtitle={estimated ? 'Estimate — confirmed upfront before dispatch.' : 'Confirmed upfront fare for this trip.'} onClose={onClose} variant="sheet">
      <FareBreakdown lines={finalLines} total={finalTotal} estimated={estimated} />
      {note ? <p className="fare-note">{note}</p> : null}
      <p className="fare-note">Category images are illustrative. The assigned model may vary within the booked category.</p>
    </Dialog>
  );
}

export function FlowBar({
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Continue',
  nextDisabled = false,
  nextLoading = false,
  total,
  secondary,
}: {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  total?: number;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="flow-bar">
      {total !== undefined && onNext ? (
        <div className="flow-bar__total">
          <div>
            <small>Estimated Fare</small>
            <strong>{formatINR(total)}</strong>
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={nextDisabled}
            loading={nextLoading}
            onClick={onNext}
            iconTrailing="arrow-right"
          >
            {nextLabel}
          </Button>
        </div>
      ) : null}

      <div className="flow-bar__nav">
        {onBack ? (
          <Button variant="secondary" size="md" onClick={onBack} icon="arrow-left">
            {backLabel}
          </Button>
        ) : null}
        {secondary}
        {total === undefined && onNext ? (
          <Button
            variant="primary"
            size="md"
            disabled={nextDisabled}
            loading={nextLoading}
            onClick={onNext}
            iconTrailing="arrow-right"
          >
            {nextLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
