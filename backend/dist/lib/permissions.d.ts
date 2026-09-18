/** POS + panel permissions (aligned with Android PosPermission + panel extras). */
export declare const PERMISSIONS: readonly ["USE_POS", "USE_WEBPOS", "PROCESS_PAYMENTS", "APPLY_DISCOUNTS", "OPEN_CASH_DRAWER", "SEND_KITCHEN", "MANAGE_TABLES", "TAKEAWAY_ORDERS", "DELIVERY_ORDERS", "VIEW_DELIVERY_TRACKING", "VIEW_ORDER_HISTORY", "CANCEL_ORDERS", "REFUND_ORDERS", "VIEW_REPORTS", "VIEW_ALL_SALES", "GANDOLA_PURGE", "MANAGE_PRODUCTS", "MANAGE_CUSTOMERS", "MANAGE_OFFERS", "MANAGE_ONLINE_SHOP", "MANAGE_SETTINGS", "ACCESS_PANEL", "MANAGE_STAFF", "MANAGE_ROLES", "MANAGE_BILLING", "END_OF_DAY", "MANAGE_INVENTORY", "STOREKEEPER_INTAKE", "MANAGE_KIOSK"];
export type Permission = (typeof PERMISSIONS)[number];
export declare function parsePermissions(raw?: string | null): Permission[];
/**
 * Accept the role-editor payload (array or comma-separated string) and keep only
 * known permission keys. Unknown keys are dropped; known keys are not rewritten.
 */
export declare function normalizePermissions(input: unknown): Permission[];
export declare function encodePermissions(perms: Permission[]): string;
export declare function hasPermission(granted: readonly string[] | undefined, required: Permission): boolean;
export declare function hasAnyPermission(granted: readonly string[] | undefined, required: readonly Permission[]): boolean;
/** Merchant owner (login via merchants table) implicitly has all permissions. */
export declare const ALL_PERMISSIONS: Permission[];
export type DefaultRoleTemplate = {
    name: string;
    permissions: Permission[];
    isSystem: boolean;
    sortOrder: number;
};
export declare const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[];
/**
 * Map panel/web permission keys → Android PosPermission names used by Reborn POS.
 * Unknown keys are dropped so Room sync only stores enums the app understands.
 */
export declare const ANDROID_PERMISSION_ALIASES: Record<string, string>;
export declare function toAndroidPermissions(perms: Permission[] | string[]): string[];
/** Panel sidebar route → required permission (any match grants access). */
export declare const PANEL_ROUTE_PERMISSIONS: Record<string, Permission[]>;
/** Staff JWT may enter merchant APIs with any of these (POS, waiter, catalog, or full panel). */
export declare const STAFF_MERCHANT_ENTRY_PERMISSIONS: Permission[];
export type WaiterSystemKind = "pos-only" | "menu-editor";
/** Classify system Waiter templates. Custom roles are not matched. */
export declare function waiterSystemKind(name: string): WaiterSystemKind | null;
export declare function waiterBlockedPermissions(kind: WaiterSystemKind): Permission[];
export declare function storekeeperBlockedPermissions(): Permission[];
/** Full merchant panel (Sales overview, CMS, users, billing) — not catalog/orders-only. */
export declare const FULL_PANEL_PERMISSIONS: Permission[];
export declare function hasFullPanelAccess(granted: readonly string[] | undefined, isOwner?: boolean): boolean;
/**
 * Floor waiters (system Waiter templates) without ACCESS_PANEL — POS/waiter app
 * and optional menu/orders, never CMS, inventory, settings, or clients.
 */
export declare function isWaiterRestrictedStaff(granted: readonly string[] | undefined, isOwner?: boolean): boolean;
export declare function isWaiterPanelPath(pathname: string, granted: readonly string[] | undefined): boolean;
export declare function waiterRestrictedHomePath(granted: readonly string[] | undefined): string;
/**
 * Runtime policy for issued JWTs / staff sessions.
 * Storekeeper stays locked to intake. Waiter templates keep merchant-saved
 * permissions so Users & roles checkboxes round-trip to the database.
 */
export declare function applyRolePermissionPolicy(roleName: string, permissions: Permission[]): Permission[];
//# sourceMappingURL=permissions.d.ts.map