/** Where a staff member lands after email/password sign-in. */
export type StaffLoginHome = "auto" | "panel" | "pos";

export function normalizeStaffLoginHome(raw: unknown): StaffLoginHome {
  if (raw === "panel" || raw === "pos") return raw;
  return "auto";
}

export function loginHomeFromPermissions(
  permissions: string[],
  canAccessPanel: boolean
): StaffLoginHome {
  const hasPos =
    permissions.includes("USE_WEBPOS") || permissions.includes("MANAGE_TABLES");
  const hasPanel =
    canAccessPanel ||
    permissions.includes("ACCESS_PANEL") ||
    permissions.includes("MANAGE_PRODUCTS") ||
    permissions.includes("VIEW_ORDER_HISTORY") ||
    permissions.includes("MANAGE_INVENTORY") ||
    permissions.includes("STOREKEEPER_INTAKE");
  if (hasPos && !hasPanel) return "pos";
  if (hasPanel) return "panel";
  return hasPos ? "pos" : "panel";
}

export function assertLoginHomeAllowed(
  loginHome: StaffLoginHome,
  permissions: string[],
  canAccessPanel: boolean
): void {
  if (loginHome === "auto") return;
  const hasPos =
    permissions.includes("USE_WEBPOS") || permissions.includes("MANAGE_TABLES");
  const hasPanel =
    canAccessPanel ||
    permissions.includes("ACCESS_PANEL") ||
    permissions.includes("MANAGE_PRODUCTS") ||
    permissions.includes("VIEW_ORDER_HISTORY") ||
    permissions.includes("MANAGE_INVENTORY") ||
    permissions.includes("STOREKEEPER_INTAKE") ||
    permissions.includes("DELIVERY_ORDERS");

  if (loginHome === "panel" && !hasPanel) {
    throw new Error("Panel login requires backend access permissions on the role");
  }
  if (loginHome === "pos" && !hasPos) {
    throw new Error("POS login requires register or waiter permissions on the role");
  }
}
