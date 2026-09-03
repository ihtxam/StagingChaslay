/** Where a staff member lands after email/password sign-in. */
export type StaffLoginHome = "auto" | "panel" | "pos";

export function normalizeStaffLoginHome(raw: unknown): StaffLoginHome {
  if (raw === "panel" || raw === "pos") return raw;
  return "auto";
}

function hasRegisterAccess(permissions: string[]): boolean {
  return (
    permissions.includes("USE_WEBPOS") || permissions.includes("MANAGE_TABLES")
  );
}

/** Mobile / floor apps that use loginHome "pos" without WebPOS or waiter access. */
function hasPosAppAccess(permissions: string[]): boolean {
  return (
    hasRegisterAccess(permissions) ||
    permissions.includes("STOREKEEPER_INTAKE") ||
    permissions.includes("DELIVERY_ORDERS")
  );
}

/** Full merchant backend — not order history on a register role. */
function hasBackendPanelPermissions(permissions: string[]): boolean {
  return (
    permissions.includes("ACCESS_PANEL") ||
    permissions.includes("MANAGE_PRODUCTS") ||
    permissions.includes("MANAGE_INVENTORY")
  );
}

/** Order center PWA — order history without register/waiter access. */
function hasOrderCenterPanelAccess(permissions: string[]): boolean {
  return permissions.includes("VIEW_ORDER_HISTORY") && !hasRegisterAccess(permissions);
}

export function loginHomeFromPermissions(
  permissions: string[],
  _canAccessPanel: boolean
): StaffLoginHome {
  const hasPos = hasRegisterAccess(permissions);
  if (hasPos && !hasBackendPanelPermissions(permissions)) return "pos";
  if (hasBackendPanelPermissions(permissions)) return "panel";
  if (hasOrderCenterPanelAccess(permissions)) return "panel";
  if (permissions.includes("STOREKEEPER_INTAKE") || permissions.includes("DELIVERY_ORDERS")) {
    return "pos";
  }
  if (permissions.includes("MANAGE_KIOSK")) return "panel";
  return hasPos ? "pos" : "panel";
}

export function assertLoginHomeAllowed(
  loginHome: StaffLoginHome,
  permissions: string[],
  _canAccessPanel: boolean
): void {
  if (loginHome === "auto") return;
  const hasPosApp = hasPosAppAccess(permissions);
  const hasPanel =
    hasBackendPanelPermissions(permissions) ||
    hasOrderCenterPanelAccess(permissions) ||
    permissions.includes("DELIVERY_ORDERS") ||
    permissions.includes("MANAGE_KIOSK");

  if (loginHome === "panel" && !hasPanel) {
    throw new Error("Panel login requires backend access permissions on the role");
  }
  if (loginHome === "pos" && !hasPosApp) {
    throw new Error("POS login requires register or waiter permissions on the role");
  }
}
