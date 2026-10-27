// Staff & Access (Master Admin): individual Staff IDs with their own module / action matrix,
// duty permissions, account controls and sensitive-data rights. The matrix is kept on
// admins/{uid}.staffAccess; the permission keys the rules and functions enforce are derived from
// it here, so a Staff ID can never hold more than its matrix grants. Only super admins call these.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';
import { DUTY_ACTIONS, PERMISSIONS, Permission, SUPER_ADMIN_ROLE } from './permissions';
import { sendEmail } from './providers';
import { requireSuperAdmin, text } from './shared';

export const STAFF_MODULES = [
  'Dashboard', 'Bookings', 'Customers', 'Partners & Fleet', 'Accounts', 'Invoices', 'Reports & GST', 'Communication', 'Support',
  'Staff & Access', 'Settings', 'Driver Partners', 'Vendors', 'Vendor Drivers', 'Vehicles', 'Business accounts', 'Penalties',
] as const;
export const MODULE_ACTIONS = ['view', 'create', 'edit', 'approve', 'export', 'send'] as const;
const ACCOUNT_TYPES = ['Driver Partners', 'Vendors', 'Vendor Drivers', 'Vehicles'] as const;
const ACCOUNT_ACTIONS = ['suspend', 'reactivate', 'inactive', 'dispute'] as const;
const STATUSES = ['Invited', 'Active', 'Inactive', 'Suspended'] as const;
const PRESETS = ['Booking staff', 'Dispatcher', 'Accounts staff', 'Support staff', 'Manager', 'Custom'] as const;
const FLAGS = {
  sensitive: ['vendorPayout', 'bankDetails'],
  privacy: ['temporaryReveal', 'requestApproval', 'copyAfterReveal'],
  fleetSwap: ['driver', 'vehicle'],
  partnerRights: ['viewCoupons', 'applyCoupon', 'createVehicle', 'createDriver', 'approveVehicleDocs', 'approveDriverDocs'],
} as const;

/** Module "view" → the enforced permission key(s). Staff & Access itself stays Master-only. */
const MODULE_PERMISSION: Partial<Record<(typeof STAFF_MODULES)[number], Permission[]>> = {
  Bookings: ['operations'], Customers: ['people'], 'Partners & Fleet': ['people', 'fleet'], 'Driver Partners': ['people'], Vendors: ['people'],
  'Vendor Drivers': ['people'], 'Business accounts': ['people'], Vehicles: ['fleet'], Accounts: ['finance'], Invoices: ['finance'],
  'Reports & GST': ['reports'], Communication: ['engagement'], Support: ['engagement'], Settings: ['system', 'pricing', 'content'], Penalties: ['compliance'],
};

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : []);
const flags = (v: unknown, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, !!(v && typeof v === 'object' && (v as Record<string, unknown>)[k] === true)]));

function accessOfInput(input: Record<string, unknown>) {
  const rawModules = (input.modules && typeof input.modules === 'object' ? input.modules : {}) as Record<string, unknown>;
  const modules = Object.fromEntries(STAFF_MODULES.map((m) => [m, pick(rawModules[m], MODULE_ACTIONS)]).filter(([, a]) => (a as string[]).length));
  const rawControls = (input.accountControls && typeof input.accountControls === 'object' ? input.accountControls : {}) as Record<string, unknown>;
  const accountControls = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t, pick(rawControls[t], ACCOUNT_ACTIONS)]));
  const limit = Number(input.bankLimit);
  if (!Number.isFinite(limit) || limit < 0 || limit > 100_000_000) throw new HttpsError('invalid-argument', 'Enter a valid bank settlement approval limit.');
  const access = {
    modules, accountControls, bankLimit: Math.round(limit),
    sensitive: flags(input.sensitive, FLAGS.sensitive), privacy: flags(input.privacy, FLAGS.privacy),
    fleetSwap: flags(input.fleetSwap, FLAGS.fleetSwap), partnerRights: flags(input.partnerRights, FLAGS.partnerRights),
  };
  const permissions = PERMISSIONS.filter((p) => Object.entries(modules).some(([m, a]) => (a as string[]).includes('view') && MODULE_PERMISSION[m as keyof typeof MODULE_PERMISSION]?.includes(p)));
  return { access, permissions, duty: pick(input.duty, DUTY_ACTIONS) };
}

