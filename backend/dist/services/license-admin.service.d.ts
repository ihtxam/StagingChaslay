import { schema } from "@/db";
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
    static getAllLicenses(page?: number, limit?: number, status?: string, merchantId?: string): Promise<{
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
            maxStaff: number;
            inventoryAddonEnabled: boolean;
            signageAddonEnabled: boolean;
            signageScreenLimit: number;
            kdsAddonEnabled: boolean;
            odsAddonEnabled: boolean;
            justEatAddonEnabled: boolean;
            uberEatsAddonEnabled: boolean;
            storekeeperAddonEnabled: boolean;
            inventoryWasteFactor: string;
            inventoryAutoReorderEmailEnabled: boolean;
            inventoryExpiryAlertDays: number;
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
            maxStaff: number;
            inventoryAddonEnabled: boolean;
            signageAddonEnabled: boolean;
            signageScreenLimit: number;
            kdsAddonEnabled: boolean;
            odsAddonEnabled: boolean;
            justEatAddonEnabled: boolean;
            uberEatsAddonEnabled: boolean;
            storekeeperAddonEnabled: boolean;
            inventoryWasteFactor: string;
            inventoryAutoReorderEmailEnabled: boolean;
            inventoryExpiryAlertDays: number;
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
                maxStaff: number;
                inventoryAddonEnabled: boolean;
                signageAddonEnabled: boolean;
                signageScreenLimit: number;
                kdsAddonEnabled: boolean;
                odsAddonEnabled: boolean;
                justEatAddonEnabled: boolean;
                uberEatsAddonEnabled: boolean;
                storekeeperAddonEnabled: boolean;
                inventoryWasteFactor: string;
                inventoryAutoReorderEmailEnabled: boolean;
                inventoryExpiryAlertDays: number;
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
        };
        daysRemaining: number;
    }[]>;
}
//# sourceMappingURL=license-admin.service.d.ts.map