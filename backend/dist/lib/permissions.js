"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_MERCHANT_ENTRY_PERMISSIONS = exports.PANEL_ROUTE_PERMISSIONS = exports.ANDROID_PERMISSION_ALIASES = exports.DEFAULT_ROLE_TEMPLATES = exports.ALL_PERMISSIONS = exports.PERMISSIONS = void 0;
exports.parsePermissions = parsePermissions;
exports.encodePermissions = encodePermissions;
exports.hasPermission = hasPermission;
exports.hasAnyPermission = hasAnyPermission;
exports.toAndroidPermissions = toAndroidPermissions;
exports.waiterSystemKind = waiterSystemKind;
exports.waiterBlockedPermissions = waiterBlockedPermissions;
/** POS + panel permissions (aligned with Android PosPermission + panel extras). */
exports.PERMISSIONS = [
    "USE_POS",
    "USE_WEBPOS",
    "PROCESS_PAYMENTS",
    "APPLY_DISCOUNTS",
    "OPEN_CASH_DRAWER",
    "SEND_KITCHEN",
    "MANAGE_TABLES",
    "TAKEAWAY_ORDERS",
    "DELIVERY_ORDERS",
    "VIEW_ORDER_HISTORY",
    "CANCEL_ORDERS",
    "REFUND_ORDERS",
    "VIEW_REPORTS",
    /** See company-wide / all-staff sales in reports and EOD (without this = own sales only). */
    "VIEW_ALL_SALES",
    "MANAGE_PRODUCTS",
    "MANAGE_CUSTOMERS",
    "MANAGE_OFFERS",
    "MANAGE_ONLINE_SHOP",
    "MANAGE_SETTINGS",
    "ACCESS_PANEL",
    "MANAGE_STAFF",
    "MANAGE_ROLES",
    "MANAGE_BILLING",
    "END_OF_DAY",
    "MANAGE_INVENTORY",
];
function parsePermissions(raw) {
    if (!raw)
        return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => exports.PERMISSIONS.includes(s));
}
function encodePermissions(perms) {
    return [...new Set(perms)].join(",");
}
function hasPermission(granted, required) {
    if (!granted)
        return false;
    return granted.includes(required);
}
function hasAnyPermission(granted, required) {
    if (!granted?.length)
        return false;
    return required.some((p) => granted.includes(p));
}
/** Merchant owner (login via merchants table) implicitly has all permissions. */
exports.ALL_PERMISSIONS = [...exports.PERMISSIONS];
exports.DEFAULT_ROLE_TEMPLATES = [
    {
        name: "Manager",
        isSystem: true,
        sortOrder: 10,
        permissions: [
            "ACCESS_PANEL",
            "USE_WEBPOS",
            "USE_POS",
            "PROCESS_PAYMENTS",
            "APPLY_DISCOUNTS",
            "OPEN_CASH_DRAWER",
            "SEND_KITCHEN",
            "MANAGE_TABLES",
            "TAKEAWAY_ORDERS",
            "DELIVERY_ORDERS",
            "VIEW_ORDER_HISTORY",
            "CANCEL_ORDERS",
            "REFUND_ORDERS",
            "VIEW_REPORTS",
            "VIEW_ALL_SALES",
            "MANAGE_PRODUCTS",
            "MANAGE_CUSTOMERS",
            "MANAGE_OFFERS",
            "MANAGE_ONLINE_SHOP",
            "MANAGE_SETTINGS",
            "MANAGE_STAFF",
            "MANAGE_BILLING",
            "END_OF_DAY",
            "MANAGE_INVENTORY",
        ],
    },
    {
        // Floor POS + optional back office (menu + orders). No Sales / reports / panel.
        name: "Waiter",
        isSystem: true,
        sortOrder: 20,
        permissions: [
            "USE_WEBPOS",
            "USE_POS",
            "PROCESS_PAYMENTS",
            "APPLY_DISCOUNTS",
            "SEND_KITCHEN",
            "MANAGE_TABLES",
            "TAKEAWAY_ORDERS",
            "VIEW_ORDER_HISTORY",
            "CANCEL_ORDERS",
            "MANAGE_PRODUCTS",
        ],
    },
    {
        // Floor POS + catalog edits (products / categories / modifiers). No full panel.
        name: "Waiter + menu editor",
        isSystem: true,
        sortOrder: 25,
        permissions: [
            "USE_WEBPOS",
            "USE_POS",
            "PROCESS_PAYMENTS",
            "APPLY_DISCOUNTS",
            "SEND_KITCHEN",
            "MANAGE_TABLES",
            "TAKEAWAY_ORDERS",
            "VIEW_ORDER_HISTORY",
            "CANCEL_ORDERS",
            "MANAGE_PRODUCTS",
        ],
    },
    {
        name: "Delivery",
        isSystem: true,
        sortOrder: 30,
        permissions: ["USE_POS", "DELIVERY_ORDERS", "VIEW_ORDER_HISTORY", "SEND_KITCHEN", "PROCESS_PAYMENTS"],
    },
    {
        name: "User",
        isSystem: true,
        sortOrder: 40,
        permissions: [
            "USE_WEBPOS",
            "USE_POS",
            "PROCESS_PAYMENTS",
            "TAKEAWAY_ORDERS",
            "VIEW_ORDER_HISTORY",
            "END_OF_DAY",
        ],
    },
    {
        name: "Cashier",
        isSystem: true,
        sortOrder: 50,
        permissions: [
            "USE_WEBPOS",
            "USE_POS",
            "PROCESS_PAYMENTS",
            "TAKEAWAY_ORDERS",
            "VIEW_ORDER_HISTORY",
            "OPEN_CASH_DRAWER",
            "APPLY_DISCOUNTS",
            "END_OF_DAY",
        ],
    },
];
/**
 * Map panel/web permission keys → Android PosPermission names used by Chaslay POS.
 * Unknown keys are dropped so Room sync only stores enums the app understands.
 */
