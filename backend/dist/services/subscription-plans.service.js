"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlansService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
function normalizeSlug(slug) {
    return slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}
class SubscriptionPlansService {
    static async listAll(includeInactive = true) {
        const db = (0, db_1.getDb)();
        const plans = await db.query.subscriptionPlans.findMany({
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.name)],
        });
        if (includeInactive)
            return plans;
        return plans.filter((p) => p.isActive);
    }
    /** Plans merchants can see / buy */
    static async listPublic() {
        const db = (0, db_1.getDb)();
        return db.query.subscriptionPlans.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.isActive, true), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.isPublic, true)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.subscriptionPlans.name)],
        });
    }
    static async getById(id) {
        const db = (0, db_1.getDb)();
        const plan = await db.query.subscriptionPlans.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.id, id),
        });
        if (!plan)
            throw new Error("Plan not found");
        return plan;
    }
    static async getBySlug(slug) {
        const db = (0, db_1.getDb)();
        return db.query.subscriptionPlans.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.slug, normalizeSlug(slug)),
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
            maxDevices: input.maxDevices ?? 1,
            maxProducts: input.maxProducts ?? null,
            features: input.features || [],
            isActive: input.isActive !== false,
            isPublic: input.isPublic !== false,
            sortOrder: input.sortOrder ?? 0,
            trialDays: input.trialDays ?? 0,
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
        if (input.maxDevices !== undefined)
            patch.maxDevices = input.maxDevices;
        if (input.maxProducts !== undefined)
            patch.maxProducts = input.maxProducts;
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
        // Soft-deactivate so payment history stays valid
        const [plan] = await db
            .update(db_1.schema.subscriptionPlans)
            .set({ isActive: false, isPublic: false, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPlans.id, id))
            .returning();
        return plan;
    }
    /** Seed default plans if table is empty */
    static async ensureDefaults() {
        const db = (0, db_1.getDb)();
        const existing = await db.query.subscriptionPlans.findMany({ limit: 1 });
        if (existing.length > 0)
            return;
        const defaults = [
            {
                name: "Free",
                slug: "free",
                description: "Get started with basic POS features",
                priceMonthly: 0,
                priceYearly: 0,
                maxDevices: 1,
                maxProducts: 50,
                features: ["1 device", "Up to 50 products", "Online shop"],
                sortOrder: 0,
            },
            {
                name: "Starter",
                slug: "starter",
                description: "For small food trucks and cafés",
                priceMonthly: 49,
                priceYearly: 490,
                maxDevices: 2,
                maxProducts: 200,
                features: ["2 devices", "Up to 200 products", "Online shop", "Loyalty"],
                sortOrder: 10,
            },
            {
                name: "Professional",
                slug: "professional",
                description: "Growing restaurants with multi-device needs",
                priceMonthly: 99,
                priceYearly: 990,
                maxDevices: 5,
                maxProducts: null,
                features: ["5 devices", "Unlimited products", "Floor plan", "Priority support"],
                sortOrder: 20,
            },
            {
                name: "Enterprise",
                slug: "enterprise",
                description: "Multi-location and custom requirements",
                priceMonthly: 199,
                priceYearly: 1990,
                maxDevices: 25,
                maxProducts: null,
                features: ["25 devices", "Unlimited products", "Dedicated support", "Custom SLA"],
                sortOrder: 30,
            },
        ];
        for (const plan of defaults) {
            await this.create(plan);
        }
        console.log("Seeded default subscription plans");
    }
}
exports.SubscriptionPlansService = SubscriptionPlansService;
//# sourceMappingURL=subscription-plans.service.js.map