import { useEffect, useMemo, useState } from "react";
import type { Booking } from "../../types";
import { subscribeLedger, type LedgerEntry } from "../../services/earningsService";
import { subscribeRegister, type RegisterEntry } from "../../services/accountsService";
import { useBookings } from "../../hooks/useOfficeData";
import { useCan } from "../AccessContext";
import { Button, DataTable } from "../ui";
import { exportRows } from "../../utils/exportData";
import { rupee } from "../../domain/officeStage";
import { bookingPickupDate, isoDateIST } from "../../utils/time";
import { paymentOf } from "../../domain/bookingFlow";
import { AdjustmentForm, DepositForm, OpeningForm, SettlementForm, type AccountRef } from "./RegisterForms";

export interface StatementLine { date: string; entry: string; sub?: string; ref: string; source: string; debit: number; credit: number }

/** Every dated entry of an account. Positive balance = owed to NESAM. */
export function statementLines(account: AccountRef, ledger: LedgerEntry[], register: RegisterEntry[], bookings: Booking[]): { lines: StatementLine[]; deposit: number } {
  const lines: StatementLine[] = [];
  const mine = register.filter((r) => r.accountType === account.type && r.accountId === account.id);
  for (const r of mine) {
    if (r.kind === "opening") lines.push({ date: r.date, entry: "Opening balance", sub: "Recorded opening", ref: r.reference ?? "", source: "Office", debit: r.amount > 0 ? r.amount : 0, credit: r.amount < 0 ? -r.amount : 0 });
    if (r.kind === "adjustment") lines.push({ date: r.date, entry: "Account adjustment", sub: r.description, ref: r.reference ?? "", source: "Office", debit: r.direction === "Debit" ? r.amount : 0, credit: r.direction === "Credit" ? r.amount : 0 });
    if (r.kind === "settlement") lines.push({ date: r.date, entry: r.description || "Settlement", sub: "Verified bank entry", ref: r.reference ?? "", source: "Bank", debit: r.direction === "Debit" ? r.amount : 0, credit: r.direction === "Credit" ? r.amount : 0 });
  }
  if (account.type === "vendor" || account.type === "driver") {
    for (const e of ledger) {
      if (e.actorType !== account.type || e.actorId !== account.id || e.status === "cancelled") continue;
      const label = e.type === "cash_collected" ? "Fare collected by driver" : e.type === "trip_earning" ? "Agreed trip payout" : e.type === "toll_reimbursement" ? "Toll reimbursement" : e.type === "payout" ? "Payout paid" : e.type.replace(/_/g, " ");
      const sub = e.type === "cash_collected" ? "Verified fare collection" : e.type === "trip_earning" ? "Verified closed bill" : e.status;
      lines.push({ date: e.createdAt ? isoDateIST(e.createdAt) : "", entry: label, sub, ref: e.bookingCode || e.payoutRequestId || "", source: "Ledger", debit: e.direction === "debit" ? e.netAmount : 0, credit: e.direction === "credit" ? e.netAmount : 0 });
    }
  } else {
    for (const b of bookings) {
      const owner = account.type === "business" ? (b as Booking & { businessAccountId?: string }).businessAccountId === account.id : b.customerId === account.id;
      if (!owner) continue;
      const day = isoDateIST(bookingPickupDate(b) ?? new Date());
      const pay = paymentOf(b);
      if (b.status === "Completed") lines.push({ date: day, entry: "Trip charge", sub: "Verified final bill", ref: b.bookingId || b.id, source: "Booking", debit: pay.amountDue, credit: 0 });
      if (b.status === "Cancelled" && (b.cancellation?.charge ?? 0) > 0) lines.push({ date: day, entry: "Cancellation charge", ref: b.bookingId || b.id, source: "Booking", debit: b.cancellation!.charge!, credit: 0 });
      if (pay.totalPaid > 0) lines.push({ date: day, entry: "Payment received", sub: Object.keys(pay.paidByMethod).join(", "), ref: b.bookingId || b.id, source: "Receipts", debit: 0, credit: pay.totalPaid });
      if (pay.refunded > 0) lines.push({ date: day, entry: "Refund paid", ref: b.bookingId || b.id, source: "Refunds", debit: pay.refunded, credit: 0 });
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const deposit = mine.filter((r) => r.kind === "deposit" && r.status !== "Refunded").reduce((s, r) => s + r.amount, 0);
  return { lines, deposit };
}

const word = (n: number, partner: boolean) => (n > 0 ? (partner ? "Receivable from partner" : "Receivable") : n < 0 ? (partner ? "Payable to partner" : "Payable") : "Settled");

/** Monthly statement with opening / closing, exports and the recording actions. */
export default function Statement({ account, code }: { account: AccountRef; code: string }) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [register, setRegister] = useState<RegisterEntry[]>([]);
  const [month, setMonth] = useState(isoDateIST(new Date()).slice(0, 7));
  const [sheet, setSheet] = useState<"opening" | "adjustment" | "settlement" | "deposit" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const bookings = useBookings().rows ?? [];
  const canFinance = useCan("finance");
  useEffect(() => { const a = subscribeLedger(setLedger, () => setLedger([])); const b = subscribeRegister(setRegister, () => setRegister([])); return () => { a(); b(); }; }, []);
  const partner = account.type === "vendor" || account.type === "driver";
  const { lines, deposit } = useMemo(() => statementLines(account, ledger, register, bookings), [account, ledger, register, bookings]);
  const before = lines.filter((l) => l.date < `${month}-01`);
  const opening = before.reduce((s, l) => s + l.debit - l.credit, 0);
  const rows = lines.filter((l) => l.date.startsWith(month));
  const debits = rows.reduce((s, l) => s + l.debit, 0);
  const credits = rows.reduce((s, l) => s + l.credit, 0);
  const closing = opening + debits - credits;
  const hasOpening = register.some((r) => r.kind === "opening" && r.accountType === account.type && r.accountId === account.id);
  let run = opening;
  const shown = rows.map((l) => ({ ...l, bal: (run += l.debit - l.credit) }));
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const exp = (fmt: "xlsx" | "print") => exportRows(`${account.name} statement ${month}`, ["Date", "Entry", "Reference", "Source", "Debit", "Credit", "Running balance"], [
    [`${month}-01`, "Opening balance", "", "", "", "", opening], ...shown.map((l) => [l.date, l.entry, l.ref, l.source, l.debit || "", l.credit || "", l.bal]), [`${month}-${last}`, "Closing balance", "", "", debits, credits, closing],
  ], fmt);
  return (
    <>
      {partner && <span className="ds-eyebrow">PARTNER ACCOUNT</span>}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div><strong className="text-[15px] text-ink">{partner ? "Monthly statement" : "Full account statement"}</strong><p className="text-[12px] text-muted">{account.name} · {code} · {month}</p></div>
        <div className="flex gap-2"><Button icon="printer" onClick={() => exp("print")}>Save as PDF</Button><Button icon="sheet" onClick={() => exp("xlsx")}>Export Excel</Button></div>
      </div>
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="ds-field"><span>Month</span><input type="month" className="ds-input" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <span className="text-[11px] text-muted">{partner ? "Debit: partner owes NESAM · Credit: NESAM owes partner" : "Debit increases the amount owed to NESAM; credit reduces it. Deposit stays separate."}</span>
      </div>
      <dl className="ds-facts mb-3" data-cols={4}>
        <div><dt>OPENING BALANCE</dt><dd>{rupee(Math.abs(opening))} · {word(opening, partner)}</dd></div>
        <div><dt>{partner ? "DEBITS" : "Charges / debits"}</dt><dd>{rupee(debits)}</dd></div>
        <div><dt>{partner ? "CREDITS" : "Receipts / credits"}</dt><dd>{rupee(credits)}</dd></div>
        <div><dt>CLOSING BALANCE</dt><dd>{rupee(Math.abs(closing))} · {word(closing, partner)}</dd></div>
      </dl>
      {canFinance && (
        <div className="flex flex-wrap gap-2 mb-3">
          <Button size="sm" icon="flag" onClick={() => setSheet("opening")}>{partner ? "Record opening balance" : "Record opening"}</Button>
          <Button size="sm" icon="pencil" onClick={() => setSheet("adjustment")}>{partner ? "Account adjustment" : "Adjustment"}</Button>
          {partner && <Button size="sm" icon="landmark" onClick={() => setSheet("settlement")}>Record settlement</Button>}
        </div>
      )}
      {msg && <p className="ds-notice" role="status"><span>{msg}</span><button type="button" className="ds-link" onClick={() => setMsg(null)}>Dismiss</button></p>}
      {!hasOpening && <p className="text-[11px] text-warn mb-2">Initial opening balance is not verified. This statement uses the recorded entries; verify the opening before final settlement.</p>}
      {partner && (
        <div className="ds-note mb-3 flex flex-wrap items-center gap-3">
          <span><strong>Security deposit</strong> {deposit ? rupee(deposit) : "Not recorded"} · {deposit ? "Active" : "Verification pending"}</span>
          <span className="text-[11px] text-faint">Separate from the working statement · Refund only at Full &amp; Final settlement</span>
          {canFinance && <Button size="sm" variant="ghost" onClick={() => setSheet("deposit")}>Record deposit</Button>}
        </div>
      )}
      <DataTable label="Statement" minWidth={820} hideTools>
        <thead><tr><th>DATE</th><th>ENTRY</th><th>{partner ? "TRIP / REFERENCE" : "REFERENCE"}</th>{!partner && <th>SOURCE</th>}<th className="ds-num">DEBIT</th><th className="ds-num">CREDIT</th><th className="ds-num">RUNNING BALANCE</th></tr></thead>
        <tbody>
          <tr><td>{month}-01</td><td><strong>Opening balance</strong></td><td>—</td>{!partner && <td />}<td className="ds-num">—</td><td className="ds-num">—</td><td className="ds-num">{rupee(Math.abs(opening))} · {word(opening, partner)}</td></tr>
          {shown.map((l, i) => <tr key={i}><td>{l.date}</td><td><strong>{l.entry}</strong>{l.sub && <small>{l.sub}</small>}</td><td>{l.ref || "—"}</td>{!partner && <td>{l.source}</td>}<td className="ds-num">{l.debit ? rupee(l.debit) : "—"}</td><td className="ds-num">{l.credit ? rupee(l.credit) : "—"}</td><td className="ds-num">{rupee(Math.abs(l.bal))} · {word(l.bal, partner)}</td></tr>)}
          <tr><td>{month}-{last}</td><td><strong>Closing balance</strong></td><td>—</td>{!partner && <td />}<td className="ds-num">{rupee(debits)}</td><td className="ds-num">{rupee(credits)}</td><td className="ds-num">{rupee(Math.abs(closing))} · {word(closing, partner)}</td></tr>
        </tbody>
      </DataTable>
      <p className="text-[11px] text-faint mt-3">Amounts use verified ledger entries and the selected month. Bank settlements, reversals and charges retain their original partner / trip reference. PDF opens the desktop print dialog; select Save as PDF.</p>
      {sheet === "opening" && <OpeningForm account={account} onClose={() => setSheet(null)} onDone={(t) => { setSheet(null); setMsg(t); }} />}
      {sheet === "adjustment" && <AdjustmentForm account={account} existing={register} onClose={() => setSheet(null)} onDone={(t) => { setSheet(null); setMsg(t); }} />}
      {sheet === "settlement" && <SettlementForm account={account} outstanding={closing} onClose={() => setSheet(null)} onDone={(t) => { setSheet(null); setMsg(t); }} />}
      {sheet === "deposit" && <DepositForm account={account} onClose={() => setSheet(null)} onDone={(t) => { setSheet(null); setMsg(t); }} />}
    </>
  );
}
