"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeStaffLoginHome = normalizeStaffLoginHome;
exports.loginHomeFromPermissions = loginHomeFromPermissions;
exports.assertLoginHomeAllowed = assertLoginHomeAllowed;
function normalizeStaffLoginHome(raw) {
    if (raw === "panel" || raw === "pos")
        return raw;
    return "auto";
}
function hasRegisterAccess(permissions) {
    return (permissions.includes("USE_WEBPOS") || permissions.includes("MANAGE_TABLES"));
}
/** Mobile / floor apps that use loginHome "pos" without WebPOS or waiter access. */
function hasPosAppAccess(permissions) {
    return (hasRegisterAccess(permissions) ||
        permissions.includes("STOREKEEPER_INTAKE") ||
        permissions.includes("DELIVERY_ORDERS"));
}
/** Full merchant backend — not order history on a register role. */
function hasBackendPanelPermissions(permissions) {
    return (permissions.includes("ACCESS_PANEL") ||
        permissions.includes("MANAGE_PRODUCTS") ||
        permissions.includes("MANAGE_INVENTORY"));
}
/** Order center PWA — order history without register/waiter access. */
function hasOrderCenterPanelAccess(permissions) {
    return permissions.includes("VIEW_ORDER_HISTORY") && !hasRegisterAccess(permissions);
}
function loginHomeFromPermissions(permissions, _canAccessPanel) {
    const hasPos = hasRegisterAccess(permissions);
    if (hasPos && !hasBackendPanelPermissions(permissions))
        return "pos";
    if (hasBackendPanelPermissions(permissions))
        return "panel";
    if (hasOrderCenterPanelAccess(permissions))
        return "panel";
    if (permissions.includes("STOREKEEPER_INTAKE") || permissions.includes("DELIVERY_ORDERS")) {
        return "pos";
    }
    if (permissions.includes("MANAGE_KIOSK"))
        return "panel";
    return hasPos ? "pos" : "panel";
}
function assertLoginHomeAllowed(loginHome, permissions, _canAccessPanel) {
    if (loginHome === "auto")
        return;
    const hasPosApp = hasPosAppAccess(permissions);
    const hasPanel = hasBackendPanelPermissions(permissions) ||
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
//# sourceMappingURL=staff-login-home.js.map