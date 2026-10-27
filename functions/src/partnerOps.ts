// Partner requests and partner-side duty operations shared by the Driver and Partner (vendor) apps:
//
//   requestDutyCancellation   owner-driver / vendor asks the office to cancel an assigned duty before it starts.
//                             The potential charge is quoted from the time the request is SUBMITTED; the duty stays
//                             assigned until the office decides.
//   submitPartnerRequest      bank-detail change or document renewal, for office approval.
//   decidePartnerRequest      office decision (approve / decline; for a cancellation: apply or waive the charge).
//   acknowledgeAssignment     the assigned driver has seen / acknowledged a dispatched duty (shown to the vendor).
//   setVehicleAvailability    vendor marks when and where a fleet vehicle is available for new duties.
//   createWalletRecharge /    "Add money" to the working wallet through the payment gateway; the credit is written
//   verifyWalletRecharge      only after the provider confirms a captured payment.
//   setSecurityDeposit        office records a partner's security deposit; requestDepositRefund asks for it at
//   requestDepositRefund      full & final settlement.
//
// Every record is server-written (firestore.rules deny client writes) and audited.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { DocumentData, FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import { db } from './admin';
import { auditInTx } from './audit';
import { pickupInstant } from './domain/time';
import { recomputeWallet, walletId } from './ledger';
import { notifyInTx, pushAfterCommit, NotifyInput } from './notify';
import { approved, requireAdmin, requirePermission, text } from './shared';

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');

type PartyType = 'driver' | 'vendor';
interface Party { type: PartyType; uid: string; data: DocumentData; name: string }

const docId = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new HttpsError('invalid-argument', `Invalid ${what}.`);
  return v;
};
const code = (b: DocumentData, id: string) => text(b.bookingId) || id;
const millisOf = (v: unknown): number | null => {
  if (v instanceof Timestamp) return v.toMillis();
  if (v && typeof (v as { toMillis?: unknown }).toMillis === 'function') return (v as Timestamp).toMillis();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};

/** The signed-in partner: an approved vendor, or an approved driver (owner-driver or a vendor's employee). */
async function partyOf(uid: string | undefined): Promise<Party> {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const [v, d] = await Promise.all([db.doc(`vendors/${uid}`).get(), db.doc(`drivers/${uid}`).get()]);
  if (v.exists && approved(v.data()!.status)) return { type: 'vendor', uid, data: v.data()!, name: text(v.data()!.companyName || v.data()!.name, 120) };
  if (d.exists && approved(d.data()!.status)) return { type: 'driver', uid, data: d.data()!, name: text(d.data()!.name, 120) };
  throw new HttpsError('permission-denied', 'Your partner account is not active.');
}

// ── Cancellation policy ─────────────────────────────────────────────────────

export interface CancellationPolicy {
  /** Pickup within this many hours → the last-minute charge applies (takes priority). */
  lastMinuteHours: number;
  lastMinuteCharge: number;
  /** Requests within this many hours of accepting the duty are free (when pickup is further away). */
  graceHours: number;
  afterGraceCharge: number;
}
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = { lastMinuteHours: 4, lastMinuteCharge: 1000, graceHours: 4, afterGraceCharge: 500 };

const wholeRupees = (v: unknown, fallback: number, max = 100000) => (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : fallback);
const hours = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 72 ? v : fallback);

/** settings/operations.partnerCancellation, validated; anything missing falls back to the published policy. */
export function cancellationPolicyOf(settings: DocumentData | undefined): CancellationPolicy {
  const p = (settings?.partnerCancellation ?? {}) as Record<string, unknown>;
  const d = DEFAULT_CANCELLATION_POLICY;
  return {
    lastMinuteHours: hours(p.lastMinuteHours, d.lastMinuteHours),
    lastMinuteCharge: wholeRupees(p.lastMinuteCharge, d.lastMinuteCharge),
    graceHours: hours(p.graceHours, d.graceHours),
    afterGraceCharge: wholeRupees(p.afterGraceCharge, d.afterGraceCharge),
  };
}

export type CancellationRule = 'last_minute' | 'grace' | 'after_grace';
export interface CancellationQuote { amount: number; rule: CancellationRule; ruleLabel: string }

/**
 * Potential charge for a request submitted at `requestedAt`.
 * The last-minute rule takes priority over the acceptance grace period.
 */
export function cancellationQuote(pickupAt: number, acceptedAt: number, requestedAt: number, policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY): CancellationQuote {
  const h = 3600000;
  if (requestedAt >= pickupAt - policy.lastMinuteHours * h) {
    return { amount: policy.lastMinuteCharge, rule: 'last_minute', ruleLabel: `Within ${policy.lastMinuteHours} hours of pickup` };
  }
  if (requestedAt <= acceptedAt + policy.graceHours * h) {
    return { amount: 0, rule: 'grace', ruleLabel: `Within ${policy.graceHours} hours of accepting` };
  }
  return { amount: policy.afterGraceCharge, rule: 'after_grace', ruleLabel: `More than ${policy.graceHours} hours after accepting` };
}

export const CANCELLATION_REASONS: Record<string, string> = {
  vehicle: 'Vehicle breakdown', health: 'Health issue', emergency: 'Personal emergency', other: 'Other reason',
};

