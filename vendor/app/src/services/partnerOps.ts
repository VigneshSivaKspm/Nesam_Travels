// Partner requests and partner operations for the Vendor app (functions/src/partnerOps.ts): duty cancellation,
// bank change, security deposit, settlement statements and the office's operating limits. Lists are Firestore
// listeners; every change goes through a server function.
import { collection, doc, onSnapshot, query, where, type DocumentData, type Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { callFunction } from './callables';

export interface OperationsConfig {
  assignmentWindowHours: number;
  assignBeforePickupHours: number;
  missedAssignmentPenalty: number;
  cancellation: { lastMinuteHours: number; lastMinuteCharge: number; graceHours: number; afterGraceCharge: number };
  supportPhone: string;
}

export interface PartnerRequestRecord {
  id: string;
  type: 'cancellation' | 'bank_change' | 'document_renewal';
  status: 'Pending' | 'Approved' | 'Declined';
  bookingId: string;
  bookingCode: string;
  route: string;
  reasonLabel: string;
  quotedPenalty: number;
  finalPenalty: number | null;
  ruleLabel: string;
  adminReason: string;
  requestedAt: Date | null;
  decidedAt: Date | null;
  documentLabel: string;
  entityName: string;
  expiry: string;
  accountLast4: string;
  ifsc: string;
}

export interface SecurityDeposit { amount: number; status: string }

export interface SettlementDue {
  id: string;
  bookingCode: string;
  amount: number;
  entitlement: number;
  collectedByPartner: number;
  status: string;
  completedAt: Date | null;
}

const date = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : null);
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const hours = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 72 ? v : d);
const rupees = (v: unknown, d: number) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : d);

export function mapOperations(d: DocumentData | undefined): OperationsConfig {
  const c = (d?.partnerCancellation ?? {}) as Record<string, unknown>;
  return {
    assignmentWindowHours: hours(d?.vendorAssignmentWindowHours, 2),
    assignBeforePickupHours: hours(d?.vendorAssignBeforePickupHours, 1),
    missedAssignmentPenalty: rupees(d?.missedAssignmentPenalty, 500),
    cancellation: { lastMinuteHours: hours(c.lastMinuteHours, 4), lastMinuteCharge: rupees(c.lastMinuteCharge, 1000), graceHours: hours(c.graceHours, 4), afterGraceCharge: rupees(c.afterGraceCharge, 500) },
    supportPhone: s(d?.supportPhone) || '+919025099990',
  };
}

export const subscribeToOperations = (cb: (c: OperationsConfig) => void) =>
  onSnapshot(doc(db, 'settings', 'operations'), (snap) => cb(mapOperations(snap.data())), () => cb(mapOperations(undefined)));

export const subscribeToPartnerRequests = (vendorId: string, cb: (r: PartnerRequestRecord[]) => void) =>
  onSnapshot(query(collection(db, 'partner_requests'), where('vendorId', '==', vendorId)), (snap) => cb(snap.docs.map((x) => {
    const d = x.data();
    return {
      id: x.id, type: d.type === 'bank_change' ? 'bank_change' : d.type === 'document_renewal' ? 'document_renewal' : 'cancellation',
      status: d.status === 'Approved' ? 'Approved' : d.status === 'Declined' ? 'Declined' : 'Pending',
      bookingId: s(d.bookingId), bookingCode: s(d.bookingCode), route: s(d.route), reasonLabel: s(d.reasonLabel), quotedPenalty: n(d.quotedPenalty),
      finalPenalty: typeof d.finalPenalty === 'number' ? d.finalPenalty : null, ruleLabel: s(d.ruleLabel), adminReason: s(d.adminReason),
      requestedAt: date(d.requestedAt) ?? date(d.createdAt), decidedAt: date(d.decidedAt), documentLabel: s(d.documentLabel), entityName: s(d.entityName),
      expiry: s(d.expiry), accountLast4: s(d.accountLast4), ifsc: s(d.ifsc),
    } as PartnerRequestRecord;
  }).sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0))), () => cb([]));

export const subscribeToDeposit = (vendorId: string, cb: (d: SecurityDeposit | null) => void) =>
  onSnapshot(doc(db, 'partner_deposits', `vendor_${vendorId}`), (snap) => cb(snap.exists() ? { amount: n(snap.data().amount), status: s(snap.data().status) || 'Not paid' } : null), () => cb(null));

export const subscribeToSettlementDues = (vendorId: string, cb: (d: SettlementDue[]) => void) =>
  onSnapshot(query(collection(db, 'settlement_dues'), where('partnerId', '==', vendorId)), (snap) => cb(snap.docs.map((x) => {
    const d = x.data();
    return { id: x.id, bookingCode: s(d.bookingCode) || x.id, amount: n(d.amount), entitlement: n(d.entitlement), collectedByPartner: n(d.collectedByPartner), status: s(d.status) || 'Due', completedAt: date(d.completedAt) };
  })), () => cb([]));

export const CANCEL_REASONS: [string, string][] = [['vehicle', 'Vehicle breakdown'], ['health', 'Health issue'], ['emergency', 'Personal emergency'], ['other', 'Other reason']];

/** Same rule as the server: the last-minute charge takes priority over the acceptance grace period. */
export function quoteCancellation(pickupAt: Date | null, acceptedAt: Date | null, c: OperationsConfig['cancellation'], now = Date.now()): { amount: number; rule: string } | null {
  if (!pickupAt) return null;
  const h = 3600000;
  const accepted = Math.min(acceptedAt?.getTime() ?? now, now);
  if (now >= pickupAt.getTime() - c.lastMinuteHours * h) return { amount: c.lastMinuteCharge, rule: `Within ${c.lastMinuteHours} hours of pickup` };
  if (now <= accepted + c.graceHours * h) return { amount: 0, rule: `Within ${c.graceHours} hours of accepting` };
  return { amount: c.afterGraceCharge, rule: `More than ${c.graceHours} hours after accepting` };
}

/** Assign-by for duties accepted before the server stored one (same rule as the server). */
export function assignDeadline(acceptedAt: Date | null, pickupAt: Date | null, ops: OperationsConfig, stored: Date | null): Date | null {
  if (stored) return stored;
  if (!acceptedAt) return null;
  const accepted = acceptedAt.getTime();
  const byWindow = accepted + ops.assignmentWindowHours * 3600000;
  if (!pickupAt) return new Date(byWindow);
  const preferred = Math.min(byWindow, pickupAt.getTime() - ops.assignBeforePickupHours * 3600000);
  return new Date(preferred > accepted ? preferred : Math.min(byWindow, pickupAt.getTime()));
}

export const requestCancellation = (bookingId: string, reason: string, details: string, quotedPenalty: number) =>
  callFunction('requestDutyCancellation', { bookingId, reason, details: details.trim(), quotedPenalty }, 30000);

export const requestBankChange = (accountHolder: string, accountLast4: string, ifsc: string) =>
  callFunction('submitPartnerRequest', { type: 'bank_change', accountHolder: accountHolder.trim(), accountLast4, ifsc: ifsc.trim().toUpperCase() });

export const requestDepositRefund = () => callFunction('requestDepositRefund', {});

export interface RechargeOrder { orderId: string; amount: number; currency: string; keyId: string; name: string; phone: string }
export const createWalletRecharge = (amount: number) => callFunction<{ amount: number }, RechargeOrder>('createWalletRecharge', { amount });
export const verifyWalletRecharge = (orderId: string, paymentId: string, signature: string) =>
  callFunction<unknown, { status: string; message?: string }>('verifyWalletRecharge', { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
