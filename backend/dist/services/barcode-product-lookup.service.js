"use strict";
/**
 * Online barcode product lookup for Storekeeper intake.
 * 1. Merchant inventory (handled by caller)
 * 2. Optional custom API (BARCODE_LOOKUP_URL with {barcode} placeholder)
 * 3. Open Food Facts, then Open Products Facts (Open*Facts family)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BarcodeProductLookupService = void 0;
exports.matchInventoryCategoryId = matchInventoryCategoryId;
const OPEN_FACTS_USER_AGENT = "RebornPOS-Storekeeper/1.0 (contact@rebornsense.com)";
const OPEN_FACTS_SOURCES = [
    { baseUrl: "https://world.openfoodfacts.org", source: "openfoodfacts" },
    { baseUrl: "https://world.openproductsfacts.org", source: "openproductsfacts" },
];
function normalizeBarcode(raw) {
    return String(raw || "").replace(/\D/g, "");
}
function parsePackageSize(quantity, unit, combined) {
    const combo = String(combined || "").trim();
    if (combo) {
        const m = combo.match(/^([\d.,]+)\s*(g|kg|ml|l|cl|piece|pieces|pcs)?$/i);
        if (m) {
            const n = parseFloat(m[1].replace(",", "."));
            const u = (m[2] || "piece").toLowerCase();
            return {
                packageSize: combo,
                unit: mapUnitCode(u),
                weightGrams: toGrams(n, u),
            };
        }
    }
    const q = String(quantity || "").trim();
    const u = String(unit || "").trim().toLowerCase();
    if (q && u) {
        const n = parseFloat(q.replace(",", "."));
        const code = mapUnitCode(u);
        return {
            packageSize: `${q} ${u}`,
            unit: code,
            weightGrams: Number.isFinite(n) ? toGrams(n, u) : null,
        };
    }
    return { packageSize: null, unit: null, weightGrams: null };
}
function mapUnitCode(raw) {
    const u = raw.toLowerCase();
    if (u === "kg" || u === "kilogram" || u === "kilograms")
        return "kg";
    if (u === "g" || u === "gram" || u === "grams")
        return "g";
    if (u === "l" || u === "liter" || u === "litre" || u === "liters")
        return "l";
    if (u === "ml" || u === "milliliter" || u === "millilitre")
        return "ml";
    if (u === "cl")
        return "ml";
    return "piece";
}
function toGrams(n, unit) {
    if (!Number.isFinite(n))
        return null;
    const u = unit.toLowerCase();
    if (u === "kg")
        return Math.round(n * 1000);
    if (u === "g")
        return Math.round(n);
    return null;
}
function pickCategoryHint(categories, tags) {
    if (categories) {
        const parts = categories.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length)
            return parts[parts.length - 1];
    }
    if (tags?.length) {
        const tag = tags.find((t) => t.startsWith("en:") && !t.includes("plant-based"));
        if (tag)
            return tag.replace(/^en:/, "").replace(/-/g, " ");
    }
    return null;
}
function buildName(productName, brand) {
    const name = productName.trim();
    const b = String(brand || "").trim();
    if (!b)
        return name;
    if (name.toLowerCase().includes(b.toLowerCase()))
        return name;
    return `${b} ${name}`.trim();
}
function suggestionFromOpenFactsProduct(code, p, source) {
    const productName = p.product_name?.trim() ||
        p.product_name_en?.trim() ||
        p.product_name_fr?.trim() ||
        p.product_name_de?.trim() ||
        "";
    if (!productName)
        return null;
    const brand = p.brands?.split(",")[0]?.trim() || null;
    const pkg = parsePackageSize(p.product_quantity, p.product_quantity_unit, p.quantity);
    return {
        barcode: code,
        name: buildName(productName, brand),
        brand,
        categoryHint: pickCategoryHint(p.categories, p.categories_tags),
        packageSize: pkg.packageSize,
        unit: pkg.unit,
        weightGrams: pkg.weightGrams,
        imageUrl: p.image_front_small_url || p.image_url || null,
        source,
    };
}
async function lookupOpenFacts(barcode, baseUrl, source) {
    const code = normalizeBarcode(barcode);
    if (code.length < 8)
        return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(`${baseUrl}/api/v2/product/${code}.json`, {
            signal: controller.signal,
            headers: { "User-Agent": OPEN_FACTS_USER_AGENT },
        });
        if (!res.ok)
            return null;
        const data = (await res.json());
        if (data.status !== 1 || !data.product)
            return null;
        return suggestionFromOpenFactsProduct(code, data.product, source);
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
function readPath(obj, path) {
    const parts = path.split(".");
    let cur = obj;
    for (const part of parts) {
        if (!cur || typeof cur !== "object")
            return undefined;
        cur = cur[part];
    }
    return cur;
}
async function lookupCustomApi(barcode) {
    const template = String(process.env.BARCODE_LOOKUP_URL || "").trim();
    if (!template)
        return null;
    const code = normalizeBarcode(barcode);
    const url = template.replace(/\{barcode\}/g, encodeURIComponent(code));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const headers = { Accept: "application/json" };
        const apiKey = String(process.env.BARCODE_LOOKUP_API_KEY || "").trim();
        if (apiKey)
            headers.Authorization = `Bearer ${apiKey}`;
        const res = await fetch(url, { signal: controller.signal, headers });
        if (!res.ok)
            return null;
        const data = await res.json();
        const namePath = process.env.BARCODE_LOOKUP_NAME_PATH || "name,product_name,title,product.name";
        const categoryPath = process.env.BARCODE_LOOKUP_CATEGORY_PATH || "category,category_name,product.category";
        const weightPath = process.env.BARCODE_LOOKUP_WEIGHT_PATH || "weight,weight_grams,package_weight_g,product.weight";
        const unitPath = process.env.BARCODE_LOOKUP_UNIT_PATH || "unit,product.unit";
        const brandPath = process.env.BARCODE_LOOKUP_BRAND_PATH || "brand,product.brand";
        const pick = (paths) => {
            for (const p of paths.split(",")) {
                const v = readPath(data, p.trim());
                if (v != null && String(v).trim())
                    return String(v).trim();
            }
            return null;
        };
        const name = pick(namePath);
        if (!name)
            return null;
        const brand = pick(brandPath);
        const categoryHint = pick(categoryPath);
        const unitRaw = pick(unitPath);
        const weightRaw = pick(weightPath);
        const weightN = weightRaw ? parseFloat(weightRaw.replace(",", ".")) : NaN;
        return {
            barcode: code,
            name: buildName(name, brand),
            brand,
            categoryHint,
            packageSize: weightRaw && unitRaw ? `${weightRaw} ${unitRaw}` : weightRaw,
            unit: unitRaw ? mapUnitCode(unitRaw) : null,
            weightGrams: Number.isFinite(weightN) ? Math.round(weightN) : null,
            imageUrl: pick("image_url,image,product.image_url"),
            source: "custom",
        };
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
class BarcodeProductLookupService {
    /** External product databases — local inventory is checked separately. */
    static async lookupExternal(barcode) {
        const custom = await lookupCustomApi(barcode);
        if (custom)
            return custom;
        for (const { baseUrl, source } of OPEN_FACTS_SOURCES) {
            const hit = await lookupOpenFacts(barcode, baseUrl, source);
            if (hit)
                return hit;
        }
        return null;
    }
}
exports.BarcodeProductLookupService = BarcodeProductLookupService;
function matchInventoryCategoryId(categories, hint) {
    const h = String(hint || "").trim().toLowerCase();
    if (!h || !categories.length)
        return null;
    const exact = categories.find((c) => c.name.trim().toLowerCase() === h);
    if (exact)
        return exact.id;
    const contains = categories.find((c) => h.includes(c.name.trim().toLowerCase()) || c.name.trim().toLowerCase().includes(h));
    if (contains)
        return contains.id;
    const tokens = h.split(/\s+/).filter((t) => t.length > 3);
    for (const token of tokens) {
        const hit = categories.find((c) => c.name.trim().toLowerCase().includes(token));
        if (hit)
            return hit.id;
    }
    return null;
}
//# sourceMappingURL=barcode-product-lookup.service.js.map