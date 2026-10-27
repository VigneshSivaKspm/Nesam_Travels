// Live records and server actions added for the Partner workspace (functions/src/partnerOps.ts).
// Lists are Firestore listeners; every change goes through a server function — the browser writes nothing here.
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { callFunction } from '../services/callables';
import { settleBooking } from '../services/backend';
import { uploadVendorFile } from '../services/storageService';
import { describeDataError } from '../utils/retry';
import { mapDeposit, mapOperations, mapPartnerRequest, mapSettlementDue } from '../services/vendorMappers';
import type { OperationsConfig, PartnerRequestRecord, SecurityDeposit, SettlementDue } from '../types';

type OnError = (message: string) => void;

export function subscribeToPartnerRequests(vendorId: string, cb: (r: PartnerRequestRecord[]) => void, onError: OnError) {
  return onSnapshot(query(collection(db, 'partner_requests'), where('vendorId', '==', vendorId)),
    (snap) => cb(snap.docs.map((d) => mapPartnerRequest(d.id, d.data())).sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0))),
    (err) => onError(describeDataError(err)));
}

export function subscribeToDeposit(vendorId: string, cb: (d: SecurityDeposit | null) => void) {
  return onSnapshot(doc(db, 'partner_deposits', `vendor_${vendorId}`), (snap) => cb(mapDeposit(snap.exists() ? snap.data() : undefined)), () => cb(null));
}

export function subscribeToSettlementDues(vendorId: string, cb: (d: SettlementDue[]) => void) {
  return onSnapshot(query(collection(db, 'settlement_dues'), where('partnerId', '==', vendorId)),
    (snap) => cb(snap.docs.map((d) => mapSettlementDue(d.id, d.data()))), () => cb([]));
}

export function subscribeToOperations(cb: (c: OperationsConfig) => void) {
  return onSnapshot(doc(db, 'settings', 'operations'), (snap) => cb(mapOperations(snap.exists() ? snap.data() : undefined)), () => cb(mapOperations(undefined)));
}

export interface CancelQuote { amount: number; rule: string }

/** Same rule as the server: the last-minute charge takes priority over the acceptance grace period. */
export function quoteCancellation(pickupAt: Date | null, acceptedAt: Date | null, c: OperationsConfig['cancellation'], now = Date.now()): CancelQuote | null {
  if (!pickupAt) return null;
  const h = 3600000;
  const accepted = Math.min(acceptedAt?.getTime() ?? now, now);
  if (now >= pickupAt.getTime() - c.lastMinuteHours * h) return { amount: c.lastMinuteCharge, rule: `Within ${c.lastMinuteHours} hours of pickup` };
  if (now <= accepted + c.graceHours * h) return { amount: 0, rule: `Within ${c.graceHours} hours of accepting` };
  return { amount: c.afterGraceCharge, rule: `More than ${c.graceHours} hours after accepting` };
}

export const CANCEL_REASONS: [string, string][] = [['vehicle', 'Vehicle breakdown'], ['health', 'Health issue'], ['emergency', 'Personal emergency'], ['other', 'Other reason']];

export async function requestCancellation(bookingId: string, reason: string, details: string, quotedPenalty: number) {
  await callFunction('requestDutyCancellation', { bookingId, reason, details: details.trim(), quotedPenalty }, 30000);
  settleBooking(bookingId);
}

export const requestBankChange = (accountHolder: string, accountLast4: string, ifsc: string) =>
  callFunction('submitPartnerRequest', { type: 'bank_change', accountHolder: accountHolder.trim(), accountLast4, ifsc: ifsc.trim().toUpperCase() });

/** Uploads the renewed document into the vendor's own folder, then sends it for office approval. */
export async function submitRenewal(entityType: 'driver' | 'vehicle', entityId: string, document: string, expiry: string, file: File, onProgress: (pct: number) => void) {
  const stored = await uploadVendorFile(document === 'licence' ? 'identity_proof' : document === 'rc' ? 'vehicle_rc' : document === 'insurance' ? 'vehicle_insurance' : document === 'fitness' ? 'vehicle_fc' : 'vehicle_permit', file, onProgress).promise;
  const fileUrl = await getDownloadURL(ref(storage, stored.path)).catch(() => '');
  await callFunction('submitPartnerRequest', { type: 'document_renewal', entityType, entityId, document, expiry, filePath: stored.path, fileUrl, fileName: stored.name });
}

export const setVehicleAvailability = (vehicleId: string, availableFrom: string, location: string) =>
  callFunction('setVehicleAvailability', { vehicleId, availableFrom, location });

export const requestDepositRefund = () => callFunction('requestDepositRefund', {});

interface RechargeOrder { orderId: string; amount: number; currency: string; keyId: string; name: string; phone: string }
interface RazorpayResult { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(e: string, f: (r: unknown) => void): void } } }

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('The payment window could not be loaded. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}

/**
 * Add money: the server creates the gateway order for the amount; the wallet is credited only after the server
 * verifies the captured payment. Resolves with a message for the screen.
 */
export async function rechargeWallet(amount: number): Promise<string> {
  let order: RechargeOrder;
  try {
    order = await callFunction<{ amount: number }, RechargeOrder>('createWalletRecharge', { amount });
  } catch (e) {
    if (/PAYMENT_NOT_CONFIGURED/.test((e as Error).message)) throw new Error('Online payment is not switched on yet. Contact the NESAM office to add money to your wallet.');
    throw e;
  }
  await loadCheckout();
  const result = await new Promise<RazorpayResult>((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId, name: 'NESAM Partner', description: 'Working wallet recharge',
      prefill: { name: order.name, contact: order.phone }, theme: { color: '#c62828' },
      handler: (r: RazorpayResult) => resolve(r),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled. No money was taken.')) },
    });
    rz.on('payment.failed', () => reject(new Error('The payment failed. You have not been charged; please try again.')));
    rz.open();
  });
  const v = await callFunction<unknown, { status: string; message?: string }>('verifyWalletRecharge', {
    razorpayOrderId: result.razorpay_order_id, razorpayPaymentId: result.razorpay_payment_id, razorpaySignature: result.razorpay_signature,
  });
  return v.status === 'credited' ? `₹${amount.toLocaleString('en-IN')} added to your working wallet.` : v.message || 'Your payment is being confirmed.';
}
