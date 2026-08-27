"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformResellerService = exports.PLATFORM_RESELLER_SETTINGS_KEY = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@/db");
const platform_settings_service_1 = require("@/services/platform-settings.service");
const auth_service_1 = require("@/services/auth.service");
exports.PLATFORM_RESELLER_SETTINGS_KEY = "platform_reseller_id";
const PLATFORM_RESELLER_EMAIL = "platform-sales@rebornsense.com";
class PlatformResellerService {
    /** Reseller id used for direct Reborn → merchant sales (superadmin acts as this agency). */
    static async getId() {
        const stored = await platform_settings_service_1.PlatformSettingsService.get(exports.PLATFORM_RESELLER_SETTINGS_KEY);
        if (stored?.trim()) {
            const db = (0, db_1.getDb)();
            const row = await db.query.resellers.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.id, stored.trim()),
                columns: { id: true },
            });
            if (row)
                return row.id;
        }
        return this.ensure();
    }
    static async ensure() {
        const db = (0, db_1.getDb)();
        const byEmail = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.email, PLATFORM_RESELLER_EMAIL),
            columns: { id: true },
        });
        if (byEmail) {
            await platform_settings_service_1.PlatformSettingsService.set(exports.PLATFORM_RESELLER_SETTINGS_KEY, byEmail.id);
            return byEmail.id;
        }
        const passwordHash = await auth_service_1.AuthService.hashPassword(crypto_1.default.randomBytes(32).toString("hex"));
        const [row] = await db
            .insert(db_1.schema.resellers)
            .values({
            name: "Reborn Direct",
            email: PLATFORM_RESELLER_EMAIL,
            passwordHash,
            status: "active",
            licenseSeats: 9999,
            branding: { platformDirect: true },
        })
            .returning();
        const id = row.id;
        await platform_settings_service_1.PlatformSettingsService.set(exports.PLATFORM_RESELLER_SETTINGS_KEY, id);
        return id;
    }
    /** Selling reseller for a merchant: assigned agency or platform direct. */
    static async resolveForMerchant(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { resellerId: true },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        if (merchant.resellerId)
            return merchant.resellerId;
        return this.getId();
    }
    /** Migrate legacy platform-owned packages/add-ons to the platform reseller. */
    static async migrateCatalogOwnership() {
        const sellerId = await this.getId();
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.subscriptionPlans)
            .set({ ownerType: "reseller", ownerId: sellerId, updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.ownerType, "platform")));
        await db
            .update(db_1.schema.subscriptionAddons)
            .set({ ownerType: "reseller", ownerId: sellerId, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerType, "platform"));
    }
}
exports.PlatformResellerService = PlatformResellerService;
//# sourceMappingURL=platform-reseller.service.js.map