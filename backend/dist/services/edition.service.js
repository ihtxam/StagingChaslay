"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditionService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const edition_features_1 = require("@/lib/edition-features");
const business_module_1 = require("@/lib/business-module");
function serialize(row) {
    return {
        id: row.id,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        name: row.name,
        note: row.note,
        businessCategory: row.businessCategory,
        features: (0, edition_features_1.normalizeEditionFeatures)(row.features),
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
class EditionService {
    static async ensureDefaults() {
        const db = (0, db_1.getDb)();
        const existing = await db
            .select({ id: db_1.schema.editions.id })
            .from(db_1.schema.editions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerType, "platform"), (0, drizzle_orm_1.eq)(db_1.schema.editions.name, "Full / Legacy")))
            .limit(1);
        if (existing.length)
            return;
        const restaurantFeatures = edition_features_1.ALL_EDITION_FEATURES.filter((k) => k !== "pos_retail" && k !== "pos_scale");
        const retailFeatures = edition_features_1.ALL_EDITION_FEATURES.filter((k) => !["pos_tables", "pos_courses", "pos_kitchen", "reservations"].includes(k));
        await db.insert(db_1.schema.editions).values([
            {
                ownerType: "platform",
                ownerId: null,
                name: "Full / Legacy",
                note: "All features (default for existing merchants)",
                businessCategory: "both",
                features: [...edition_features_1.ALL_EDITION_FEATURES],
                isActive: true,
            },
            {
                ownerType: "platform",
                ownerId: null,
                name: "Restaurant Pro",
                note: "Tables, kitchen, courses, channels",
                businessCategory: "restaurant",
                features: restaurantFeatures,
                isActive: true,
            },
            {
                ownerType: "platform",
                ownerId: null,
                name: "Retail Basic",
                note: "Direct sales, barcode-friendly, no tables/kitchen",
                businessCategory: "retail",
                features: retailFeatures,
                isActive: true,
            },
        ]);
    }
    static async list(opts) {
        await this.ensureDefaults();
        const db = (0, db_1.getDb)();
        const clauses = [];
        if (opts?.forResellerId) {
            clauses.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerType, "platform"), (0, drizzle_orm_1.isNull)(db_1.schema.editions.ownerId)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerType, "reseller"), (0, drizzle_orm_1.eq)(db_1.schema.editions.ownerId, opts.forResellerId))));
        }
        else if (opts?.ownerType) {
            clauses.push((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerType, opts.ownerType));
            if (opts.ownerType === "platform") {
                clauses.push((0, drizzle_orm_1.isNull)(db_1.schema.editions.ownerId));
            }
            else if (opts.ownerId) {
                clauses.push((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerId, opts.ownerId));
            }
        }
        if (!opts?.includeInactive) {
            clauses.push((0, drizzle_orm_1.eq)(db_1.schema.editions.isActive, true));
        }
        const rows = await db
            .select()
            .from(db_1.schema.editions)
            .where(clauses.length ? (0, drizzle_orm_1.and)(...clauses) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.editions.createdAt));
        return rows.map(serialize);
    }
    static async getById(id) {
        const db = (0, db_1.getDb)();
        const row = await db.query.editions.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.editions.id, id),
        });
        return row ? serialize(row) : null;
    }
    static async create(input) {
        const db = (0, db_1.getDb)();
        const ownerType = input.ownerType || "platform";
        const features = (0, edition_features_1.normalizeEditionFeatures)(input.features ?? edition_features_1.ALL_EDITION_FEATURES);
        const [row] = await db
            .insert(db_1.schema.editions)
            .values({
            name: String(input.name || "").trim(),
            note: input.note?.trim() || null,
            businessCategory: ["retail", "restaurant", "both"].includes(String(input.businessCategory))
                ? String(input.businessCategory)
                : "both",
            features,
            ownerType,
            ownerId: ownerType === "reseller" ? input.ownerId || null : null,
            isActive: input.isActive !== false,
        })
            .returning();
        if (!row)
            throw new Error("Failed to create edition");
        return serialize(row);
    }
    static async update(id, input, opts) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.editions.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.editions.id, id),
        });
        if (!existing)
            throw new Error("Edition not found");
        if (opts?.requireOwnerType && existing.ownerType !== opts.requireOwnerType) {
            throw new Error("Edition not found");
        }
        if (opts?.requireOwnerId && existing.ownerId !== opts.requireOwnerId) {
            throw new Error("Edition not found");
        }
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = String(input.name).trim();
        if (input.note !== undefined)
            patch.note = input.note?.trim() || null;
        if (input.businessCategory !== undefined) {
            patch.businessCategory = ["retail", "restaurant", "both"].includes(String(input.businessCategory))
                ? String(input.businessCategory)
                : existing.businessCategory;
        }
        if (input.features !== undefined)
            patch.features = (0, edition_features_1.normalizeEditionFeatures)(input.features);
        if (input.isActive !== undefined)
            patch.isActive = !!input.isActive;
        const [row] = await db
            .update(db_1.schema.editions)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.editions.id, id))
            .returning();
        return serialize(row);
    }
    static async softDelete(id, opts) {
        return this.update(id, { isActive: false }, opts);
    }
    static async cloneForReseller(sourceId, resellerId, name) {
        const src = await this.getById(sourceId);
        if (!src)
            throw new Error("Source edition not found");
        return this.create({
            name: name?.trim() || `${src.name} (copy)`,
            note: src.note,
            businessCategory: src.businessCategory,
            features: src.features,
            ownerType: "reseller",
            ownerId: resellerId,
        });
    }
    /** Features for a merchant; null means legacy full access */
    static async getMerchantFeatures(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { editionId: true },
        });
        if (!merchant?.editionId)
            return null;
        const edition = await this.getById(merchant.editionId);
        if (!edition || !edition.isActive)
            return null;
        return edition.features;
    }
    static async applyEditionDefaultsToMerchant(merchantId, editionId, opts) {
        const edition = await this.getById(editionId);
        if (!edition)
            return;
        const module = (0, business_module_1.businessModuleFromEditionCategory)(edition.businessCategory, (0, business_module_1.normalizeBusinessModule)(opts?.businessCategory));
        const defaults = (0, edition_features_1.retailDefaultsFromFeatures)(edition.features);
        const db = (0, db_1.getDb)();
        const checkout = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { posCheckoutSettings: true },
        });
        const prev = checkout?.posCheckoutSettings && typeof checkout.posCheckoutSettings === "object"
            ? { ...checkout.posCheckoutSettings }
            : {};
        prev.posMode = module === "retail" ? "retail" : defaults.posMode;
        if (module === "retail") {
            prev.retailTakeawayEnabled = edition.features.includes("channel_takeaway");
            prev.retailDeliveryEnabled = edition.features.includes("channel_delivery");
        }
        const modulePatch = (0, business_module_1.businessModuleMerchantPatch)(module, prev);
        await db
            .update(db_1.schema.merchants)
            .set({
            editionId,
            floorPlanEnabled: module === "retail" ? false : defaults.floorPlanEnabled,
            coursesEnabled: module === "retail" ? false : defaults.coursesEnabled,
            reservationsEnabled: module === "retail" ? false : defaults.reservationsEnabled,
            shopEnabled: defaults.shopEnabled,
            pickupEnabled: defaults.pickupEnabled,
            deliveryEnabled: defaults.deliveryEnabled,
            loyaltyEnabled: defaults.loyaltyEnabled,
            webposGiftCardEnabled: defaults.webposGiftCardEnabled,
            businessCategory: module,
            posCheckoutSettings: modulePatch.posCheckoutSettings,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
    }
    static async getLegacyFullEditionId() {
        await this.ensureDefaults();
        const db = (0, db_1.getDb)();
        const row = await db.query.editions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.editions.ownerType, "platform"), (0, drizzle_orm_1.eq)(db_1.schema.editions.name, "Full / Legacy")),
        });
        return row?.id ?? null;
    }
}
exports.EditionService = EditionService;
//# sourceMappingURL=edition.service.js.map