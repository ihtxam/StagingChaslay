"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HqCatalogService = exports.BulkPricingService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const money_1 = require("@/lib/money");
const uuid_1 = require("uuid");
const previewCache = new Map();
const PREVIEW_TTL_MS = 15 * 60 * 1000;
function roundTo(value, step) {
    if (!step || step <= 0)
        return (0, money_1.roundMoney2)(value);
    return (0, money_1.roundMoney2)(Math.round(value / step) * step);
}
function applyOp(current, operation, valueType, value) {
    let next = current;
    if (operation === "decrease") {
        next = valueType === "percent" ? current * (1 - value / 100) : current - value;
    }
    else {
        next = valueType === "percent" ? current * (1 + value / 100) : current + value;
    }
    return Math.max(0, next);
}
class BulkPricingService {
    static async preview(merchantId, input) {
        const db = (0, db_1.getDb)();
        const productIds = (input.productIds || []).filter(Boolean);
        const categoryIds = (input.categoryIds || []).filter(Boolean);
        let products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
            columns: { id: true, name: true, categoryId: true, price: true, isActive: true },
        });
        if (productIds.length > 0) {
            const set = new Set(productIds);
            products = products.filter((p) => set.has(p.id));
        }
        else if (categoryIds.length > 0) {
            const set = new Set(categoryIds);
            products = products.filter((p) => p.categoryId && set.has(p.categoryId));
        }
        products = products.filter((p) => p.isActive !== false);
        const rows = products.map((p) => {
            const currentPrice = Number(p.price) || 0;
            const newPrice = roundTo(applyOp(currentPrice, input.operation, input.valueType, Number(input.value) || 0), input.roundTo);
            return {
                productId: p.id,
                name: p.name,
                categoryId: p.categoryId,
                currentPrice,
                newPrice,
            };
        });
        const token = (0, uuid_1.v4)();
        previewCache.set(token, {
            merchantId,
            rows,
            expires: Date.now() + PREVIEW_TTL_MS,
        });
        return { token, rows, affectedCount: rows.length };
    }
    static async apply(merchantId, previewToken, opts) {
        const cached = previewCache.get(previewToken);
        if (!cached || cached.merchantId !== merchantId || cached.expires < Date.now()) {
            throw new Error("Preview expired — run preview again");
        }
        previewCache.delete(previewToken);
        const db = (0, db_1.getDb)();
        const locationIds = opts?.locationIds || [];
        await db.transaction(async (tx) => {
            for (const row of cached.rows) {
                if (row.newPrice === row.currentPrice)
                    continue;
                if (locationIds.length > 0) {
                    for (const locationId of locationIds) {
                        const existing = await tx.query.locationProductOverrides.findFirst({
                            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.locationId, locationId), (0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.productId, row.productId)),
                        });
                        if (existing) {
                            await tx
                                .update(db_1.schema.locationProductOverrides)
                                .set({
                                priceOverride: row.newPrice.toFixed(2),
                                updatedAt: new Date(),
                            })
                                .where((0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.id, existing.id));
                        }
                        else {
                            await tx.insert(db_1.schema.locationProductOverrides).values({
                                merchantId,
                                locationId,
                                productId: row.productId,
                                priceOverride: row.newPrice.toFixed(2),
                            });
                        }
                    }
                }
                else {
                    await tx
                        .update(db_1.schema.products)
                        .set({ price: row.newPrice.toFixed(2), updatedAt: new Date() })
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, row.productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)));
                }
            }
            await tx.insert(db_1.schema.pricingBulkJobs).values({
                merchantId,
                locationIds,
                categoryIds: [],
                productIds: cached.rows.map((r) => r.productId),
                operation: "bulk",
                valueType: "mixed",
                value: "0",
                affectedCount: cached.rows.length,
                createdByStaffId: opts?.staffId || null,
                createdByName: opts?.staffName || null,
            });
        });
        return { affectedCount: cached.rows.length };
    }
    static async listJobs(merchantId, limit = 20) {
        const db = (0, db_1.getDb)();
        return db.query.pricingBulkJobs.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.pricingBulkJobs.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.pricingBulkJobs.createdAt)],
            limit,
        });
    }
}
exports.BulkPricingService = BulkPricingService;
class HqCatalogService {
    static async listVersions(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.hqCatalogVersions.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.hqCatalogVersions.createdAt)],
            limit: 50,
        });
    }
    static async createVersion(merchantId, input) {
        const db = (0, db_1.getDb)();
        const products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
        });
        let selected = products;
        if (input.productIds?.length) {
            const set = new Set(input.productIds);
            selected = products.filter((p) => set.has(p.id));
        }
        const payload = {
            products: selected.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: p.price,
                categoryId: p.categoryId,
                visibility: p.visibility,
                isActive: p.isActive,
            })),
            categories: await db.query.categories.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
            }),
        };
        const [latest] = await db
            .select({ max: (0, drizzle_orm_1.sql) `coalesce(max(${db_1.schema.hqCatalogVersions.version}), 0)` })
            .from(db_1.schema.hqCatalogVersions)
            .where((0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.merchantId, merchantId));
        const [row] = await db
            .insert(db_1.schema.hqCatalogVersions)
            .values({
            merchantId,
            version: Number(latest?.max || 0) + 1,
            name: input.name?.trim() || `HQ Menu v${Number(latest?.max || 0) + 1}`,
            payloadJson: payload,
            createdByStaffId: input.staffId || null,
        })
            .returning();
        return row;
    }
    static async pushToLocations(merchantId, input) {
        const db = (0, db_1.getDb)();
        const version = await db.query.hqCatalogVersions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.id, input.versionId), (0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.merchantId, merchantId)),
        });
        if (!version)
            throw new Error("HQ catalog version not found");
        const payload = version.payloadJson;
        const hqProducts = payload.products || [];
        let linked = 0;
        for (const locationId of input.locationIds) {
            for (const hp of hqProducts) {
                const local = await db.query.products.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.id, hp.id)),
                });
                if (!local)
                    continue;
                const existingLink = await db.query.locationCatalogLinks.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locationCatalogLinks.locationId, locationId), (0, drizzle_orm_1.eq)(db_1.schema.locationCatalogLinks.hqProductId, hp.id)),
                });
                if (existingLink) {
                    await db
                        .update(db_1.schema.locationCatalogLinks)
                        .set({
                        localProductId: local.id,
                        syncStatus: "synced",
                        fromHqVersionId: version.id,
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(db_1.schema.locationCatalogLinks.id, existingLink.id));
                }
                else {
                    await db.insert(db_1.schema.locationCatalogLinks).values({
                        merchantId,
                        locationId,
                        hqProductId: hp.id,
                        localProductId: local.id,
                        syncStatus: "synced",
                        fromHqVersionId: version.id,
                    });
                }
                if (input.overwritePrices) {
                    const override = await db.query.locationProductOverrides.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.locationId, locationId), (0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.productId, local.id)),
                    });
                    const price = String(hp.price);
                    if (override) {
                        await db
                            .update(db_1.schema.locationProductOverrides)
                            .set({ priceOverride: price, updatedAt: new Date() })
                            .where((0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.id, override.id));
                    }
                    else {
                        await db.insert(db_1.schema.locationProductOverrides).values({
                            merchantId,
                            locationId,
                            productId: local.id,
                            priceOverride: price,
                        });
                    }
                }
                linked += 1;
            }
        }
        return { linked, locationCount: input.locationIds.length };
    }
    static async listLocationLinks(merchantId, locationId) {
        const db = (0, db_1.getDb)();
        return db.query.locationCatalogLinks.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locationCatalogLinks.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locationCatalogLinks.locationId, locationId)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.locationCatalogLinks.createdAt)],
        });
    }
}
exports.HqCatalogService = HqCatalogService;
//# sourceMappingURL=hq-catalog.service.js.map