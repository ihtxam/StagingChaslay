import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
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
    /** Grant VIEW_ALL_SALES to system Manager roles that already have company report access. */
    static ensureManagerViewAllSales(merchantId: string): Promise<void>;
    /** @deprecated use enforceWaiterFloorRestrictions */
    static enforceWaiterReportRestrictions(merchantId: string): Promise<void>;
    /**
     * Strip full panel / company sales from system Waiter templates.
     * Menu, orders, and own-sales EOD (END_OF_DAY) stay as assigned on the Roles page.
     */
    static enforceWaiterFloorRestrictions(merchantId: string): Promise<void>;
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
    static listStaff(merchantId: string): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY" | "STOREKEEPER_INTAKE")[];
        canAccessPanel: boolean;
        isActive: boolean;
        pinSet: boolean;
        passwordSet: boolean;
        deliveryHourlyRateOverride: string | null;
        deliveryPerOrderFeeOverride: string | null;
        createdAt: Date;
    }[]>;
    static createStaff(merchantId: string, input: {
        name: string;
        roleId: string;
        pin?: string;
        email?: string;
        password?: string;
        canAccessPanel?: boolean;
    }): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY" | "STOREKEEPER_INTAKE")[];
        canAccessPanel: boolean;
        isActive: boolean;
        pinSet: boolean;
        passwordSet: boolean;
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
    }): Promise<{
        id: string;
        name: string;
        email: string | null;
        roleId: string;
        roleName: string;
        permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY" | "STOREKEEPER_INTAKE")[];
        canAccessPanel: boolean;
        isActive: boolean;
        pinSet: boolean;
        passwordSet: boolean;
    }>;
    static deleteStaff(merchantId: string, staffId: string): Promise<void>;
    static verifyPin(merchantId: string, pin: string): Promise<{
        id: string;
        name: string;
        roleId: string;
        roleName: string;
        permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY" | "STOREKEEPER_INTAKE")[];
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
        permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY" | "STOREKEEPER_INTAKE")[];
        canAccessPanel: boolean;
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
            passwordHash: string | null;
            canAccessPanel: boolean;
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
        permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY" | "STOREKEEPER_INTAKE")[];
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