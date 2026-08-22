"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModifierService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
function normalizePricing(type) {
    if (type === "free" || type === "toppings_by_size")
        return type;
    return "fixed";
}
function normalizeSelection(type) {
    return type === "required" ? "required" : "optional";
}
const OPTION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function publicOption(o) {
    const qty = parseFloat(o.inventoryQty?.toString() || "0");
    return {
        id: o.id,
        name: o.name,
        price: parseFloat(o.price?.toString() || "0"),
        saleStatus: o.saleStatus || "in_stock",
        isDefault: !!o.isDefault,
        sortOrder: o.sortOrder ?? 0,
        inventoryItemId: o.inventoryItemId || null,
        inventoryQty: Number.isFinite(qty) ? qty : 0,
    };
}
class ModifierService {
    static async list(merchantId) {
        const db = (0, db_1.getDb)();
        const groups = await db.query.modifierGroups.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId),
            with: {
                options: { orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.modifierOptions.sortOrder)] },
                productLinks: {
                    with: {
                        product: {
                            with: { category: true },
                        },
                    },
                    orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.productModifierGroups.sortOrder)],
                },
            },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.modifierGroups.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.modifierGroups.title)],
        });
        return groups.map((g) => this.serializeGroup(g));
    }
    static async getById(merchantId, groupId) {
        const db = (0, db_1.getDb)();
        const group = await db.query.modifierGroups.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.id, groupId), (0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId)),
            with: {
                options: { orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.modifierOptions.sortOrder)] },
                productLinks: {
                    with: {
                        product: { with: { category: true } },
                    },
                    orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.productModifierGroups.sortOrder)],
                },
            },
        });
        if (!group)
            throw new Error("Modifier group not found");
        return this.serializeGroup(group);
    }
    static async create(merchantId, input) {
        const db = (0, db_1.getDb)();
        const title = input.title?.trim();
        if (!title)
            throw new Error("Title is required");
        const pricingType = normalizePricing(input.pricingType);
        const selectionType = normalizeSelection(input.selectionType);
        const minSelectable = selectionType === "required"
            ? Math.max(1, Number(input.minSelectable) || 1)
            : Math.max(0, Number(input.minSelectable) || 0);
        const maxSelectable = Math.max(minSelectable, Number(input.maxSelectable) || 1);
        const [group] = await db
            .insert(db_1.schema.modifierGroups)
            .values({
            merchantId,
            title,
            pricingType,
            selectionType,
            minSelectable,
            maxSelectable,
            defaultCollapsed: !!input.defaultCollapsed,
            allowMultipleSameItem: !!input.allowMultipleSameItem,
            sortOrder: Number(input.sortOrder) || 0,
        })
            .returning();
        await this.replaceOptions(group.id, input.options || [], pricingType);
        if (input.productIds?.length) {
            await this.setProductLinks(merchantId, group.id, input.productIds);
        }
        return this.getById(merchantId, group.id);
    }
    static async update(merchantId, groupId, input) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.modifierGroups.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.id, groupId), (0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Modifier group not found");
        const title = input.title?.trim() || existing.title;
        const pricingType = normalizePricing(input.pricingType ?? existing.pricingType);
        const selectionType = normalizeSelection(input.selectionType ?? existing.selectionType);
        const minSelectable = selectionType === "required"
            ? Math.max(1, Number(input.minSelectable ?? existing.minSelectable) || 1)
            : Math.max(0, Number(input.minSelectable ?? existing.minSelectable) || 0);
        const maxSelectable = Math.max(minSelectable, Number(input.maxSelectable ?? existing.maxSelectable) || 1);
        await db
            .update(db_1.schema.modifierGroups)
            .set({
            title,
            pricingType,
            selectionType,
            minSelectable,
            maxSelectable,
            defaultCollapsed: input.defaultCollapsed !== undefined ? !!input.defaultCollapsed : existing.defaultCollapsed,
            allowMultipleSameItem: input.allowMultipleSameItem !== undefined
                ? !!input.allowMultipleSameItem
                : existing.allowMultipleSameItem,
            sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) || 0 : existing.sortOrder,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.id, groupId));
        if (input.options) {
            await this.replaceOptions(groupId, input.options, pricingType);
        }
        if (input.productIds) {
            await this.setProductLinks(merchantId, groupId, input.productIds);
        }
        // Keep legacy product.extras in sync for POS
        await this.syncLinkedProductsExtras(merchantId, groupId);
        return this.getById(merchantId, groupId);
    }
    static async remove(merchantId, groupId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.modifierGroups.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.id, groupId), (0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Modifier group not found");
        const links = await db.query.productModifierGroups.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.productModifierGroups.groupId, groupId),
        });
        const productIds = links.map((l) => l.productId);
        await db.delete(db_1.schema.modifierGroups).where((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.id, groupId));
        for (const productId of productIds) {
            await this.refreshProductExtras(merchantId, productId);
        }
        return { success: true };
    }
    static async setProductLinks(merchantId, groupId, productIds) {
        const db = (0, db_1.getDb)();
        const uniqueIds = [...new Set(productIds.filter(Boolean))];
        if (uniqueIds.length) {
            const owned = await db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.products.id, uniqueIds)),
                columns: { id: true },
            });
            const ownedSet = new Set(owned.map((p) => p.id));
            for (const id of uniqueIds) {
                if (!ownedSet.has(id))
                    throw new Error(`Product not found: ${id}`);
            }
        }
        const previous = await db.query.productModifierGroups.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.productModifierGroups.groupId, groupId),
        });
        const previousIds = previous.map((p) => p.productId);
        await db.delete(db_1.schema.productModifierGroups).where((0, drizzle_orm_1.eq)(db_1.schema.productModifierGroups.groupId, groupId));
        if (uniqueIds.length) {
            await db.insert(db_1.schema.productModifierGroups).values(uniqueIds.map((productId, idx) => ({
                productId,
                groupId,
                sortOrder: idx,
            })));
        }
        const touched = new Set([...previousIds, ...uniqueIds]);
        for (const productId of touched) {
            await this.refreshProductExtras(merchantId, productId);
        }
    }
    /** Link/unlink groups from a product (product editor side). */
    static async setGroupsForProduct(merchantId, productId, groupIds) {
        const db = (0, db_1.getDb)();
        const product = await db.query.products.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)),
        });
        if (!product)
            throw new Error("Product not found");
        const uniqueIds = [...new Set(groupIds.filter(Boolean))];
        if (uniqueIds.length) {
            const owned = await db.query.modifierGroups.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.modifierGroups.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.modifierGroups.id, uniqueIds)),
                columns: { id: true },
            });
            if (owned.length !== uniqueIds.length)
                throw new Error("One or more modifier groups not found");
        }
        await db
            .delete(db_1.schema.productModifierGroups)
            .where((0, drizzle_orm_1.eq)(db_1.schema.productModifierGroups.productId, productId));
        if (uniqueIds.length) {
            await db.insert(db_1.schema.productModifierGroups).values(uniqueIds.map((groupId, idx) => ({
                productId,
                groupId,
                sortOrder: idx,
            })));
        }
        await this.refreshProductExtras(merchantId, productId);
        return this.getGroupsForProduct(merchantId, productId);
    }
    static async getGroupsForProduct(merchantId, productId) {
        const map = await this.getGroupsForProducts(merchantId, [productId]);
        return map.get(productId) || [];
    }
    /** Batch-load modifier groups for many products (WebPOS / catalog). */
    static async getGroupsForProducts(merchantId, productIds) {
        const byProduct = new Map();
        if (!productIds.length)
            return byProduct;
        const db = (0, db_1.getDb)();
        const links = await db.query.productModifierGroups.findMany({
            where: (0, drizzle_orm_1.inArray)(db_1.schema.productModifierGroups.productId, productIds),
            with: {
                group: {
                    with: {
                        options: { orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.modifierOptions.sortOrder)] },
                    },
                },
            },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.productModifierGroups.sortOrder)],
        });
        for (const link of links) {
            const g = link.group;
            if (!g || g.merchantId !== merchantId || g.isActive === false)
                continue;
            const list = byProduct.get(link.productId) || [];
            list.push(this.serializeGroup(g));
            byProduct.set(link.productId, list);
        }
        return byProduct;
    }
    static async replaceOptions(groupId, options, pricingType) {
        const db = (0, db_1.getDb)();
        await db.delete(db_1.schema.modifierOptions).where((0, drizzle_orm_1.eq)(db_1.schema.modifierOptions.groupId, groupId));
        const rows = options
            .map((o, idx) => ({
            ...(o.id && OPTION_UUID_RE.test(o.id) ? { id: o.id } : {}),
            groupId,
            name: (o.name || "").trim(),
            price: pricingType === "free" ? "0" : String(Number(o.price) || 0),
            saleStatus: o.saleStatus === "out_of_stock" ? "out_of_stock" : "in_stock",
            isDefault: !!o.isDefault,
            sortOrder: o.sortOrder !== undefined ? Number(o.sortOrder) : idx,
            inventoryItemId: o.inventoryItemId && OPTION_UUID_RE.test(o.inventoryItemId)
                ? o.inventoryItemId
                : null,
            inventoryQty: String(Math.max(0, Number(o.inventoryQty) || 0)),
        }))
            .filter((o) => o.name);
        if (rows.length) {
            await db.insert(db_1.schema.modifierOptions).values(rows);
        }
    }
    static async syncLinkedProductsExtras(merchantId, groupId) {
        const db = (0, db_1.getDb)();
        const links = await db.query.productModifierGroups.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.productModifierGroups.groupId, groupId),
        });
        for (const link of links) {
            await this.refreshProductExtras(merchantId, link.productId);
        }
    }
    /** Flatten linked in-stock options into product.extras for POS/shop compatibility. */
    static async refreshProductExtras(merchantId, productId) {
        const db = (0, db_1.getDb)();
        const product = await db.query.products.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)),
        });
        if (!product)
            return;
        const groups = await this.getGroupsForProduct(merchantId, productId);
        const flat = groups.flatMap((g) => g.options
            .filter((o) => o.saleStatus === "in_stock")
            .map((o) => ({
            id: o.id,
            name: g.pricingType === "free" ? o.name : o.name,
            price: g.pricingType === "free" ? 0 : o.price,
            groupId: g.id,
            groupTitle: g.title,
        })));
        // Keep any legacy extras that are not from groups (no groupId) — but we store only group-derived
        await db
            .update(db_1.schema.products)
            .set({
            extras: flat.map(({ id, name, price }) => ({ id, name, price })),
            allowExtras: flat.length > 0,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId));
    }
    static serializeGroup(g) {
        const options = (g.options || []).map(publicOption);
        const products = (g.productLinks || [])
            .map((link) => {
            const p = link.product;
            if (!p)
                return null;
            return {
                id: p.id,
                name: p.name,
                categoryId: p.categoryId,
                categoryName: p.category?.name || null,
                price: p.price,
            };
        })
            .filter(Boolean);
        return {
            id: g.id,
            title: g.title,
            pricingType: g.pricingType,
            selectionType: g.selectionType,
            minSelectable: g.minSelectable,
            maxSelectable: g.maxSelectable,
            defaultCollapsed: !!g.defaultCollapsed,
            allowMultipleSameItem: !!g.allowMultipleSameItem,
            sortOrder: g.sortOrder ?? 0,
            isActive: g.isActive !== false,
            options,
            products,
            productIds: products.map((p) => p.id),
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
        };
    }
}
exports.ModifierService = ModifierService;
//# sourceMappingURL=modifier.service.js.map