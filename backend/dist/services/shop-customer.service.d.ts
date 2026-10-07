export type SavedAddressInput = {
    label?: string;
    address: string;
    zipCode?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isDefault?: boolean;
};
export declare class ShopCustomerService {
    static register(merchantId: string, input: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
    }): Promise<{
        token: string;
        customer: {
            id: string;
            email: string | null;
            phone: string | null;
            firstName: string | null;
            lastName: string | null;
            name: string | null;
            defaultAddress: string | null;
            defaultZip: string | null;
            defaultCity: string | null;
            addresses: {
                id: string;
                label: string;
                address: string;
                zipCode: string | null;
                city: string | null;
                latitude: number | null;
                longitude: number | null;
                isDefault: boolean;
            }[];
            hasAccount: boolean;
            loyaltyPoints: number;
        };
    }>;
    static requestPasswordReset(merchantId: string, email: string): Promise<{
        success: boolean;
    }>;
    static login(merchantId: string, email: string, password: string): Promise<{
        token: string;
        customer: {
            id: string;
            email: string | null;
            phone: string | null;
            firstName: string | null;
            lastName: string | null;
            name: string | null;
            defaultAddress: string | null;
            defaultZip: string | null;
            defaultCity: string | null;
            addresses: {
                id: string;
                label: string;
                address: string;
                zipCode: string | null;
                city: string | null;
                latitude: number | null;
                longitude: number | null;
                isDefault: boolean;
            }[];
            hasAccount: boolean;
            loyaltyPoints: number;
        };
    }>;
    static getProfile(customerId: string, merchantId: string): Promise<{
        id: string;
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        name: string | null;
        defaultAddress: string | null;
        defaultZip: string | null;
        defaultCity: string | null;
        addresses: {
            id: string;
            label: string;
            address: string;
            zipCode: string | null;
            city: string | null;
            latitude: number | null;
            longitude: number | null;
            isDefault: boolean;
        }[];
        hasAccount: boolean;
        loyaltyPoints: number;
    }>;
    static updateProfile(customerId: string, merchantId: string, updates: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        defaultAddress?: string;
        defaultZip?: string;
        defaultCity?: string;
    }): Promise<{
        id: string;
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        name: string | null;
        defaultAddress: string | null;
        defaultZip: string | null;
        defaultCity: string | null;
        addresses: {
            id: string;
            label: string;
            address: string;
            zipCode: string | null;
            city: string | null;
            latitude: number | null;
            longitude: number | null;
            isDefault: boolean;
        }[];
        hasAccount: boolean;
        loyaltyPoints: number;
    }>;
    /** Ensure legacy default_* fields become a saved Home address once. */
    static ensureMigratedDefaultAddress(customerId: string, merchantId: string): Promise<void>;
    static listAddresses(customerId: string, merchantId: string): Promise<{
        id: string;
        label: string;
        address: string;
        zipCode: string | null;
        city: string | null;
        latitude: number | null;
        longitude: number | null;
        isDefault: boolean;
    }[]>;
    static createAddress(customerId: string, merchantId: string, input: SavedAddressInput): Promise<{
        id: string;
        label: string;
        address: string;
        zipCode: string | null;
        city: string | null;
        latitude: number | null;
        longitude: number | null;
        isDefault: boolean;
    }>;
    static updateAddress(customerId: string, merchantId: string, addressId: string, input: Partial<SavedAddressInput>): Promise<{
        id: string;
        label: string;
        address: string;
        zipCode: string | null;
        city: string | null;
        latitude: number | null;
        longitude: number | null;
        isDefault: boolean;
    }>;
    static deleteAddress(customerId: string, merchantId: string, addressId: string): Promise<{
        success: boolean;
    }>;
    /** Fill blank profile fields from a logged-in checkout without overwriting set values. */
    static syncFromCheckout(customerId: string, merchantId: string, input: {
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
        email?: string | null;
    }): Promise<{
        id: string;
        email: string | null;
        passwordHash: string | null;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        merchantId: string;
        firstName: string | null;
        lastName: string | null;
        defaultAddress: string | null;
        defaultZip: string | null;
        defaultCity: string | null;
        loyaltyPoints: number | null;
        totalSpent: string | null;
        marketingOptIn: boolean;
        lastOrderAt: Date | null;
        lastReorderReminderAt: Date | null;
        crmTags: string[];
    } | null>;
    /**
     * Persist a delivery address on the shop account if it is new.
     * Guest checkout must not call this.
     */
    static rememberCheckoutAddress(customerId: string, merchantId: string, input: SavedAddressInput): Promise<{
        id: string;
        label: string;
        address: string;
        zipCode: string | null;
        city: string | null;
        latitude: number | null;
        longitude: number | null;
        isDefault: boolean;
    } | null>;
    private static publicCustomer;
    private static tokenFor;
}
//# sourceMappingURL=shop-customer.service.d.ts.map