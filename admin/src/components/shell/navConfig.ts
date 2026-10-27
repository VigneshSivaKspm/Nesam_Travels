import type { IconName } from "../ui/Icon";

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar in the Master Admin order (Operations / People & Fleet / Finance / Office): the reference
 * pages come first with the reference labels and icons; pages the app has beyond the reference
 * follow inside the group they belong to, so nothing that existed before is lost.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
      { id: "bookings", label: "Bookings", icon: "calendar-check-2" },
      { id: "trips", label: "Trips", icon: "route" },
      { id: "marketplace", label: "Open Marketplace", icon: "radio-tower" },
    ],
  },
  {
    label: "People & Fleet",
    items: [
      { id: "customers", label: "Customers", icon: "contact-round" },
      { id: "business", label: "Business accounts", icon: "building-2" },
      { id: "drivers", label: "Driver Partners", icon: "user-round-check" },
      { id: "vendors", label: "Vendors", icon: "building-2" },
      { id: "vendor-drivers", label: "Vendor Drivers", icon: "users-round" },
      { id: "vehicles", label: "Vehicles", icon: "car-front" },
      { id: "verification", label: "Verification", icon: "file-check-2" },
      { id: "partner-links", label: "Partner Links", icon: "link" },
      { id: "categories", label: "Vehicle Categories", icon: "layout-grid" },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "accounts", label: "Accounts", icon: "wallet-cards" },
      { id: "penalties", label: "Penalties", icon: "shield-alert" },
      { id: "invoices", label: "Invoices", icon: "files" },
      { id: "reports", label: "Reports & GST", icon: "chart-no-axes-combined" },
      { id: "full-final", label: "Full & Final", icon: "file-check-2" },
      { id: "payments", label: "Payments", icon: "receipt-indian-rupee" },
      { id: "earnings", label: "Driver Earnings", icon: "wallet" },
      { id: "vendor-finance", label: "Vendor Finance", icon: "landmark" },
      { id: "commission", label: "Commission Policy", icon: "percent" },
    ],
  },
  {
    label: "Office",
    items: [
      { id: "pricing", label: "Service & Fare Settings", icon: "sliders-horizontal" },
      { id: "notifications", label: "Communication", icon: "radio-tower" },
      { id: "support", label: "Support", icon: "headset" },
      { id: "staff", label: "Staff & Access", icon: "shield-user" },
      { id: "security", label: "Staff activity", icon: "history" },
      { id: "settings", label: "Settings", icon: "settings" },
      { id: "offers", label: "Offers & Coupons", icon: "ticket-percent" },
      { id: "services", label: "Services", icon: "briefcase" },
      { id: "packages", label: "Tour Packages", icon: "map" },
      { id: "locations", label: "Locations", icon: "map-pin" },
      { id: "reviews", label: "Reviews", icon: "star" },
      { id: "b2b", label: "B2B Integrations", icon: "globe" },
      { id: "legal", label: "Terms & Privacy", icon: "file-check-2" },
    ],
  },
];
