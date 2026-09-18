"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FULL_PANEL_PERMISSIONS = exports.STAFF_MERCHANT_ENTRY_PERMISSIONS = exports.PANEL_ROUTE_PERMISSIONS = exports.ANDROID_PERMISSION_ALIASES = exports.DEFAULT_ROLE_TEMPLATES = exports.ALL_PERMISSIONS = exports.PERMISSIONS = void 0;
exports.parsePermissions = parsePermissions;
exports.normalizePermissions = normalizePermissions;
exports.encodePermissions = encodePermissions;
exports.hasPermission = hasPermission;
exports.hasAnyPermission = hasAnyPermission;
exports.toAndroidPermissions = toAndroidPermissions;
exports.waiterSystemKind = waiterSystemKind;
exports.waiterBlockedPermissions = waiterBlockedPermissions;
exports.storekeeperBlockedPermissions = storekeeperBlockedPermissions;
exports.hasFullPanelAccess = hasFullPanelAccess;
exports.isWaiterRestrictedStaff = isWaiterRestrictedStaff;
exports.isWaiterPanelPath = isWaiterPanelPath;
exports.waiterRestrictedHomePath = waiterRestrictedHomePath;
exports.applyRolePermissionPolicy = applyRolePermissionPolicy;
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
    "VIEW_DELIVERY_TRACKING",
    "VIEW_ORDER_HISTORY",
    "CANCEL_ORDERS",
    "REFUND_ORDERS",
    "VIEW_REPORTS",
    /** See company-wide / all-staff sales in reports and EOD (without this = own sales only). */
    "VIEW_ALL_SALES",
    /** Permanently remove completed cash sales from POS history and reports (gandola role). */
    "GANDOLA_PURGE",
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
    "STOREKEEPER_INTAKE",
    "MANAGE_KIOSK",
];
function parsePermissions(raw) {
    if (!raw)
        return [];
    const seen = new Set();
    for (const part of raw.split(",")) {
        const key = part.trim();
        if (exports.PERMISSIONS.includes(key)) {
            seen.add(key);
        }
    }
    return exports.PERMISSIONS.filter((p) => seen.has(p));
}
/**
 * Accept the role-editor payload (array or comma-separated string) and keep only
 * known permission keys. Unknown keys are dropped; known keys are not rewritten.
 */
