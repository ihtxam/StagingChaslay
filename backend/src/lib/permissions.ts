/** POS + panel permissions (aligned with Android PosPermission + panel extras). */
export const PERMISSIONS = [
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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function parsePermissions(raw?: string | null): Permission[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Permission => (PERMISSIONS as readonly string[]).includes(s));
}

export function encodePermissions(perms: Permission[]): string {
  return [...new Set(perms)].join(",");
}

export function hasPermission(granted: readonly string[] | undefined, required: Permission): boolean {
  if (!granted) return false;
  return granted.includes(required);
}

export function hasAnyPermission(granted: readonly string[] | undefined, required: readonly Permission[]): boolean {
  if (!granted?.length) return false;
  return required.some((p) => granted.includes(p));
}

/** Merchant owner (login via merchants table) implicitly has all permissions. */
export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

export type DefaultRoleTemplate = {
  name: string;
  permissions: Permission[];
  isSystem: boolean;
  sortOrder: number;
};

export const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
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
];

/**
 * Map panel/web permission keys → Android PosPermission names used by Reborn POS.
 * Unknown keys are dropped so Room sync only stores enums the app understands.
 */
export const ANDROID_PERMISSION_ALIASES: Record<string, string> = {
  ACCESS_PANEL: "ACCESS_SETTINGS",
  MANAGE_SETTINGS: "ACCESS_SETTINGS",
  MANAGE_STAFF: "MANAGE_USERS",
  USE_WEBPOS: "USE_POS",
};

export function toAndroidPermissions(perms: Permission[] | string[]): string[] {
  const out = new Set<string>();
  for (const raw of perms) {
    const key = String(raw || "").trim();
    if (!key) continue;
    const mapped = ANDROID_PERMISSION_ALIASES[key] || key;
    out.add(mapped);
  }
  return [...out];
}

/** Panel sidebar route → required permission (any match grants access). */
export const PANEL_ROUTE_PERMISSIONS: Record<string, Permission[]> = {
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
  "/merchant/storekeeper": ["STOREKEEPER_INTAKE", "MANAGE_INVENTORY"],
  "/merchant/kiosk": ["MANAGE_KIOSK", "MANAGE_SETTINGS"],
};

/** Staff JWT may enter merchant APIs with any of these (POS, waiter, catalog, or full panel). */
export const STAFF_MERCHANT_ENTRY_PERMISSIONS: Permission[] = [
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
];

const WAITER_PRIVILEGED_BLOCKED: Permission[] = [
  "VIEW_REPORTS",
  "VIEW_ALL_SALES",
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

export type WaiterSystemKind = "pos-only" | "menu-editor";

/** Classify system Waiter templates. Custom roles are not matched. */
export function waiterSystemKind(name: string): WaiterSystemKind | null {
  const n = name.trim().toLowerCase();
  if (!n.startsWith("waiter")) return null;
  if (n.includes("menu")) return "menu-editor";
  return "pos-only";
}

export function waiterBlockedPermissions(kind: WaiterSystemKind): Permission[] {
  const blocked = [...WAITER_PRIVILEGED_BLOCKED];
  if (kind === "pos-only") {
    blocked.push("MANAGE_PRODUCTS", "VIEW_ORDER_HISTORY");
  }
  return blocked;
}

const STOREKEEPER_PRIVILEGED_BLOCKED: Permission[] = [
  "ACCESS_PANEL",
  "VIEW_REPORTS",
  "VIEW_ALL_SALES",
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

export function storekeeperBlockedPermissions(): Permission[] {
  return [...STOREKEEPER_PRIVILEGED_BLOCKED];
}

/** Full merchant panel (Sales overview, CMS, users, billing) — not catalog/orders-only. */
export const FULL_PANEL_PERMISSIONS: Permission[] = [
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

export function hasFullPanelAccess(
  granted: readonly string[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return true;
  return FULL_PANEL_PERMISSIONS.some((p) => hasPermission(granted, p));
}

/**
 * Floor waiters (system Waiter templates) without ACCESS_PANEL — POS/waiter app
 * and optional menu/orders, never CMS, inventory, settings, or clients.
 */
export function isWaiterRestrictedStaff(
  granted: readonly string[] | undefined,
  isOwner = false
): boolean {
  if (isOwner) return false;
  if (!hasPermission(granted, "MANAGE_TABLES")) return false;
  if (hasPermission(granted, "ACCESS_PANEL")) return false;
  return !hasFullPanelAccess(granted, false);
}

export function isWaiterPanelPath(pathname: string, granted: readonly string[] | undefined): boolean {
  const path = pathname.replace(/\/$/, "") || "/merchant";
  if (path === "/merchant/waiter" || path.startsWith("/merchant/waiter/")) return true;
  if (path === "/merchant/pos" || path.startsWith("/merchant/pos/")) return true;
  if (hasPermission(granted, "MANAGE_PRODUCTS")) {
    if (
      path === "/merchant/products" ||
      path.startsWith("/merchant/products/") ||
      path === "/merchant/categories" ||
      path.startsWith("/merchant/categories/") ||
      path === "/merchant/modifiers" ||
      path.startsWith("/merchant/modifiers/")
    ) {
      return true;
    }
  }
  if (hasPermission(granted, "VIEW_ORDER_HISTORY")) {
    if (path === "/merchant/orders" || path.startsWith("/merchant/orders/")) return true;
  }
  return false;
}

export function waiterRestrictedHomePath(granted: readonly string[] | undefined): string {
  if (hasPermission(granted, "MANAGE_PRODUCTS")) return "/merchant/products";
  if (hasPermission(granted, "VIEW_ORDER_HISTORY")) return "/merchant/orders";
  if (hasPermission(granted, "MANAGE_TABLES")) return "/merchant/waiter";
  return "/merchant/pos";
}

/** Strip privileged permissions from system Waiter roles before issuing JWTs. */
export function applyRolePermissionPolicy(roleName: string, permissions: Permission[]): Permission[] {
  const kind = waiterSystemKind(roleName);
  if (kind) {
    const blocked = new Set(waiterBlockedPermissions(kind));
    return permissions.filter((p) => !blocked.has(p));
  }
  if (roleName.trim().toLowerCase() === "storekeeper") {
    const blocked = new Set(storekeeperBlockedPermissions());
    return permissions.filter((p) => !blocked.has(p));
  }
  return permissions;
}
