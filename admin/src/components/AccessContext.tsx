import { createContext, useContext } from "react";
import type { AdminAccess, DutyAction, Permission } from "../config/permissions";

const NO_ACCESS: AdminAccess = { isSuper: false, staffRole: "", roleName: "", permissions: [] };

const AccessContext = createContext<AdminAccess>(NO_ACCESS);

export const AccessProvider = AccessContext.Provider;

/** The signed-in admin's role. Use it to hide actions the rules would refuse anyway. */
export const useAccess = () => useContext(AccessContext);

export function useCan(permission: Permission): boolean {
  return useContext(AccessContext).permissions.includes(permission);
}

/** Duty action of a Staff ID; admins without a Staff & Access matrix are limited by permissions only. */
export function useDuty(action: DutyAction): boolean {
  const a = useContext(AccessContext);
  return a.isSuper || !a.duty || a.duty.includes(action);
}

/** Account control (suspend / reactivate / inactive / dispute) for an account type. */
export function useAccountControl(type: "Driver Partners" | "Vendors" | "Vendor Drivers" | "Vehicles") {
  const a = useContext(AccessContext);
  return (action: "suspend" | "reactivate" | "inactive" | "dispute") => a.isSuper || !a.matrix || (a.matrix.accountControls?.[type] ?? []).includes(action);
}
