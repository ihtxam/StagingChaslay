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
exports.CatalogImportService = void 0;
const XLSX = __importStar(require("xlsx"));
const db_1 = require("@/db");
const category_colors_1 = require("@/lib/category-colors");
const text_encoding_1 = require("@/lib/text-encoding");
const drizzle_orm_1 = require("drizzle-orm");
class CatalogImportService {
    /**
     * One-click Excel import for categories + products.
     * Expected sheets (case-insensitive): Categories, Products
     * Categories columns: name, description?, color?, sortOrder?
     * Products columns: name, price, category (name), sku?, barcode?, stock?, cost?,
     *   taxable?, description?, productType?, isOpenPrice?, soldByWeight?, weightUnit?,
     *   bulkPricing? (JSON or "10:2.5;20:2.0"), extras? (JSON or "Extra Cheese:1.5|Bacon:2")
     */
    static async importWorkbook(merchantId, buffer) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const errors = [];
        let categoriesCreated = 0;
        let productsCreated = 0;
        let productsUpdated = 0;
        const db = (0, db_1.getDb)();
        const categoryNameToId = new Map();
        let nextColorIndex = 0;
        // Prefill existing categories
        const existingCategories = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
        });
        for (const cat of existingCategories) {
            categoryNameToId.set(cat.name.trim().toLowerCase(), cat.id);
            if (cat.color)
                nextColorIndex++;
        }
        const categoriesSheet = workbook.Sheets["Categories"] ||
            workbook.Sheets["categories"] ||
            workbook.Sheets["CATEGORIES"];
        if (categoriesSheet) {
            const rows = XLSX.utils.sheet_to_json(categoriesSheet, {
                defval: "",
            });
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const name = (0, text_encoding_1.repairCatalogText)(String(row.name || row.Name || "").trim());
                if (!name) {
                    errors.push({ sheet: "Categories", row: i + 2, message: "Missing category name" });
                    continue;
                }
                const key = name.toLowerCase();
                if (categoryNameToId.has(key))
                    continue;
                try {
                    const rawColor = String(row.color || row.Color || "").trim();
                    const color = (0, category_colors_1.isValidHexColor)(rawColor)
                        ? (0, category_colors_1.normalizeHexColor)(rawColor)
                        : (0, category_colors_1.paletteColorAt)(nextColorIndex++);
                    const [created] = await db
                        .insert(db_1.schema.categories)
                        .values({
                        merchantId,
                        name,
                        description: String(row.description || row.Description || "") || null,
                        color,
                        sortOrder: Number(row.sortOrder || row.SortOrder || i) || 0,
                    })
                        .returning();
                    categoryNameToId.set(key, created.id);
                    categoriesCreated++;
                }
                catch (error) {
                    errors.push({
                        sheet: "Categories",
                        row: i + 2,
                        message: error instanceof Error ? error.message : "Failed to create category",
                    });
                }
            }
        }
        const productsSheet = workbook.Sheets["Products"] || workbook.Sheets["products"] || workbook.Sheets["PRODUCTS"];
        if (!productsSheet) {
            return {
                success: errors.length === 0,
                categoriesCreated,
                productsCreated,
                productsUpdated,
                errors: errors.concat([
                    { sheet: "Products", row: 0, message: "Missing Products sheet in workbook" },
                ]),
            };
        }
        const productRows = XLSX.utils.sheet_to_json(productsSheet, {
            defval: "",
        });
        for (let i = 0; i < productRows.length; i++) {
            const row = productRows[i];
            const name = (0, text_encoding_1.repairCatalogText)(String(row.name || row.Name || "").trim());
            const priceRaw = row.price ?? row.Price;
            if (!name) {
                errors.push({ sheet: "Products", row: i + 2, message: "Missing product name" });
                continue;
            }
            const price = Number(priceRaw);
            if (Number.isNaN(price)) {
                errors.push({ sheet: "Products", row: i + 2, message: "Invalid price" });
                continue;
            }
            const categoryName = String(row.category || row.Category || "").trim();
            let categoryId;
            if (categoryName) {
                const key = categoryName.toLowerCase();
                categoryId = categoryNameToId.get(key);
                if (!categoryId) {
                    const [created] = await db
                        .insert(db_1.schema.categories)
                        .values({
                        merchantId,
                        name: (0, text_encoding_1.repairCatalogText)(categoryName),
                        sortOrder: 0,
                        color: (0, category_colors_1.paletteColorAt)(nextColorIndex++),
                    })
                        .returning();
                    categoryId = created.id;
                    categoryNameToId.set(key, categoryId);
                    categoriesCreated++;
                }
            }
            const sku = String(row.sku || row.SKU || "").trim() || null;
            const barcode = String(row.barcode || row.Barcode || "").trim() || null;
            const isOpenPrice = parseBool(row.isOpenPrice ?? row.OpenPrice ?? row.open_price);
            const soldByWeight = parseBool(row.soldByWeight ?? row.SoldByWeight ?? row.weighed);
            const productType = String(row.productType || row.ProductType || "").trim() ||
                (soldByWeight ? "weighed" : isOpenPrice ? "open_price" : "standard");
            const values = {
                merchantId,
                name,
                price: price.toString(),
                categoryId,
                sku,
                barcode,
                cost: row.cost != null && row.cost !== "" ? String(row.cost) : null,
                stock: Number(row.stock ?? row.Stock ?? 0) || 0,
                isTaxable: parseBool(row.taxable ?? row.Taxable ?? true, true),
                description: String(row.description || row.Description || "") || null,
                productType,
                isOpenPrice,
                soldByWeight,
                weightUnit: String(row.weightUnit || row.WeightUnit || "kg") || "kg",
                bulkPricing: parseBulkPricing(row.bulkPricing ?? row.BulkPricing),
                extras: parseExtras(row.extras ?? row.Extras),
                allowExtras: parseBool(row.allowExtras ?? row.AllowExtras),
                updatedAt: new Date(),
            };
            try {
                // Upsert by barcode or sku when present, else always insert
                let existing = null;
                if (barcode) {
                    existing = await db.query.products.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.barcode, barcode)),
                    });
                }
                else if (sku) {
                    existing = await db.query.products.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.sku, sku)),
                    });
                }
                if (existing) {
                    await db.update(db_1.schema.products).set(values).where((0, drizzle_orm_1.eq)(db_1.schema.products.id, existing.id));
                    productsUpdated++;
                }
                else {
                    const { ProductEntitlementsService } = await Promise.resolve().then(() => __importStar(require("@/services/product-entitlements.service")));
                    try {
                        await ProductEntitlementsService.assertCanAddProducts(merchantId, 1);
                    }
                    catch (error) {
                        const err = error;
                        if (err.code === "PRODUCT_LIMIT_REACHED") {
                            errors.push({ sheet: "Products", row: i + 2, message: err.message });
                            break;
                        }
                        throw error;
                    }
                    await db.insert(db_1.schema.products).values(values);
                    productsCreated++;
                }
            }
            catch (error) {
                errors.push({
                    sheet: "Products",
                    row: i + 2,
                    message: error instanceof Error ? error.message : "Failed to import product",
                });
            }
        }
        return {
            success: errors.length === 0,
            categoriesCreated,
            productsCreated,
            productsUpdated,
            errors,
        };
    }
    static buildTemplateBuffer() {
        const categories = [
            { name: "Food", description: "Fresh food", color: "#F97316", sortOrder: 0 },
            { name: "Beverages", description: "Drinks", color: "#3B82F6", sortOrder: 1 },
        ];
        const products = [
            {
                name: "Burger",
                price: 8.9,
                category: "Food",
                sku: "BRG-1",
                barcode: "5901234123457",
                stock: 50,
                taxable: true,
                productType: "standard",
                isOpenPrice: false,
                soldByWeight: false,
                weightUnit: "kg",
                bulkPricing: "10:7.5;20:7",
                extras: "Extra Cheese:1.5|Bacon:2",
                allowExtras: true,
                description: "Classic burger",
            },
            {
                name: "Apples",
                price: 3.5,
                category: "Food",
                sku: "APL-KG",
                barcode: "",
                stock: 100,
                taxable: true,
                productType: "weighed",
                isOpenPrice: false,
                soldByWeight: true,
                weightUnit: "kg",
                bulkPricing: "",
                extras: "",
                allowExtras: false,
                description: "Sold by weight (A-Class CX6)",
            },
            {
                name: "Custom amount",
                price: 0,
                category: "Food",
                sku: "OPEN-1",
                barcode: "",
                stock: 9999,
                taxable: true,
                productType: "open_price",
                isOpenPrice: true,
                soldByWeight: false,
                weightUnit: "kg",
                bulkPricing: "",
                extras: "",
                allowExtras: false,
                description: "Cashier enters price",
            },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories), "Categories");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
        return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    }
    /** Export current categories + products to Excel (same columns as import template). */
    static async exportWorkbook(merchantId) {
        const db = (0, db_1.getDb)();
        const categories = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.categories.name)],
        });
        const products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
            with: { category: { columns: { name: true } } },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.name)],
        });
        const catRows = categories.map((c) => ({
            name: c.name,
            description: c.description || "",
            color: c.color || "",
            sortOrder: c.sortOrder ?? 0,
        }));
        const productRows = products.map((p) => {
            const bulk = Array.isArray(p.bulkPricing) ? p.bulkPricing : [];
            const bulkStr = bulk
                .map((t) => `${t.minQty}:${t.price}`)
                .filter(Boolean)
                .join(";");
            const extras = Array.isArray(p.extras) ? p.extras : [];
            const extrasStr = extras
                .map((e) => `${e.name}:${e.price}`)
                .filter(Boolean)
                .join("|");
            return {
                name: p.name,
                price: Number(p.price),
                category: p.category?.name || "",
                sku: p.sku || "",
                barcode: p.barcode || "",
                stock: p.stock ?? 0,
                cost: p.cost != null ? Number(p.cost) : "",
                taxable: p.isTaxable !== false,
                description: p.description || "",
                productType: p.productType || "standard",
                isOpenPrice: !!p.isOpenPrice,
                soldByWeight: !!p.soldByWeight,
                weightUnit: p.weightUnit || "kg",
                bulkPricing: bulkStr,
                extras: extrasStr,
            };
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), "Categories");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), "Products");
        return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    }
}
exports.CatalogImportService = CatalogImportService;
function parseBool(value, defaultValue = false) {
    if (value === undefined || value === null || value === "")
        return defaultValue;
    if (typeof value === "boolean")
        return value;
    const s = String(value).trim().toLowerCase();
    return ["1", "true", "yes", "y"].includes(s);
}
function parseBulkPricing(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    const raw = String(value).trim();
    if (!raw)
        return [];
    try {
        if (raw.startsWith("["))
            return JSON.parse(raw);
    }
    catch {
        // fall through
    }
    // format: 10:2.5;20:2.0
    return raw
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
        const [minQty, price] = part.split(":").map((x) => Number(x.trim()));
        return { minQty, price };
    })
        .filter((t) => !Number.isNaN(t.minQty) && !Number.isNaN(t.price));
}
function parseExtras(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    const raw = String(value).trim();
    if (!raw)
        return [];
    try {
        if (raw.startsWith("["))
            return JSON.parse(raw);
    }
    catch {
        // fall through
    }
    // format: Extra Cheese:1.5|Bacon:2
    return raw
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part, index) => {
        const [name, priceRaw] = part.split(":");
        return {
            id: `extra-${index + 1}`,
            name: (name || "").trim(),
            price: Number(priceRaw || 0) || 0,
        };
    })
        .filter((e) => e.name);
}
//# sourceMappingURL=catalog-import.service.js.map