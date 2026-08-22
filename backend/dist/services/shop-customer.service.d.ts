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
    private static publicCustomer;
    private static tokenFor;
}
//# sourceMappingURL=shop-customer.service.d.ts.map