function normalizePermissions(input) {
    if (input == null)
        return [];
    if (Array.isArray(input)) {
        return parsePermissions(input
            .map((v) => String(v ?? "").trim())
            .filter(Boolean)
            .join(","));
    }
    if (typeof input === "string")
        return parsePermissions(input);
    return [];
}
function encodePermissions(perms) {
    const set = new Set(perms);
    return exports.PERMISSIONS.filter((p) => set.has(p)).join(",");
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
            "VIEW_DELIVERY_TRACKING",
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
            "GANDOLA_PURGE",
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
            "MANAGE_PRODUCTS",
        ],
    },
    {
        name: "Delivery",
        isSystem: true,
        sortOrder: 30,
        permissions: ["DELIVERY_ORDERS"],
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
    {
        /** Self-order kiosk setup — sliders, payments, launch customer mode. No full panel. */
        name: "Kiosk operator",
        isSystem: true,
        sortOrder: 56,
        permissions: ["MANAGE_KIOSK"],
    },
    {
        /** Handheld / Chrome order center PWA — live online orders, print, daily summary. No panel. */
        name: "Order center operator",
        isSystem: true,
        sortOrder: 57,
        permissions: ["VIEW_ORDER_HISTORY", "END_OF_DAY"],
    },
    {
        /** Mobile stock intake — scan barcodes, receive stock, expiry lots. No full panel. */
        name: "Storekeeper",
        isSystem: true,
        sortOrder: 55,
        permissions: ["STOREKEEPER_INTAKE"],
    },
];
/**
 * Map panel/web permission keys → Android PosPermission names used by Reborn POS.
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
    "/merchant/chaslay-page-builder": ["MANAGE_ONLINE_SHOP"],
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
    "/merchant/storekeeper": ["STOREKEEPER_INTAKE", "MANAGE_INVENTORY"],
    "/merchant/kiosk": ["MANAGE_KIOSK", "MANAGE_SETTINGS"],
    "/merchant/order-center": ["VIEW_ORDER_HISTORY"],
    "/merchant/order-hub": ["VIEW_ORDER_HISTORY"],
};
/** Staff JWT may enter merchant APIs with any of these (POS, waiter, catalog, or full panel). */
exports.STAFF_MERCHANT_ENTRY_PERMISSIONS = [
    "ACCESS_PANEL",
    "USE_WEBPOS",
    "USE_POS",
    "MANAGE_PRODUCTS",
    "MANAGE_TABLES",
    "SEND_KITCHEN",
    "MANAGE_INVENTORY",
    "STOREKEEPER_INTAKE",
    "DELIVERY_ORDERS",
    "VIEW_DELIVERY_TRACKING",
    "MANAGE_KIOSK",
    "VIEW_ORDER_HISTORY",
];
const WAITER_PRIVILEGED_BLOCKED = [
    "VIEW_REPORTS",
    "VIEW_ALL_SALES",
    "GANDOLA_PURGE",
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
    "CANCEL_ORDERS",
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
function waiterBlockedPermissions(kind) {
    const blocked = [...WAITER_PRIVILEGED_BLOCKED];
    if (kind === "pos-only") {
        blocked.push("MANAGE_PRODUCTS", "VIEW_ORDER_HISTORY");
    }
    return blocked;
}
const STOREKEEPER_PRIVILEGED_BLOCKED = [
    "ACCESS_PANEL",
    "VIEW_REPORTS",
    "VIEW_ALL_SALES",
    "GANDOLA_PURGE",
    "MANAGE_STAFF",
    "MANAGE_ROLES",
    "MANAGE_BILLING",
    "MANAGE_SETTINGS",
    "MANAGE_CUSTOMERS",
    "MANAGE_OFFERS",
    "MANAGE_ONLINE_SHOP",
    "MANAGE_PRODUCTS",
    "VIEW_ORDER_HISTORY",
    "USE_WEBPOS",
    "USE_POS",
    "PROCESS_PAYMENTS",
    "APPLY_DISCOUNTS",
    "OPEN_CASH_DRAWER",
    "SEND_KITCHEN",
    "MANAGE_TABLES",
    "TAKEAWAY_ORDERS",
    "DELIVERY_ORDERS",
    "VIEW_DELIVERY_TRACKING",
    "CANCEL_ORDERS",
    "REFUND_ORDERS",
    "END_OF_DAY",
    "MANAGE_INVENTORY",
];
function storekeeperBlockedPermissions() {
    return [...STOREKEEPER_PRIVILEGED_BLOCKED];
}
/** Full merchant panel (Sales overview, CMS, users, billing) — not catalog/orders-only. */
exports.FULL_PANEL_PERMISSIONS = [
    "ACCESS_PANEL",
    "VIEW_REPORTS",
    "MANAGE_SETTINGS",
    "MANAGE_STAFF",
    "MANAGE_BILLING",
    "MANAGE_CUSTOMERS",
    "MANAGE_ONLINE_SHOP",
    "MANAGE_OFFERS",
    "MANAGE_INVENTORY",
    "MANAGE_ROLES",
    "VIEW_ALL_SALES",
    "END_OF_DAY",
];
function hasFullPanelAccess(granted, isOwner = false) {
    if (isOwner)
        return true;
    return exports.FULL_PANEL_PERMISSIONS.some((p) => hasPermission(granted, p));
}
/**
 * Floor waiters (system Waiter templates) without ACCESS_PANEL — POS/waiter app
 * and optional menu/orders, never CMS, inventory, settings, or clients.
 */
function isWaiterRestrictedStaff(granted, isOwner = false) {
    if (isOwner)
        return false;
    if (!hasPermission(granted, "MANAGE_TABLES"))
        return false;
    if (hasPermission(granted, "ACCESS_PANEL"))
        return false;
    return !hasFullPanelAccess(granted, false);
}
function isWaiterPanelPath(pathname, granted) {
    const path = pathname.replace(/\/$/, "") || "/merchant";
    if (path === "/merchant/waiter" || path.startsWith("/merchant/waiter/"))
        return true;
    if (path === "/merchant/pos" || path.startsWith("/merchant/pos/"))
        return true;
    if (hasPermission(granted, "MANAGE_PRODUCTS")) {
        if (path === "/merchant/products" ||
            path.startsWith("/merchant/products/") ||
            path === "/merchant/categories" ||
            path.startsWith("/merchant/categories/") ||
            path === "/merchant/modifiers" ||
            path.startsWith("/merchant/modifiers/")) {
            return true;
        }
    }
    if (hasPermission(granted, "VIEW_ORDER_HISTORY")) {
        if (path === "/merchant/orders" || path.startsWith("/merchant/orders/"))
            return true;
    }
    return false;
}
function waiterRestrictedHomePath(granted) {
    if (hasPermission(granted, "MANAGE_PRODUCTS"))
        return "/merchant/products";
    if (hasPermission(granted, "VIEW_ORDER_HISTORY"))
        return "/merchant/orders";
    if (hasPermission(granted, "MANAGE_TABLES"))
        return "/merchant/waiter";
    return "/merchant/pos";
}
/**
 * Runtime policy for issued JWTs / staff sessions.
 * Storekeeper stays locked to intake. Waiter templates keep merchant-saved
 * permissions so Users & roles checkboxes round-trip to the database.
 */
function applyRolePermissionPolicy(roleName, permissions) {
    if (roleName.trim().toLowerCase() === "storekeeper") {
        const blocked = new Set(storekeeperBlockedPermissions());
        return permissions.filter((p) => !blocked.has(p));
    }
    return permissions;
}
//# sourceMappingURL=permissions.js.map