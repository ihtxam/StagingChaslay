"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANEL_NAV_ALLOWED_KEYS = exports.PANEL_NAV_GROUP_PATHS = void 0;
exports.normalizePanelNavHidden = normalizePanelNavHidden;
exports.isPanelNavHidden = isPanelNavHidden;
exports.isPanelNavGroupHidden = isPanelNavGroupHidden;
/** Sidebar group ids and route paths a reseller can hide from a merchant panel. */
exports.PANEL_NAV_GROUP_PATHS = {
    sales: [
        "/merchant/orders",
        "/merchant/order-center",
        "/merchant/order-hub",
        "/merchant/sales/reservations",
        "/merchant/reports",
    ],
    catalog: ["/merchant/products", "/merchant/categories", "/merchant/modifiers"],
    hq: ["/merchant/hq", "/merchant/hq/menus", "/merchant/hq/bulk-pricing"],
    inventory: [
        "/merchant/inventory",
        "/merchant/inventory/list",
        "/merchant/inventory/inbound",
        "/merchant/inventory/outbound",
        "/merchant/inventory/counting",
        "/merchant/inventory/history",
        "/merchant/inventory/items",
        "/merchant/inventory/categories",
        "/merchant/inventory/cookbook",
        "/merchant/inventory/suppliers",
        "/merchant/inventory/units",
        "/merchant/inventory/report",
        "/merchant/inventory/dead-stock",
        "/merchant/inventory/consumption",
        "/merchant/storekeeper",
    ],
    customers: [
        "/merchant/customers",
        "/merchant/members",
        "/merchant/loyalty",
        "/merchant/offers",
        "/merchant/vouchers",
        "/merchant/newsletter",
    ],
    cms: ["/merchant/online-shop", "/merchant/chaslay-page-builder"],
};
exports.PANEL_NAV_ALLOWED_KEYS = new Set([
    ...Object.keys(exports.PANEL_NAV_GROUP_PATHS),
    ...Object.values(exports.PANEL_NAV_GROUP_PATHS).flat(),
    "platform-shop",
]);
function normalizePath(raw) {
    const base = String(raw || "")
        .trim()
        .split("?")[0]
        .replace(/\/$/, "");
    return base || "/merchant";
}
function normalizePanelNavHidden(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const item of raw) {
        const key = String(item || "").trim();
        if (!key || !exports.PANEL_NAV_ALLOWED_KEYS.has(key))
            continue;
        if (!out.includes(key))
            out.push(key);
    }
    return out;
}
function isPanelNavHidden(path, hidden) {
    const list = hidden || [];
    if (!list.length)
        return false;
    const normalized = normalizePath(path);
    if (list.includes(normalized))
        return true;
    for (const [groupId, paths] of Object.entries(exports.PANEL_NAV_GROUP_PATHS)) {
        if (!list.includes(groupId))
            continue;
        if (paths.some((p) => normalized === p || normalized.startsWith(`${p}/`)))
            return true;
    }
    return false;
}
function isPanelNavGroupHidden(groupId, hidden) {
    return (hidden || []).includes(groupId);
}
//# sourceMappingURL=panel-nav-hidden.js.map