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
exports.LocationsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
function slugify(name) {
    const base = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return base || "location";
}
class LocationsService {
    static async ensureDefaults(merchantId) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            await (0, ensure_merchant_schema_1.ensureLocationsSchema)();
            const db = (0, db_1.getDb)();
            const existing = await db.query.locations.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.locations.createdAt)],
            });
            if (existing)
                return existing;
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                columns: {
                    name: true,
                    businessCategory: true,
                    address: true,
                    city: true,
                    country: true,
                },
            });
            if (!merchant)
                throw new Error("Merchant not found");
            const [row] = await db
                .insert(db_1.schema.locations)
                .values({
                merchantId,
                name: merchant.name?.trim() || "Main location",
                slug: "main",
                businessCategory: merchant.businessCategory || "restaurant",
                address: merchant.address,
                city: merchant.city,
                country: merchant.country,
                isDefault: true,
                status: "active",
            })
                .returning();
            return row;
        });
    }
    static async getDefaultId(merchantId) {
        const row = await this.ensureDefaults(merchantId);
        return row.id;
    }
    static async resolveLocationIdOrNull(merchantId, locationId) {
        const id = String(locationId || "").trim();
        if (!id)
            return null;
        const db = (0, db_1.getDb)();
        const row = await db.query.locations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId)),
        });
        return row?.id ?? null;
    }
    static async resolveLocationId(merchantId, locationId) {
        const id = String(locationId || "").trim();
        if (!id)
            return this.getDefaultId(merchantId);
        const resolved = await this.resolveLocationIdOrNull(merchantId, id);
        if (!resolved)
            throw new Error("Location not found");
        return resolved;
    }
    static async resolveBySlug(merchantId, slug) {
        const db = (0, db_1.getDb)();
        const normalized = String(slug || "")
            .trim()
            .toLowerCase();
        if (!normalized)
            return null;
        return ((await db.query.locations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locations.slug, normalized), (0, drizzle_orm_1.eq)(db_1.schema.locations.status, "active")),
        })) ?? null);
    }
    static async listPublicForShop(merchantId) {
        await this.ensureDefaults(merchantId);
        const db = (0, db_1.getDb)();
        return db.query.locations.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locations.status, "active")),
            columns: {
                id: true,
                name: true,
                slug: true,
                businessCategory: true,
                address: true,
                city: true,
                isDefault: true,
            },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.locations.isDefault), (0, drizzle_orm_1.asc)(db_1.schema.locations.name)],
        });
    }
    static async listForUser(merchantId, opts) {
        await this.ensureDefaults(merchantId);
        const db = (0, db_1.getDb)();
        const rows = await db.query.locations.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locations.status, "active")),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.locations.isDefault), (0, drizzle_orm_1.asc)(db_1.schema.locations.name)],
        });
        if (opts?.isOwner || !opts?.staffId)
            return rows;
        const scoped = await db.query.merchantStaffLocations.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.staffId, opts.staffId)),
        });
        if (scoped.length === 0)
            return rows;
        const allowed = new Set(scoped.map((s) => s.locationId));
        return rows.filter((r) => allowed.has(r.id));
    }
    static async assertStaffAccess(merchantId, locationId, opts) {
        if (opts?.isOwner || !opts?.staffId)
            return;
        const db = (0, db_1.getDb)();
        const scoped = await db.query.merchantStaffLocations.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.staffId, opts.staffId)),
        });
        if (scoped.length === 0)
            return;
        if (!scoped.some((s) => s.locationId === locationId)) {
            throw new Error("You do not have access to this location");
        }
    }
    static async countActive(merchantId) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .select({ total: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.locations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locations.status, "active")));
        return Number(row?.total) || 0;
    }
    static async assertCanCreate(merchantId) {
        const { MerchantEntitlementsService } = await Promise.resolve().then(() => __importStar(require("@/services/merchant-entitlements.service")));
        await MerchantEntitlementsService.assertCanAddLocation(merchantId);
    }
    static async create(merchantId, input) {
        await this.assertCanCreate(merchantId);
        const db = (0, db_1.getDb)();
        const name = String(input.name || "").trim();
        if (!name)
            throw new Error("Location name is required");
        let slug = slugify(input.slug || name);
        const taken = await db.query.locations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locations.slug, slug)),
        });
        if (taken)
            slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        if (input.isDefault) {
            await db
                .update(db_1.schema.locations)
                .set({ isDefault: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId));
        }
        const [row] = await db
            .insert(db_1.schema.locations)
            .values({
            merchantId,
            name,
            slug,
            businessCategory: input.businessCategory || "restaurant",
            address: input.address || null,
            city: input.city || null,
            country: input.country || null,
            timezone: input.timezone || "Europe/Zurich",
            isDefault: !!input.isDefault,
            status: "active",
        })
            .returning();
        return row;
    }
    static async update(merchantId, locationId, input) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.locations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.id, locationId), (0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Location not found");
        if (input.isDefault) {
            await db
                .update(db_1.schema.locations)
                .set({ isDefault: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId));
        }
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = String(input.name).trim();
        if (input.slug !== undefined)
            patch.slug = slugify(input.slug);
        if (input.businessCategory !== undefined)
            patch.businessCategory = input.businessCategory;
        if (input.address !== undefined)
            patch.address = input.address;
        if (input.city !== undefined)
            patch.city = input.city;
        if (input.country !== undefined)
            patch.country = input.country;
        if (input.timezone !== undefined)
            patch.timezone = input.timezone;
        if (input.isDefault !== undefined)
            patch.isDefault = input.isDefault;
        if (input.status !== undefined)
            patch.status = input.status;
        if (input.settings !== undefined)
            patch.settings = input.settings;
        const [row] = await db
            .update(db_1.schema.locations)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.locations.id, locationId))
            .returning();
        return row;
    }
    static async remove(merchantId, locationId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.locations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.id, locationId), (0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Location not found");
        if (existing.isDefault)
            throw new Error("Cannot delete the default location");
        const activeCount = await this.countActive(merchantId);
        if (activeCount <= 1)
            throw new Error("At least one location is required");
        await db
            .update(db_1.schema.locations)
            .set({ status: "archived", updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.locations.id, locationId));
        return { success: true };
    }
    static async getStaffLocationIds(merchantId, staffId) {
        const db = (0, db_1.getDb)();
        const rows = await db.query.merchantStaffLocations.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.staffId, staffId)),
        });
        return rows.map((r) => r.locationId);
    }
    static async setStaffLocations(merchantId, staffId, locationIds) {
        const db = (0, db_1.getDb)();
        const unique = [...new Set(locationIds.filter(Boolean))];
        if (unique.length > 0) {
            const valid = await db.query.locations.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.locations.id, unique)),
            });
            if (valid.length !== unique.length)
                throw new Error("Invalid location id");
        }
        await db
            .delete(db_1.schema.merchantStaffLocations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaffLocations.staffId, staffId)));
        if (unique.length === 0)
            return [];
        const inserted = await db
            .insert(db_1.schema.merchantStaffLocations)
            .values(unique.map((locationId) => ({
            merchantId,
            staffId,
            locationId,
        })))
            .returning();
        return inserted.map((r) => r.locationId);
    }
}
exports.LocationsService = LocationsService;
//# sourceMappingURL=locations.service.js.map