/** When the vendor accepted / was given this duty, or the owner-driver accepted it. */
function acceptedAtOf(b: DocumentData, type: PartyType): number | null {
  const fields = type === 'vendor' ? ['assignedVendorAt', 'acceptedAt', 'confirmedAt', 'assignedAt'] : ['acceptedAt', 'assignedAt'];
  for (const f of fields) { const m = millisOf(b[f]); if (m) return m; }
  return null;
}

/** Who holds this duty and may ask to cancel it. A vendor's employee driver goes through the vendor. */
function holderOf(b: DocumentData, party: Party): PartyType | null {
  if (party.type === 'vendor') return b.assignedVendorId === party.uid ? 'vendor' : null;
  if (b.assignedDriverId !== party.uid) return null;
  if (party.data.vendorId || b.assignedVendorId) return null;
  return 'driver';
}

const notStarted = (b: DocumentData) => !b.tripSubStatus || b.tripSubStatus === 'Not Started';

export const requestDutyCancellation = onCall({ timeoutSeconds: 60 }, async (request) => {
  const party = await partyOf(request.auth?.uid);
  const input = request.data ?? {};
  const bookingId = docId(input.bookingId, 'booking');
  const reason = text(input.reason, 20);
  if (!CANCELLATION_REASONS[reason]) throw new HttpsError('invalid-argument', 'Select a reason.');
  const details = text(input.details, 500);
  if (details.length < 10) throw new HttpsError('invalid-argument', 'Describe the issue in at least 10 characters.');
  const quoted = input.quotedPenalty;
  const ref = db.doc(`bookings/${bookingId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];

  const out = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    const [snap, settings] = await Promise.all([tx.get(ref), tx.get(db.doc('settings/operations'))]);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const b = snap.data()!;
    const holder = holderOf(b, party);
    if (!holder) {
      throw new HttpsError('permission-denied', party.type === 'driver' && (party.data.vendorId || b.assignedVendorId)
        ? 'Your vendor manages changes to this duty. Contact your vendor or the NESAM office.'
        : 'This duty is not assigned to you.');
    }
    if (!['Approved', 'Confirmed', 'Assigned'].includes(String(b.status)) || !notStarted(b)) {
      throw new HttpsError('failed-precondition', 'This duty has started or closed. Call the NESAM office for changes.', { code: 'started' });
    }
    const requestRef = db.doc(`partner_requests/cancel_${bookingId}_${holder}_${party.uid}`);
    const existing = await tx.get(requestRef);
    if (existing.exists) {
      const st = String(existing.data()!.status);
      throw new HttpsError('failed-precondition', st === 'Pending'
        ? 'Your cancellation request is already with the office.'
        : 'A cancellation request for this duty has already been decided. Call the NESAM office.', { code: 'exists' });
    }
    const pickupAt = pickupInstant(b)?.getTime() ?? null;
    const acceptedAt = acceptedAtOf(b, holder) ?? Date.now();
    if (!pickupAt) throw new HttpsError('failed-precondition', 'This duty has no pickup time. Call the NESAM office.');
    const now = Date.now();
    const quote = cancellationQuote(pickupAt, Math.min(acceptedAt, now), now, cancellationPolicyOf(settings.data()));
    // The charge shown on the form must be the one recorded; if the window moved while the form was open, show the new one.
    if (quoted !== undefined && quoted !== quote.amount) {
      throw new HttpsError('failed-precondition', 'The cancellation window changed. Review the updated charge, then submit again.', { code: 'quote-changed', amount: quote.amount, ruleLabel: quote.ruleLabel });
    }
    const stamp = FieldValue.serverTimestamp();
    const bookingCode = code(b, bookingId);
    const route = `${text(b.pickupCity || b.pickup || b.from, 80)} → ${text(b.dropCity || b.drop || b.to, 80)}`;
    tx.create(requestRef, {
      id: requestRef.id, type: 'cancellation', status: 'Pending', partyType: holder, partyId: party.uid, partyName: party.name,
      [holder === 'vendor' ? 'vendorId' : 'driverId']: party.uid,
      bookingId, bookingCode, route, pickupAt: Timestamp.fromMillis(pickupAt), acceptedAt: Timestamp.fromMillis(acceptedAt), requestedAt: stamp,
      reason, reasonLabel: CANCELLATION_REASONS[reason], details, quotedPenalty: quote.amount, rule: quote.rule, ruleLabel: quote.ruleLabel,
      finalPenalty: null, decidedAt: null, decidedBy: '', adminReason: '', createdAt: stamp, updatedAt: stamp,
    });
    tx.update(ref, {
      cancellationRequest: { requestId: requestRef.id, status: 'Pending', partyType: holder, partyId: party.uid, reason, quotedPenalty: quote.amount, requestedAt: stamp },
      updatedAt: stamp,
    });
    tx.create(ref.collection('events').doc(), { type: 'partner_cancellation_requested', actorId: party.uid, actorRole: holder, reason, quotedPenalty: quote.amount, at: stamp });
    auditInTx(tx, { action: 'partner_cancellation_requested', entity: 'booking', entityId: bookingId, performedBy: party.uid, performedByName: party.name, role: holder, bookingId, next: { reason, quotedPenalty: quote.amount, rule: quote.rule }, reason: details });
    const n: NotifyInput = {
      recipientType: 'admin', recipientId: 'admin', category: 'bookings', severity: 'warning', sound: 'general', push: true,
      title: 'Partner cancellation request', message: `${party.name} (${holder}) asked to cancel ${bookingCode}: ${CANCELLATION_REASONS[reason]}. Potential charge ₹${quote.amount.toLocaleString('en-IN')}.`,
      bookingId, bookingCode, cta: { label: 'Review request', page: 'partner-requests', bookingId },
    };
    pushes.push({ id: notifyInTx(tx, n), input: n });
    return { requestId: requestRef.id, quotedPenalty: quote.amount, ruleLabel: quote.ruleLabel };
  });
  await pushAfterCommit(pushes);
  return { ok: true, ...out };
});

// ── Bank change / document renewal ──────────────────────────────────────────

export const RENEWABLE_DOCUMENTS: Record<'driver' | 'vehicle', Record<string, { label: string; field: string; urlField: string }>> = {
  driver: { licence: { label: 'Driving licence', field: 'licenseExpiry', urlField: 'licenseInfo.renewedDocUrl' } },
  vehicle: {
    rc: { label: 'RC', field: 'rcExpiry', urlField: 'rcDocUrl' }, insurance: { label: 'Insurance', field: 'insuranceExpiry', urlField: 'insuranceDocUrl' },
    fitness: { label: 'Fitness certificate', field: 'fitnessExpiry', urlField: 'fitnessDocUrl' }, permit: { label: 'Permit', field: 'permitExpiry', urlField: 'statePermitDocUrl' },
    puc: { label: 'PUC', field: 'pucExpiry', urlField: 'pucDocUrl' },
  },
};

export const submitPartnerRequest = onCall(async (request) => {
  const party = await partyOf(request.auth?.uid);
  const input = request.data ?? {};
  const type = input.type === 'bank_change' ? 'bank_change' : input.type === 'document_renewal' ? 'document_renewal' : null;
  if (!type) throw new HttpsError('invalid-argument', 'Unknown request.');
  const stamp = FieldValue.serverTimestamp();
  const pushes: { id: string; input: NotifyInput }[] = [];
  let payload: Record<string, unknown>;
  let title: string;
  let entityRef: FirebaseFirestore.DocumentReference | null = null;

  if (type === 'bank_change') {
    const accountHolder = text(input.accountHolder, 120);
    const last4 = String(input.accountLast4 ?? '').replace(/\D/g, '');
    const ifsc = text(input.ifsc, 11).toUpperCase();
    if (accountHolder.length < 3) throw new HttpsError('invalid-argument', 'Enter the account holder name.');
    if (!/^\d{4}$/.test(last4)) throw new HttpsError('invalid-argument', 'Enter the last four digits of the new account.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new HttpsError('invalid-argument', 'Enter a valid IFSC (for example HDFC0001234).');
    payload = { accountHolder, accountLast4: last4, ifsc, note: text(input.note, 300) };
    title = 'Bank detail change';
  } else {
    const entityType = input.entityType === 'vehicle' ? 'vehicle' : input.entityType === 'driver' ? 'driver' : null;
    if (!entityType) throw new HttpsError('invalid-argument', 'Choose a driver or a vehicle.');
    const entityId = docId(input.entityId, entityType);
    const doc = RENEWABLE_DOCUMENTS[entityType][text(input.document, 20)];
    if (!doc) throw new HttpsError('invalid-argument', 'Choose the document to renew.');
    const expiry = text(input.expiry, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Date.parse(`${expiry}T23:59:59+05:30`) <= Date.now()) throw new HttpsError('invalid-argument', 'Enter a new expiry date in the future.');
    const filePath = text(input.filePath, 400);
    const ownFolder = party.type === 'vendor' ? `vendors/${party.uid}/` : `drivers/${party.uid}/`;
    if (!filePath.startsWith(ownFolder) || filePath.includes('..')) throw new HttpsError('invalid-argument', 'Upload the renewed document first.');
    // The download URL of that same object (shown to staff in the vehicle / driver desks once approved).
    const fileUrl = text(input.fileUrl, 1200);
    if (fileUrl && (!fileUrl.startsWith('https://firebasestorage.googleapis.com/') || !fileUrl.includes(encodeURIComponent(filePath)))) {
      throw new HttpsError('invalid-argument', 'The uploaded file link does not match the document.');
    }
    entityRef = db.doc(`${entityType === 'driver' ? 'drivers' : 'vehicles'}/${entityId}`);
    const e = await entityRef.get();
    if (!e.exists) throw new HttpsError('not-found', `${entityType === 'driver' ? 'Driver' : 'Vehicle'} not found.`);
    const ed = e.data()!;
    const mine = party.type === 'vendor'
      ? ed.vendorId === party.uid
      : entityType === 'driver' ? entityId === party.uid : ed.assignedDriverId === party.uid && !ed.vendorId;
    if (!mine) throw new HttpsError('permission-denied', 'You can renew documents only for your own drivers and vehicles.');
    payload = {
      entityType, entityId, entityName: text(entityType === 'driver' ? ed.name : ed.vehicleNumber, 80), document: text(input.document, 20), documentLabel: doc.label,
      field: doc.field, urlField: doc.urlField, expiry, filePath, fileUrl, fileName: text(input.fileName, 120), previousExpiry: text(ed[doc.field], 30),
    };
    title = `${doc.label} renewal`;
  }

  const ref = db.collection('partner_requests').doc();
  await db.runTransaction(async (tx) => {
    pushes.length = 0;
    if (type === 'bank_change') {
      const open = await tx.get(db.collection('partner_requests').where('partyId', '==', party.uid).where('type', '==', 'bank_change').where('status', '==', 'Pending').limit(1));
      if (!open.empty) throw new HttpsError('failed-precondition', 'A bank change request is already with the office.');
    }
    tx.create(ref, {
      id: ref.id, type, status: 'Pending', partyType: party.type, partyId: party.uid, partyName: party.name,
      [party.type === 'vendor' ? 'vendorId' : 'driverId']: party.uid, ...payload, createdAt: stamp, requestedAt: stamp, updatedAt: stamp,
      decidedAt: null, decidedBy: '', adminReason: '',
    });
    auditInTx(tx, { action: `partner_${type}_requested`, entity: 'partner_request', entityId: ref.id, performedBy: party.uid, performedByName: party.name, role: party.type, next: payload });
    const n: NotifyInput = {
      recipientType: 'admin', recipientId: 'admin', category: 'approvals', severity: 'info', sound: 'general', push: false,
      title: `${title} request`, message: `${party.name} (${party.type}) sent a ${title.toLowerCase()} request for review.`, cta: { label: 'Review request', page: 'partner-requests' },
    };
    pushes.push({ id: notifyInTx(tx, n), input: n });
  });
  await pushAfterCommit(pushes);
  void entityRef;
  return { ok: true, requestId: ref.id };
});

// ── Office decision ─────────────────────────────────────────────────────────

export const decidePartnerRequest = onCall({ timeoutSeconds: 60 }, async (request) => {
  const admin = await requireAdmin(request.auth);
  const input = request.data ?? {};
  const requestId = docId(input.requestId, 'request');
  const decision = input.decision === 'approve' ? 'approve' : input.decision === 'decline' ? 'decline' : null;
  if (!decision) throw new HttpsError('invalid-argument', 'Choose approve or decline.');
  const adminReason = text(input.reason, 300);
  if (adminReason.length < 5) throw new HttpsError('invalid-argument', 'Give a short reason (at least 5 characters). The partner sees it.');
  const ref = db.doc(`partner_requests/${requestId}`);
  const pushes: { id: string; input: NotifyInput }[] = [];
  let walletToRecompute: { type: PartyType; id: string } | null = null;

  const out = await db.runTransaction(async (tx) => {
    pushes.length = 0;
    walletToRecompute = null;
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Request not found.');
    const r = snap.data()!;
    if (r.status !== 'Pending') throw new HttpsError('failed-precondition', `This request is already ${String(r.status).toLowerCase()}.`);
    const need = r.type === 'cancellation' ? 'operations' : r.type === 'bank_change' ? 'finance' : 'people';
    if (!admin.permissions.includes(need as never)) throw new HttpsError('permission-denied', `Your role does not include ${need} access.`);
    const stamp = FieldValue.serverTimestamp();
    const partyType = r.partyType as PartyType;
    const partyId = text(r.partyId);
    let finalPenalty: number | null = null;
    let message = '';

    if (r.type === 'cancellation') {
      const bookingRef = db.doc(`bookings/${text(r.bookingId)}`);
      const [bs, market, verification] = await Promise.all([
        tx.get(bookingRef), tx.get(db.doc(`marketplace_trips/${text(r.bookingId)}`)), tx.get(db.doc(`vehicle_verifications/${text(r.bookingId)}`)),
      ]);
      if (!bs.exists) throw new HttpsError('not-found', 'Booking not found.');
      const b = bs.data()!;
      if (decision === 'approve') {
        const holderStill = partyType === 'vendor' ? b.assignedVendorId === partyId : b.assignedDriverId === partyId;
        if (!holderStill) throw new HttpsError('failed-precondition', 'This duty is no longer assigned to the partner. Decline the request instead.');
        if (!notStarted(b)) throw new HttpsError('failed-precondition', 'The trip has started; it cannot be cancelled from a partner request.');
        const apply = input.penalty === 'apply';
        if (input.penalty !== 'apply' && input.penalty !== 'waive') throw new HttpsError('invalid-argument', 'Choose whether to apply or waive the quoted charge.');
        finalPenalty = apply ? Number(r.quotedPenalty) || 0 : 0;
        const oldDriver = { id: text(b.assignedDriverId), name: text(b.assignedDriverName || b.driver), vehicleId: text(b.assignedVehicleId), vehicleNumber: text(b.assignedVehicleNumber), vendorId: text(b.assignedVendorId) };
        // Same release as an office "remove assignment": back to approved, awaiting fulfilment; not re-published.
        tx.update(bookingRef, {
          status: 'Approved', tripStage: FieldValue.delete(), tripSubStatus: 'Not Started',
          assignedDriverId: '', assignedDriverName: '', driver: '', driverPhone: '', assignedVehicleId: '', assignedVehicleNumber: '',
          assignedVendorId: '', assignedVendorName: '', driverPayout: FieldValue.delete(), vendorPayout: FieldValue.delete(), payoutSource: FieldValue.delete(),
          assignedAt: FieldValue.delete(), fulfilmentRoute: FieldValue.delete(), assignBy: FieldValue.delete(), driverResponse: FieldValue.delete(),
          lastAssignment: { action: 'remove', by: admin.uid, byName: admin.name, reason: `Partner cancellation approved: ${adminReason}`, at: Timestamp.now() },
          cancellationRequest: { requestId, status: 'Approved', partyType, partyId, quotedPenalty: Number(r.quotedPenalty) || 0, finalPenalty, decidedAt: stamp },
          assignmentChanges: FieldValue.increment(1), updatedAt: stamp,
        });
        if (market.exists) tx.update(market.ref, { status: 'Closed', assignedDriverId: FieldValue.delete(), assignedDriverName: FieldValue.delete(), assignedVendorId: FieldValue.delete(), assignedVendorName: FieldValue.delete(), acceptedBidId: FieldValue.delete(), updatedAt: stamp });
        if (verification.exists) tx.update(verification.ref, { status: 'Superseded', supersededAt: stamp });
        tx.create(bookingRef.collection('assignments').doc(), { action: 'remove', oldDriver, newDriver: null, changedBy: admin.uid, changedByName: admin.name, reason: `Partner cancellation: ${adminReason}`, at: stamp });
        tx.create(bookingRef.collection('events').doc(), { type: 'partner_cancellation_approved', actorId: admin.uid, actorRole: 'admin', partyType, partyId, finalPenalty, at: stamp });
        if (finalPenalty > 0) {
          const penaltyRef = db.doc(`penalties/cancel_${requestId}`);
          tx.create(penaltyRef, {
            id: penaltyRef.id, entityType: partyType === 'vendor' ? 'Vendor' : 'Driver', entityId: partyId, entityName: text(r.partyName, 120),
            driverId: partyType === 'driver' ? partyId : '', vendorId: partyType === 'vendor' ? partyId : '',
            category: 'Trip Cancellation', reason: `Duty cancellation approved — ${text(r.ruleLabel)}. ${adminReason}`.slice(0, 500), description: text(r.details, 1000), notes: text(r.details, 1000),
            amount: finalPenalty, customerCompensation: 0, bookingDocumentId: text(r.bookingId), bookingCode: text(r.bookingCode), incidentDate: new Date().toISOString().slice(0, 10),
            // The partner saw and accepted this charge when submitting; it is recorded as an approved debit.
            status: 'Deducted', requiresAcknowledgement: false, acknowledged: false, cancellationRequestId: requestId,
            issuedBy: admin.uid, issuedByName: admin.name, issuedAt: stamp, createdBy: admin.uid, createdAt: stamp, updatedAt: stamp,
            deductedAt: stamp, deductedBy: admin.uid, ledgerEntryId: `penalty_${penaltyRef.id}`,
            history: [{ status: 'Deducted', by: admin.uid, byName: admin.name, at: Timestamp.now(), note: 'Approved cancellation charge' }],
          });
          tx.set(db.doc(`wallet_ledger/penalty_${penaltyRef.id}`), {
            schema: 2, actorType: partyType, actorId: partyId, walletId: walletId(partyType, partyId), [partyType === 'vendor' ? 'vendorId' : 'driverId']: partyId,
            type: 'penalty_deduction', direction: 'debit', netAmount: finalPenalty, grossAmount: finalPenalty, commissionAmount: 0, status: 'completed',
            bookingId: text(r.bookingId), bookingCode: text(r.bookingCode), payoutRequestId: '', penaltyId: penaltyRef.id, source: 'cancellation', createdAt: stamp, finalizedAt: stamp,
          });
          walletToRecompute = { type: partyType, id: partyId };
        }
        message = finalPenalty > 0
          ? `${text(r.bookingCode)} is cancelled. A cancellation charge of ₹${finalPenalty.toLocaleString('en-IN')} is recorded in your wallet. ${adminReason}`
          : `${text(r.bookingCode)} is cancelled with no charge. ${adminReason}`;
      } else {
        tx.update(bookingRef, { 'cancellationRequest.status': 'Declined', 'cancellationRequest.decidedAt': stamp, updatedAt: stamp });
        tx.create(bookingRef.collection('events').doc(), { type: 'partner_cancellation_declined', actorId: admin.uid, actorRole: 'admin', partyType, partyId, at: stamp });
        message = `Your cancellation request for ${text(r.bookingCode)} was declined. The duty remains assigned. ${adminReason}`;
      }
    } else if (r.type === 'bank_change') {
      if (decision === 'approve') {
        const profile = db.doc(`${partyType === 'vendor' ? 'vendors' : 'drivers'}/${partyId}`);
        tx.update(profile, { payoutSummary: { accountHolderName: text(r.accountHolder), bankLast4: text(r.accountLast4), ifsc: text(r.ifsc), upiId: '' }, bankUpdatedAt: stamp, updatedAt: stamp });
        message = `Your bank details now end in ${text(r.accountLast4)}. ${adminReason}`;
      } else message = `Your bank change request was declined. ${adminReason}`;
    } else if (r.type === 'document_renewal') {
      if (decision === 'approve') {
        const entity = db.doc(`${r.entityType === 'driver' ? 'drivers' : 'vehicles'}/${text(r.entityId)}`);
        tx.update(entity, {
          [text(r.field)]: text(r.expiry),
          ...(r.entityType === 'driver' ? { 'licenseInfo.expiryDate': text(r.expiry) } : {}),
          ...(text(r.urlField) && text(r.fileUrl) ? { [text(r.urlField)]: text(r.fileUrl) } : {}),
          [`renewals.${text(r.document)}`]: { path: text(r.filePath), url: text(r.fileUrl), expiry: text(r.expiry), approvedAt: stamp, approvedBy: admin.uid },
          updatedAt: stamp,
        });
        message = `${text(r.documentLabel)} for ${text(r.entityName)} is renewed until ${text(r.expiry)}. ${adminReason}`;
      } else message = `${text(r.documentLabel)} renewal for ${text(r.entityName)} was declined. ${adminReason}`;
    } else {
      throw new HttpsError('failed-precondition', 'Unknown request type.');
    }

    tx.update(ref, { status: decision === 'approve' ? 'Approved' : 'Declined', finalPenalty, adminReason, decidedAt: stamp, decidedBy: admin.uid, decidedByName: admin.name, updatedAt: stamp });
    auditInTx(tx, { action: `partner_request_${decision}d`, entity: 'partner_request', entityId: requestId, performedBy: admin.uid, performedByName: admin.name, role: 'admin', bookingId: text(r.bookingId) || undefined, previous: { status: 'Pending' }, next: { status: decision, finalPenalty }, reason: adminReason });
    const n: NotifyInput = {
      recipientType: partyType, recipientId: partyId, category: r.type === 'cancellation' ? 'trips' : 'approvals', severity: decision === 'approve' ? 'success' : 'warning', sound: 'general', push: true,
      title: r.type === 'cancellation' ? (decision === 'approve' ? 'Duty cancelled by NESAM' : 'Cancellation request declined') : decision === 'approve' ? 'Request approved' : 'Request declined',
      message, bookingId: text(r.bookingId) || undefined, bookingCode: text(r.bookingCode) || undefined, cta: { label: 'Open', page: r.type === 'cancellation' ? 'trips' : 'requests' }, sentBy: admin.uid,
    };
    pushes.push({ id: notifyInTx(tx, n), input: n });
    return { status: decision === 'approve' ? 'Approved' : 'Declined', finalPenalty };
  });
  await pushAfterCommit(pushes);
  const w = walletToRecompute as { type: PartyType; id: string } | null;
  if (w) await recomputeWallet(w.type, w.id);
  return { ok: true, ...out };
});

// ── Driver response to a dispatched duty ────────────────────────────────────

export const acknowledgeAssignment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const bookingId = docId(request.data?.bookingId, 'booking');
  const step = request.data?.step === 'acknowledged' ? 'acknowledged' : 'viewed';
  const ref = db.doc(`bookings/${bookingId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const b = snap.data()!;
    if (b.assignedDriverId !== uid) throw new HttpsError('permission-denied', 'This duty is not assigned to you.');
    const current = (b.driverResponse ?? {}) as Record<string, unknown>;
    // The response belongs to the current assignment only.
    const sameAssignment = current.driverId === uid;
    if (sameAssignment && (step === 'viewed' ? current.viewedAt : current.acknowledgedAt)) return;
    const stamp = FieldValue.serverTimestamp();
    tx.update(ref, {
      driverResponse: {
        driverId: uid,
        viewedAt: sameAssignment && current.viewedAt ? current.viewedAt : stamp,
        acknowledgedAt: step === 'acknowledged' ? stamp : sameAssignment ? current.acknowledgedAt ?? null : null,
      },
    });
  });
  return { ok: true };
});

