/**
 * Staff permissions. These keys are enforced by firestore.rules / storage.rules
 * (can('…')) and by the server functions (functions/src/permissions.ts);
 * tests check all three lists stay identical. Hiding a page here is only a
 * convenience — the rules are what actually allow or deny each action.
 */
export const SUPER_ADMIN_ROLE = "super_admin";

export const PERMISSIONS = [
  "operations",
  "people",
  "fleet",
  "pricing",
  "content",
  "finance",
  "compliance",
  "reports",
  "engagement",
  "system",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string }> = {
  operations: { label: "Operations", description: "Bookings, live trips, marketplace, manual bookings and dispatch" },
  people: { label: "People", description: "Customers, vendors and drivers, including KYC review and approvals" },
  fleet: { label: "Fleet", description: "Vehicles and their document review" },
  pricing: { label: "Pricing", description: "Vehicle category fares, fare rules, offers and coupons" },
  content: { label: "Content", description: "Services, tour packages and locations" },
  finance: { label: "Finance", description: "Payments, invoices, earnings, payouts and fare overrides" },
  compliance: { label: "Compliance", description: "Penalties and disputes" },
  reports: { label: "Reports", description: "Reports & analytics (read access to financial records)" },
  engagement: { label: "Engagement", description: "Notifications, reviews and support tickets" },
  system: { label: "System", description: "Company settings and B2B integrations" },
};

/** Permission a page needs. null = every active admin; "super" = super admins only. */
export const PAGE_ACCESS: Record<string, Permission | null | "super"> = {
  dashboard: null,
  trips: "operations",
  bookings: "operations",
  "booking-detail": "operations",
  marketplace: "operations",
  customers: "people",
  business: "people",
  vendors: "people",
  "vendor-drivers": "people",
  verification: "people",
  drivers: "people",
  "partner-links": "people",
  // Listing is open to every active admin; each decision checks operations / finance / people on the server.
  "partner-requests": null,
  vehicles: "fleet",
  categories: "pricing",
  pricing: "pricing",
  "fare-rules": "pricing",
  offers: "pricing",
  services: "content",
  packages: "content",
  locations: "content",
  accounts: "finance",
  "full-final": "finance",
  payments: "finance",
  invoices: "finance",
  earnings: "finance",
  "vendor-finance": "finance",
  commission: "finance",
  penalties: "compliance",
  reports: "reports",
  notifications: "engagement",
  reviews: "engagement",
  support: "engagement",
  b2b: "system",
  settings: "system",
  security: "system",
  legal: "system",
  staff: "super",
};

/** Staff & Access › Duty permissions (enforced by the booking server for Staff IDs). */
export const DUTY_ACTIONS = [["approve", "Approve booking"], ["publish", "Publish duty"], ["payout", "Change payout / bidding"], ["assign", "Assign on behalf"], ["remove", "Remove allocation"]] as const;
export type DutyAction = (typeof DUTY_ACTIONS)[number][0];

/** The per-person matrix saved by Staff & Access (admins/{uid}.staffAccess). */
export interface StaffMatrix {
  modules: Record<string, string[]>;
  accountControls: Record<string, string[]>;
  bankLimit: number;
  sensitive: Record<string, boolean>;
  privacy: Record<string, boolean>;
  fleetSwap: Record<string, boolean>;
  partnerRights: Record<string, boolean>;
}

export interface AdminAccess {
  isSuper: boolean;
  staffRole: string;
  roleName: string;
  permissions: Permission[];
  /** Present only for Staff IDs made in Staff & Access. */
  duty?: DutyAction[];
  matrix?: StaffMatrix;
  staffCode?: string;
}

export const isPermission = (v: unknown): v is Permission =>
  typeof v === "string" && (PERMISSIONS as readonly string[]).includes(v);

/** Same interpretation as the rules: an admin without staffRole predates roles and is a super admin. */
export function accessFromAdminDoc(d: Record<string, unknown> | undefined): AdminAccess {
  const staffRole = typeof d?.staffRole === "string" && d.staffRole ? d.staffRole : SUPER_ADMIN_ROLE;
  const isSuper = staffRole === SUPER_ADMIN_ROLE;
  return {
    isSuper,
    staffRole,
    roleName: isSuper ? "Super Admin" : typeof d?.roleName === "string" && d.roleName ? d.roleName : "Staff",
    permissions: isSuper ? [...PERMISSIONS] : Array.isArray(d?.permissions) ? d.permissions.filter(isPermission) : [],
    ...(!isSuper && Array.isArray(d?.dutyPermissions) ? { duty: d.dutyPermissions.filter((x): x is DutyAction => DUTY_ACTIONS.some(([k]) => k === x)) } : {}),
    ...(!isSuper && d?.staffAccess && typeof d.staffAccess === "object" ? { matrix: d.staffAccess as StaffMatrix } : {}),
    ...(typeof d?.staffCode === "string" ? { staffCode: d.staffCode } : {}),
  };
}

export function canAccessPage(access: AdminAccess, page: string): boolean {
  const need = PAGE_ACCESS[page];
  if (need === undefined || need === null) return true;
  if (need === "super") return access.isSuper;
  return access.permissions.includes(need);
}
