import { schema } from "@/db";
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
    static getLicensesExpiringsoon(daysThreshold?: number): Promise<{
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
        merchant: {
            id: string;
            name: string;
            email: string;
            passwordHash: string;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            status: string;
            businessCategory: string | null;
            businessLicense: string | null;
            address: string | null;
            city: string | null;
            country: string | null;
            vatNumber: string | null;
            vatRate: string | null;
            taxTakeawayRate: string | null;
            taxDineInRate: string | null;
            taxDeliveryRate: string | null;
            taxIncludedInPrice: boolean;
            vatAfterDiscount: boolean;
            slug: string | null;
            subdomain: string | null;
            customDomain: string | null;
            shopEnabled: boolean;
            acceptingOrders: boolean;
            acceptingReservations: boolean;
            cmsHomepageEnabled: boolean;
            pickupEnabled: boolean;
            dineInEnabled: boolean;
            deliveryEnabled: boolean;
            channelSelectMode: string;
            menuShowProductImages: boolean;
            menuShowCategoryBanners: boolean;
            cartLayout: string;
            scheduledOrdersEnabled: boolean;
            storeHours: Record<string, Record<string, {
                open: string;
                close: string;
            }[]>> | null;
            shopLogoUrl: string | null;
            shopBannerUrl: string | null;
            latitude: string | null;
            longitude: string | null;
            pickupEtaMinutes: number | null;
            deliveryEtaMinutes: number | null;
            minPreOrderDelayMinutes: number | null;
            deliveryMenuMarkup: string | null;
            deliveryDriverPayMode: string;
            deliveryDriverHourlyRate: string | null;
            deliveryPerOrderFee: string | null;
            adyenMerchantAccount: string | null;
            adyenApiKey: string | null;
            adyenClientId: string | null;
            adyenLiveEnvironment: boolean;
            adyenLiveRegion: string;
            adyenUseLegacyEndpoint: boolean;
            webposExpressEnabled: boolean;
            webposCashEnabled: boolean;
            webposCardEnabled: boolean;
            webposTerminalEnabled: boolean;
            webposGiftCardEnabled: boolean;
            webposInvoiceEnabled: boolean;
            bankIban: string | null;
            bankQrIban: string | null;
            bankName: string | null;
            bankAccountHolder: string | null;
            invoiceSequence: number;
            giftCardSettings: Record<string, unknown> | null;
            onlineCardFeeFixed: string | null;
            onlineCardFeePercent: string | null;
            loyaltyEnabled: boolean;
            loyaltyEarnPointsPerChf: string | null;
            loyaltyRedeemPointsPerChf: number;
            loyaltyPointsExpiryDays: number;
            panelLanguage: string;
            shopLanguage: string | null;
            syncApiKey: string | null;
            floorPlanEnabled: boolean;
            paxOrderingEnabled: boolean;
            coursesEnabled: boolean;
            shiftsEnabled: boolean;
            maxPosPosts: number;
            maxWaiterPosts: number;
            inventoryAddonEnabled: boolean;
            signageAddonEnabled: boolean;
            signageScreenLimit: number;
            kdsAddonEnabled: boolean;
            odsAddonEnabled: boolean;
            inventoryWasteFactor: string;
            inventoryAutoReorderEmailEnabled: boolean;
            posColorTheme: string;
            reservationsEnabled: boolean;
            reservationSettings: schema.ReservationSettings | null;
            vacationSettings: schema.VacationSettings | null;
            emailSmtpSettings: schema.MerchantSmtpSettings | null;
            emailBrevoSettings: schema.MerchantBrevoSettings | null;
            emailDeliveryMode: string;
            marketingSettings: schema.MarketingSettings | null;
            reportEmailSettings: schema.ReportEmailSettings | null;
            posPrintSettings: import("../lib/pos-print-settings").PosPrintSettings | null;
            tableQrSettings: import("../lib/table-qr-settings").TableQrSettings | null;
            posCheckoutSettings: Record<string, unknown> | null;
            deliveryPlatformSettings: Record<string, unknown> | null;
            subscriptionPlan: string | null;
            trialEndsAt: Date | null;
            subscriptionEndsAt: Date | null;
            subscriptionBillingCycle: string | null;
            adyenRecurringDetailReference: string | null;
            resellerId: string | null;
            editionId: string | null;
            planBillingPaid: boolean;
            passwordSetAt: Date | null;
            inviteTokenHash: string | null;
            inviteTokenExpiresAt: Date | null;
            inviteSentAt: Date | null;
        };
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
    }[]>;
    /**
     * Mark renewal notification as sent
     */
    static markRenewalNotified(licenseId: string): Promise<void>;
    /**
     * Get all licenses for a merchant
     */
    static getMerchantLicenses(merchantId: string): Promise<{
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
    }[]>;
}
//# sourceMappingURL=licensing.service.d.ts.map