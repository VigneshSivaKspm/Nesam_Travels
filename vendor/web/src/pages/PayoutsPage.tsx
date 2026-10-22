import React, { useState } from 'react';
import { usePartner } from '../state/Partner';
import { Badge, Banner, Button, Dialog, Empty, KV, Stat, TextInput, Toast, useToast, type Tone } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { inr } from '../ui/format';
import { formatDateTime12 } from '../utils/time';

const ENTRY_LABEL: Record<string, string> = {
  trip_earning: 'Trip earning',
  toll_reimbursement: 'Toll reimbursement',
  cash_collected: 'Cash fare collected by your driver',
  payout: 'Payout',
};
const ENTRY_STATUS: Record<string, string> = {
  pending: 'Awaiting customer payment',
  available: 'Available',
  reserved: 'Held for payout',
  completed: 'Completed',
  cancelled: 'Released',
};
const payoutTone: Record<string, Tone> = { Paid: 'green', Pending: 'amber', Deferred: 'amber', Rejected: 'red', Cancelled: 'gray' };

export const PayoutsPage: React.FC = () => {
  const { wallet, payouts, ledger, profile, actions } = usePartner();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, show, dismiss } = useToast();

  const withdrawable = Math.max(0, Math.floor(wallet.available));
  const hasBank = !!profile.bankAccountNumber && !!profile.ifscCode;
  const hasUpi = !!profile.upiId;
  const [method, setMethod] = useState<'UPI' | 'Bank Transfer'>(hasBank || !hasUpi ? 'Bank Transfer' : 'UPI');
  const destination = method === 'UPI'
    ? (hasUpi ? `UPI ${profile.upiId}` : 'No UPI ID saved')
    : (hasBank ? `${profile.bankAccountName ? `${profile.bankAccountName} · ` : ''}Account ${profile.bankAccountNumber} · ${profile.ifscCode}` : 'No bank account saved');

  const openDialog = () => { setAmount(withdrawable > 0 ? String(withdrawable) : ''); setError(''); setOpen(true); };
  const submit = async () => {
    if (busy) return;
    const n = Number(amount);
    if (!Number.isSafeInteger(n) || n <= 0) return setError('Enter the amount in whole rupees.');
    if (n > withdrawable) return setError(`You can withdraw up to ${inr(withdrawable)}.`);
    setBusy(true); setError('');
    try {
      await actions.requestPayout(n, method);
      setOpen(false);
      show(`Payout request for ${inr(n)} sent to NESAM Finance. The amount is held until they transfer it.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Payout request failed. Please retry.'); } finally { setBusy(false); }
  };

  return (
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
      <div className="vx-card" style={{ background: '#20242E', color: '#fff', borderColor: '#20242E' }}>
        <div className="vx-split vx-split--center" style={{ flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, opacity: .7 }}>Available to withdraw</div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -.6, color: wallet.available < 0 ? '#FFB4BA' : '#fff' }}>{inr(wallet.available)}</div>
            <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>Kept by NESAM from your trip ledger — customer collection is already adjusted.</div>
          </div>
          <Button variant="primary" icon="bank" disabled={withdrawable <= 0} title={withdrawable <= 0 ? 'Nothing is available to withdraw yet.' : undefined} onClick={openDialog}>Request payout</Button>
        </div>
        {wallet.available < 0 && <p style={{ fontSize: 12, color: '#FFB4BA', marginTop: 8 }}>Cash fares your drivers collected exceed your earnings; upcoming earnings settle this first.</p>}
      </div>

      <div className="vx-stats" style={{ marginTop: 14 }}>
        <Stat value={inr(wallet.pending)} label="Awaiting customer payment" />
        <Stat value={inr(wallet.reserved)} label="Held for payout requests" />
        <Stat value={inr(wallet.paidOut)} label="Paid out so far" tone="good" />
        <Stat value={inr(wallet.cashCollected)} label="Cash collected by drivers" />
      </div>

      <div className="vx-grid vx-grid--2" style={{ alignItems: 'start' }}>
        <section className="vx-card">
          <div className="vx-card__head"><h2 className="vx-card__title">Payout requests</h2></div>
          {payouts.length === 0 ? <Empty icon="bank" title="No payout requests yet">Request a payout once you have a balance to withdraw.</Empty> : (
            payouts.map((p) => (
              <div className="vx-listrow" key={p.id}>
                <div className="vx-listrow__body">
                  <strong>{inr(p.amount)}</strong>
                  <small>{p.payoutMethod || 'Payout'} · {p.targetDetails || '—'}</small>
                  <small>{p.requestedAt ? formatDateTime12(p.requestedAt) : '—'}</small>
                  {p.utr && <small style={{ color: 'var(--green)' }}>Transfer reference (UTR): {p.utr}</small>}
                  {p.adminNote && <small>NESAM note: {p.adminNote}</small>}
                </div>
                <Badge tone={payoutTone[p.status] ?? 'gray'}>{p.status}</Badge>
              </div>
            ))
          )}
        </section>

        <section className="vx-card">
          <div className="vx-card__head"><h2 className="vx-card__title">Wallet ledger</h2></div>
          {ledger.length === 0 ? <Empty icon="chart" title="No ledger entries yet">Earnings are recorded when a trip is completed with a verified fare.</Empty> : (
            ledger.slice(0, 60).map((e) => (
              <div className="vx-listrow" key={e.id}>
                <span className="vx-avatar vx-avatar--grey" style={{ color: e.direction === 'credit' ? 'var(--green)' : 'var(--red-dark)' }}><Icon name={e.direction === 'credit' ? 'arrow' : 'bank'} /></span>
                <div className="vx-listrow__body">
                  <strong>{ENTRY_LABEL[e.type] ?? e.type}</strong>
                  <small>{[e.bookingCode, ENTRY_STATUS[e.status] ?? e.status, e.createdAt ? formatDateTime12(e.createdAt) : ''].filter(Boolean).join(' · ')}</small>
                </div>
                <strong style={{ color: e.direction === 'credit' ? 'var(--green)' : 'var(--red-dark)' }}>{e.direction === 'credit' ? '+' : '−'}{inr(Math.abs(e.amount))}</strong>
              </div>
            ))
          )}
        </section>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} eyebrow="Fleet payout" title="Request payout" locked={busy}
        footer={<><Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Confirm request</Button></>}>
        <p className="vx-muted" style={{ marginBottom: 12 }}>You can withdraw up to <strong style={{ color: 'var(--ink)' }}>{inr(withdrawable)}</strong>.</p>
        <TextInput id="payout-amount" label="Amount (₹)" inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setError(''); }} error={error} />
        <div className="vx-tabs" role="radiogroup" aria-label="Payout method">
          {(['Bank Transfer', 'UPI'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={method === m} className="vx-tab" aria-selected={method === m} onClick={() => setMethod(m)}>{m === 'Bank Transfer' ? 'Bank NEFT / IMPS' : 'UPI'}</button>
          ))}
        </div>
        <KV label="Paid to">{destination}</KV>
        <Banner>To change the payout account, update it with NESAM under Account → Business &amp; KYC.</Banner>
      </Dialog>
    </div>
  );
};