async function nextStaffCode(): Promise<string> {
  const ref = db.doc('counters/staff');
  const n = await db.runTransaction(async (tx) => {
    const v = ((await tx.get(ref)).data()?.value ?? 0) + 1;
    tx.set(ref, { value: v, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return v as number;
  });
  return `NSM-ST-${String(n).padStart(6, '0')}`;
}

export const saveStaffProfile = onCall({ timeoutSeconds: 60 }, async (request) => {
  const actor = await requireSuperAdmin(request.auth);
  const input = (request.data ?? {}) as Record<string, unknown>;
  const name = text(input.name, 80);
  const phone = text(input.phone, 20).replace(/\D/g, '').slice(-10);
  const email = text(input.email, 120).toLowerCase();
  const branch = text(input.branch, 60);
  const preset = (PRESETS as readonly string[]).includes(String(input.preset)) ? String(input.preset) : 'Custom';
  const status = (STATUSES as readonly string[]).includes(String(input.accountStatus)) ? String(input.accountStatus) : 'Invited';
  const reason = text(input.statusReason, 300);
  if (name.length < 2) throw new HttpsError('invalid-argument', 'Enter the staff member’s full name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpsError('invalid-argument', 'Enter a valid 10-digit mobile number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  const { access, permissions, duty } = accessOfInput(input);
  const live = status === 'Active' || status === 'Invited';
  const auth = getAuth();
  let uid = text(input.uid, 128);
  let created = false;

  if (uid) {
    if (uid === actor.uid) throw new HttpsError('failed-precondition', 'You cannot change your own access. Ask another super admin.');
    const snap = await db.doc(`admins/${uid}`).get();
    const d = snap.data();
    if (!snap.exists || d?.role !== 'admin') throw new HttpsError('not-found', 'Staff ID not found.');
    if ((d.staffRole || SUPER_ADMIN_ROLE) === SUPER_ADMIN_ROLE) throw new HttpsError('failed-precondition', 'Super Admin access is managed under Roles & sign-up requests.');
    if ((d.accountStatus || (d.status === 'active' ? 'Active' : 'Inactive')) !== status && reason.length < 5) {
      throw new HttpsError('invalid-argument', 'Record the reason for this status change (at least 5 characters).');
    }
    if (text(d.email, 120).toLowerCase() !== email) await auth.updateUser(uid, { email });
  } else {
    try {
      const existing = await auth.getUserByEmail(email);
      const [admin, cust, drv, ven] = await Promise.all(['admins', 'customers', 'drivers', 'vendors'].map((c) => db.doc(`${c}/${existing.uid}`).get()));
      if (admin.exists) throw new HttpsError('already-exists', 'This email already has a staff ID or sign-up request.');
      if (cust.exists || drv.exists || ven.exists) throw new HttpsError('failed-precondition', 'This email belongs to a customer, driver or vendor account. Use a separate staff email.');
      uid = existing.uid;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      uid = (await auth.createUser({ email, displayName: name, emailVerified: false, disabled: !live })).uid;
      created = true;
    }
  }

  const ref = db.doc(`admins/${uid}`);
  const before = (await ref.get()).data();
  const staffCode = text(before?.staffCode, 20) || await nextStaffCode();
  const entry = { action: before ? 'Profile & permissions saved' : 'Staff ID created', from: before?.accountStatus ?? '', to: status, reason, byName: actor.name, at: Timestamp.now() };
  await ref.set({
    role: 'admin', status: live ? 'active' : 'inactive', accountStatus: status, staffRole: 'individual', roleName: preset,
    permissions, dutyPermissions: duty, staffAccess: access, name, email, phone, branch, staffCode,
    statusHistory: FieldValue.arrayUnion(entry), updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp(),
    ...(before ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: actor.uid }),
  }, { merge: true });
  await auth.updateUser(uid, { disabled: !live, displayName: name });
  if (!live) await auth.revokeRefreshTokens(uid);
  await db.collection('admin_audit').add({
    action: before ? 'staff_profile_updated' : 'staff_profile_created', targetId: uid, actorId: actor.uid, actorName: actor.name, at: FieldValue.serverTimestamp(),
    details: { staffCode, email, preset, status, permissions, duty, reason, ...(before ? { before: { permissions: before.permissions ?? [], duty: before.dutyPermissions ?? [], status: before.accountStatus ?? before.status } } : {}) },
  });

  // Invitation: a password-set link by email. When email delivery is not configured the Master
  // gets the link to share privately.
  let invite: { sent: boolean; link?: string } = { sent: false };
  if (status === 'Invited' && (created || !before || input.resendInvite === true)) {
    const link = await auth.generatePasswordResetLink(email);
    const res = await sendEmail(email, { subject: 'Your NESAM staff login', text: `Hello ${name},\n\nA NESAM office Staff ID (${staffCode}) has been created for you. Set your password with this link, then sign in to the admin panel with ${email}:\n\n${link}\n\nNESAM Tours & Travels` });
    invite = res.ok ? { sent: true } : { sent: false, link };
  }
  return { uid, staffCode, permissions, invite };
});

/** Ends one session, or every session of a Staff ID (refresh tokens revoked: logout on all devices). */
export const revokeStaffSessions = onCall(async (request) => {
  const actor = await requireSuperAdmin(request.auth);
  const uid = text(request.data?.uid, 128);
  const sessionId = text(request.data?.sessionId, 128);
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) throw new HttpsError('invalid-argument', 'Choose the staff member.');
  const stamp = FieldValue.serverTimestamp();
  const end = { status: 'Revoked', endedAt: stamp, endedBy: actor.uid, endedByName: actor.name };
  let ended = 0;
  if (sessionId) {
    const ref = db.doc(`staff_sessions/${sessionId}`);
    const s = await ref.get();
    if (!s.exists || s.data()!.uid !== uid) throw new HttpsError('not-found', 'Session not found.');
    await ref.update(end);
    ended = 1;
  } else {
    await getAuth().revokeRefreshTokens(uid);
    const open = await db.collection('staff_sessions').where('uid', '==', uid).where('status', '==', 'Online').limit(100).get();
    await Promise.all(open.docs.map((d) => d.ref.update(end)));
    ended = open.size;
  }
  await db.collection('admin_audit').add({ action: sessionId ? 'staff_session_ended' : 'staff_sessions_revoked', targetId: uid, actorId: actor.uid, actorName: actor.name, at: stamp, details: { sessionId, ended } });
  return { ended };
});
