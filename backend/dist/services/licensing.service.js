"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicensingService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
class LicensingService {
    /**
     * Generate a device ID for a new POS device
     * Format: POS-{MERCHANT_ID}-{DEVICE_UUID}-{TIMESTAMP}
     */
    static generateDeviceId(merchantId) {
        const timestamp = Date.now();
        const uuid = (0, uuid_1.v4)().substring(0, 8).toUpperCase();
        return `POS-${merchantId.substring(0, 6).toUpperCase()}-${uuid}-${timestamp}`;
    }
    /**
     * Generate a license code
     * Format: {MERCHANT_ID}-{DEVICE_ID}-{RANDOM_KEY}-{EXPIRY_YEAR}
     */
    static generateLicenseCode(merchantId, deviceId, expiryYear) {
        const merchantPart = merchantId.substring(0, 6).toUpperCase();
        const devicePart = deviceId.substring(0, 6).toUpperCase();
        const randomKey = (0, uuid_1.v4)().substring(0, 8).toUpperCase();
        return `${merchantPart}-${devicePart}-${randomKey}-${expiryYear}`;
    }
    /**
     * Register a new device and create a trial license
     */
    static async registerDevice(merchantId, deviceName, deviceType, osVersion, appVersion) {
        const db = (0, db_1.getDb)();
        try {
            // Generate device ID
            const deviceId = this.generateDeviceId(merchantId);
            // Create device record
            const device = await db
                .insert(db_1.schema.devices)
                .values({
                merchantId,
                deviceId,
                deviceName,
                deviceType,
                osVersion,
                appVersion,
                isActive: true,
            })
                .returning();
            // Get merchant to check trial status
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            if (!merchant) {
                throw new Error("Merchant not found");
            }
            // Create trial license if merchant is new
            let license = null;
            if (merchant.status === "active" && !merchant.trialEndsAt) {
                const now = new Date();
                const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
                const licenseKey = this.generateLicenseCode(merchantId, deviceId, trialEndsAt.getFullYear());
                license = await db
                    .insert(db_1.schema.licenses)
                    .values({
                    merchantId,
                    deviceId: device[0].id,
                    licenseKey,
                    licenseType: "trial",
                    trialDays: 7,
                    startsAt: now,
                    expiresAt: trialEndsAt,
                    status: "active",
                })
                    .returning();
                // Update merchant trial end date
                await db
                    .update(db_1.schema.merchants)
                    .set({ trialEndsAt })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            }
            return {
                device: device[0],
                license: license?.[0] || null,
            };
        }
        catch (error) {
            console.error("Error registering device:", error);
            throw error;
        }
    }
    /**
     * Activate a license with a license code
     */
    static async activateLicense(merchantId, deviceId, licenseCode) {
        const db = (0, db_1.getDb)();
        try {
            // Find the license by code
            const license = await db.query.licenses.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.licenseKey, licenseCode), (0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active")),
            });
            if (!license) {
                throw new Error("Invalid or expired license code");
            }
            // Check if license is already activated
            if (license.status === "active" && new Date() < license.expiresAt) {
                return {
                    success: true,
                    message: "License already active",
                    license,
                };
            }
            // Update license status
            const updatedLicense = await db
                .update(db_1.schema.licenses)
                .set({ status: "active" })
                .where((0, drizzle_orm_1.eq)(db_1.schema.licenses.id, license.id))
                .returning();
            // Update merchant subscription
            await db
                .update(db_1.schema.merchants)
                .set({
                status: "active",
                subscriptionEndsAt: license.expiresAt,
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            return {
                success: true,
                message: "License activated successfully",
                license: updatedLicense[0],
            };
        }
        catch (error) {
            console.error("Error activating license:", error);
            throw error;
        }
    }
    /**
     * Check license status for a device
     */
    static async checkLicenseStatus(merchantId, deviceId) {
        const db = (0, db_1.getDb)();
        try {
            // Find active license for device
            const license = await db.query.licenses.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active")),
            });
            if (!license) {
                return {
                    isValid: false,
                    message: "No active license found",
                };
            }
            const now = new Date();
            // Check if license is expired
            if (now > license.expiresAt) {
                // Update license status to expired
                await db
                    .update(db_1.schema.licenses)
                    .set({ status: "expired" })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.licenses.id, license.id));
                // Update merchant status
                await db
                    .update(db_1.schema.merchants)
                    .set({ status: "expired" })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
                return {
                    isValid: false,
                    message: "License expired",
                    expiresAt: license.expiresAt,
                };
            }
            // Calculate days remaining
            const daysRemaining = Math.ceil((license.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                isValid: true,
                daysRemaining,
                expiresAt: license.expiresAt,
                licenseType: license.licenseType,
            };
        }
        catch (error) {
            console.error("Error checking license status:", error);
            throw error;
        }
    }
    /**
     * Generate license code for renewal
     */
    static async generateRenewalLicense(merchantId, deviceId) {
        const db = (0, db_1.getDb)();
        try {
            // Find the device
            const device = await db.query.devices.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.devices.deviceId, deviceId)),
            });
            if (!device) {
                throw new Error("Device not found");
            }
            // Generate new license code
            const now = new Date();
            const expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            const licenseKey = this.generateLicenseCode(merchantId, deviceId, expiresAt.getFullYear());
            // Create new license
            const license = await db
                .insert(db_1.schema.licenses)
                .values({
                merchantId,
                deviceId: device.id,
                licenseKey,
                licenseType: "yearly",
                startsAt: now,
                expiresAt,
                status: "active",
            })
                .returning();
            // Update merchant subscription
            await db
                .update(db_1.schema.merchants)
                .set({
                status: "active",
                subscriptionEndsAt: expiresAt,
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            return {
                success: true,
                license: license[0],
                licenseCode: licenseKey,
            };
        }
        catch (error) {
            console.error("Error generating renewal license:", error);
            throw error;
        }
    }
    /**
     * Get licenses expiring soon (for renewal notifications)
     */
    static async getLicensesExpiringsoon(daysThreshold = 35) {
        const db = (0, db_1.getDb)();
        try {
            const now = new Date();
            const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
            const licenses = await db.query.licenses.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active"), (0, drizzle_orm_1.lt)(db_1.schema.licenses.expiresAt, thresholdDate), (0, drizzle_orm_1.gt)(db_1.schema.licenses.expiresAt, now)),
                with: {
                    merchant: true,
                    device: true,
                },
            });
            return licenses;
        }
        catch (error) {
            console.error("Error getting licenses expiring soon:", error);
            throw error;
        }
    }
    /**
     * Mark renewal notification as sent
     */
    static async markRenewalNotified(licenseId) {
        const db = (0, db_1.getDb)();
        try {
            await db
                .update(db_1.schema.licenses)
                .set({ renewalNotifiedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.licenses.id, licenseId));
        }
        catch (error) {
            console.error("Error marking renewal notified:", error);
            throw error;
        }
    }
    /**
     * Get all licenses for a merchant
     */
    static async getMerchantLicenses(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const licenses = await db.query.licenses.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchantId),
                with: {
                    device: true,
                },
            });
            return licenses;
        }
        catch (error) {
            console.error("Error getting merchant licenses:", error);
            throw error;
        }
    }
}
exports.LicensingService = LicensingService;
//# sourceMappingURL=licensing.service.js.map