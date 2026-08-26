/**
 * Online barcode product lookup for Storekeeper intake.
 * 1. Merchant inventory (handled by caller)
 * 2. Optional custom API (BARCODE_LOOKUP_URL with {barcode} placeholder)
 * 3. Open Food Facts (default fallback for EAN/GTIN)
 */

export type BarcodeLookupSuggestion = {
  barcode: string;
  name: string;
  brand?: string | null;
  categoryHint?: string | null;
  /** Parsed package size label, e.g. "430 g" or "1 L". */
  packageSize?: string | null;
  /** Suggested inventory unit code: g, kg, ml, l, piece. */
  unit?: string | null;
  weightGrams?: number | null;
  imageUrl?: string | null;
  source: "openfoodfacts" | "custom";
};

function normalizeBarcode(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

function parsePackageSize(
  quantity?: string | null,
  unit?: string | null,
  combined?: string | null
): { packageSize: string | null; unit: string | null; weightGrams: number | null } {
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

function mapUnitCode(raw: string): string {
  const u = raw.toLowerCase();
  if (u === "kg" || u === "kilogram" || u === "kilograms") return "kg";
  if (u === "g" || u === "gram" || u === "grams") return "g";
  if (u === "l" || u === "liter" || u === "litre" || u === "liters") return "l";
  if (u === "ml" || u === "milliliter" || u === "millilitre") return "ml";
  if (u === "cl") return "ml";
  return "piece";
}

function toGrams(n: number, unit: string): number | null {
  if (!Number.isFinite(n)) return null;
  const u = unit.toLowerCase();
  if (u === "kg") return Math.round(n * 1000);
  if (u === "g") return Math.round(n);
  return null;
}

function pickCategoryHint(categories?: string | null, tags?: string[] | null): string | null {
  if (categories) {
    const parts = categories.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  if (tags?.length) {
    const tag = tags.find((t) => t.startsWith("en:") && !t.includes("plant-based"));
    if (tag) return tag.replace(/^en:/, "").replace(/-/g, " ");
  }
  return null;
}

function buildName(productName: string, brand?: string | null): string {
  const name = productName.trim();
  const b = String(brand || "").trim();
  if (!b) return name;
  if (name.toLowerCase().includes(b.toLowerCase())) return name;
  return `${b} ${name}`.trim();
}

async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeLookupSuggestion | null> {
  const code = normalizeBarcode(barcode);
  if (code.length < 8) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      signal: controller.signal,
      headers: { "User-Agent": "RebornPOS-Storekeeper/1.0 (contact@rebornsense.com)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_en?: string;
        product_name_fr?: string;
        product_name_de?: string;
        brands?: string;
        categories?: string;
        categories_tags?: string[];
        quantity?: string;
        product_quantity?: string;
        product_quantity_unit?: string;
        image_front_small_url?: string;
        image_url?: string;
      };
    };
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const productName =
      p.product_name?.trim() ||
      p.product_name_en?.trim() ||
      p.product_name_fr?.trim() ||
      p.product_name_de?.trim() ||
      "";
    if (!productName) return null;
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
      source: "openfoodfacts",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

async function lookupCustomApi(barcode: string): Promise<BarcodeLookupSuggestion | null> {
  const template = String(process.env.BARCODE_LOOKUP_URL || "").trim();
  if (!template) return null;
  const code = normalizeBarcode(barcode);
  const url = template.replace(/\{barcode\}/g, encodeURIComponent(code));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const apiKey = String(process.env.BARCODE_LOOKUP_API_KEY || "").trim();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) return null;
    const data = await res.json();
    const namePath = process.env.BARCODE_LOOKUP_NAME_PATH || "name,product_name,title,product.name";
    const categoryPath =
      process.env.BARCODE_LOOKUP_CATEGORY_PATH || "category,category_name,product.category";
    const weightPath =
      process.env.BARCODE_LOOKUP_WEIGHT_PATH || "weight,weight_grams,package_weight_g,product.weight";
    const unitPath = process.env.BARCODE_LOOKUP_UNIT_PATH || "unit,product.unit";
    const brandPath = process.env.BARCODE_LOOKUP_BRAND_PATH || "brand,product.brand";

    const pick = (paths: string) => {
      for (const p of paths.split(",")) {
        const v = readPath(data, p.trim());
        if (v != null && String(v).trim()) return String(v).trim();
      }
      return null;
    };

    const name = pick(namePath);
    if (!name) return null;
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
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class BarcodeProductLookupService {
  /** External product databases — local inventory is checked separately. */
  static async lookupExternal(barcode: string): Promise<BarcodeLookupSuggestion | null> {
    const custom = await lookupCustomApi(barcode);
    if (custom) return custom;
    return lookupOpenFoodFacts(barcode);
  }
}

export function matchInventoryCategoryId(
  categories: Array<{ id: string; name: string }>,
  hint?: string | null
): string | null {
  const h = String(hint || "").trim().toLowerCase();
  if (!h || !categories.length) return null;
  const exact = categories.find((c) => c.name.trim().toLowerCase() === h);
  if (exact) return exact.id;
  const contains = categories.find(
    (c) => h.includes(c.name.trim().toLowerCase()) || c.name.trim().toLowerCase().includes(h)
  );
  if (contains) return contains.id;
  const tokens = h.split(/\s+/).filter((t) => t.length > 3);
  for (const token of tokens) {
    const hit = categories.find((c) => c.name.trim().toLowerCase().includes(token));
    if (hit) return hit.id;
  }
  return null;
}
