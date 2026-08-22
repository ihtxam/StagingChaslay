"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoInventoryService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const demo_inventory_data_1 = require("@/lib/demo-inventory.data");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const inventory_service_1 = require("@/services/inventory.service");
function qtyStr(n) {
    return (Math.round(n * 10000) / 10000).toFixed(4);
}
function num(v, fallback = 0) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function daysAgoDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - Math.max(0, daysAgo));
    d.setHours(10, 0, 0, 0);
    return d;
}
class DemoInventoryService {
    /** True when any inventory row is flagged is_demo for this merchant. */
    static async hasDemoData(merchantId) {
        await (0, ensure_merchant_schema_1.ensureInventoryDemoColumns)();
        const db = (0, db_1.getDb)();
        const tables = [
            db_1.schema.inventoryItems,
            db_1.schema.inventoryCategories,
            db_1.schema.inventorySuppliers,
            db_1.schema.inventoryUnits,
            db_1.schema.inventoryUnitRatios,
        ];
        for (const table of tables) {
            const [{ n }] = await db
                .select({ n: (0, drizzle_orm_1.count)() })
                .from(table)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.merchantId, merchantId), (0, drizzle_orm_1.eq)(table.isDemo, true)));
            if (Number(n) > 0)
                return true;
        }
        const [{ recipeDemo }] = await db
            .select({ recipeDemo: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.productRecipes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.isDemo, true)));
        return Number(recipeDemo) > 0;
    }
    /**
     * Idempotent: removes existing demo inventory for this merchant, then seeds fresh sample data.
     * Real (non-demo) inventory rows are never touched.
     */
    static async importDemo(merchantId) {
        await inventory_service_1.InventoryService.getLicense(merchantId);
        await (0, ensure_merchant_schema_1.ensureInventoryDemoColumns)();
        const hadDemo = await this.hasDemoData(merchantId);
        if (hadDemo) {
            await this.deleteDemo(merchantId);
        }
        const db = (0, db_1.getDb)();
        const categoryIds = new Map();
        const supplierIds = new Map();
        const itemIds = new Map();
        let categoriesCreated = 0;
        let unitsCreated = 0;
        let suppliersCreated = 0;
        let itemsCreated = 0;
        let recipesCreated = 0;
        let stockMovementsCreated = 0;
        await db.transaction(async (tx) => {
            for (const cat of demo_inventory_data_1.DEMO_INV_CATEGORIES) {
                const [row] = await tx
                    .insert(db_1.schema.inventoryCategories)
                    .values({ merchantId, name: cat.name, isDemo: true })
                    .returning({ id: db_1.schema.inventoryCategories.id });
                categoryIds.set(cat.key, row.id);
                categoriesCreated++;
            }
            for (const unit of demo_inventory_data_1.DEMO_INV_UNITS) {
                const existing = await tx.query.inventoryUnits.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.code, unit.code)),
                });
                if (existing)
                    continue;
                await tx
                    .insert(db_1.schema.inventoryUnits)
                    .values({ merchantId, code: unit.code, name: unit.name, isDemo: true });
                unitsCreated++;
            }
            for (const ratio of demo_inventory_data_1.DEMO_INV_UNIT_RATIOS) {
                const existing = await tx.query.inventoryUnitRatios.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.fromCode, ratio.fromCode), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.toCode, ratio.toCode)),
                });
                if (existing)
                    continue;
                await tx.insert(db_1.schema.inventoryUnitRatios).values({
                    merchantId,
                    fromCode: ratio.fromCode,
                    toCode: ratio.toCode,
                    factor: qtyStr(ratio.factor),
                    isDemo: true,
                });
            }
            for (const sup of demo_inventory_data_1.DEMO_INV_SUPPLIERS) {
                const [row] = await tx
                    .insert(db_1.schema.inventorySuppliers)
                    .values({
                    merchantId,
                    name: sup.name,
                    email: sup.email,
                    phone: sup.phone,
                    contactPerson: sup.contactPerson,
                    isDemo: true,
                })
                    .returning({ id: db_1.schema.inventorySuppliers.id });
                supplierIds.set(sup.key, row.id);
                suppliersCreated++;
            }
            for (const item of demo_inventory_data_1.DEMO_INV_ITEMS) {
                const [row] = await tx
                    .insert(db_1.schema.inventoryItems)
                    .values({
                    merchantId,
                    name: item.name,
                    unit: item.unit,
                    cost: qtyStr(item.cost),
                    onHand: qtyStr(item.onHand),
                    minStock: qtyStr(item.minStock),
                    reorderQty: qtyStr(item.reorderQty),
                    categoryId: categoryIds.get(item.categoryKey) || null,
                    supplierId: supplierIds.get(item.supplierKey) || null,
                    perishable: !!item.perishable,
                    autoReorderEnabled: !!item.autoReorderEnabled,
                    isDemo: true,
                })
                    .returning({ id: db_1.schema.inventoryItems.id });
                itemIds.set(item.key, row.id);
                itemsCreated++;
            }
            for (const movement of demo_inventory_data_1.DEMO_INV_MOVEMENTS) {
                const itemId = itemIds.get(movement.itemKey);
                if (!itemId)
                    continue;
                const item = demo_inventory_data_1.DEMO_INV_ITEMS.find((i) => i.key === movement.itemKey);
                await tx.insert(db_1.schema.inventoryMovements).values({
                    merchantId,
                    itemId,
                    type: movement.type,
                    qty: qtyStr(movement.qty),
                    unitCost: movement.type === "in" ? qtyStr(item?.cost ?? 0) : null,
                    note: movement.note,
                    supplierName: movement.supplierName,
                    createdAt: daysAgoDate(movement.daysAgo),
                });
                stockMovementsCreated++;
            }
            const demoProducts = await tx
                .select({
                id: db_1.schema.products.id,
                clientId: db_1.schema.products.clientId,
                name: db_1.schema.products.name,
            })
                .from(db_1.schema.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.like)(db_1.schema.products.clientId, "demo-prod-%")));
            const productByKey = new Map();
            for (const p of demoProducts) {
                const key = p.clientId?.replace(/^demo-prod-/, "");
                if (key)
                    productByKey.set(key, { id: p.id, name: p.name });
            }
            for (const recipe of demo_inventory_data_1.DEMO_INV_RECIPES) {
                const product = productByKey.get(recipe.productKey);
                if (!product)
                    continue;
                await tx
                    .update(db_1.schema.products)
                    .set({ recipeYield: qtyStr(recipe.recipeYield) })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.products.id, product.id));
                await tx
                    .delete(db_1.schema.productRecipes)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.productId, product.id), (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.isDemo, true)));
                for (const line of recipe.lines) {
                    const itemId = itemIds.get(line.itemKey);
                    if (!itemId)
                        continue;
                    await tx.insert(db_1.schema.productRecipes).values({
                        merchantId,
                        productId: product.id,
                        itemId,
                        qty: qtyStr(line.qty),
                        unit: line.unit || "kg",
                        isDemo: true,
                    });
                    recipesCreated++;
                }
            }
        });
        return {
            success: true,
            replaced: hadDemo,
            categoriesCreated,
            unitsCreated,
            suppliersCreated,
            itemsCreated,
            recipesCreated,
            stockMovementsCreated,
        };
    }
    /** Removes all demo-flagged inventory rows. Non-demo data is untouched. */
    static async deleteDemo(merchantId) {
        await (0, ensure_merchant_schema_1.ensureInventoryDemoColumns)();
        const db = (0, db_1.getDb)();
        const deletedRecipes = await db
            .delete(db_1.schema.productRecipes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.isDemo, true)))
            .returning({ id: db_1.schema.productRecipes.id });
        const demoItems = await db
            .select({ id: db_1.schema.inventoryItems.id })
            .from(db_1.schema.inventoryItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.isDemo, true)));
        const demoItemIds = demoItems.map((r) => r.id);
        if (demoItemIds.length) {
            await db
                .update(db_1.schema.modifierOptions)
                .set({ inventoryItemId: null, inventoryQty: "0" })
                .where((0, drizzle_orm_1.inArray)(db_1.schema.modifierOptions.inventoryItemId, demoItemIds));
        }
        await db
            .delete(db_1.schema.inventoryItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.isDemo, true)));
        const deletedCategories = await db
            .delete(db_1.schema.inventoryCategories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryCategories.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryCategories.isDemo, true)))
            .returning({ id: db_1.schema.inventoryCategories.id });
        const deletedSuppliers = await db
            .delete(db_1.schema.inventorySuppliers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventorySuppliers.isDemo, true)))
            .returning({ id: db_1.schema.inventorySuppliers.id });
        const deletedRatios = await db
            .delete(db_1.schema.inventoryUnitRatios)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnitRatios.isDemo, true)))
            .returning({ id: db_1.schema.inventoryUnitRatios.id });
        const deletedUnits = await db
            .delete(db_1.schema.inventoryUnits)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryUnits.isDemo, true)))
            .returning({ id: db_1.schema.inventoryUnits.id });
        return {
            success: true,
            itemsDeleted: demoItemIds.length,
            categoriesDeleted: deletedCategories.length,
            suppliersDeleted: deletedSuppliers.length,
            unitsDeleted: deletedUnits.length,
            ratiosDeleted: deletedRatios.length,
            recipesDeleted: deletedRecipes.length,
        };
    }
    /** Overview KPIs, scenarios and charts for the inventory home dashboard. */
    static async getDashboard(merchantId) {
        await inventory_service_1.InventoryService.assertLicensed(merchantId);
        await (0, ensure_merchant_schema_1.ensureInventoryDemoColumns)();
        const hasDemoData = await this.hasDemoData(merchantId);
        const items = await inventory_service_1.InventoryService.listItems(merchantId);
        const hasAnyData = items.length > 0;
        const stockValue = items.reduce((sum, i) => sum + num(i.onHand) * num(i.cost), 0);
        const lowStockItems = items.filter((i) => i.lowStock);
        const belowReorderCount = items.filter((i) => num(i.minStock) > 0 && num(i.onHand) <= num(i.minStock)).length;
        const db = (0, db_1.getDb)();
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekMovements = await db.query.inventoryMovements.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryMovements.merchantId, merchantId), (0, drizzle_orm_1.gte)(db_1.schema.inventoryMovements.createdAt, weekAgo)),
            with: { item: true },
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.inventoryMovements.createdAt)],
            limit: 500,
        });
        const stockInThisWeek = weekMovements
            .filter((m) => m.type === "in")
            .reduce((sum, m) => sum + num(m.qty), 0);
        let saleQty = 0;
        let wasteQty = 0;
        for (const m of weekMovements) {
            if (m.type === "sale")
                saleQty += num(m.qty);
            if (m.type === "waste")
                wasteQty += num(m.qty);
        }
        const wastePct = saleQty + wasteQty > 0 ? Math.round((wasteQty / (saleQty + wasteQty)) * 1000) / 10 : 0;
        const avgOnHand = items.length > 0 ? items.reduce((sum, i) => sum + num(i.onHand), 0) / items.length : 0;
        const turnoverRatio = avgOnHand > 0 ? Math.round((saleQty / avgOnHand) * 100) / 100 : 0;
        const byDate = new Map();
        for (const m of weekMovements) {
            if (m.type !== "in")
                continue;
            const day = m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : "";
            const cur = byDate.get(day) || { qty: 0, cost: 0 };
            cur.qty += num(m.qty);
            cur.cost += num(m.qty) * num(m.unitCost);
            byDate.set(day, cur);
        }
        const stockInByDay = [...byDate.entries()]
            .map(([date, v]) => ({ date, ...v }))
            .sort((a, b) => a.date.localeCompare(b.date));
        const products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.isActive, true)),
            columns: { id: true, name: true, recipeYield: true },
        });
        const recipeRows = await db.query.productRecipes.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.productRecipes.merchantId, merchantId),
            with: { item: true, product: { columns: { id: true, name: true, recipeYield: true } } },
        });
        const recipesByProduct = new Map();
        for (const row of recipeRows) {
            const list = recipesByProduct.get(row.productId) || [];
            list.push(row);
            recipesByProduct.set(row.productId, list);
        }
        const recipesLinkedCount = [...recipesByProduct.keys()].length;
        const recipesTotalProducts = products.length;
        const recipesLinkedPct = recipesTotalProducts > 0
            ? Math.round((recipesLinkedCount / recipesTotalProducts) * 1000) / 10
            : 0;
        const scenarios = [];
        const chicken = items.find((i) => i.name.toLowerCase().includes("chicken breast"));
        if (chicken?.lowStock) {
            scenarios.push({
                id: "chicken_reorder",
                tone: "warning",
                params: { name: chicken.name, onHand: num(chicken.onHand), unit: chicken.unit },
            });
        }
        const margheritaRecipe = demo_inventory_data_1.DEMO_INV_RECIPES.find((r) => r.productKey === "pizzaMargherita");
        const margheritaProduct = products.find((p) => p.name.toLowerCase().includes("margherita"));
        if (margheritaProduct && recipesByProduct.has(margheritaProduct.id)) {
            scenarios.push({ id: "margherita_linked", tone: "success" });
        }
        else if (margheritaRecipe && recipesLinkedCount > 0) {
            scenarios.push({ id: "margherita_linked", tone: "success" });
        }
        const stockInCount = weekMovements.filter((m) => m.type === "in").length;
        if (stockInCount >= 3) {
            scenarios.push({ id: "stock_in_week", tone: "info", params: { count: stockInCount } });
        }
        if (hasDemoData && scenarios.length === 0) {
            scenarios.push({ id: "demo_active", tone: "info" });
        }
        const recipeExamples = demo_inventory_data_1.DEMO_INV_RECIPES.filter((def) => {
            const product = products.find((p) => p.name.toLowerCase().includes(def.productKey === "pizzaMargherita" ? "margherita" : ""));
            return product && recipesByProduct.has(product.id);
        })
            .slice(0, 4)
            .map((def) => {
            const product = products.find((p) => {
                if (def.productKey === "pizzaMargherita")
                    return p.name.toLowerCase().includes("margherita");
                if (def.productKey === "kebabPlate")
                    return p.name.toLowerCase().includes("kebab");
                if (def.productKey === "cappuccino")
                    return p.name.toLowerCase() === "cappuccino";
                return false;
            }) || products[0];
            const lines = (recipesByProduct.get(product?.id || "") || []).map((r) => ({
                itemName: r.item?.name || "",
                qty: num(r.qty),
                unit: r.unit,
            }));
            return {
                productId: product?.id || "",
                productName: product?.name || def.productKey,
                recipeYield: num(product?.recipeYield) || def.recipeYield,
                exampleLabel: def.exampleLabel,
                autoConsumption: lines.length > 0,
                lines,
            };
        });
        // Build richer recipe examples from linked demo recipes
        const linkedDemoRecipes = recipeRows.filter((r) => r.isDemo);
        const exampleByProduct = new Map();
        for (const row of linkedDemoRecipes) {
            const def = demo_inventory_data_1.DEMO_INV_RECIPES.find((d) => d.productKey && row.product?.name);
            const productId = row.productId;
            const existing = exampleByProduct.get(productId) || {
                productId,
                productName: row.product?.name || "",
                recipeYield: num(row.product?.recipeYield) || 1,
                exampleLabel: demo_inventory_data_1.DEMO_INV_RECIPES.find((d) => {
                    const pname = row.product?.name?.toLowerCase() || "";
                    if (d.productKey === "pizzaMargherita")
                        return pname.includes("margherita");
                    if (d.productKey === "kebabPlate")
                        return pname.includes("kebab");
                    if (d.productKey === "cappuccino")
                        return pname === "cappuccino";
                    if (d.productKey === "latte")
                        return pname.includes("latte");
                    if (d.productKey === "clubSandwich")
                        return pname.includes("club");
                    return false;
                })?.exampleLabel || row.product?.name || "",
                autoConsumption: true,
                lines: [],
            };
            existing.lines.push({
                itemName: row.item?.name || "",
                qty: num(row.qty),
                unit: row.unit,
            });
            exampleByProduct.set(productId, existing);
        }
        return {
            hasDemoData,
            hasAnyData,
            kpis: {
                stockValue: Math.round(stockValue * 100) / 100,
                itemCount: items.length,
                lowStockCount: lowStockItems.length,
                belowReorderCount,
                recipesLinkedCount,
                recipesTotalProducts,
                recipesLinkedPct,
                wastePct,
                stockInThisWeek: Math.round(stockInThisWeek * 100) / 100,
                movementsThisWeek: weekMovements.length,
                turnoverRatio,
            },
            scenarios,
            stockInByDay,
            lowStockItems: lowStockItems.slice(0, 6).map((i) => ({
                id: i.id,
                name: i.name,
                onHand: num(i.onHand),
                minStock: num(i.minStock),
                reorderQty: num(i.reorderQty),
                unit: i.unit,
            })),
            recipeExamples: [...exampleByProduct.values()].slice(0, 5),
        };
    }
}
exports.DemoInventoryService = DemoInventoryService;
//# sourceMappingURL=demo-inventory.service.js.map