// ── Vehicle availability ────────────────────────────────────────────────────

export const setVehicleAvailability = onCall(async (request) => {
  const party = await partyOf(request.auth?.uid);
  if (party.type !== 'vendor') throw new HttpsError('permission-denied', 'Only a fleet vendor can update vehicle availability.');
  const vehicleId = docId(request.data?.vehicleId, 'vehicle');
  const availableFrom = text(request.data?.availableFrom, 30);
  const location = text(request.data?.location, 120);
  const at = Date.parse(availableFrom);
  if (!Number.isFinite(at)) throw new HttpsError('invalid-argument', 'Choose the date and time the vehicle is available from.');
  if (at > Date.now() + 90 * 86400000) throw new HttpsError('invalid-argument', 'Availability can be set up to 90 days ahead.');
  const ref = db.doc(`vehicles/${vehicleId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.vendorId !== party.uid) throw new HttpsError('permission-denied', 'This vehicle is not in your fleet.');
  await ref.update({ availability: { availableFrom: Timestamp.fromMillis(at), location, updatedAt: FieldValue.serverTimestamp(), updatedBy: party.uid }, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

// ── Working wallet recharge ─────────────────────────────────────────────────

export const RECHARGE_MIN = 100;
export const RECHARGE_MAX = 100000;
const UNSET = 'UNSET';
const configured = (...values: string[]) => values.every((v) => v && v !== UNSET);
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const createWalletRecharge = onCall({ secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (request) => {
  const party = await partyOf(request.auth?.uid);
  const amount = request.data?.amount;
  if (!Number.isSafeInteger(amount) || amount < RECHARGE_MIN || amount > RECHARGE_MAX) {
    throw new HttpsError('invalid-argument', `Enter an amount from ₹${RECHARGE_MIN} to ₹${RECHARGE_MAX.toLocaleString('en-IN')}, in whole rupees.`);
  }
  const keyId = RAZORPAY_KEY_ID.value();
  const keySecret = RAZORPAY_KEY_SECRET.value();
  if (!configured(keyId, keySecret)) throw new HttpsError('failed-precondition', 'PAYMENT_NOT_CONFIGURED');
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt: `wr_${party.uid}`.slice(0, 40), notes: { purpose: 'wallet_recharge', partyType: party.type, partyId: party.uid } });
  await db.doc(`wallet_recharges/${order.id}`).set({
    orderId: order.id, partyType: party.type, partyId: party.uid, partyName: party.name, [party.type === 'vendor' ? 'vendorId' : 'driverId']: party.uid,
    amount, amountPaise: amount * 100, currency: 'INR', status: 'created', createdAt: FieldValue.serverTimestamp(),
  });
  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId, name: party.name, phone: text(party.data.phone, 20) };
});

export const verifyWalletRecharge = onCall({ secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (request) => {
  const party = await partyOf(request.auth?.uid);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = (request.data ?? {}) as Record<string, string | undefined>;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) throw new HttpsError('invalid-argument', 'Missing payment verification fields.');
  const keyId = RAZORPAY_KEY_ID.value();
  const keySecret = RAZORPAY_KEY_SECRET.value();
  if (!configured(keyId, keySecret)) throw new HttpsError('failed-precondition', 'PAYMENT_NOT_CONFIGURED');
  const orderRef = db.doc(`wallet_recharges/${docId(razorpayOrderId, 'order')}`);
  const order = await orderRef.get();
  if (!order.exists || order.data()!.partyId !== party.uid) throw new HttpsError('failed-precondition', 'This payment does not belong to your wallet.');
  const expected = createHmac('sha256', keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  if (!safeEq(expected, razorpaySignature)) throw new HttpsError('invalid-argument', 'Payment signature verification failed.');
  const p = (await (new Razorpay({ key_id: keyId, key_secret: keySecret }) as unknown as { payments: { fetch(id: string): Promise<{ order_id: string; status: string; amount: number }> } }).payments.fetch(razorpayPaymentId));
  if (p.order_id !== razorpayOrderId) throw new HttpsError('failed-precondition', 'The payment does not belong to this order.');
  if (p.status === 'failed') {
    await orderRef.update({ status: 'failed', lastPaymentId: razorpayPaymentId, updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError('failed-precondition', 'The payment failed. You have not been charged; please try again.');
  }
  if (p.status !== 'captured') return { verified: true, status: 'pending', message: 'Your payment is being confirmed. The wallet updates shortly.' };
  if (p.amount !== order.data()!.amountPaise) throw new HttpsError('failed-precondition', 'The paid amount does not match the order.');
  await creditRecharge(orderRef.id, razorpayPaymentId, party.type, party.uid);
  return { verified: true, status: 'credited' };
});

/** Idempotent: one ledger credit per provider payment, whatever the number of callbacks. */
export async function creditRecharge(orderId: string, paymentId: string, type: PartyType, id: string): Promise<void> {
  const orderRef = db.doc(`wallet_recharges/${orderId}`);
  const entryId = `recharge_${paymentId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)}`;
  await db.runTransaction(async (tx: Transaction) => {
    const [o, e] = await Promise.all([tx.get(orderRef), tx.get(db.doc(`wallet_ledger/${entryId}`))]);
    if (e.exists || !o.exists) return;
    const amount = Number(o.data()!.amount);
    const stamp = FieldValue.serverTimestamp();
    tx.set(db.doc(`wallet_ledger/${entryId}`), {
      schema: 2, actorType: type, actorId: id, walletId: walletId(type, id), [type === 'vendor' ? 'vendorId' : 'driverId']: id,
      type: 'wallet_recharge', direction: 'credit', netAmount: amount, grossAmount: amount, commissionAmount: 0, status: 'available',
      bookingId: '', bookingCode: '', payoutRequestId: '', rechargeOrderId: orderId, reference: paymentId, source: 'wallet_recharge', createdAt: stamp, finalizedAt: stamp,
    });
    tx.update(orderRef, { status: 'credited', paymentId, ledgerEntryId: entryId, creditedAt: stamp });
    auditInTx(tx, { action: 'wallet_recharged', entity: 'wallet', entityId: walletId(type, id), performedBy: id, performedByName: text(o.data()!.partyName), role: type, next: { amount, paymentId } });
  });
  await recomputeWallet(type, id);
}

// ── Security deposit ────────────────────────────────────────────────────────

export const DEPOSIT_STATUSES = ['Not paid', 'Active', 'Refund requested', 'Refunded', 'Adjusted'] as const;

export const setSecurityDeposit = onCall(async (request) => {
  const admin = await requirePermission(request.auth, 'finance');
  const input = request.data ?? {};
  const partyType = input.partyType === 'vendor' ? 'vendor' : input.partyType === 'driver' ? 'driver' : null;
  if (!partyType) throw new HttpsError('invalid-argument', 'Choose a vendor or a driver.');
  const partyId = docId(input.partyId, partyType);
  const amount = input.amount;
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000) throw new HttpsError('invalid-argument', 'Enter the deposit in whole rupees.');
  const status = String(input.status);
  if (!(DEPOSIT_STATUSES as readonly string[]).includes(status)) throw new HttpsError('invalid-argument', 'Choose a deposit status.');
  const reference = text(input.reference, 120);
  const ref = db.doc(`partner_deposits/${partyType}_${partyId}`);
  await db.runTransaction(async (tx) => {
    const [p, d] = await Promise.all([tx.get(db.doc(`${partyType === 'vendor' ? 'vendors' : 'drivers'}/${partyId}`)), tx.get(ref)]);
    if (!p.exists) throw new HttpsError('not-found', 'Partner not found.');
    const stamp = FieldValue.serverTimestamp();
    const history = [...(Array.isArray(d.data()?.history) ? d.data()!.history : []).slice(-19), { status, amount, reference, by: admin.uid, byName: admin.name, at: Timestamp.now() }];
    tx.set(ref, { partyType, partyId, [partyType === 'vendor' ? 'vendorId' : 'driverId']: partyId, amount, status, reference, history, updatedAt: stamp, updatedBy: admin.uid }, { merge: true });
    auditInTx(tx, { action: 'security_deposit_updated', entity: 'partner_deposit', entityId: ref.id, performedBy: admin.uid, performedByName: admin.name, role: 'admin', previous: d.data() ? { amount: d.data()!.amount, status: d.data()!.status } : undefined, next: { amount, status } });
  });
  return { ok: true };
});

export const requestDepositRefund = onCall(async (request) => {
  const party = await partyOf(request.auth?.uid);
  const ref = db.doc(`partner_deposits/${party.type}_${party.uid}`);
  const pushes: { id: string; input: NotifyInput }[] = [];
  await db.runTransaction(async (tx) => {
    pushes.length = 0;
    const d = await tx.get(ref);
    if (!d.exists || d.data()!.status !== 'Active' || !(Number(d.data()!.amount) > 0)) throw new HttpsError('failed-precondition', 'There is no active security deposit to refund.');
    const stamp = FieldValue.serverTimestamp();
    tx.update(ref, { status: 'Refund requested', refundRequestedAt: stamp, updatedAt: stamp, history: FieldValue.arrayUnion({ status: 'Refund requested', by: party.uid, byName: party.name, at: Timestamp.now() }) });
    const n: NotifyInput = {
      recipientType: 'admin', recipientId: 'admin', category: 'payments', severity: 'info', sound: 'general', push: false,
      title: 'Security deposit refund requested', message: `${party.name} (${party.type}) asked for the security deposit refund at full & final settlement.`, cta: { label: 'Open', page: 'full-final' },
    };
    pushes.push({ id: notifyInTx(tx, n), input: n });
  });
  await pushAfterCommit(pushes);
  return { ok: true };
});

// ── Helpers used by the marketplace ─────────────────────────────────────────

/**
 * New duty acceptance waits until every penalty notice that needs acknowledgement has been read.
 * Running and accepted duties are not affected.
 */
export async function assertPenaltiesAcknowledged(tx: Transaction, kind: PartyType, uid: string): Promise<void> {
  const open = await tx.get(db.collection('penalties').where(kind === 'vendor' ? 'vendorId' : 'driverId', '==', uid).where('requiresAcknowledgement', '==', true).where('acknowledged', '==', false).limit(1));
  if (!open.empty) {
    throw new HttpsError('failed-precondition', 'Acknowledge your penalty notice before accepting a new duty.', { code: 'penalty-ack', penaltyId: open.docs[0].id });
  }
}

/** Assignment window for a vendor-accepted duty: hours after acceptance, but never later than the cut-off before pickup. */
export function assignByFor(acceptedAt: number, pickupAt: number | null, settings: DocumentData | undefined): number {
  const s = (settings ?? {}) as Record<string, unknown>;
  const windowH = hours(s.vendorAssignmentWindowHours, 2);
  const beforeH = hours(s.vendorAssignBeforePickupHours, 1);
  const byWindow = acceptedAt + windowH * 3600000;
  if (!pickupAt) return byWindow;
  // Urgent duties: never later than the pickup itself.
  return Math.max(Math.min(byWindow, pickupAt - beforeH * 3600000), Math.min(byWindow, pickupAt));
}

