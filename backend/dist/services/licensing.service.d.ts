export declare class LicensingService {
    /**
     * Generate a device ID for a new POS device
     * Format: POS-{MERCHANT_ID}-{DEVICE_UUID}-{TIMESTAMP}
     */
    static generateDeviceId(merchantId: string): string;
    /**
     * Generate a license code
     * Format: {MERCHANT_ID}-{DEVICE_ID}-{RANDOM_KEY}-{EXPIRY_YEAR}
     */
    static generateLicenseCode(merchantId: string, deviceId: string, expiryYear: number): string;
    /**
     * Register a new device and create a trial license
     */
    static registerDevice(merchantId: string, deviceName: string, deviceType: string, osVersion?: string, appVersion?: string): Promise<{
        device: {
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
        };
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
        } | null;
    }>;
    /**
     * Activate a license with a license code
     */
    static activateLicense(merchantId: string, deviceId: string, licenseCode: string): Promise<{
        success: boolean;
        message: string;
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
    }>;
    /**
     * Check license status for a device
     */
    static checkLicenseStatus(merchantId: string, deviceId: string): Promise<{
        isValid: boolean;
        message: string;
        expiresAt?: undefined;
        daysRemaining?: undefined;
        licenseType?: undefined;
    } | {
        isValid: boolean;
        message: string;
        expiresAt: Date;
        daysRemaining?: undefined;
        licenseType?: undefined;
    } | {
        isValid: boolean;
        daysRemaining: number;
        expiresAt: Date;
        licenseType: string;
        message?: undefined;
    }>;
    /**
     * Generate license code for renewal
     */
    static generateRenewalLicense(merchantId: string, deviceId: string): Promise<{
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
     * Get licenses expiring soon (for renewal notifications)
     */
    static getLicensesExpiringsoon(daysThreshold?: number): Promise<({
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
        merchant: {
            id: string;
            name: string;
            email: string;
            resellerId: string | null;
        } | null;
        device: {
            id: string;
            deviceName: string;
            deviceId: string;
        } | null;
    })[]>;
    /**
     * Mark renewal notification as sent
     */
    static markRenewalNotified(licenseId: string): Promise<void>;
    /**
     * Get all licenses for a merchant
     */
    static getMerchantLicenses(merchantId: string): Promise<({
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
        merchant: {
            id: string;
            name: string;
            email: string;
            resellerId: string | null;
        } | null;
        device: {
            id: string;
            deviceName: string;
            deviceId: string;
        } | null;
    })[]>;
}
//# sourceMappingURL=licensing.service.d.ts.map