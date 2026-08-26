"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = exports.InventoryLicenseError = exports.INVENTORY_UNITS = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const email_service_1 = require("@/services/email.service");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const inventory_addon_1 = require("@/lib/inventory-addon");
exports.INVENTORY_UNITS = ["kg", "g", "L", "ml", "piece", "pack"];
const DEFAULT_UNITS = [
    { code: "kg", name: "Kilogram" },
    { code: "g", name: "Gram" },
    { code: "L", name: "Liter" },
    { code: "ml", name: "Milliliter" },
    { code: "piece", name: "Piece" },
    { code: "pack", name: "Pack" },
];
const DEFAULT_RATIOS = [
    { fromCode: "kg", toCode: "g", factor: 1000 },
    { fromCode: "L", toCode: "ml", factor: 1000 },
];
const AUTO_REORDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
function num(v, fallback = 0) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function clampWasteFactor(raw) {
    const n = num(raw, 0.2);
    if (n < 0)
        return 0;
    if (n > 0.5)
        return 0.5;
    return Math.round(n * 10000) / 10000;
}
function normalizeUnit(raw) {
    const u = String(raw || "").trim();
    if (!u)
        return "kg";
    const key = u.toLowerCase();
    const aliases = {
        l: "L",
        lt: "L",
        liter: "L",
        litre: "L",
        ml: "ml",
        milliliter: "ml",
        kg: "kg",
        kilo: "kg",
        g: "g",
        gram: "g",
        grams: "g",
        piece: "piece",
        pcs: "piece",
        pc: "piece",
        unité: "piece",
        pack: "pack",
        can: "can",
        box: "box",
    };
    if (aliases[key])
        return aliases[key];
    return u.slice(0, 20);
}
function qtyStr(n) {
    return (Math.round(n * 10000) / 10000).toFixed(4);
}
function clampRecipeYield(raw) {
    const n = num(raw, 1);
    if (!(n > 0))
        return 1;
    if (n > 10000)
        return 10000;
    return Math.round(n * 10000) / 10000;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(raw) {
    return !!raw && UUID_RE.test(raw);
}
class InventoryLicenseError extends Error {
    constructor(message = "Restaurant inventory addon is not enabled") {
        super(message);
        this.name = "InventoryLicenseError";
    }
}
exports.InventoryLicenseError = InventoryLicenseError;
class InventoryService {
    static async getLicense(merchantId) {
        await (0, ensure_merchant_schema_1.ensureInventoryAddonColumn)();
        const db = (0, db_1.getDb)();
        const merchant = await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                id: true,
                name: true,
                inventoryAddonEnabled: true,
                inventoryWasteFactor: true,
                inventoryAutoReorderEmailEnabled: true,
            },
        }));
        if (!merchant)
            throw new Error("Merchant not found");
        const enabled = await (0, inventory_addon_1.readInventoryAddonEnabled)(merchantId).catch(() => (0, inventory_addon_1.isInventoryAddonEnabled)(merchant.inventoryAddonEnabled));
        return {
            enabled,
            inventoryAddonEnabled: enabled,
            inventoryEnabled: enabled,
            wasteFactor: clampWasteFactor(merchant.inventoryWasteFactor),
            autoReorderEmailEnabled: merchant.inventoryAutoReorderEmailEnabled === true,
            merchantName: merchant.name,
        };
    }
    static async assertLicensed(merchantId) {
        const license = await this.getLicense(merchantId);
        if (!license.enabled)
            throw new InventoryLicenseError();
        return license;
    }
    static async updateSettings(merchantId, updates) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (updates.wasteFactor !== undefined) {
            patch.inventoryWasteFactor = clampWasteFactor(updates.wasteFactor).toFixed(4);
        }
        if (updates.autoReorderEmailEnabled !== undefined) {
            patch.inventoryAutoReorderEmailEnabled = !!updates.autoReorderEmailEnabled;
        }
        await db.update(db_1.schema.merchants).set(patch).where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return this.getLicense(merchantId);
    }
    // ---------------------------------------------------------------------------
    // Suppliers (first-class CRUD)
    // ---------------------------------------------------------------------------
    static async listSuppliers(merchantId, opts) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const rows = await db.query.inventorySuppliers.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.inventorySuppliers.updatedAt)],
        });
        const visible = opts?.includeArchived ? rows : rows.filter((s) => !s.archivedAt);
        const ids = visible.map((s) => s.id);
        const counts = new Map();
        if (ids.length) {
            const grouped = await db
                .select({
                supplierId: db_1.schema.inventoryItems.supplierId,
                c: (0, drizzle_orm_1.sql) `count(*)::int`,
            })
                .from(db_1.schema.inventoryItems)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.inventoryItems.supplierId, ids)))
                .groupBy(db_1.schema.inventoryItems.supplierId);
            for (const g of grouped) {
                if (g.supplierId)
                    counts.set(g.supplierId, Number(g.c) || 0);
            }
        }
        return visible.map((s) => ({
            ...s,
            linkedItemCount: counts.get(s.id) || 0,
        }));
    }
    static async getSupplier(merchantId, supplierId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const supplier = await db.query.inventorySuppliers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId), (0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.merchantId, merchantId)),
        });
        if (!supplier)
            throw new Error("Supplier not found");
        const items = await db.query.inventoryItems.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.supplierId, supplierId)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.inventoryItems.name)],
        });
        return { supplier, items };
    }
    static async createSupplier(merchantId, input) {
        await this.assertLicensed(merchantId);
        const name = String(input.name || "").trim().slice(0, 255);
        if (!name)
            throw new Error("Supplier name is required");
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.inventorySuppliers)
            .values({
            merchantId,
            name,
            email: input.email ? String(input.email).trim().slice(0, 255) : null,
            phone: input.phone ? String(input.phone).trim().slice(0, 40) : null,
            address: input.address ? String(input.address).trim().slice(0, 2000) : null,
            contactPerson: input.contactPerson ? String(input.contactPerson).trim().slice(0, 255) : null,
            notes: input.notes ? String(input.notes).trim().slice(0, 4000) : null,
        })
            .returning();
        return row;
    }
    static async updateSupplier(merchantId, supplierId, input) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const existing = await db.query.inventorySuppliers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId), (0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Supplier not found");
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined) {
            const name = String(input.name || "").trim().slice(0, 255);
            if (!name)
                throw new Error("Supplier name is required");
            patch.name = name;
        }
        if (input.email !== undefined) {
            patch.email = input.email ? String(input.email).trim().slice(0, 255) : null;
        }
        if (input.phone !== undefined) {
            patch.phone = input.phone ? String(input.phone).trim().slice(0, 40) : null;
        }
        if (input.address !== undefined) {
            patch.address = input.address ? String(input.address).trim().slice(0, 2000) : null;
        }
        if (input.contactPerson !== undefined) {
            patch.contactPerson = input.contactPerson
                ? String(input.contactPerson).trim().slice(0, 255)
                : null;
        }
        if (input.notes !== undefined) {
            patch.notes = input.notes ? String(input.notes).trim().slice(0, 4000) : null;
        }
        const [row] = await db
            .update(db_1.schema.inventorySuppliers)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId))
            .returning();
        return row;
    }
    static async deleteSupplier(merchantId, supplierId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const existing = await db.query.inventorySuppliers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId), (0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Supplier not found");
        const linked = await db.query.inventoryItems.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.supplierId, supplierId)),
            columns: { id: true },
        });
        if (linked) {
            const [row] = await db
                .update(db_1.schema.inventorySuppliers)
                .set({ archivedAt: new Date(), updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId))
                .returning();
            return { supplier: row, softDeleted: true };
        }
        await db
            .delete(db_1.schema.inventorySuppliers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId), (0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.merchantId, merchantId)));
        return { supplier: existing, softDeleted: false };
    }
    // ---------------------------------------------------------------------------
    // Items
    // ---------------------------------------------------------------------------
    static async listItems(merchantId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const rows = await db.query.inventoryItems.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId),
            with: { supplier: true, category: true },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.inventoryItems.name)],
        });
        return rows.map((row) => this.serializeItem(row));
    }
    static serializeItem(row) {
        const onHand = num(row.onHand);
        const minStock = num(row.minStock);
        return {
            ...row,
            onHand,
            minStock,
            reorderQty: num(row.reorderQty),
            cost: num(row.cost),
            lowStock: minStock > 0 && onHand <= minStock,
            outOfStock: onHand <= 0,
            categoryId: row.categoryId || null,
            category: row.category
                ? { id: row.category.id, name: row.category.name }
                : null,
            supplier: row.supplier
                ? {
                    id: row.supplier.id,
                    name: row.supplier.name,
                    email: row.supplier.email,
                    archivedAt: row.supplier.archivedAt,
                }
                : null,
        };
    }
    static async createItem(merchantId, input) {
        await this.assertLicensed(merchantId);
        const name = String(input.name || "").trim().slice(0, 255);
        if (!name)
            throw new Error("Item name is required");
        const db = (0, db_1.getDb)();
        const supplierId = await this.assertSupplier(merchantId, input.supplierId);
        const categoryId = await this.assertCategory(merchantId, input.categoryId);
        const [row] = await db
            .insert(db_1.schema.inventoryItems)
            .values({
            merchantId,
            name,
            unit: normalizeUnit(input.unit),
            cost: qtyStr(Math.max(0, num(input.cost))),
            onHand: qtyStr(Math.max(0, num(input.onHand))),
            minStock: qtyStr(Math.max(0, num(input.minStock))),
            reorderQty: qtyStr(Math.max(0, num(input.reorderQty))),
            supplierId,
            categoryId,
            perishable: !!input.perishable,
            autoReorderEnabled: !!input.autoReorderEnabled,
        })
            .returning();
        if (num(input.onHand) > 0) {
            await db.insert(db_1.schema.inventoryMovements).values({
                merchantId,
                itemId: row.id,
                type: "in",
                qty: qtyStr(num(input.onHand)),
                unitCost: qtyStr(Math.max(0, num(input.cost))),
                note: "Opening stock",
            });
        }
        await this.maybeAutoReorder(merchantId, [row.id], num(input.onHand), num(input.onHand));
        return this.serializeItem({ ...row, supplier: null });
    }
    static async updateItem(merchantId, itemId, input) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const existing = await this.getOwnedItem(merchantId, itemId);
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined) {
            const name = String(input.name || "").trim().slice(0, 255);
            if (!name)
                throw new Error("Item name is required");
            patch.name = name;
        }
        if (input.unit !== undefined)
            patch.unit = normalizeUnit(input.unit);
        if (input.cost !== undefined)
            patch.cost = qtyStr(Math.max(0, num(input.cost)));
        if (input.minStock !== undefined)
            patch.minStock = qtyStr(Math.max(0, num(input.minStock)));
        if (input.reorderQty !== undefined)
            patch.reorderQty = qtyStr(Math.max(0, num(input.reorderQty)));
        if (input.supplierId !== undefined) {
            patch.supplierId = await this.assertSupplier(merchantId, input.supplierId);
        }
        if (input.perishable !== undefined)
            patch.perishable = !!input.perishable;
        if (input.autoReorderEnabled !== undefined)
            patch.autoReorderEnabled = !!input.autoReorderEnabled;
        if (input.categoryId !== undefined) {
            patch.categoryId = await this.assertCategory(merchantId, input.categoryId);
        }
        const [row] = await db
            .update(db_1.schema.inventoryItems)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, existing.id))
            .returning();
        return this.serializeItem({ ...row, supplier: null });
    }
    static async deleteItem(merchantId, itemId) {
        await this.assertLicensed(merchantId);
        const existing = await this.getOwnedItem(merchantId, itemId);
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.inventoryItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, existing.id), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId)));
        return { ok: true };
    }
    // ---------------------------------------------------------------------------
    // Movements
    // ---------------------------------------------------------------------------
    static async stockIn(merchantId, itemId, input) {
        await this.assertLicensed(merchantId);
        const item = await this.getOwnedItem(merchantId, itemId);
        const qty = await this.toBaseQty(merchantId, num(input.qty), input.unit, item.unit);
        if (!(qty > 0))
            throw new Error("Quantity must be greater than 0");
        return this.applyMovement(merchantId, itemId, {
            type: "in",
            qty,
            unitCost: input.unitCost,
            note: input.note,
            supplierName: input.supplierName,
        });
    }
    static async stockOut(merchantId, itemId, input) {
        await this.assertLicensed(merchantId);
        const qty = num(input.qty);
        if (!(qty > 0))
            throw new Error("Quantity must be greater than 0");
        const type = input.reason === "out" ? "out" : "waste";
        return this.applyMovement(merchantId, itemId, { type, qty, note: input.note });
    }
    static async waste(merchantId, itemId, input) {
        return this.stockOut(merchantId, itemId, { ...input, reason: "waste" });
    }
    static async countStock(merchantId, itemId, input) {
        await this.assertLicensed(merchantId);
        const item = await this.getOwnedItem(merchantId, itemId);
        const realQty = Math.max(0, num(input.realQty));
        const systemQty = num(item.onHand);
        const delta = Math.round((realQty - systemQty) * 10000) / 10000;
        if (delta === 0) {
            return this.serializeItem({ ...item, supplier: null, category: null });
        }
        return this.applyMovement(merchantId, itemId, {
            type: "adjust",
            qty: Math.abs(delta),
            note: input.note || `Count: system ${systemQty} → real ${realQty}`,
            adjustSign: delta > 0 ? 1 : -1,
        });
    }
    static async listMovements(merchantId, itemId, limit = 100) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const where = [(0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.merchantId, merchantId)];
        if (itemId)
            where.push((0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.itemId, itemId));
        return db.query.inventoryMovements.findMany({
            where: (0, drizzle_orm_1.and)(...where),
            with: { item: true },
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.inventoryMovements.createdAt)],
            limit: Math.min(300, Math.max(1, limit)),
        });
    }
    static async lowStock(merchantId) {
        await this.assertLicensed(merchantId);
        const items = await this.listItems(merchantId);
        return items.filter((i) => i.lowStock);
    }
    static async usageReport(merchantId, days = 30) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
        const rows = await db
            .select({
            itemId: db_1.schema.inventoryMovements.itemId,
            type: db_1.schema.inventoryMovements.type,
            qty: (0, drizzle_orm_1.sql) `sum(${db_1.schema.inventoryMovements.qty})`,
        })
            .from(db_1.schema.inventoryMovements)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.merchantId, merchantId), (0, drizzle_orm_1.gte)(db_1.schema.inventoryMovements.createdAt, since)))
            .groupBy(db_1.schema.inventoryMovements.itemId, db_1.schema.inventoryMovements.type);
        const items = await this.listItems(merchantId);
        const byItem = new Map();
        for (const r of rows) {
            const cur = byItem.get(r.itemId) || { sale: 0, waste: 0, inn: 0 };
            const q = num(r.qty);
            if (r.type === "sale")
                cur.sale += q;
            else if (r.type === "waste")
                cur.waste += q;
            else if (r.type === "in")
                cur.inn += q;
            byItem.set(r.itemId, cur);
        }
        return items.map((item) => {
            const u = byItem.get(item.id) || { sale: 0, waste: 0, inn: 0 };
            return {
                ...item,
                theoreticalUsage: u.sale,
                wasteQty: u.waste,
                stockInQty: u.inn,
            };
        });
    }
    // ---------------------------------------------------------------------------
    // Recipes
    // ---------------------------------------------------------------------------
    static async getRecipe(merchantId, productId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const product = await db.query.products.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)),
            columns: { id: true, name: true, sku: true, recipeYield: true, productType: true },
        });
        if (!product)
            throw new Error("Product not found");
        const lines = await db.query.productRecipes.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.productId, productId)),
            with: { item: true },
        });
        return {
            product: {
                ...product,
                recipeYield: clampRecipeYield(product.recipeYield),
            },
            recipeYield: clampRecipeYield(product.recipeYield),
            lines: lines.map((l) => ({
                id: l.id,
                itemId: l.itemId,
                qty: num(l.qty),
                unit: l.unit,
                itemName: l.item?.name,
                itemUnit: l.item?.unit,
            })),
        };
    }
    static async listCookbook(merchantId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
            columns: {
                id: true,
                name: true,
                sku: true,
                isActive: true,
                productType: true,
                recipeYield: true,
            },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.name)],
        });
        const lines = await db.query.productRecipes.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId),
            with: { item: true },
        });
        const byProduct = new Map();
        for (const line of lines) {
            const list = byProduct.get(line.productId) || [];
            list.push(line);
            byProduct.set(line.productId, list);
        }
        return products.map((p) => ({
            productId: p.id,
            name: p.name,
            sku: p.sku,
            isActive: p.isActive !== false,
            productType: p.productType,
            recipeYield: clampRecipeYield(p.recipeYield),
            lines: (byProduct.get(p.id) || []).map((l) => ({
                id: l.id,
                itemId: l.itemId,
                qty: num(l.qty),
                unit: l.unit,
                itemName: l.item?.name,
                itemUnit: l.item?.unit,
            })),
        }));
    }
    static async setRecipe(merchantId, productId, lines, recipeYield) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const product = await db.query.products.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)),
            columns: { id: true },
        });
        if (!product)
            throw new Error("Product not found");
        const clean = (Array.isArray(lines) ? lines : [])
            .map((l) => ({
            itemId: String(l.itemId || ""),
            qty: num(l.qty),
            unit: normalizeUnit(l.unit),
        }))
            .filter((l) => l.itemId && l.qty > 0)
            .slice(0, 80);
        const itemIds = [...new Set(clean.map((l) => l.itemId))];
        if (itemIds.length) {
            const owned = await db.query.inventoryItems.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.inventoryItems.id, itemIds)),
                columns: { id: true, unit: true },
            });
            const ownedSet = new Set(owned.map((o) => o.id));
            for (const id of itemIds) {
                if (!ownedSet.has(id))
                    throw new Error("Invalid inventory item in recipe");
            }
            const unitById = new Map(owned.map((o) => [o.id, o.unit]));
            for (const line of clean) {
                line.unit = normalizeUnit(unitById.get(line.itemId) || line.unit);
            }
        }
        await db
            .delete(db_1.schema.productRecipes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.productId, productId)));
        if (clean.length) {
            await db.insert(db_1.schema.productRecipes).values(clean.map((l) => ({
                merchantId,
                productId,
                itemId: l.itemId,
                qty: qtyStr(l.qty),
                unit: l.unit,
            })));
        }
        if (recipeYield !== undefined) {
            await db
                .update(db_1.schema.products)
                .set({ recipeYield: qtyStr(clampRecipeYield(recipeYield)), updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)));
        }
        return this.getRecipe(merchantId, productId);
    }
    // ---------------------------------------------------------------------------
    // Sale deduction (paid orders only)
    // ---------------------------------------------------------------------------
    static async deductForPaidOrder(merchantId, orderId) {
        try {
            const license = await this.getLicense(merchantId);
            if (!license.enabled)
                return { deducted: false, reason: "addon_off" };
            const db = (0, db_1.getDb)();
            const order = await db.query.orders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
                with: { items: true },
            });
            if (!order)
                return { deducted: false, reason: "missing_order" };
            const status = String(order.status || "").toLowerCase();
            const pay = String(order.paymentStatus || "").toLowerCase();
            if (status === "cancelled")
                return { deducted: false, reason: "cancelled" };
            if (pay !== "completed" && pay !== "paid")
                return { deducted: false, reason: "unpaid" };
            const already = await db.query.inventoryMovements.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.orderId, orderId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.type, "sale")),
                columns: { id: true },
            });
            if (already)
                return { deducted: false, reason: "already" };
            const extraIds = [];
            const candidateIds = new Set();
            for (const line of order.items || []) {
                if (line.productId)
                    candidateIds.add(line.productId);
                const extras = Array.isArray(line.selectedExtras) ? line.selectedExtras : [];
                for (const extra of extras) {
                    if (extra?.id)
                        extraIds.push(String(extra.id));
                }
                const combos = Array.isArray(line.comboSelections) ? line.comboSelections : [];
                for (const combo of combos) {
                    if (combo?.productId)
                        candidateIds.add(combo.productId);
                    for (const extra of combo.selectedExtras || []) {
                        if (extra?.id)
                            extraIds.push(String(extra.id));
                    }
                }
            }
            const productIds = [...candidateIds];
            if (!productIds.length && !extraIds.length) {
                return { deducted: false, reason: "no_products" };
            }
            const recipes = productIds.length
                ? await db.query.productRecipes.findMany({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.productRecipes.productId, productIds)),
                })
                : [];
            const yieldRows = productIds.length
                ? await db.query.products.findMany({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.products.id, productIds)),
                    columns: { id: true, recipeYield: true },
                })
                : [];
            const yieldByProduct = new Map(yieldRows.map((p) => [p.id, clampRecipeYield(p.recipeYield)]));
            const recipesByProduct = new Map();
            for (const rec of recipes) {
                const list = recipesByProduct.get(rec.productId) || [];
                list.push(rec);
                recipesByProduct.set(rec.productId, list);
            }
            const uniqueExtraIds = [...new Set(extraIds.filter(isUuid))];
            const modifierRows = uniqueExtraIds.length
                ? await db.query.modifierOptions.findMany({
                    where: (0, drizzle_orm_1.inArray)(db_1.schema.modifierOptions.id, uniqueExtraIds),
                    with: { group: true },
                })
                : [];
            const modifierById = new Map(modifierRows
                .filter((o) => o.group?.merchantId === merchantId && o.inventoryItemId && num(o.inventoryQty) > 0)
                .map((o) => [o.id, o]));
            if (!recipes.length && !modifierById.size) {
                return { deducted: false, reason: "no_recipes" };
            }
            const factor = 1 + license.wasteFactor;
            const usage = new Map();
            const addUsage = (itemId, qty) => {
                if (!(qty > 0) || !itemId)
                    return;
                usage.set(itemId, (usage.get(itemId) || 0) + qty);
            };
            const consumeProduct = (productId, lineQty) => {
                const recs = recipesByProduct.get(productId);
                if (!recs?.length)
                    return;
                const yieldQty = yieldByProduct.get(productId) || 1;
                for (const rec of recs) {
                    addUsage(rec.itemId, (num(rec.qty) * lineQty * factor) / yieldQty);
                }
            };
            const consumeExtras = (extras, lineQty) => {
                for (const extra of extras || []) {
                    if (!extra?.id)
                        continue;
                    const opt = modifierById.get(extra.id);
                    if (!opt?.inventoryItemId)
                        continue;
                    addUsage(opt.inventoryItemId, num(opt.inventoryQty) * lineQty * factor);
                }
            };
            for (const line of order.items || []) {
                const lineQty = num(line.quantity);
                if (!(lineQty > 0))
                    continue;
                const parentId = line.productId || "";
                const combos = Array.isArray(line.comboSelections) ? line.comboSelections : [];
                const parentHasRecipe = parentId ? recipesByProduct.has(parentId) : false;
                if (parentHasRecipe) {
                    consumeProduct(parentId, lineQty);
                }
                else {
                    for (const combo of combos) {
                        if (combo?.productId)
                            consumeProduct(combo.productId, lineQty);
                    }
                }
                consumeExtras(line.selectedExtras, lineQty);
                for (const combo of combos) {
                    consumeExtras(combo.selectedExtras, lineQty);
                }
            }
            const touched = [];
            for (const [itemId, qty] of usage) {
                if (!(qty > 0))
                    continue;
                await this.applyMovement(merchantId, itemId, {
                    type: "sale",
                    qty,
                    orderId,
                    note: `Sale ${order.orderNumber || orderId.slice(0, 8)}`,
                    skipLicense: true,
                    skipAutoReorder: true,
                });
                touched.push(itemId);
            }
            if (touched.length) {
                void this.maybeAutoReorder(merchantId, touched).catch((err) => console.warn("[inventory] sale auto-reorder failed:", err));
            }
            return { deducted: true, items: touched.length };
        }
        catch (err) {
            console.warn("[inventory] sale deduct failed:", err);
            return { deducted: false, reason: "error" };
        }
    }
    // ---------------------------------------------------------------------------
    // Reorder emails
    // ---------------------------------------------------------------------------
    static async sendReorderEmail(merchantId, opts) {
        const license = await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        let items = await this.listItems(merchantId);
        if (opts.supplierId) {
            items = items.filter((i) => i.supplierId === opts.supplierId);
        }
        if (opts.itemIds?.length) {
            const set = new Set(opts.itemIds);
            items = items.filter((i) => set.has(i.id));
        }
        const targets = items.filter((i) => {
            if (!i.supplier?.email || i.supplier.archivedAt)
                return false;
            if (opts.force)
                return num(i.reorderQty) > 0 || i.lowStock;
            return i.lowStock && num(i.reorderQty) > 0;
        });
        if (!targets.length)
            throw new Error("No items to order");
        const bySupplier = new Map();
        for (const item of targets) {
            const sid = item.supplierId;
            const list = bySupplier.get(sid) || [];
            list.push(item);
            bySupplier.set(sid, list);
        }
        const sent = [];
        for (const [supplierId, list] of bySupplier) {
            const supplier = list[0].supplier;
            const email = String(supplier.email || "").trim();
            if (!email)
                continue;
            const lines = list
                .map((i) => {
                const qty = num(i.reorderQty) > 0 ? num(i.reorderQty) : Math.max(0, num(i.minStock) - num(i.onHand));
                return `• ${i.name}: ${qty} ${i.unit} (on hand ${num(i.onHand)} ${i.unit}, par ${num(i.minStock)} ${i.unit})`;
            })
                .join("\n");
            const subject = `Purchase order request — ${license.merchantName}`;
            const text = [
                `Hello${supplier.name ? ` ${supplier.name}` : ""},`,
                "",
                `${license.merchantName} would like to order:`,
                "",
                lines,
                "",
                "Please confirm availability and delivery.",
                "",
                license.merchantName,
            ].join("\n");
            await email_service_1.EmailService.send({
                merchantId,
                to: email,
                subject,
                text,
                html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
                emailType: "inventory_reorder",
            });
            await db
                .update(db_1.schema.inventorySuppliers)
                .set({ lastOrderEmailAt: new Date(), updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId));
            const now = new Date();
            await db
                .update(db_1.schema.inventoryItems)
                .set({ lastAutoReorderAt: now, updatedAt: now })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.inventoryItems.id, list.map((i) => i.id))));
            sent.push({ supplierId, email, items: list.length });
        }
        return { sent };
    }
    // ---------------------------------------------------------------------------
    // Categories / units
    // ---------------------------------------------------------------------------
    static async listCategories(merchantId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        return db.query.inventoryCategories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.inventoryCategories.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.inventoryCategories.name)],
        });
    }
    static async createCategory(merchantId, name) {
        await this.assertLicensed(merchantId);
        const clean = String(name || "").trim().slice(0, 100);
        if (!clean)
            throw new Error("Category name is required");
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.inventoryCategories)
            .values({ merchantId, name: clean })
            .returning();
        return row;
    }
    static async deleteCategory(merchantId, categoryId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.inventoryItems)
            .set({ categoryId: null, updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.categoryId, categoryId)));
        await db
            .delete(db_1.schema.inventoryCategories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryCategories.id, categoryId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryCategories.merchantId, merchantId)));
        return { ok: true };
    }
    static async listUnits(merchantId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        let units = await db.query.inventoryUnits.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.inventoryUnits.code)],
        });
        if (!units.length) {
            await db.insert(db_1.schema.inventoryUnits).values(DEFAULT_UNITS.map((u) => ({ merchantId, code: u.code, name: u.name })));
            const existing = await db.query.inventoryUnitRatios.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.merchantId, merchantId),
            });
            if (!existing.length) {
                await db.insert(db_1.schema.inventoryUnitRatios).values(DEFAULT_RATIOS.map((r) => ({
                    merchantId,
                    fromCode: r.fromCode,
                    toCode: r.toCode,
                    factor: qtyStr(r.factor),
                })));
            }
            units = await db.query.inventoryUnits.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.inventoryUnits.code)],
            });
        }
        const ratios = await db.query.inventoryUnitRatios.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.inventoryUnitRatios.fromCode)],
        });
        return {
            units,
            ratios: ratios.map((r) => ({ ...r, factor: num(r.factor) })),
        };
    }
    static async createUnit(merchantId, input) {
        await this.assertLicensed(merchantId);
        const code = normalizeUnit(input.code);
        const name = String(input.name || "").trim().slice(0, 80) || code;
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.inventoryUnits)
            .values({ merchantId, code, name })
            .returning();
        return row;
    }
    static async deleteUnit(merchantId, unitId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const unit = await db.query.inventoryUnits.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.id, unitId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.merchantId, merchantId)),
        });
        if (!unit)
            throw new Error("Unit not found");
        await db
            .delete(db_1.schema.inventoryUnitRatios)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.merchantId, merchantId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.fromCode, unit.code), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.toCode, unit.code))));
        await db
            .delete(db_1.schema.inventoryUnits)
            .where((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.id, unit.id));
        return { ok: true };
    }
    static async createRatio(merchantId, input) {
        await this.assertLicensed(merchantId);
        const fromCode = normalizeUnit(input.fromCode);
        const toCode = normalizeUnit(input.toCode);
        const factor = num(input.factor);
        if (fromCode === toCode)
            throw new Error("Units must be different");
        if (!(factor > 0))
            throw new Error("Ratio must be greater than 0");
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.inventoryUnitRatios)
            .values({ merchantId, fromCode, toCode, factor: qtyStr(factor) })
            .returning();
        return { ...row, factor };
    }
    static async deleteRatio(merchantId, ratioId) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.inventoryUnitRatios)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.id, ratioId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.merchantId, merchantId)));
        return { ok: true };
    }
    static async purchaseReport(merchantId, days = 30) {
        await this.assertLicensed(merchantId);
        const db = (0, db_1.getDb)();
        const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
        const rows = await db.query.inventoryMovements.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.type, "in"), (0, drizzle_orm_1.gte)(db_1.schema.inventoryMovements.createdAt, since)),
            with: { item: true },
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.inventoryMovements.createdAt)],
            limit: 500,
        });
        const byStock = new Map();
        const bySupplier = new Map();
        const byDate = new Map();
        for (const r of rows) {
            const qty = num(r.qty);
            const cost = qty * num(r.unitCost);
            const stockName = r.item?.name || r.itemId;
            const stock = byStock.get(r.itemId) || { name: stockName, qty: 0, cost: 0 };
            stock.qty += qty;
            stock.cost += cost;
            byStock.set(r.itemId, stock);
            const supplierName = r.supplierName || "—";
            const sup = bySupplier.get(supplierName) || { name: supplierName, qty: 0, cost: 0 };
            sup.qty += qty;
            sup.cost += cost;
            bySupplier.set(supplierName, sup);
            const day = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
            const date = byDate.get(day) || { qty: 0, cost: 0 };
            date.qty += qty;
            date.cost += cost;
            byDate.set(day, date);
        }
        return {
            byStock: [...byStock.values()].sort((a, b) => b.cost - a.cost),
            bySupplier: [...bySupplier.values()].sort((a, b) => b.cost - a.cost),
            byDate: [...byDate.entries()]
                .map(([date, v]) => ({ date, ...v }))
                .sort((a, b) => b.date.localeCompare(a.date)),
        };
    }
    // ---------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------
    static async getOwnedItem(merchantId, itemId) {
        const db = (0, db_1.getDb)();
        const item = await db.query.inventoryItems.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, itemId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId)),
        });
        if (!item)
            throw new Error("Inventory item not found");
        return item;
    }
    static async assertCategory(merchantId, categoryId) {
        if (!categoryId)
            return null;
        const db = (0, db_1.getDb)();
        const c = await db.query.inventoryCategories.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryCategories.id, categoryId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryCategories.merchantId, merchantId)),
        });
        if (!c)
            throw new Error("Stock category not found");
        return c.id;
    }
    static async toBaseQty(merchantId, qty, fromUnit, toUnit) {
        const from = normalizeUnit(fromUnit || toUnit);
        const to = normalizeUnit(toUnit);
        if (from === to)
            return qty;
        const { ratios } = await this.listUnits(merchantId);
        const direct = ratios.find((r) => r.fromCode === from && r.toCode === to);
        if (direct)
            return qty * num(direct.factor);
        const inverse = ratios.find((r) => r.fromCode === to && r.toCode === from);
        if (inverse && num(inverse.factor) > 0)
            return qty / num(inverse.factor);
        throw new Error(`No unit ratio from ${from} to ${to}`);
    }
    static async assertSupplier(merchantId, supplierId) {
        if (!supplierId)
            return null;
        const db = (0, db_1.getDb)();
        const s = await db.query.inventorySuppliers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.id, supplierId), (0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.merchantId, merchantId)),
        });
        if (!s || s.archivedAt)
            throw new Error("Supplier not found");
        return s.id;
    }
    static async applyMovement(merchantId, itemId, input) {
        if (!input.skipLicense)
            await this.assertLicensed(merchantId);
        const item = await this.getOwnedItem(merchantId, itemId);
        const prev = num(item.onHand);
        const signed = input.type === "adjust"
            ? input.qty * (input.adjustSign || 1)
            : input.type === "in"
                ? input.qty
                : -input.qty;
        const next = Math.round((prev + signed) * 10000) / 10000;
        const db = (0, db_1.getDb)();
        await db.insert(db_1.schema.inventoryMovements).values({
            merchantId,
            itemId,
            type: input.type,
            qty: qtyStr(Math.abs(input.qty)),
            unitCost: input.unitCost != null ? qtyStr(Math.max(0, num(input.unitCost))) : null,
            note: input.note ? String(input.note).slice(0, 500) : null,
            supplierName: input.supplierName ? String(input.supplierName).slice(0, 255) : null,
            orderId: input.orderId || null,
        });
        const [updated] = await db
            .update(db_1.schema.inventoryItems)
            .set({ onHand: qtyStr(next), updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, itemId))
            .returning();
        if (input.type === "in" && input.unitCost != null && num(input.unitCost) > 0) {
            await db
                .update(db_1.schema.inventoryItems)
                .set({ cost: qtyStr(Math.max(0, num(input.unitCost))) })
                .where((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, itemId));
        }
        if (!input.skipAutoReorder) {
            void this.maybeAutoReorder(merchantId, [itemId], prev, next).catch((err) => console.warn("[inventory] auto-reorder failed:", err));
        }
        return this.serializeItem({ ...(updated || item), supplier: null });
    }
    static async maybeAutoReorder(merchantId, itemIds, previousOnHand, newOnHand) {
        if (!itemIds.length)
            return;
        const license = await this.getLicense(merchantId);
        if (!license.enabled || !license.autoReorderEmailEnabled)
            return;
        const db = (0, db_1.getDb)();
        const items = await db.query.inventoryItems.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.inventoryItems.id, itemIds)),
            with: { supplier: true },
        });
        const now = Date.now();
        const due = [];
        for (const item of items) {
            const minStock = num(item.minStock);
            const onHand = num(item.onHand);
            if (minStock <= 0)
                continue;
            if (onHand > minStock) {
                if (item.lastAutoReorderAt) {
                    await db
                        .update(db_1.schema.inventoryItems)
                        .set({ lastAutoReorderAt: null, updatedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, item.id));
                }
                continue;
            }
            if (!item.autoReorderEnabled)
                continue;
            if (!item.supplier?.email || item.supplier.archivedAt)
                continue;
            if (num(item.reorderQty) <= 0 && minStock - onHand <= 0)
                continue;
            const last = item.lastAutoReorderAt ? new Date(item.lastAutoReorderAt).getTime() : 0;
            const crossedBelow = previousOnHand > minStock && onHand <= minStock;
            const cooled = !last || now - last >= AUTO_REORDER_COOLDOWN_MS;
            if (crossedBelow || cooled)
                due.push(item.id);
        }
        if (!due.length)
            return;
        try {
            await this.sendReorderEmail(merchantId, { itemIds: due, force: true });
        }
        catch (err) {
            console.warn("[inventory] auto reorder email skipped:", err);
        }
    }
}
exports.InventoryService = InventoryService;
//# sourceMappingURL=inventory.service.js.map