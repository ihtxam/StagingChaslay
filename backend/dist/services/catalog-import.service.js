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
const modifier_service_1 = require("@/services/modifier.service");
class CatalogImportService {
    /**
     * One-click Excel import for categories + modifier groups + products.
     * Expected sheets (case-insensitive):
     * - Categories: name, description?, color?, sortOrder?
     * - ModifierGroups: title, pricingType?, selectionType?, minSelectable?, maxSelectable?, options?
     * - Products: name, price, category (name), sku?, barcode?, stock?, cost?,
     *   taxable?, description?, productType?, isOpenPrice?, soldByWeight?, weightUnit?,
     *   bulkPricing? (10:2.5;20:2.0), specifications? (Small:8.9|Large:10.5*),
     *   modifierGroups? (Milk|Toppings), extras? (Extra Cheese:1.5|Bacon:2), allowExtras?
     */
    static async importWorkbook(merchantId, buffer) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const errors = [];
        let categoriesCreated = 0;
        let productsCreated = 0;
        let productsUpdated = 0;
        let modifierGroupsCreated = 0;
        let modifierGroupsUpdated = 0;
        const db = (0, db_1.getDb)();
        const categoryNameToId = new Map();
        let nextColorIndex = 0;
        const existingCategories = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
        });
        for (const cat of existingCategories) {
            categoryNameToId.set(cat.name.trim().toLowerCase(), cat.id);
            if (cat.color)
                nextColorIndex++;
        }
        const categoriesSheet = findSheet(workbook, "Categories");
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
        const groupTitleToId = await this.importModifierGroupsSheet(merchantId, workbook, errors, { created: () => modifierGroupsCreated++, updated: () => modifierGroupsUpdated++ });
        const productsSheet = findSheet(workbook, "Products");
        if (!productsSheet) {
            return {
                success: errors.length === 0,
                categoriesCreated,
                productsCreated,
                productsUpdated,
                modifierGroupsCreated,
                modifierGroupsUpdated,
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
            const specifications = parseSpecifications(row.specifications ??
                row.Specifications ??
                row.variations ??
                row.Variations ??
                row.sizes ??
                row.Sizes);
            const modifierGroupTitles = parseTitleList(row.modifierGroups ??
                row.ModifierGroups ??
                row.addons ??
                row.Addons ??
                row.modifierGroupTitles);
            const parsedExtras = parseExtras(row.extras ?? row.Extras);
            const allowExtras = modifierGroupTitles.length > 0 ||
                parsedExtras.length > 0 ||
                parseBool(row.allowExtras ?? row.AllowExtras);
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
                specifications,
                extras: parsedExtras,
                allowExtras,
                updatedAt: new Date(),
            };
            try {
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
                let productId;
                if (existing) {
                    await db.update(db_1.schema.products).set(values).where((0, drizzle_orm_1.eq)(db_1.schema.products.id, existing.id));
                    productId = existing.id;
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
                    const [created] = await db.insert(db_1.schema.products).values(values).returning({ id: db_1.schema.products.id });
                    productId = created.id;
                    productsCreated++;
                }
                const groupIds = modifierGroupTitles
                    .map((title) => groupTitleToId.get(title.trim().toLowerCase()))
                    .filter((id) => !!id);
                if (modifierGroupTitles.length && groupIds.length !== modifierGroupTitles.length) {
                    const missing = modifierGroupTitles.filter((title) => !groupTitleToId.has(title.trim().toLowerCase()));
                    errors.push({
                        sheet: "Products",
                        row: i + 2,
                        message: `Unknown modifier group(s): ${missing.join(", ")}`,
                    });
                }
                if (groupIds.length) {
                    await modifier_service_1.ModifierService.setGroupsForProduct(merchantId, productId, groupIds);
                }
                else if (parsedExtras.length) {
                    await db
                        .update(db_1.schema.products)
                        .set({ extras: parsedExtras, allowExtras: true, updatedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId));
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
            modifierGroupsCreated,
            modifierGroupsUpdated,
            errors,
        };
    }
    static async importModifierGroupsSheet(merchantId, workbook, errors, counters) {
        const groupTitleToId = new Map();
        const existingGroups = await modifier_service_1.ModifierService.list(merchantId);
        for (const group of existingGroups) {
            groupTitleToId.set(group.title.trim().toLowerCase(), group.id);
        }
        const sheet = findSheet(workbook, "ModifierGroups");
        if (!sheet)
            return groupTitleToId;
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const title = (0, text_encoding_1.repairCatalogText)(String(row.title || row.Title || row.name || row.Name || "").trim());
            if (!title) {
                errors.push({ sheet: "ModifierGroups", row: i + 2, message: "Missing group title" });
                continue;
            }
            const pricingType = normalizeModifierPricing(String(row.pricingType || row.PricingType || "fixed"));
            const selectionType = normalizeModifierSelection(String(row.selectionType || row.SelectionType || "optional"));
            const minSelectable = Number(row.minSelectable ?? row.MinSelectable ?? (selectionType === "required" ? 1 : 0)) || 0;
            const maxSelectable = Number(row.maxSelectable ?? row.MaxSelectable ?? 1) || 1;
            const options = parseNamedPrices(row.options ?? row.Options ?? row.extras ?? row.Extras, "modifier-opt").map((o) => ({
                name: o.name,
                price: o.price,
                isDefault: o.isDefault,
            }));
            const key = title.toLowerCase();
            const existingId = groupTitleToId.get(key);
            try {
                if (existingId) {
                    await modifier_service_1.ModifierService.update(merchantId, existingId, {
                        title,
                        pricingType,
                        selectionType,
                        minSelectable,
                        maxSelectable,
                        options,
                    });
                    counters.updated();
                }
                else {
                    const created = await modifier_service_1.ModifierService.create(merchantId, {
                        title,
                        pricingType,
                        selectionType,
                        minSelectable,
                        maxSelectable,
                        options,
                    });
                    groupTitleToId.set(key, created.id);
                    counters.created();
                }
            }
            catch (error) {
                errors.push({
                    sheet: "ModifierGroups",
                    row: i + 2,
                    message: error instanceof Error ? error.message : "Failed to import modifier group",
                });
            }
        }
        return groupTitleToId;
    }
    static buildTemplateBuffer() {
        const categories = [
            { name: "Food", description: "Fresh food", color: "#F97316", sortOrder: 0 },
            { name: "Beverages", description: "Drinks", color: "#3B82F6", sortOrder: 1 },
        ];
        const modifierGroups = [
            {
                title: "Toppings",
                pricingType: "fixed",
                selectionType: "optional",
                minSelectable: 0,
                maxSelectable: 3,
                options: "Extra Cheese:1.5|Bacon:2|Avocado:2.5",
            },
            {
                title: "Milk",
                pricingType: "fixed",
                selectionType: "optional",
                minSelectable: 0,
                maxSelectable: 1,
                options: "Whole milk:0*|Oat milk:0.8|Almond milk:0.8",
            },
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
                specifications: "Regular:8.9*|Large:10.9",
                modifierGroups: "Toppings",
                extras: "",
                allowExtras: true,
                description: "Classic burger with size variations and topping add-ons",
            },
            {
                name: "Latte",
                price: 4.0,
                category: "Beverages",
                sku: "LAT-1",
                barcode: "",
                stock: 9999,
                taxable: true,
                productType: "standard",
                isOpenPrice: false,
                soldByWeight: false,
                weightUnit: "kg",
                bulkPricing: "",
                specifications: "Small:3.5|Medium:4.0*|Large:4.5",
                modifierGroups: "Milk",
                extras: "",
                allowExtras: true,
                description: "Espresso with steamed milk — pick size and milk type",
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
                specifications: "",
                modifierGroups: "",
                extras: "",
                allowExtras: false,
                description: "Sold by weight",
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
                specifications: "",
                modifierGroups: "",
                extras: "",
                allowExtras: false,
                description: "Cashier enters price",
            },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories), "Categories");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modifierGroups), "ModifierGroups");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
        return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    }
    /** Export current categories + modifier groups + products to Excel (same columns as import template). */
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
        const modifierGroups = await modifier_service_1.ModifierService.list(merchantId);
        const groupsByProduct = await modifier_service_1.ModifierService.getGroupsForProducts(merchantId, products.map((p) => p.id));
        const catRows = categories.map((c) => ({
            name: c.name,
            description: c.description || "",
            color: c.color || "",
            sortOrder: c.sortOrder ?? 0,
        }));
        const modifierRows = modifierGroups.map((g) => ({
            title: g.title,
            pricingType: g.pricingType,
            selectionType: g.selectionType,
            minSelectable: g.minSelectable,
            maxSelectable: g.maxSelectable,
            options: g.options
                .map((o) => `${o.name}:${o.price}${o.isDefault ? "*" : ""}`)
                .filter(Boolean)
                .join("|"),
        }));
        const productRows = products.map((p) => {
            const bulk = Array.isArray(p.bulkPricing) ? p.bulkPricing : [];
            const bulkStr = bulk
                .map((t) => `${t.minQty}:${t.price}`)
                .filter(Boolean)
                .join(";");
            const specs = Array.isArray(p.specifications) ? p.specifications : [];
            const specsStr = specs
                .map((s) => `${s.name}:${s.price}${s.isDefault ? "*" : ""}`)
                .filter(Boolean)
                .join("|");
            const linkedGroups = groupsByProduct.get(p.id) || [];
            const modifierGroupsStr = linkedGroups.map((g) => g.title).join("|");
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
                specifications: specsStr,
                modifierGroups: modifierGroupsStr,
                extras: linkedGroups.length ? "" : extrasStr,
                allowExtras: !!p.allowExtras,
            };
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), "Categories");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modifierRows), "ModifierGroups");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), "Products");
        return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    }
}
exports.CatalogImportService = CatalogImportService;
function findSheet(workbook, name) {
    return (workbook.Sheets[name] ||
        workbook.Sheets[name.toLowerCase()] ||
        workbook.Sheets[name.toUpperCase()]);
}
function parseBool(value, defaultValue = false) {
    if (value === undefined || value === null || value === "")
        return defaultValue;
    if (typeof value === "boolean")
        return value;
    const s = String(value).trim().toLowerCase();
    return ["1", "true", "yes", "y"].includes(s);
}
function normalizeModifierPricing(value) {
    const s = value.trim().toLowerCase();
    if (s === "free")
        return "free";
    if (s === "toppings_by_size" || s === "toppings")
        return "toppings_by_size";
    return "fixed";
}
function normalizeModifierSelection(value) {
    return value.trim().toLowerCase() === "required" ? "required" : "optional";
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
function parseTitleList(value) {
    const raw = String(value || "").trim();
    if (!raw)
        return [];
    return raw
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
}
function parseNamedPrices(value, idPrefix) {
    if (!value)
        return [];
    if (Array.isArray(value)) {
        return value.map((item, index) => ({
            id: item.id || `${idPrefix}-${index + 1}`,
            name: String(item.name || "").trim(),
            price: Number(item.price) || 0,
            isDefault: !!item.isDefault,
        }));
    }
    const raw = String(value).trim();
    if (!raw)
        return [];
    try {
        if (raw.startsWith("[")) {
            const parsed = JSON.parse(raw);
            return parsed.map((item, index) => ({
                id: `${idPrefix}-${index + 1}`,
                name: String(item.name || "").trim(),
                price: Number(item.price) || 0,
                isDefault: !!item.isDefault,
            }));
        }
    }
    catch {
        // fall through
    }
    return raw
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part, index) => {
        const defaultMark = part.endsWith("*");
        const clean = defaultMark ? part.slice(0, -1).trim() : part;
        const colon = clean.lastIndexOf(":");
        const name = (colon >= 0 ? clean.slice(0, colon) : clean).trim();
        const priceRaw = colon >= 0 ? clean.slice(colon + 1) : "0";
        return {
            id: `${idPrefix}-${index + 1}`,
            name,
            price: Number(priceRaw) || 0,
            isDefault: defaultMark,
        };
    })
        .filter((e) => e.name);
}
function parseSpecifications(value) {
    const parsed = parseNamedPrices(value, "spec");
    if (!parsed.length)
        return [];
    const hasDefault = parsed.some((s) => s.isDefault);
    return parsed.map((s, index) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        saleStatus: "in_stock",
        isDefault: s.isDefault || (!hasDefault && index === 0),
        sortOrder: index,
    }));
}
function parseExtras(value) {
    return parseNamedPrices(value, "extra").map(({ id, name, price }) => ({ id, name, price }));
}
//# sourceMappingURL=catalog-import.service.js.map