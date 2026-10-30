/** Keep saved shortcuts working after consolidating duplicate workspaces. */
export function resolveAdminDestination(page: string, tab?: string): { page: string; tab?: string } {
  if (page === "notifications" && tab === "Coupons") return { page: "offers" };
  if (page === "accounts" && tab?.split(":")[0] === "Partner statements") {
    return { page, tab: tab.replace(/^Partner statements/, "Statements") };
  }
  return { page, tab };
}
