/** POS + panel permissions (aligned with Android PosPermission + panel extras). */
export declare const PERMISSIONS: readonly ["USE_POS", "USE_WEBPOS", "PROCESS_PAYMENTS", "APPLY_DISCOUNTS", "OPEN_CASH_DRAWER", "SEND_KITCHEN", "MANAGE_TABLES", "TAKEAWAY_ORDERS", "DELIVERY_ORDERS", "VIEW_DELIVERY_TRACKING", "VIEW_ORDER_HISTORY", "CANCEL_ORDERS", "REFUND_ORDERS", "VIEW_REPORTS", "VIEW_ALL_SALES", "MANAGE_PRODUCTS", "MANAGE_CUSTOMERS", "MANAGE_OFFERS", "MANAGE_ONLINE_SHOP", "MANAGE_SETTINGS", "ACCESS_PANEL", "MANAGE_STAFF", "MANAGE_ROLES", "MANAGE_BILLING", "END_OF_DAY", "MANAGE_INVENTORY"];
export type Permission = (typeof PERMISSIONS)[number];
export declare function parsePermissions(raw?: string | null): Permission[];
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
 * Map panel/web permission keys → Android PosPermission names used by Chaslay POS.
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
export declare function waiterBlockedPermissions(_kind: WaiterSystemKind): Permission[];
//# sourceMappingURL=permissions.d.ts.map