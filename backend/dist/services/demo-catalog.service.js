"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoCatalogService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
const db_1 = require("@/db");
const demo_catalog_data_1 = require("@/lib/demo-catalog.data");
const barcode_service_1 = require("@/services/barcode.service");
const modifier_service_1 = require("@/services/modifier.service");
function norm(s) {
    return s.trim().toLowerCase();
}
function productConflictKey(name, sku) {
    const trimmedSku = sku?.trim();
    if (trimmedSku)
        return `sku:${norm(trimmedSku)}`;
    return `name:${norm(name)}`;
}
class DemoCatalogService {
    static async importDemo(merchantId, options = {}) {
        const db = (0, db_1.getDb)();
        const [{ existing }] = await db
            .select({ existing: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.categories)
            .where((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId));
        const hasExisting = Number(existing) > 0;
        const mode = options.mode === "replace" || options.mode === "merge"
            ? options.mode
            : options.force === true
                ? "replace"
                : hasExisting
                    ? (() => {
                        throw new Error("Catalog already has categories. Pass mode: 'replace' or 'merge'.");
                    })()
                    : "merge";
        const categoryIds = new Map();
        const groupIds = new Map();
        const productIds = new Map();
        const linkedProductIds = [];
        const counters = {
            categoriesCreated: 0,
            productsCreated: 0,
            modifierGroupsCreated: 0,
            combosCreated: 0,
            categoriesSkipped: 0,
            productsSkipped: 0,
            modifierGroupsSkipped: 0,
            combosSkipped: 0,
        };
        await db.transaction(async (tx) => {
            if (mode === "replace" && hasExisting) {
                await tx.delete(db_1.schema.products).where((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId));
                await tx
                    .delete(db_1.schema.modifierGroups)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId));
                await tx.delete(db_1.schema.categories).where((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId));
            }
            const existingCategories = mode === "merge"
                ? await tx
                    .select({
                    id: db_1.schema.categories.id,
                    name: db_1.schema.categories.name,
                    sortOrder: db_1.schema.categories.sortOrder,
                })
                    .from(db_1.schema.categories)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId))
                : [];
            const categoryByName = new Map(existingCategories.map((c) => [norm(c.name), c]));
            let categorySortBase = existingCategories.reduce((maxSoFar, c) => Math.max(maxSoFar, c.sortOrder ?? 0), -1) + 1;
            const existingProducts = mode === "merge"
                ? await tx
                    .select({
                    id: db_1.schema.products.id,
                    name: db_1.schema.products.name,
                    sku: db_1.schema.products.sku,
                    barcode: db_1.schema.products.barcode,
                    clientId: db_1.schema.products.clientId,
                    sortOrder: db_1.schema.products.sortOrder,
                })
                    .from(db_1.schema.products)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId))
                : [];
            const takenBarcodes = new Set(existingProducts
                .map((p) => String(p.barcode || "").trim())
                .filter(Boolean));
            const productByKey = new Map();
            for (const p of existingProducts) {
                productByKey.set(productConflictKey(p.name, p.sku), {
                    id: p.id,
                    sortOrder: p.sortOrder ?? 0,
                });
                if (p.clientId?.trim()) {
                    productByKey.set(`client:${norm(p.clientId)}`, {
                        id: p.id,
                        sortOrder: p.sortOrder ?? 0,
                    });
                }
            }
            let productSortBase = existingProducts.reduce((maxSoFar, p) => Math.max(maxSoFar, p.sortOrder ?? 0), -1) + 1;
            let comboSortBase = mode === "merge" ? productSortBase : demo_catalog_data_1.DEMO_PRODUCTS.length;
            const existingGroups = mode === "merge"
                ? await tx
                    .select({
                    id: db_1.schema.modifierGroups.id,
                    title: db_1.schema.modifierGroups.title,
                    sortOrder: db_1.schema.modifierGroups.sortOrder,
                })
                    .from(db_1.schema.modifierGroups)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId))
                : [];
            const groupByTitle = new Map(existingGroups.map((g) => [norm(g.title), g]));
            let groupSortBase = existingGroups.reduce((maxSoFar, g) => Math.max(maxSoFar, g.sortOrder ?? 0), -1) + 1;
            for (let i = 0; i < demo_catalog_data_1.DEMO_CATEGORIES.length; i++) {
                const cat = demo_catalog_data_1.DEMO_CATEGORIES[i];
                const existing = mode === "merge" ? categoryByName.get(norm(cat.name)) : undefined;
                if (existing) {
                    categoryIds.set(cat.key, existing.id);
                    counters.categoriesSkipped++;
                    continue;
                }
                const [row] = await tx
                    .insert(db_1.schema.categories)
                    .values({
                    merchantId,
                    name: cat.name,
                    description: cat.description,
                    color: cat.color,
                    sortOrder: mode === "merge" ? categorySortBase++ : i,
                    clientId: `demo-cat-${cat.key}`,
                })
                    .returning({ id: db_1.schema.categories.id });
                categoryIds.set(cat.key, row.id);
                counters.categoriesCreated++;
            }
            for (let gi = 0; gi < demo_catalog_data_1.DEMO_MODIFIER_GROUPS.length; gi++) {
                const g = demo_catalog_data_1.DEMO_MODIFIER_GROUPS[gi];
                const existing = mode === "merge" ? groupByTitle.get(norm(g.title)) : undefined;
                if (existing) {
                    groupIds.set(g.key, existing.id);
                    counters.modifierGroupsSkipped++;
                    continue;
                }
                const minSelectable = g.selectionType === "required"
                    ? Math.max(1, g.minSelectable ?? 1)
                    : Math.max(0, g.minSelectable ?? 0);
                const maxSelectable = Math.max(minSelectable, g.maxSelectable ?? 1);
                const [group] = await tx
                    .insert(db_1.schema.modifierGroups)
                    .values({
                    merchantId,
                    title: g.title,
                    pricingType: g.pricingType,
                    selectionType: g.selectionType,
                    minSelectable,
                    maxSelectable,
                    sortOrder: mode === "merge" ? groupSortBase++ : gi,
                })
                    .returning({ id: db_1.schema.modifierGroups.id });
                groupIds.set(g.key, group.id);
                counters.modifierGroupsCreated++;
                if (g.options.length) {
                    await tx.insert(db_1.schema.modifierOptions).values(g.options.map((o, oi) => ({
                        groupId: group.id,
                        name: o.name,
                        price: g.pricingType === "free" ? "0" : String(o.price ?? 0),
                        isDefault: !!o.isDefault,
                        sortOrder: oi,
                    })));
                }
            }
            for (let pi = 0; pi < demo_catalog_data_1.DEMO_PRODUCTS.length; pi++) {
                const p = demo_catalog_data_1.DEMO_PRODUCTS[pi];
                const categoryId = categoryIds.get(p.categoryKey);
                if (!categoryId)
                    continue;
                const demoClientId = `demo-prod-${p.key}`;
                const conflictKey = productConflictKey(p.name, p.sku);
                const existing = mode === "merge"
                    ? productByKey.get(conflictKey) ||
                        productByKey.get(`client:${norm(demoClientId)}`)
                    : undefined;
                if (existing) {
                    productIds.set(p.key, existing.id);
                    counters.productsSkipped++;
                    continue;
                }
                const [row] = await tx
                    .insert(db_1.schema.products)
                    .values({
                    merchantId,
                    categoryId,
                    name: p.name,
                    description: p.description,
                    price: p.price.toFixed(2),
                    stock: p.stock ?? 100,
                    sku: p.sku,
                    barcode: (0, barcode_service_1.allocateInternalBarcode)(takenBarcodes),
                    isActive: true,
                    isTaxable: true,
                    productType: "standard",
                    sortOrder: mode === "merge" ? productSortBase++ : pi,
                    clientId: demoClientId,
                })
                    .returning({ id: db_1.schema.products.id });
                productIds.set(p.key, row.id);
                counters.productsCreated++;
                const groupKeys = p.modifierGroupKeys || [];
                if (groupKeys.length) {
                    linkedProductIds.push(row.id);
                    await tx.insert(db_1.schema.productModifierGroups).values(groupKeys
                        .filter((gk) => groupIds.has(gk))
                        .map((gk, idx) => ({
                        productId: row.id,
                        groupId: groupIds.get(gk),
                        sortOrder: idx,
                    })));
                }
            }
            for (const combo of demo_catalog_data_1.DEMO_COMBOS) {
                const categoryId = categoryIds.get(combo.categoryKey);
                if (!categoryId) {
                    counters.combosSkipped++;
                    continue;
                }
                const demoClientId = `demo-combo-${combo.key}`;
                const conflictKey = productConflictKey(combo.name, combo.sku);
                const existing = mode === "merge"
                    ? productByKey.get(conflictKey) ||
                        productByKey.get(`client:${norm(demoClientId)}`)
                    : undefined;
                if (existing) {
                    productIds.set(combo.key, existing.id);
                    counters.combosSkipped++;
                    continue;
                }
                const slotProductKeys = combo.slots.flatMap((slot) => slot.productKeys);
                if (slotProductKeys.some((pk) => !productIds.has(pk))) {
                    counters.combosSkipped++;
                    continue;
                }
                const comboItems = combo.slots.map((slot) => ({
                    id: (0, uuid_1.v4)(),
                    name: slot.name,
                    minPick: slot.minPick,
                    maxPick: slot.maxPick,
                    options: slot.productKeys.map((pk, oi) => ({
                        productId: productIds.get(pk),
                        extraPrice: slot.extraPrices?.[oi] ?? 0,
                    })),
                }));
                const [row] = await tx
                    .insert(db_1.schema.products)
                    .values({
                    merchantId,
                    categoryId,
                    name: combo.name,
                    description: combo.description,
                    price: combo.price.toFixed(2),
                    stock: 100,
                    sku: combo.sku,
                    barcode: (0, barcode_service_1.allocateInternalBarcode)(takenBarcodes),
                    isActive: true,
                    isTaxable: true,
                    productType: "combo",
                    comboItems,
                    sortOrder: mode === "merge" ? productSortBase++ : comboSortBase++,
                    clientId: demoClientId,
                })
                    .returning({ id: db_1.schema.products.id });
                productIds.set(combo.key, row.id);
                counters.combosCreated++;
            }
        });
        for (const productId of linkedProductIds) {
            await modifier_service_1.ModifierService.refreshProductExtras(merchantId, productId);
        }
        return {
            success: true,
            mode,
            categoriesCreated: counters.categoriesCreated,
            productsCreated: counters.productsCreated + counters.combosCreated,
            modifierGroupsCreated: counters.modifierGroupsCreated,
            combosCreated: counters.combosCreated,
            categoriesSkipped: counters.categoriesSkipped,
            productsSkipped: counters.productsSkipped,
            modifierGroupsSkipped: counters.modifierGroupsSkipped,
            combosSkipped: counters.combosSkipped,
            categoryNames: demo_catalog_data_1.DEMO_CATEGORIES.map((c) => c.name),
        };
    }
    /** True when demo catalog products exist (clientId demo-prod-* / demo-combo-*). */
    static async hasDemoData(merchantId) {
        const db = (0, db_1.getDb)();
        const [{ n }] = await db
            .select({ n: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(db_1.schema.products.clientId, "demo-prod-%"), (0, drizzle_orm_1.like)(db_1.schema.products.clientId, "demo-combo-%"))));
        return Number(n) > 0;
    }
    /**
     * Removes imported demo catalog only (clientId prefix demo-prod- / demo-combo- / demo-cat-).
     * Real merchant products and categories are never touched.
     */
    static async deleteDemo(merchantId) {
        const db = (0, db_1.getDb)();
        const demoProductRows = await db
            .select({ id: db_1.schema.products.id })
            .from(db_1.schema.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(db_1.schema.products.clientId, "demo-prod-%"), (0, drizzle_orm_1.like)(db_1.schema.products.clientId, "demo-combo-%"))));
        const demoProductIds = demoProductRows.map((r) => r.id);
        if (demoProductIds.length) {
            await db.delete(db_1.schema.products).where((0, drizzle_orm_1.inArray)(db_1.schema.products.id, demoProductIds));
        }
        const demoCategories = await db
            .select({ id: db_1.schema.categories.id })
            .from(db_1.schema.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId), (0, drizzle_orm_1.like)(db_1.schema.categories.clientId, "demo-cat-%")));
        let categoriesDeleted = 0;
        for (const cat of demoCategories) {
            const [{ remaining }] = await db
                .select({ remaining: (0, drizzle_orm_1.count)() })
                .from(db_1.schema.products)
                .where((0, drizzle_orm_1.eq)(db_1.schema.products.categoryId, cat.id));
            if (Number(remaining) === 0) {
                await db.delete(db_1.schema.categories).where((0, drizzle_orm_1.eq)(db_1.schema.categories.id, cat.id));
                categoriesDeleted++;
            }
        }
        const demoGroupTitles = demo_catalog_data_1.DEMO_MODIFIER_GROUPS.map((g) => g.title.trim());
        const groups = await db.query.modifierGroups.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId),
            columns: { id: true, title: true },
            with: { productLinks: { columns: { productId: true } } },
        });
        let modifierGroupsDeleted = 0;
        for (const group of groups) {
            if (!demoGroupTitles.includes(group.title.trim()))
                continue;
            if (group.productLinks.length > 0)
                continue;
            await db.delete(db_1.schema.modifierGroups).where((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.id, group.id));
            modifierGroupsDeleted++;
        }
        return {
            success: true,
            productsDeleted: demoProductIds.length,
            categoriesDeleted,
            modifierGroupsDeleted,
        };
    }
}
exports.DemoCatalogService = DemoCatalogService;
//# sourceMappingURL=demo-catalog.service.js.map