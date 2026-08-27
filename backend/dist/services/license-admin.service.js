"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseAdminService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const licensing_service_1 = require("./licensing.service");
const chaslay_compat_service_1 = require("./chaslay-compat.service");
const ensure_licenses_schema_1 = require("@/lib/ensure-licenses-schema");
function asDate(value) {
    if (!value)
        return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
function formatActivationCode() {
    const raw = crypto_1.default.randomBytes(6).toString("hex").toUpperCase();
    return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}
class LicenseAdminService {
    /**
     * Issue a license bound to the Android POS device ID shown in the app.
     * Matches legacy Reborn admin flow: copy device ID → generate code for that device.
     */
    static async issueForPosDeviceId(merchantId, posDeviceId, licenseType = "yearly", customDays, deviceType = "tablet", issuedByResellerId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const trimmed = String(posDeviceId || "").trim();
        if (!trimmed)
            throw new Error("POS device ID is required");
        const normalized = (0, chaslay_compat_service_1.normalizeChaslayDeviceId)(trimmed) || (0, chaslay_compat_service_1.deriveShortDeviceId)(trimmed);
        if (!normalized)
            throw new Error("Invalid POS device ID");
        let device = await db.query.devices.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.devices.deviceId, normalized)),
            with: { licenses: true },
        });
        if (!device) {
            // Also match if stored under derived short form of a longer id
            const all = await db.query.devices.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchantId),
                with: { licenses: true },
            });
            device =
                all.find((d) => (0, chaslay_compat_service_1.normalizeChaslayDeviceId)(d.deviceId) === normalized ||
                    (0, chaslay_compat_service_1.deriveShortDeviceId)(d.deviceId) === normalized) || undefined;
        }
        if (!device) {
            const inserted = await db
                .insert(db_1.schema.devices)
                .values({
                merchantId,
                deviceId: normalized,
                deviceName: `POS ${normalized}`,
                deviceType,
                isActive: true,
            })
                .returning();
            device = { ...inserted[0], licenses: [] };
        }
        const existingActive = (device.licenses || []).find((l) => l.status === "active" && l.expiresAt > new Date());
        if (existingActive) {
            return {
                deviceId: device.id,
                externalDeviceId: device.deviceId,
                deviceName: device.deviceName,
                licenseKey: existingActive.licenseKey,
                expiresAt: existingActive.expiresAt,
                licenseId: existingActive.id,
                reused: true,
            };
        }
        const now = new Date();
        let expiresAt;
        if (licenseType === "trial") {
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
        else if (licenseType === "custom" && customDays) {
            expiresAt = new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000);
        }
        else {
            expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        }
        // Reborn-style short activation code (easier to type on tablet)
        let licenseKey = formatActivationCode();
        for (let i = 0; i < 5; i++) {
            const taken = await db.query.licenses.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.licenses.licenseKey, licenseKey),
            });
            if (!taken)
                break;
            licenseKey = formatActivationCode();
        }
        const license = await db
            .insert(db_1.schema.licenses)
            .values({
            merchantId,
            deviceId: device.id,
            licenseKey,
            licenseType,
            startsAt: now,
            expiresAt,
            status: "active",
            issuedByResellerId: issuedByResellerId || null,
        })
            .returning();
        await db
            .update(db_1.schema.merchants)
            .set({ status: "active", subscriptionEndsAt: expiresAt, updatedAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return {
            deviceId: device.id,
            externalDeviceId: normalized,
            deviceName: device.deviceName,
            licenseKey,
            expiresAt,
            licenseId: license[0].id,
            reused: false,
        };
    }
    /**
     * Issue N device seats for a merchant (creates placeholder devices + license keys).
     * POS devices activate/bind using these license codes.
     */
    static async issueDeviceSeats(merchantId, seats = 1, licenseType = "yearly", customDays, deviceType = "tablet", issuedByResellerId) {
        const db = (0, db_1.getDb)();
        const count = Math.max(1, Math.min(20, seats));
        const issued = [];
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant) {
            throw new Error("Merchant not found");
        }
        for (let i = 0; i < count; i++) {
            const externalDeviceId = licensing_service_1.LicensingService.generateDeviceId(merchantId);
            const deviceName = `POS Seat ${Date.now().toString(36).slice(-4).toUpperCase()}-${i + 1}`;
            const device = await db
                .insert(db_1.schema.devices)
                .values({
                merchantId,
                deviceId: externalDeviceId,
                deviceName,
                deviceType,
                isActive: true,
            })
                .returning();
            const result = await this.generateLicenseForMerchant(merchantId, device[0].id, licenseType, customDays, issuedByResellerId);
            issued.push({
                deviceId: device[0].id,
                deviceName,
                licenseKey: result.licenseCode,
                expiresAt: result.license.expiresAt,
                licenseId: result.license.id,
            });
        }
        return issued;
    }
    /**
     * List devices for a merchant (for license assignment UI)
     */
    static async getMerchantDevices(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.devices.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchantId),
            with: { licenses: true },
            orderBy: (0, drizzle_orm_1.desc)(db_1.schema.devices.createdAt),
        });
    }
    /**
     * Generate and issue license code to merchant
     */
    static async generateLicenseForMerchant(merchantId, deviceId, licenseType = "yearly", customDays, issuedByResellerId) {
        const db = (0, db_1.getDb)();
        try {
            // Get device
            const device = await db.query.devices.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.devices.id, deviceId), (0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchantId)),
            });
            if (!device) {
                throw new Error("Device not found for this merchant");
            }
            // Calculate expiry date
            const now = new Date();
            let expiresAt;
            if (licenseType === "trial") {
                expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
            else if (licenseType === "custom" && customDays) {
                expiresAt = new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000);
            }
            else {
                // yearly
                expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            }
            // Generate license code
            const licenseKey = licensing_service_1.LicensingService.generateLicenseCode(merchantId, device.deviceId, expiresAt.getFullYear());
            // Create license
            const license = await db
                .insert(db_1.schema.licenses)
                .values({
                merchantId,
                deviceId: device.id,
                licenseKey,
                licenseType,
                startsAt: now,
                expiresAt,
                status: "active",
                issuedByResellerId: issuedByResellerId || null,
            })
                .returning();
            // Update merchant subscription if needed
            if (licenseType === "yearly" || licenseType === "custom") {
                await db
                    .update(db_1.schema.merchants)
                    .set({
                    status: "active",
                    subscriptionEndsAt: expiresAt,
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            }
            return {
                success: true,
                license: license[0],
                licenseCode: licenseKey,
            };
        }
        catch (error) {
            console.error("Error generating license:", error);
            throw error;
        }
    }
    /**
     * Get all licenses with filters
     */
    static async getAllLicenses(page = 1, limit = 20, status, merchantId) {
        try {
            return await (0, ensure_licenses_schema_1.withLicenseSchemaRetry)(async () => {
                const db = (0, db_1.getDb)();
                const offset = (page - 1) * limit;
                const whereConditions = [];
                if (status) {
                    whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.licenses.status, status));
                }
                if (merchantId) {
                    whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchantId));
                }
                return db.query.licenses.findMany({
                    where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
                    with: {
                        merchant: true,
                        device: true,
                    },
                    limit,
                    offset,
                    orderBy: (0, drizzle_orm_1.desc)(db_1.schema.licenses.createdAt),
                });
            });
        }
        catch (error) {
            console.error("Error getting licenses:", error);
            return [];
        }
    }
    /**
     * Get license details
     */
    static async getLicenseDetails(licenseId) {
        const db = (0, db_1.getDb)();
        try {
            const license = await db.query.licenses.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.licenses.id, licenseId),
                with: {
                    merchant: true,
                    device: true,
                },
            });
            if (!license) {
                throw new Error("License not found");
            }
            return license;
        }
        catch (error) {
            console.error("Error getting license details:", error);
            throw error;
        }
    }
    /**
     * Revoke license
     */
    static async revokeLicense(licenseId) {
        const db = (0, db_1.getDb)();
        try {
            const license = await db
                .update(db_1.schema.licenses)
                .set({
                status: "suspended",
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.licenses.id, licenseId))
                .returning();
            return license[0];
        }
        catch (error) {
            console.error("Error revoking license:", error);
            throw error;
        }
    }
    /**
     * Extend license expiry
     */
    static async extendLicense(licenseId, additionalDays) {
        const db = (0, db_1.getDb)();
        try {
            const license = await db.query.licenses.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.licenses.id, licenseId),
            });
            if (!license) {
                throw new Error("License not found");
            }
            const expiresAt = asDate(license.expiresAt);
            if (!expiresAt) {
                throw new Error("License has an invalid expiry date");
            }
            const newExpiryDate = new Date(expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);
            const updatedLicense = await db
                .update(db_1.schema.licenses)
                .set({
                expiresAt: newExpiryDate,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.licenses.id, licenseId))
                .returning();
            return updatedLicense[0];
        }
        catch (error) {
            console.error("Error extending license:", error);
            throw error;
        }
    }
    /**
     * Get license statistics
     */
    static async getLicenseStatistics() {
        const empty = {
            total: 0,
            active: 0,
            expired: 0,
            suspended: 0,
            expiringIn30Days: 0,
            trial: 0,
            yearly: 0,
        };
        try {
            return await (0, ensure_licenses_schema_1.withLicenseSchemaRetry)(async () => {
                const db = (0, db_1.getDb)();
                const now = new Date();
                const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                const licenses = await db.query.licenses.findMany();
                return {
                    total: licenses.length,
                    active: licenses.filter((l) => l.status === "active").length,
                    expired: licenses.filter((l) => l.status === "expired").length,
                    suspended: licenses.filter((l) => l.status === "suspended").length,
                    expiringIn30Days: licenses.filter((l) => {
                        const expiresAt = asDate(l.expiresAt);
                        return (l.status === "active" &&
                            !!expiresAt &&
                            expiresAt > now &&
                            expiresAt <= horizon);
                    }).length,
                    trial: licenses.filter((l) => l.licenseType === "trial").length,
                    yearly: licenses.filter((l) => l.licenseType === "yearly").length,
                };
            });
        }
        catch (error) {
            console.error("Error getting license statistics:", error);
            return empty;
        }
    }
    /**
     * Bulk generate licenses for multiple merchants
     */
    static async bulkGenerateLicenses(merchantIds, licenseType = "yearly") {
        const db = (0, db_1.getDb)();
        try {
            const results = [];
            for (const merchantId of merchantIds) {
                // Get first device for merchant
                const device = await db.query.devices.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchantId),
                });
                if (device) {
                    const result = await this.generateLicenseForMerchant(merchantId, device.id, licenseType);
                    results.push({
                        merchantId,
                        success: true,
                        licenseCode: result.licenseCode,
                    });
                }
                else {
                    results.push({
                        merchantId,
                        success: false,
                        error: "No device found for merchant",
                    });
                }
            }
            return results;
        }
        catch (error) {
            console.error("Error bulk generating licenses:", error);
            throw error;
        }
    }
    /**
     * Get licenses expiring soon
     */
    static async getLicensesExpiringSoon(daysThreshold = 35) {
        try {
            return await (0, ensure_licenses_schema_1.withLicenseSchemaRetry)(async () => {
                const db = (0, db_1.getDb)();
                const now = new Date();
                const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
                const licenses = await db.query.licenses.findMany({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active"), (0, drizzle_orm_1.lt)(db_1.schema.licenses.expiresAt, thresholdDate), (0, drizzle_orm_1.gt)(db_1.schema.licenses.expiresAt, now)),
                    with: {
                        merchant: true,
                        device: true,
                    },
                    orderBy: (0, drizzle_orm_1.asc)(db_1.schema.licenses.expiresAt),
                });
                return licenses
                    .map((l) => {
                    const expiresAt = asDate(l.expiresAt);
                    if (!expiresAt)
                        return null;
                    return {
                        license: l,
                        daysRemaining: Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                    };
                })
                    .filter((row) => row != null);
            });
        }
        catch (error) {
            console.error("Error getting licenses expiring soon:", error);
            return [];
        }
    }
}
exports.LicenseAdminService = LicenseAdminService;
//# sourceMappingURL=license-admin.service.js.map