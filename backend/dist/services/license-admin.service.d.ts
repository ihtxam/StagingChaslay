type LicenseMerchantLite = {
    id: string;
    name: string;
    email: string;
    resellerId: string | null;
};
type LicenseDeviceLite = {
    id: string;
    deviceName: string;
    deviceId: string;
};
/**
 * Attach merchant/device without Drizzle `with: { merchant: true }`.
 * Relational joins SELECT every merchants column (addon flags, etc.).
 * Production often lags schema, so the query throws and list APIs return [].
 * Stats skip the join, which is why counts can be 5 while the table is empty.
 */
export declare function attachLicenseRelations<T extends {
    merchantId: string;
    deviceId: string | null;
}>(rows: T[]): Promise<Array<T & {
    merchant: LicenseMerchantLite | null;
    device: LicenseDeviceLite | null;
}>>;
export declare class LicenseAdminService {
    /**
     * Issue a license bound to the Android POS device ID shown in the app.
     * Matches legacy Reborn admin flow: copy device ID → generate code for that device.
     */
    static issueForPosDeviceId(merchantId: string, posDeviceId: string, licenseType?: "trial" | "yearly" | "custom", customDays?: number, deviceType?: string, issuedByResellerId?: string | null): Promise<{
        deviceId: string;
        externalDeviceId: string;
        deviceName: string;
        licenseKey: string;
        expiresAt: Date;
        licenseId: string;
        reused: boolean;
    }>;
    /**
     * Issue N device seats for a merchant (creates placeholder devices + license keys).
     * POS devices activate/bind using these license codes.
     */
    static issueDeviceSeats(merchantId: string, seats?: number, licenseType?: "trial" | "yearly" | "custom", customDays?: number, deviceType?: string, issuedByResellerId?: string | null): Promise<{
        deviceId: string;
        deviceName: string;
        licenseKey: string;
        expiresAt: Date;
        licenseId: string;
    }[]>;
    /**
     * List devices for a merchant (for license assignment UI)
     */
    static getMerchantDevices(merchantId: string): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        merchantId: string;
        deviceId: string;
        deviceName: string;
        deviceType: string;
        osVersion: string | null;
        appVersion: string | null;
        lastSync: Date | null;
        licenses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            trialDays: number | null;
            expiresAt: Date;
            deviceId: string;
            licenseKey: string;
            licenseType: string;
            startsAt: Date;
            renewalNotifiedAt: Date | null;
            issuedByResellerId: string | null;
        }[];
    }[]>;
    /**
     * Generate and issue license code to merchant
     */
    static generateLicenseForMerchant(merchantId: string, deviceId: string, licenseType?: "trial" | "yearly" | "custom", customDays?: number, issuedByResellerId?: string | null): Promise<{
        success: boolean;
        license: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            trialDays: number | null;
            expiresAt: Date;
            deviceId: string;
            licenseKey: string;
            licenseType: string;
            startsAt: Date;
            renewalNotifiedAt: Date | null;
            issuedByResellerId: string | null;
        };
        licenseCode: string;
    }>;
    /**
     * Get all licenses with filters
     */
    static getAllLicenses(page?: number, limit?: number, status?: string, merchantId?: string): Promise<({
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        trialDays: number | null;
        expiresAt: Date;
        deviceId: string;
        licenseKey: string;
        licenseType: string;
        startsAt: Date;
        renewalNotifiedAt: Date | null;
        issuedByResellerId: string | null;
    } & {
        merchant: LicenseMerchantLite | null;
        device: LicenseDeviceLite | null;
    })[]>;
    /**
     * Get license details
     */
    static getLicenseDetails(licenseId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        trialDays: number | null;
        expiresAt: Date;
        deviceId: string;
        licenseKey: string;
        licenseType: string;
        startsAt: Date;
        renewalNotifiedAt: Date | null;
        issuedByResellerId: string | null;
    } & {
        merchant: LicenseMerchantLite | null;
        device: LicenseDeviceLite | null;
    }>;
    /**
     * Revoke license
     */
    static revokeLicense(licenseId: string): Promise<{
        id: string;
        merchantId: string;
        deviceId: string;
        licenseKey: string;
        licenseType: string;
        trialDays: number | null;
        startsAt: Date;
        expiresAt: Date;
        renewalNotifiedAt: Date | null;
        status: string;
        issuedByResellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Extend license expiry
     */
    static extendLicense(licenseId: string, additionalDays: number): Promise<{
        id: string;
        merchantId: string;
        deviceId: string;
        licenseKey: string;
        licenseType: string;
        trialDays: number | null;
        startsAt: Date;
        expiresAt: Date;
        renewalNotifiedAt: Date | null;
        status: string;
        issuedByResellerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Get license statistics
     */
    static getLicenseStatistics(): Promise<{
        total: number;
        active: number;
        expired: number;
        suspended: number;
        expiringIn30Days: number;
        trial: number;
        yearly: number;
    }>;
    /**
     * Bulk generate licenses for multiple merchants
     */
    static bulkGenerateLicenses(merchantIds: string[], licenseType?: "trial" | "yearly"): Promise<({
        merchantId: string;
        success: boolean;
        licenseCode: string;
        error?: undefined;
    } | {
        merchantId: string;
        success: boolean;
        error: string;
        licenseCode?: undefined;
    })[]>;
    /**
     * Get licenses expiring soon
     */
    static getLicensesExpiringSoon(daysThreshold?: number): Promise<{
        license: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            trialDays: number | null;
            expiresAt: Date;
            deviceId: string;
            licenseKey: string;
            licenseType: string;
            startsAt: Date;
            renewalNotifiedAt: Date | null;
            issuedByResellerId: string | null;
        } & {
            merchant: LicenseMerchantLite | null;
            device: LicenseDeviceLite | null;
        };
        daysRemaining: number;
    }[]>;
}
export {};
//# sourceMappingURL=license-admin.service.d.ts.map