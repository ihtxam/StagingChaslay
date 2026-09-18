"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformResellerService = exports.PLATFORM_RESELLER_SETTINGS_KEY = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const platform_settings_service_1 = require("@/services/platform-settings.service");
exports.PLATFORM_RESELLER_SETTINGS_KEY = "platform_reseller_id";
/** Legacy platform-direct seller emails — catalog migrates to Chaslay agency. */
const LEGACY_PLATFORM_SELLER_EMAILS = [
    "platform-sales@rebornsense.com",
    "agency@rebornsense.com",
];
class PlatformResellerService {
    /** Reseller id used when a merchant has no assigned agency (defaults to Chaslay). */
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
    /** Ensure Chaslay agency exists and is the platform default seller (no direct Reborn sales). */
    static async ensure() {
        const { ResellerService } = await Promise.resolve().then(() => __importStar(require("@/services/reseller.service")));
        const chaslay = await ResellerService.ensureChaslayAgency();
        await platform_settings_service_1.PlatformSettingsService.set(exports.PLATFORM_RESELLER_SETTINGS_KEY, chaslay.id);
        await this.migrateLegacyDirectSalesCatalog(chaslay.id);
        return chaslay.id;
    }
    /** Selling reseller for a merchant: assigned agency or Chaslay default. */
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
    /** Move legacy Reborn Direct catalog and merchants to Chaslay agency. */
    static async migrateLegacyDirectSalesCatalog(chaslayId) {
        const db = (0, db_1.getDb)();
        for (const email of LEGACY_PLATFORM_SELLER_EMAILS) {
            const legacy = await db.query.resellers.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.email, email),
                columns: { id: true },
            });
            if (!legacy || legacy.id === chaslayId)
                continue;
            await db
                .update(db_1.schema.subscriptionPlans)
                .set({ ownerType: "reseller", ownerId: chaslayId, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.ownerId, legacy.id));
            await db
                .update(db_1.schema.subscriptionAddons)
                .set({ ownerType: "reseller", ownerId: chaslayId, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerId, legacy.id));
            await db
                .update(db_1.schema.merchants)
                .set({ resellerId: chaslayId, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.resellerId, legacy.id));
        }
    }
    /** Migrate legacy platform-owned packages/add-ons to the Chaslay reseller. */
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
        await this.migrateLegacyDirectSalesCatalog(sellerId);
    }
}
exports.PlatformResellerService = PlatformResellerService;
//# sourceMappingURL=platform-reseller.service.js.map