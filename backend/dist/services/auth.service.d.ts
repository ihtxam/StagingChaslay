export interface JWTPayload {
    id: string;
    email: string;
    role: "superadmin" | "merchant" | "customer" | "staff" | "reseller";
    merchantId?: string;
    customerId?: string;
    staffId?: string;
    resellerId?: string;
    name?: string;
    roleName?: string;
    permissions?: string[];
    /** Set when a superadmin opens a merchant or reseller panel */
    impersonatedBy?: string;
}
export declare class AuthService {
    private static readonly SALT_ROUNDS;
    private static readonly JWT_SECRET;
    private static readonly JWT_EXPIRY;
    /**
     * Hash a password
     */
    static hashPassword(password: string): Promise<string>;
    /**
     * Compare password with hash
     */
    static comparePassword(password: string, hash: string): Promise<boolean>;
    /**
     * Generate JWT token
     */
    static generateToken(payload: JWTPayload): string;
    /**
     * Verify JWT token
     */
    static verifyToken(token: string): JWTPayload;
    /**
     * Register a new merchant
     */
    static registerMerchant(email: string, password: string, name: string, businessName: string): Promise<{
        id: string;
        email: string;
        name: string;
    }>;
    /**
     * Login merchant owner or staff with panel access
     */
    static loginMerchant(email: string, password: string): Promise<{
        token: string;
        merchant: {
            id: string;
            email: string;
            name: string;
            status: string;
            roleName: string;
            inventoryAddonEnabled: boolean;
            inventoryEnabled: boolean;
            signageAddonEnabled: boolean;
            signageEnabled: boolean;
            signageScreenLimit: number;
        };
        isOwner: boolean;
    } | {
        token: string;
        merchant: {
            id: string;
            email: string;
            name: string;
            status: string;
            staffId: string;
            roleName: string | undefined;
            permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY")[];
            inventoryAddonEnabled: boolean;
            inventoryEnabled: boolean;
            signageAddonEnabled: boolean;
            signageEnabled: boolean;
            signageScreenLimit: number;
        };
        isOwner: boolean;
    }>;
    static loginMerchantOwner(email: string, password: string): Promise<{
        token: string;
        merchant: {
            id: string;
            email: string;
            name: string;
            status: string;
            roleName: string;
            inventoryAddonEnabled: boolean;
            inventoryEnabled: boolean;
            signageAddonEnabled: boolean;
            signageEnabled: boolean;
            signageScreenLimit: number;
        };
        isOwner: boolean;
    }>;
    static loginMerchantStaff(email: string, password: string): Promise<{
        token: string;
        merchant: {
            id: string;
            email: string;
            name: string;
            status: string;
            staffId: string;
            roleName: string | undefined;
            permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY")[];
            inventoryAddonEnabled: boolean;
            inventoryEnabled: boolean;
            signageAddonEnabled: boolean;
            signageEnabled: boolean;
            signageScreenLimit: number;
        };
        isOwner: boolean;
    }>;
    /**
     * Register superadmin
     */
    static registerSuperadmin(email: string, password: string, name: string): Promise<{
        id: string;
        email: string;
        name: string;
    }>;
    /**
     * Unified panel login — merchant owner → staff → reseller → superadmin.
     * Does not replace PIN WebPOS or waiter PIN.
     */
    static loginAny(email: string, password: string): Promise<{
        kind: "merchant";
        token: string;
        merchant: {
            id: string;
            email: string;
            name: string;
            status: string;
            roleName: string;
            inventoryAddonEnabled: boolean;
            inventoryEnabled: boolean;
            signageAddonEnabled: boolean;
            signageEnabled: boolean;
            signageScreenLimit: number;
        };
        isOwner: boolean;
        reseller?: undefined;
        superadmin?: undefined;
    } | {
        kind: "staff";
        token: string;
        merchant: {
            id: string;
            email: string;
            name: string;
            status: string;
            staffId: string;
            roleName: string | undefined;
            permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY")[];
            inventoryAddonEnabled: boolean;
            inventoryEnabled: boolean;
            signageAddonEnabled: boolean;
            signageEnabled: boolean;
            signageScreenLimit: number;
        };
        isOwner: boolean;
        reseller?: undefined;
        superadmin?: undefined;
    } | {
        kind: "reseller";
        token: string;
        reseller: {
            id: string;
            email: string;
            name: string;
            role: "reseller";
        };
        merchant?: undefined;
        isOwner?: undefined;
        superadmin?: undefined;
    } | {
        kind: "superadmin";
        token: string;
        superadmin: {
            id: string;
            email: string;
            name: string;
        };
        merchant?: undefined;
        isOwner?: undefined;
        reseller?: undefined;
    }>;
    /**
     * Login superadmin
     */
    static loginSuperadmin(email: string, password: string): Promise<{
        token: string;
        superadmin: {
            id: string;
            email: string;
            name: string;
        };
    }>;
    /**
     * Issue a merchant JWT so a superadmin can open that merchant's panel.
     */
    static impersonateMerchant(superadminId: string, merchantId: string): Promise<{
        token: string;
        merchant: {
            id: string;
            email: string;
            name: string;
            status: string;
            inventoryAddonEnabled: boolean;
            inventoryEnabled: boolean;
            signageAddonEnabled: boolean;
            signageEnabled: boolean;
            signageScreenLimit: number;
        };
        impersonatedBy: string;
    }>;
    /**
     * Verify merchant email (for password reset, etc.)
     */
    static getMerchantById(merchantId: string): Promise<{
        id: string;
        email: string;
        name: string;
        status: string;
        inventoryAddonEnabled: boolean;
        inventoryEnabled: boolean;
        signageAddonEnabled: boolean;
        signageEnabled: boolean;
        signageScreenLimit: number;
    }>;
    /**
     * Update merchant password
     */
    static updateMerchantPassword(merchantId: string, newPassword: string): Promise<{
        success: boolean;
    }>;
    /**
     * Temporary login-page password reset (merchants / staff / superadmin by email).
     * Disable with ALLOW_LOGIN_PASSWORD_RESET=0.
     */
    static resetLoginPasswordByEmail(role: "merchant" | "staff" | "superadmin" | "reseller", email: string, newPassword: string): Promise<{
        success: boolean;
        role: "merchant";
        email: string;
    } | {
        success: boolean;
        role: "staff";
        email: string;
    } | {
        success: boolean;
        role: "superadmin";
        email: string;
    } | {
        success: boolean;
        role: "reseller";
        email: string;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map