exports.ANDROID_PERMISSION_ALIASES = {
    ACCESS_PANEL: "ACCESS_SETTINGS",
    MANAGE_SETTINGS: "ACCESS_SETTINGS",
    MANAGE_STAFF: "MANAGE_USERS",
    USE_WEBPOS: "USE_POS",
};
function toAndroidPermissions(perms) {
    const out = new Set();
    for (const raw of perms) {
        const key = String(raw || "").trim();
        if (!key)
            continue;
        const mapped = exports.ANDROID_PERMISSION_ALIASES[key] || key;
        out.add(mapped);
    }
    return [...out];
}
/** Panel sidebar route → required permission (any match grants access). */
exports.PANEL_ROUTE_PERMISSIONS = {
    "/merchant": ["VIEW_REPORTS", "ACCESS_PANEL"],
    "/merchant/orders": ["VIEW_ORDER_HISTORY"],
    "/merchant/invoices": ["VIEW_REPORTS", "VIEW_ALL_SALES", "ACCESS_PANEL"],
    "/merchant/pos": ["USE_WEBPOS"],
    "/merchant/reports": ["VIEW_REPORTS", "END_OF_DAY"],
    "/merchant/products": ["MANAGE_PRODUCTS"],
    "/merchant/modifiers": ["MANAGE_PRODUCTS"],
    "/merchant/categories": ["MANAGE_PRODUCTS"],
    "/merchant/customers": ["MANAGE_CUSTOMERS"],
    "/merchant/members": ["MANAGE_CUSTOMERS"],
    "/merchant/loyalty": ["MANAGE_CUSTOMERS"],
    "/merchant/offers": ["MANAGE_OFFERS"],
    "/merchant/vouchers": ["MANAGE_OFFERS"],
    "/merchant/terminals": ["MANAGE_SETTINGS"],
    "/merchant/waiter": ["USE_WEBPOS"],
    "/merchant/newsletter": ["MANAGE_ONLINE_SHOP"],
    "/merchant/online-shop": ["MANAGE_ONLINE_SHOP"],
    "/merchant/website": ["MANAGE_ONLINE_SHOP"],
    "/merchant/floor-plan": ["MANAGE_TABLES"],
    "/merchant/tables": ["MANAGE_TABLES"],
    "/merchant/tables/settings": ["MANAGE_TABLES"],
    "/merchant/tables/layout": ["MANAGE_TABLES"],
    "/merchant/tables/qr": ["MANAGE_TABLES"],
    "/merchant/reservations": ["MANAGE_ONLINE_SHOP", "VIEW_REPORTS"],
    "/merchant/sales/reservations": ["MANAGE_ONLINE_SHOP", "VIEW_REPORTS"],
    "/merchant/billing": ["MANAGE_BILLING"],
    "/merchant/settings": ["MANAGE_SETTINGS"],
    "/merchant/users": ["MANAGE_STAFF"],
    "/merchant/inventory": ["MANAGE_INVENTORY"],
    "/merchant/inventory/list": ["MANAGE_INVENTORY"],
    "/merchant/inventory/inbound": ["MANAGE_INVENTORY"],
    "/merchant/inventory/outbound": ["MANAGE_INVENTORY"],
    "/merchant/inventory/counting": ["MANAGE_INVENTORY"],
    "/merchant/inventory/history": ["MANAGE_INVENTORY"],
    "/merchant/inventory/items": ["MANAGE_INVENTORY"],
    "/merchant/inventory/categories": ["MANAGE_INVENTORY"],
    "/merchant/inventory/cookbook": ["MANAGE_INVENTORY"],
    "/merchant/inventory/suppliers": ["MANAGE_INVENTORY"],
    "/merchant/inventory/units": ["MANAGE_INVENTORY"],
    "/merchant/inventory/report": ["MANAGE_INVENTORY"],
    "/merchant/inventory/consumption": ["MANAGE_INVENTORY"],
};
/** Staff JWT may enter merchant APIs with any of these (POS, waiter, catalog, or full panel). */
exports.STAFF_MERCHANT_ENTRY_PERMISSIONS = [
    "ACCESS_PANEL",
    "USE_WEBPOS",
    "USE_POS",
    "MANAGE_PRODUCTS",
    "MANAGE_TABLES",
    "SEND_KITCHEN",
];
const WAITER_PRIVILEGED_BLOCKED = [
    "VIEW_REPORTS",
    "VIEW_ALL_SALES",
    "END_OF_DAY",
    "ACCESS_PANEL",
    "OPEN_CASH_DRAWER",
    "MANAGE_SETTINGS",
    "MANAGE_STAFF",
    "MANAGE_ROLES",
    "MANAGE_BILLING",
    "MANAGE_INVENTORY",
    "MANAGE_CUSTOMERS",
    "MANAGE_OFFERS",
    "MANAGE_ONLINE_SHOP",
    "REFUND_ORDERS",
];
/** Classify system Waiter templates. Custom roles are not matched. */
function waiterSystemKind(name) {
    const n = name.trim().toLowerCase();
    if (!n.startsWith("waiter"))
        return null;
    if (n.includes("menu"))
        return "menu-editor";
    return "pos-only";
}
function waiterBlockedPermissions(_kind) {
    // Menu (MANAGE_PRODUCTS) and Orders (VIEW_ORDER_HISTORY) are assigned in Roles.
    return [...WAITER_PRIVILEGED_BLOCKED];
}
//# sourceMappingURL=permissions.js.map