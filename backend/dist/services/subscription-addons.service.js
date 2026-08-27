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
exports.SubscriptionAddonsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const platform_reseller_service_1 = require("@/services/platform-reseller.service");
function normalizeSlug(slug) {
    return slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}
const VALID_ADDON_KEYS = new Set([
    "inventory",
    "storekeeper",
    "signage",
    "kds",
    "ods",
    "just_eat",
    "uber_eats",
    "extra_pos_post",
    "extra_waiter_post",
    "extra_staff",
]);
class SubscriptionAddonsService {
    static async listForReseller(resellerId, includeInactive = true) {
        const db = (0, db_1.getDb)();
        const rows = await db.query.subscriptionAddons.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerType, "reseller"), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerId, resellerId)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.subscriptionAddons.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.subscriptionAddons.name)],
        });
        if (includeInactive)
            return rows;
        return rows.filter((r) => r.isActive);
    }
    static async listAll(opts) {
        const resellerId = opts?.forResellerId || (await platform_reseller_service_1.PlatformResellerService.getId());
        return this.listForReseller(resellerId, opts?.includeInactive !== false);
    }
    static async listPublicForMerchant(merchantId) {
        const sellerId = await platform_reseller_service_1.PlatformResellerService.resolveForMerchant(merchantId);
        const db = (0, db_1.getDb)();
        return db.query.subscriptionAddons.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.isActive, true), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.isPublic, true), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerType, "reseller"), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerId, sellerId)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.subscriptionAddons.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.subscriptionAddons.name)],
        });
    }
    static async getById(id) {
        const db = (0, db_1.getDb)();
        const row = await db.query.subscriptionAddons.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.id, id),
        });
        if (!row)
            throw new Error("Add-on not found");
        return row;
    }
    static async create(input) {
        const db = (0, db_1.getDb)();
        const slug = normalizeSlug(input.slug || input.name);
        if (!slug)
            throw new Error("Add-on slug is required");
        const addonKey = String(input.addonKey || "").toLowerCase();
        if (!VALID_ADDON_KEYS.has(addonKey)) {
            throw new Error(`Invalid add-on key. Use: ${[...VALID_ADDON_KEYS].join(", ")}`);
        }
        const ownerType = "reseller";
        const ownerId = input.ownerId;
        if (!ownerId)
            throw new Error("Reseller id is required for add-ons");
        const [row] = await db
            .insert(db_1.schema.subscriptionAddons)
            .values({
            name: input.name.trim(),
            slug,
            description: input.description ?? null,
            addonKey,
            priceMonthly: String(input.priceMonthly ?? 0),
            priceYearly: input.priceYearly === undefined || input.priceYearly === null || input.priceYearly === ""
                ? null
                : String(input.priceYearly),
            currency: (input.currency || "CHF").toUpperCase().slice(0, 3),
            quantity: input.quantity ?? 1,
            isActive: input.isActive !== false,
            isPublic: input.isPublic !== false,
            sortOrder: input.sortOrder ?? 0,
            ownerType,
            ownerId,
        })
            .returning();
        return row;
    }
    static async update(id, input) {
        const db = (0, db_1.getDb)();
        await this.getById(id);
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = input.name.trim();
        if (input.slug !== undefined)
            patch.slug = normalizeSlug(input.slug);
        if (input.description !== undefined)
            patch.description = input.description;
        if (input.addonKey !== undefined) {
            const key = String(input.addonKey).toLowerCase();
            if (!VALID_ADDON_KEYS.has(key))
                throw new Error("Invalid add-on key");
            patch.addonKey = key;
        }
        if (input.priceMonthly !== undefined)
            patch.priceMonthly = String(input.priceMonthly);
        if (input.priceYearly !== undefined) {
            patch.priceYearly =
                input.priceYearly === null || input.priceYearly === "" ? null : String(input.priceYearly);
        }
        if (input.currency !== undefined)
            patch.currency = input.currency.toUpperCase().slice(0, 3);
        if (input.quantity !== undefined)
            patch.quantity = input.quantity;
        if (input.isActive !== undefined)
            patch.isActive = input.isActive;
        if (input.isPublic !== undefined)
            patch.isPublic = input.isPublic;
        if (input.sortOrder !== undefined)
            patch.sortOrder = input.sortOrder;
        const [row] = await db
            .update(db_1.schema.subscriptionAddons)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.id, id))
            .returning();
        return row;
    }
    static async remove(id) {
        const db = (0, db_1.getDb)();
        await this.getById(id);
        const [row] = await db
            .update(db_1.schema.subscriptionAddons)
            .set({ isActive: false, isPublic: false, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.id, id))
            .returning();
        return row;
    }
    static async listActiveForMerchant(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.merchantAddonSubscriptions.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantAddonSubscriptions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantAddonSubscriptions.status, "active")),
            with: { addon: true },
        });
    }
    static async ensureDefaults() {
        const db = (0, db_1.getDb)();
        const { PlatformResellerService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-reseller.service")));
        const platformResellerId = await PlatformResellerService.ensure();
        await PlatformResellerService.migrateCatalogOwnership();
        const existing = await db.query.subscriptionAddons.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerId, platformResellerId),
            limit: 1,
        });
        if (existing.length > 0)
            return;
        const defaults = [
            {
                name: "Inventory & recipes",
                slug: "inventory",
                addonKey: "inventory",
                description: "Stock, suppliers, recipes, and expiry alerts",
                priceMonthly: 29,
                priceYearly: 290,
                sortOrder: 10,
            },
            {
                name: "Digital signage",
                slug: "signage",
                addonKey: "signage",
                description: "Menu boards on TV screens",
                priceMonthly: 19,
                priceYearly: 190,
                quantity: 2,
                sortOrder: 20,
            },
            {
                name: "Kitchen display (KDS)",
                slug: "kds",
                addonKey: "kds",
                description: "Kitchen order screen",
                priceMonthly: 15,
                priceYearly: 150,
                sortOrder: 30,
            },
            {
                name: "Order display (ODS)",
                slug: "ods",
                addonKey: "ods",
                description: "Customer-facing order status screen",
                priceMonthly: 15,
                priceYearly: 150,
                sortOrder: 40,
            },
            {
                name: "Extra POS station",
                slug: "extra-pos",
                addonKey: "extra_pos_post",
                description: "One additional concurrent register",
                priceMonthly: 12,
                priceYearly: 120,
                quantity: 1,
                sortOrder: 50,
            },
            {
                name: "Extra waiter device",
                slug: "extra-waiter",
                addonKey: "extra_waiter_post",
                description: "One additional waiter station",
                priceMonthly: 8,
                priceYearly: 80,
                quantity: 1,
                sortOrder: 60,
            },
        ];
        for (const addon of defaults) {
            await this.create({ ...addon, ownerId: platformResellerId });
        }
        console.log("Seeded default subscription add-ons");
        await this.ensureMissingDefaultAddons(platformResellerId);
    }
    /** Add new catalog entries on existing installs without re-seeding everything. */
    static async ensureMissingDefaultAddons(platformResellerId) {
        const db = (0, db_1.getDb)();
        const { PlatformResellerService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-reseller.service")));
        const ownerId = platformResellerId || (await PlatformResellerService.ensure());
        const missing = [
            {
                name: "Just Eat integration",
                slug: "just-eat",
                addonKey: "just_eat",
                description: "Receive and manage Just Eat / JET Connect orders in POS",
                priceMonthly: 19,
                priceYearly: 190,
                sortOrder: 45,
            },
            {
                name: "Uber Eats integration",
                slug: "uber-eats",
                addonKey: "uber_eats",
                description: "Receive and manage Uber Eats orders in POS",
                priceMonthly: 19,
                priceYearly: 190,
                sortOrder: 46,
            },
            {
                name: "Storekeeper mobile app",
                slug: "storekeeper",
                addonKey: "storekeeper",
                description: "iPhone barcode scanning, stock intake, and POS publish for retail",
                priceMonthly: 15,
                priceYearly: 150,
                sortOrder: 15,
            },
        ];
        for (const addon of missing) {
            const existing = await db.query.subscriptionAddons.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.ownerId, ownerId), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionAddons.slug, addon.slug)),
            });
            if (!existing) {
                await this.create({ ...addon, ownerId });
            }
        }
    }
}
exports.SubscriptionAddonsService = SubscriptionAddonsService;
//# sourceMappingURL=subscription-addons.service.js.map