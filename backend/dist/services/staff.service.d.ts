import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { type StaffLoginHome } from "@/lib/staff-login-home";
/** Default POS PIN for the first manager provisioned on new merchant signup. Change in Users & roles. */
export declare const DEFAULT_MANAGER_PIN = "0000";
export declare function invalidateDefaultRolesCache(merchantId: string): void;
export declare class StaffService {
    /** Staff row exists with a POS PIN but no email/password hash for /login. */
    static readonly PIN_ONLY_LOGIN_MESSAGE = "This account uses a POS PIN. Sign in on the POS with your PIN, or ask the owner to set an official login password in Users & roles.";
    /** Staff email exists but password was never hashed (must be set again). */
    static readonly NO_PASSWORD_LOGIN_MESSAGE = "This staff account has no official login password. Ask the owner to set one in Users & roles.";
    static readonly NO_ENTRY_PERMISSION_MESSAGE = "This account cannot sign in";
    static isLoginGuidanceError(message: string): boolean;
    static ensureDefaultRoles(merchantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        permissions: string;
        isSystem: boolean;
        sortOrder: number;
    }[]>;
    /**
     * Provision the merchant's first Manager staff row (POS PIN + full panel role).
     * Idempotent: skips when any staff already exist.
     * Default PIN is 0000 (stored for display in Users & roles).
     */
    static ensureDefaultManagerStaff(merchantId: string, displayName: string): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_WEBPOS" | "MANAGE_TABLES" | "STOREKEEPER_INTAKE" | "DELIVERY_ORDERS" | "ACCESS_PANEL" | "MANAGE_PRODUCTS" | "MANAGE_INVENTORY" | "VIEW_ORDER_HISTORY" | "MANAGE_KIOSK" | "USE_POS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "TAKEAWAY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "GANDOLA_PURGE" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY")[];
        canAccessPanel: boolean;
        isActive: boolean;
        pinSet: boolean;
        pin: string | null;
        passwordSet: boolean;
        loginHome: StaffLoginHome;
    } | null>;
    /**
     * Ensure a Manager staff row exists and has the default POS PIN (0000) when unset.
     * Repairs older merchants that had staff before auto-provisioning existed.
     */
    static ensureManagerPosPin(merchantId: string): Promise<void>;
    private static normalizePinInput;
    private static assignStaffPin;
    /** Re-seed the Storekeeper system role if it was deleted or stripped. */
    static ensureStorekeeperSystemRole(merchantId: string): Promise<void>;
    /** Remove deprecated gandola system role; reassign staff to Manager when possible. */
    static removeGandolaSystemRole(merchantId: string): Promise<void>;
    /** Grant GANDOLA_PURGE to system Manager roles (cash order purge via search 5× tap). */
    static ensureManagerGandolaPurge(merchantId: string): Promise<void>;
    /** Grant VIEW_ALL_SALES to system Manager roles that already have company report access. */
    static ensureManagerViewAllSales(merchantId: string): Promise<void>;
    /** @deprecated use enforceWaiterFloorRestrictions */
    static enforceWaiterReportRestrictions(merchantId: string): Promise<void>;
    /**
     * Align floor-waiter login home. Do not rewrite role permissions — merchants
     * can grant extra access on Users & roles and those checkboxes must persist.
     */
    static enforceWaiterFloorRestrictions(merchantId: string): Promise<void>;
    /** Floor waiters should land on POS/waiter screen, not merchant panel. */
    static syncFloorWaiterLoginHome(merchantId: string): Promise<void>;
    /** Storekeeper staff should use the mobile intake app, not the merchant panel. */
    static syncStorekeeperLoginHome(merchantId: string): Promise<void>;
    /** Cashiers and other register-first staff should land on WebPOS after email login. */
    static syncCashierLoginHome(merchantId: string): Promise<void>;
    /** Restore Cashier system role permissions (USE_WEBPOS, etc.) if stripped in older installs. */
    static ensureCashierRolePermissions(merchantId: string): Promise<void>;
    /**
     * Strip full panel access from the system Storekeeper role.
     * Mobile intake only — inventory managers should use a different role.
     */
    static enforceStorekeeperPanelRestrictions(merchantId: string): Promise<void>;
    static listRoles(merchantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        permissions: string;
        isSystem: boolean;
        sortOrder: number;
    }[]>;
    static updateRole(merchantId: string, roleId: string, updates: {
        name?: string;
        permissions?: Permission[];
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        permissions: string;
        isSystem: boolean;
        sortOrder: number;
    }>;
    static createRole(merchantId: string, name: string, permissions: Permission[]): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        permissions: string;
        isSystem: boolean;
        sortOrder: number;
    }>;
    static deleteRole(merchantId: string, roleId: string): Promise<void>;
    /** Re-create the default manager when a merchant has zero staff (recovery after accidental deletes). */
    static ensureMerchantHasStaff(merchantId: string): Promise<void>;
    static listStaff(merchantId: string): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_WEBPOS" | "MANAGE_TABLES" | "STOREKEEPER_INTAKE" | "DELIVERY_ORDERS" | "ACCESS_PANEL" | "MANAGE_PRODUCTS" | "MANAGE_INVENTORY" | "VIEW_ORDER_HISTORY" | "MANAGE_KIOSK" | "USE_POS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "TAKEAWAY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "GANDOLA_PURGE" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY")[];
        canAccessPanel: boolean;
        isActive: boolean;
        pinSet: boolean;
        pin: string | null;
        passwordSet: boolean;
        deliveryHourlyRateOverride: string | null;
        deliveryPerOrderFeeOverride: string | null;
        loginHome: StaffLoginHome;
        createdAt: Date;
    }[]>;
    static createStaff(merchantId: string, input: {
        name: string;
        roleId: string;
        pin?: string;
        email?: string;
        password?: string;
        canAccessPanel?: boolean;
        loginHome?: StaffLoginHome;
    }): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_WEBPOS" | "MANAGE_TABLES" | "STOREKEEPER_INTAKE" | "DELIVERY_ORDERS" | "ACCESS_PANEL" | "MANAGE_PRODUCTS" | "MANAGE_INVENTORY" | "VIEW_ORDER_HISTORY" | "MANAGE_KIOSK" | "USE_POS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "TAKEAWAY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "GANDOLA_PURGE" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY")[];
        canAccessPanel: boolean;
        isActive: boolean;
        pinSet: boolean;
        pin: string | null;
        passwordSet: boolean;
        loginHome: StaffLoginHome;
    }>;
    static updateStaff(merchantId: string, staffId: string, input: {
        name?: string;
        roleId?: string;
        pin?: string | null;
        email?: string | null;
        password?: string | null;
        canAccessPanel?: boolean;
        isActive?: boolean;
        deliveryHourlyRateOverride?: number | null;
        deliveryPerOrderFeeOverride?: number | null;
        loginHome?: StaffLoginHome;
    }): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_WEBPOS" | "MANAGE_TABLES" | "STOREKEEPER_INTAKE" | "DELIVERY_ORDERS" | "ACCESS_PANEL" | "MANAGE_PRODUCTS" | "MANAGE_INVENTORY" | "VIEW_ORDER_HISTORY" | "MANAGE_KIOSK" | "USE_POS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "TAKEAWAY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "GANDOLA_PURGE" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY")[];
        canAccessPanel: boolean;
        isActive: boolean;
        pinSet: boolean;
        pin: string | null;
        passwordSet: boolean;
        loginHome: StaffLoginHome;
    }>;
    private static assertPinUnique;
    static deleteStaff(merchantId: string, staffId: string): Promise<void>;
    static verifyPin(merchantId: string, pin: string): Promise<{
        id: string;
        name: string;
        roleId: string;
        roleName: string;
        permissions: ("USE_WEBPOS" | "MANAGE_TABLES" | "STOREKEEPER_INTAKE" | "DELIVERY_ORDERS" | "ACCESS_PANEL" | "MANAGE_PRODUCTS" | "MANAGE_INVENTORY" | "VIEW_ORDER_HISTORY" | "MANAGE_KIOSK" | "USE_POS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "TAKEAWAY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "GANDOLA_PURGE" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY")[];
        preferredTerminalId: string | null;
        accessToken: string;
        /** Android PosPermission-compatible keys for clients that consume this payload. */
        androidPermissions: string[];
    }>;
    /** Fresh staff profile for session refresh (panel / WebPOS after role change). */
    static getStaffProfile(merchantId: string, staffId: string): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_WEBPOS" | "MANAGE_TABLES" | "STOREKEEPER_INTAKE" | "DELIVERY_ORDERS" | "ACCESS_PANEL" | "MANAGE_PRODUCTS" | "MANAGE_INVENTORY" | "VIEW_ORDER_HISTORY" | "MANAGE_KIOSK" | "USE_POS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "TAKEAWAY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "GANDOLA_PURGE" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY")[];
        canAccessPanel: boolean;
        loginHome: StaffLoginHome;
        preferredTerminalId: string | null;
    }>;
    /** Waiter / cashier saves their preferred payment terminal for WebPOS. */
    static updatePosPreferences(merchantId: string, staffId: string, prefs: {
        preferredTerminalId?: string | null;
    }): Promise<{
        preferredTerminalId: string | null;
    }>;
    static loginStaff(email: string, password: string): Promise<{
        staff: {
            id: string;
            merchantId: string;
            roleId: string;
            name: string;
            email: string | null;
            pinHash: string | null;
            pinDisplay: string | null;
            passwordHash: string | null;
            canAccessPanel: boolean;
            loginHome: string;
            preferredTerminalId: string | null;
            deliveryHourlyRateOverride: string | null;
            deliveryPerOrderFeeOverride: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        role: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            permissions: string;
            isSystem: boolean;
            sortOrder: number;
        } | undefined;
        permissions: ("USE_WEBPOS" | "MANAGE_TABLES" | "STOREKEEPER_INTAKE" | "DELIVERY_ORDERS" | "ACCESS_PANEL" | "MANAGE_PRODUCTS" | "MANAGE_INVENTORY" | "VIEW_ORDER_HISTORY" | "MANAGE_KIOSK" | "USE_POS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "TAKEAWAY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "GANDOLA_PURGE" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY")[];
    }>;
    static getSyncPayload(merchantId: string): Promise<{
        roles: {
            id: string;
            name: string;
            permissions: string[];
            isSystem: boolean;
        }[];
        staff: {
            id: string;
            name: string;
            roleId: string;
            pinHash: string | null;
            isActive: boolean;
        }[];
    }>;
    private static formatStaff;
}
export { ALL_PERMISSIONS };
//# sourceMappingURL=staff.service.d.ts.map