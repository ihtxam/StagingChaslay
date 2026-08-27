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
exports.SubscriptionPlansService = void 0;
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
class SubscriptionPlansService {
    /** Packages owned by one reseller (including Reborn Direct). */
    static async listForReseller(resellerId, includeInactive = true) {
        const db = (0, db_1.getDb)();
        const plans = await db.query.subscriptionPlans.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.ownerType, "reseller"), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.ownerId, resellerId)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.name)],
            with: { edition: true },
        });
        if (includeInactive)
            return plans;
        return plans.filter((p) => p.isActive);
    }
    static async listAll(includeInactive = true, opts) {
        if (!opts?.forResellerId) {
            const platformId = await platform_reseller_service_1.PlatformResellerService.getId();
            return this.listForReseller(platformId, includeInactive);
        }
        return this.listForReseller(opts.forResellerId, includeInactive);
    }
    /** @deprecated Use listForReseller(platformResellerId) */
    static async listPublic() {
        const platformId = await platform_reseller_service_1.PlatformResellerService.getId();
        return this.listForReseller(platformId, false).then((plans) => plans.filter((p) => p.isPublic));
    }
    static async listPublicForMerchant(merchantId) {
        const sellerId = await platform_reseller_service_1.PlatformResellerService.resolveForMerchant(merchantId);
        const db = (0, db_1.getDb)();
        return db.query.subscriptionPlans.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.isActive, true), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.isPublic, true), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.ownerType, "reseller"), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.ownerId, sellerId)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.name)],
            with: { edition: true },
        });
    }
    static async getById(id) {
        const db = (0, db_1.getDb)();
        const plan = await db.query.subscriptionPlans.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.id, id),
            with: { edition: true },
        });
        if (!plan)
            throw new Error("Plan not found");
        return plan;
    }
    static async getBySlug(slug) {
        const db = (0, db_1.getDb)();
        return db.query.subscriptionPlans.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.slug, normalizeSlug(slug)),
            with: { edition: true },
        });
    }
    static async create(input) {
        const db = (0, db_1.getDb)();
        const slug = normalizeSlug(input.slug || input.name);
        if (!slug)
            throw new Error("Plan slug is required");
        if (!input.name?.trim())
            throw new Error("Plan name is required");
        const existing = await this.getBySlug(slug);
        if (existing)
            throw new Error(`Plan slug "${slug}" already exists`);
        const ownerType = "reseller";
        const ownerId = input.ownerId;
        if (!ownerId)
            throw new Error("Reseller id is required for packages");
        const [plan] = await db
            .insert(db_1.schema.subscriptionPlans)
            .values({
            name: input.name.trim(),
            slug,
            description: input.description ?? null,
            priceMonthly: String(input.priceMonthly ?? 0),
            priceYearly: input.priceYearly === undefined || input.priceYearly === null || input.priceYearly === ""
                ? null
                : String(input.priceYearly),
            currency: (input.currency || "CHF").toUpperCase().slice(0, 3),
            editionId: input.editionId || null,
            maxDevices: input.maxDevices ?? 1,
            maxProducts: input.maxProducts ?? null,
            maxPosPosts: input.maxPosPosts ?? 0,
            maxWaiterPosts: input.maxWaiterPosts ?? 0,
            maxStaff: input.maxStaff ?? 0,
            includedAddons: input.includedAddons || {},
            features: input.features || [],
            isActive: input.isActive !== false,
            isPublic: input.isPublic !== false,
            sortOrder: input.sortOrder ?? 0,
            trialDays: input.trialDays ?? 0,
            ownerType,
            ownerId,
        })
            .returning();
        return plan;
    }
    static async update(id, input) {
        const db = (0, db_1.getDb)();
        await this.getById(id);
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = input.name.trim();
        if (input.slug !== undefined) {
            const slug = normalizeSlug(input.slug);
            if (!slug)
                throw new Error("Plan slug is required");
            const existing = await this.getBySlug(slug);
            if (existing && existing.id !== id)
                throw new Error(`Plan slug "${slug}" already exists`);
            patch.slug = slug;
        }
        if (input.description !== undefined)
            patch.description = input.description;
        if (input.priceMonthly !== undefined)
            patch.priceMonthly = String(input.priceMonthly);
        if (input.priceYearly !== undefined) {
            patch.priceYearly =
                input.priceYearly === null || input.priceYearly === ""
                    ? null
                    : String(input.priceYearly);
        }
        if (input.currency !== undefined)
            patch.currency = input.currency.toUpperCase().slice(0, 3);
        if (input.editionId !== undefined)
            patch.editionId = input.editionId || null;
        if (input.maxDevices !== undefined)
            patch.maxDevices = input.maxDevices;
        if (input.maxProducts !== undefined)
            patch.maxProducts = input.maxProducts;
        if (input.maxPosPosts !== undefined)
            patch.maxPosPosts = input.maxPosPosts;
        if (input.maxWaiterPosts !== undefined)
            patch.maxWaiterPosts = input.maxWaiterPosts;
        if (input.maxStaff !== undefined)
            patch.maxStaff = input.maxStaff;
        if (input.includedAddons !== undefined)
            patch.includedAddons = input.includedAddons;
        if (input.features !== undefined)
            patch.features = input.features;
        if (input.isActive !== undefined)
            patch.isActive = input.isActive;
        if (input.isPublic !== undefined)
            patch.isPublic = input.isPublic;
        if (input.sortOrder !== undefined)
            patch.sortOrder = input.sortOrder;
        if (input.trialDays !== undefined)
            patch.trialDays = input.trialDays;
        const [plan] = await db
            .update(db_1.schema.subscriptionPlans)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.id, id))
            .returning();
        return plan;
    }
    static async remove(id) {
        const db = (0, db_1.getDb)();
        await this.getById(id);
        const [plan] = await db
            .update(db_1.schema.subscriptionPlans)
            .set({ isActive: false, isPublic: false, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.id, id))
            .returning();
        return plan;
    }
    static async ensureDefaults() {
        const db = (0, db_1.getDb)();
        const { PlatformResellerService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-reseller.service")));
        const platformResellerId = await PlatformResellerService.ensure();
        await PlatformResellerService.migrateCatalogOwnership();
        const existing = await db.query.subscriptionPlans.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.ownerId, platformResellerId),
            limit: 1,
        });
        if (existing.length > 0)
            return;
        const { EditionService } = await Promise.resolve().then(() => __importStar(require("@/services/edition.service")));
        await EditionService.ensureDefaults();
        const retailEdition = await db.query.editions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerType, "platform"), (0, drizzle_orm_1.eq)(db_1.schema.editions.name, "Retail Basic")),
        });
        const restaurantEdition = await db.query.editions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerType, "platform"), (0, drizzle_orm_1.eq)(db_1.schema.editions.name, "Restaurant Pro")),
        });
        const defaults = [
            {
                name: "Free",
                slug: "free",
                description: "Get started with basic POS features",
                priceMonthly: 0,
                priceYearly: 0,
                editionId: retailEdition?.id,
                maxDevices: 1,
                maxProducts: 50,
                maxPosPosts: 1,
                maxWaiterPosts: 0,
                maxStaff: 3,
                features: ["1 POS station", "Up to 50 products", "Online shop"],
                sortOrder: 0,
            },
            {
                name: "Starter",
                slug: "starter",
                description: "For small food trucks and cafés",
                priceMonthly: 49,
                priceYearly: 490,
                editionId: restaurantEdition?.id,
                maxDevices: 2,
                maxProducts: 200,
                maxPosPosts: 2,
                maxWaiterPosts: 2,
                maxStaff: 5,
                features: ["2 POS stations", "2 waiter devices", "Up to 200 products", "Online shop", "Loyalty"],
                sortOrder: 10,
            },
            {
                name: "Professional",
                slug: "professional",
                description: "Growing restaurants with multi-device needs",
                priceMonthly: 99,
                priceYearly: 990,
                editionId: restaurantEdition?.id,
                maxDevices: 5,
                maxProducts: null,
                maxPosPosts: 5,
                maxWaiterPosts: 5,
                maxStaff: 15,
                includedAddons: { kds: true },
                features: ["5 POS stations", "5 waiter devices", "Unlimited products", "KDS included", "Priority support"],
                sortOrder: 20,
            },
            {
                name: "Enterprise",
                slug: "enterprise",
                description: "Multi-location and custom requirements",
                priceMonthly: 199,
                priceYearly: 1990,
                editionId: restaurantEdition?.id,
                maxDevices: 25,
                maxProducts: null,
                maxPosPosts: 0,
                maxWaiterPosts: 0,
                maxStaff: 0,
                includedAddons: { inventory: true, signage: true, kds: true, ods: true, signageScreenLimit: 5 },
                features: ["Unlimited stations", "All add-ons included", "Dedicated support"],
                sortOrder: 30,
            },
        ];
        for (const plan of defaults) {
            await this.create({ ...plan, ownerId: platformResellerId });
        }
        console.log("Seeded default subscription plans");
    }
}
exports.SubscriptionPlansService = SubscriptionPlansService;
//# sourceMappingURL=subscription-plans.service.js.map