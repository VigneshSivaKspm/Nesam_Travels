// Admin access model. The same permission keys are enforced by
// firestore.rules / storage.rules (can('…')) and listed for the admin UI in
// admin/src/config/permissions.ts — tests check the three stay identical.
//
// admins/{uid}.staffRole is either SUPER_ADMIN_ROLE or a staff_roles/{id};
// admins/{uid}.permissions is a server-written copy of that role's list.
// An active admin without staffRole predates roles and is a super admin.

export const SUPER_ADMIN_ROLE = 'super_admin';

export const PERMISSIONS = [
  'operations', // bookings, live trips, marketplace, manual bookings
  'people', // customers, vendors, drivers, KYC review
  'fleet', // vehicles
  'pricing', // vehicle category fares, fare rules, offers & coupons
  'content', // services, tour packages, locations
  'finance', // payments, invoices, earnings, payouts, fare overrides
  'compliance', // penalties
  'reports', // reports & analytics
  'engagement', // notifications, reviews, support tickets
  'system', // settings, B2B integrations
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (v: unknown): v is Permission => typeof v === 'string' && (PERMISSIONS as readonly string[]).includes(v);

export interface AdminAccess {
  uid: string;
  name: string;
  isSuper: boolean;
  permissions: Permission[];
  /** Duty actions of a Staff ID made in Staff & Access; absent = not restricted beyond permissions. */
  duty?: DutyAction[];
}

/** Master Admin duty permissions (Staff & Access › Duty permissions). */
export const DUTY_ACTIONS = ['approve', 'publish', 'payout', 'assign', 'remove'] as const;
export type DutyAction = (typeof DUTY_ACTIONS)[number];
export const DUTY_LABEL: Record<DutyAction, string> = {
  approve: 'Approve booking', publish: 'Publish duty', payout: 'Change payout / bidding', assign: 'Assign on behalf', remove: 'Remove allocation',
};

/** Access carried by an admins/{uid} document (not yet checked for active status). */
export function accessOf(uid: string, d: FirebaseFirestore.DocumentData | undefined, fallbackName = ''): AdminAccess {
  const staffRole = typeof d?.staffRole === 'string' && d.staffRole ? d.staffRole : SUPER_ADMIN_ROLE;
  const isSuper = staffRole === SUPER_ADMIN_ROLE;
  const permissions = isSuper ? [...PERMISSIONS] : (Array.isArray(d?.permissions) ? d!.permissions.filter(isPermission) : []);
  const name = typeof d?.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 120) : fallbackName;
  const duty = !isSuper && Array.isArray(d?.dutyPermissions)
    ? (d!.dutyPermissions as unknown[]).filter((x): x is DutyAction => (DUTY_ACTIONS as readonly unknown[]).includes(x))
    : undefined;
  return { uid, name, isSuper, permissions, ...(duty ? { duty } : {}) };
}
