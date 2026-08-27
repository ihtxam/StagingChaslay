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
function loginHomeFromPermissions(permissions, canAccessPanel) {
    const hasPos = permissions.includes("USE_WEBPOS") || permissions.includes("MANAGE_TABLES");
    const hasPanel = canAccessPanel ||
        permissions.includes("ACCESS_PANEL") ||
        permissions.includes("MANAGE_PRODUCTS") ||
        permissions.includes("VIEW_ORDER_HISTORY") ||
        permissions.includes("MANAGE_INVENTORY") ||
        permissions.includes("STOREKEEPER_INTAKE");
    if (hasPos && !hasPanel)
        return "pos";
    if (hasPanel)
        return "panel";
    return hasPos ? "pos" : "panel";
}
function assertLoginHomeAllowed(loginHome, permissions, canAccessPanel) {
    if (loginHome === "auto")
        return;
    const hasPos = permissions.includes("USE_WEBPOS") || permissions.includes("MANAGE_TABLES");
    const hasPanel = canAccessPanel ||
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
//# sourceMappingURL=staff-login-home.js.map