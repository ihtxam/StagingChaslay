import * as XLSX from "xlsx";
import { getDb, schema } from "@/db";
import {
  isValidHexColor,
  normalizeHexColor,
  paletteColorAt,
} from "@/lib/category-colors";
import { repairCatalogText } from "@/lib/text-encoding";
import { eq, and, asc } from "drizzle-orm";
import { ModifierService } from "@/services/modifier.service";

export interface ImportRowError {
  sheet: string;
  row: number;
  message: string;
}

export type ImportProgressPhase =
  | "parsing"
  | "categories"
  | "modifierGroups"
  | "products"
  | "done"
  | "error";

export type ImportProgressEvent = {
  phase: ImportProgressPhase;
  message?: string;
  current?: number;
  total?: number;
  percent?: number;
};

export type ImportWorkbookOptions = {
  onProgress?: (event: ImportProgressEvent) => void;
};

type SpecRow = {
  id: string;
  name: string;
  price: number;
  saleStatus?: "in_stock" | "out_of_stock";
  isDefault?: boolean;
  sortOrder?: number;
};

export class CatalogImportService {
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
  static async importWorkbook(
    merchantId: string,
    buffer: Buffer,
    options?: ImportWorkbookOptions
  ) {
    const onProgress = options?.onProgress;
    const emit = (event: ImportProgressEvent) => onProgress?.(event);

    emit({ phase: "parsing", message: "Reading workbook…", percent: 0 });
    const workbook = XLSX.read(buffer, { type: "buffer" });
    emit({ phase: "parsing", message: "Workbook loaded", percent: 5 });

    const errors: ImportRowError[] = [];
    let categoriesCreated = 0;
    let productsCreated = 0;
    let productsUpdated = 0;
    let modifierGroupsCreated = 0;
    let modifierGroupsUpdated = 0;

    const db = getDb();
    const categoryNameToId = new Map<string, string>();
    let nextColorIndex = 0;

    const existingCategories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
    });
    for (const cat of existingCategories) {
      categoryNameToId.set(cat.name.trim().toLowerCase(), cat.id);
      if (cat.color) nextColorIndex++;
    }

    const categoriesSheet = findSheet(workbook, "Categories");
    if (categoriesSheet) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(categoriesSheet, {
        defval: "",
      });
      for (let i = 0; i < rows.length; i++) {
        emit({
          phase: "categories",
          current: i + 1,
          total: rows.length,
          percent: rows.length ? 5 + Math.round(((i + 1) / rows.length) * 15) : 10,
          message: `Importing categories (${i + 1}/${rows.length})`,
        });
        const row = rows[i];
        const name = repairCatalogText(String(row.name || row.Name || "").trim());
        if (!name) {
          errors.push({ sheet: "Categories", row: i + 2, message: "Missing category name" });
          continue;
        }
        const key = name.toLowerCase();
        if (categoryNameToId.has(key)) continue;

        try {
          const rawColor = String(row.color || row.Color || "").trim();
          const color = isValidHexColor(rawColor)
            ? normalizeHexColor(rawColor)
            : paletteColorAt(nextColorIndex++);
          const [created] = await db
            .insert(schema.categories)
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
        } catch (error) {
          errors.push({
            sheet: "Categories",
            row: i + 2,
            message: error instanceof Error ? error.message : "Failed to create category",
          });
        }
      }
    }

    const groupTitleToId = await this.importModifierGroupsSheet(
      merchantId,
      workbook,
      errors,
      { created: () => modifierGroupsCreated++, updated: () => modifierGroupsUpdated++ },
      (current, total) => {
        emit({
          phase: "modifierGroups",
          current,
          total,
          percent: total ? 20 + Math.round((current / total) * 10) : 25,
          message: `Importing modifier groups (${current}/${total})`,
        });
      }
    );

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

    const productRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(productsSheet, {
      defval: "",
    });

    for (let i = 0; i < productRows.length; i++) {
      emit({
        phase: "products",
        current: i + 1,
        total: productRows.length,
        percent: productRows.length
          ? 30 + Math.round(((i + 1) / productRows.length) * 65)
          : 95,
        message: `Importing products (${i + 1}/${productRows.length})`,
      });
      const row = productRows[i];
      const name = repairCatalogText(String(row.name || row.Name || "").trim());
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
      let categoryId: string | undefined;
      if (categoryName) {
        const key = categoryName.toLowerCase();
        categoryId = categoryNameToId.get(key);
        if (!categoryId) {
          const [created] = await db
            .insert(schema.categories)
            .values({
              merchantId,
              name: repairCatalogText(categoryName),
              sortOrder: 0,
              color: paletteColorAt(nextColorIndex++),
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
      const productType =
        String(row.productType || row.ProductType || "").trim() ||
        (soldByWeight ? "weighed" : isOpenPrice ? "open_price" : "standard");

      const specifications = parseSpecifications(
        row.specifications ??
          row.Specifications ??
          row.variations ??
          row.Variations ??
          row.sizes ??
          row.Sizes
      );
      const modifierGroupTitles = parseTitleList(
        row.modifierGroups ??
          row.ModifierGroups ??
          row.addons ??
          row.Addons ??
          row.modifierGroupTitles
      );
      const parsedExtras = parseExtras(row.extras ?? row.Extras);
      const allowExtras =
        modifierGroupTitles.length > 0 ||
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
        let existing = null as Awaited<ReturnType<typeof db.query.products.findFirst>>;
        if (barcode) {
          existing = await db.query.products.findFirst({
            where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.barcode, barcode)),
          });
        } else if (sku) {
          existing = await db.query.products.findFirst({
            where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.sku, sku)),
          });
        }

        let productId: string;
        if (existing) {
          await db.update(schema.products).set(values).where(eq(schema.products.id, existing.id));
          productId = existing.id;
          productsUpdated++;
        } else {
          const { ProductEntitlementsService } = await import(
            "@/services/product-entitlements.service"
          );
          try {
            await ProductEntitlementsService.assertCanAddProducts(merchantId, 1);
          } catch (error) {
            const err = error as Error & { code?: string };
            if (err.code === "PRODUCT_LIMIT_REACHED") {
              errors.push({ sheet: "Products", row: i + 2, message: err.message });
              break;
            }
            throw error;
          }
          const [created] = await db.insert(schema.products).values(values).returning({ id: schema.products.id });
          productId = created.id;
          productsCreated++;
        }

        const groupIds = modifierGroupTitles
          .map((title) => groupTitleToId.get(title.trim().toLowerCase()))
          .filter((id): id is string => !!id);
        if (modifierGroupTitles.length && groupIds.length !== modifierGroupTitles.length) {
          const missing = modifierGroupTitles.filter(
            (title) => !groupTitleToId.has(title.trim().toLowerCase())
          );
          errors.push({
            sheet: "Products",
            row: i + 2,
            message: `Unknown modifier group(s): ${missing.join(", ")}`,
          });
        }
        if (groupIds.length) {
          await ModifierService.setGroupsForProduct(merchantId, productId, groupIds);
        } else if (parsedExtras.length) {
          await db
            .update(schema.products)
            .set({ extras: parsedExtras, allowExtras: true, updatedAt: new Date() })
            .where(eq(schema.products.id, productId));
        }
      } catch (error) {
        errors.push({
          sheet: "Products",
          row: i + 2,
          message: error instanceof Error ? error.message : "Failed to import product",
        });
      }
    }

    emit({ phase: "done", message: "Import complete", percent: 100 });

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

  private static async importModifierGroupsSheet(
    merchantId: string,
    workbook: XLSX.WorkBook,
    errors: ImportRowError[],
    counters: { created: () => void; updated: () => void },
    onRowProgress?: (current: number, total: number) => void
  ): Promise<Map<string, string>> {
    const groupTitleToId = new Map<string, string>();
    const existingGroups = await ModifierService.list(merchantId);
    for (const group of existingGroups) {
      groupTitleToId.set(group.title.trim().toLowerCase(), group.id);
    }

    const sheet = findSheet(workbook, "ModifierGroups");
    if (!sheet) return groupTitleToId;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    for (let i = 0; i < rows.length; i++) {
      onRowProgress?.(i + 1, rows.length);
      const row = rows[i];
      const title = repairCatalogText(String(row.title || row.Title || row.name || row.Name || "").trim());
      if (!title) {
        errors.push({ sheet: "ModifierGroups", row: i + 2, message: "Missing group title" });
        continue;
      }

      const pricingType = normalizeModifierPricing(
        String(row.pricingType || row.PricingType || "fixed")
      );
      const selectionType = normalizeModifierSelection(
        String(row.selectionType || row.SelectionType || "optional")
      );
      const minSelectable = Number(row.minSelectable ?? row.MinSelectable ?? (selectionType === "required" ? 1 : 0)) || 0;
      const maxSelectable = Number(row.maxSelectable ?? row.MaxSelectable ?? 1) || 1;
      const options = parseNamedPrices(
        row.options ?? row.Options ?? row.extras ?? row.Extras,
        "modifier-opt"
      ).map((o) => ({
        name: o.name,
        price: o.price,
        isDefault: o.isDefault,
      }));

      const key = title.toLowerCase();
      const existingId = groupTitleToId.get(key);
      try {
        if (existingId) {
          await ModifierService.update(merchantId, existingId, {
            title,
            pricingType,
            selectionType,
            minSelectable,
            maxSelectable,
            options,
          });
          counters.updated();
        } else {
          const created = await ModifierService.create(merchantId, {
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
      } catch (error) {
        errors.push({
          sheet: "ModifierGroups",
          row: i + 2,
          message: error instanceof Error ? error.message : "Failed to import modifier group",
        });
      }
    }

    return groupTitleToId;
  }

  static buildTemplateBuffer(): Buffer {
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
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  /** Export current categories + modifier groups + products to Excel (same columns as import template). */
  static async exportWorkbook(merchantId: string): Promise<Buffer> {
    const db = getDb();
    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
      orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
    });
    const products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      with: { category: { columns: { name: true } } },
      orderBy: [asc(schema.products.name)],
    });
    const modifierGroups = await ModifierService.list(merchantId);
    const groupsByProduct = await ModifierService.getGroupsForProducts(
      merchantId,
      products.map((p) => p.id)
    );

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
        category: (p as { category?: { name?: string } }).category?.name || "",
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
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
}

function findSheet(workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet | undefined {
  return (
    workbook.Sheets[name] ||
    workbook.Sheets[name.toLowerCase()] ||
    workbook.Sheets[name.toUpperCase()]
  );
}

function parseBool(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(s);
}

function normalizeModifierPricing(value: string): "free" | "fixed" | "toppings_by_size" {
  const s = value.trim().toLowerCase();
  if (s === "free") return "free";
  if (s === "toppings_by_size" || s === "toppings") return "toppings_by_size";
  return "fixed";
}

function normalizeModifierSelection(value: string): "optional" | "required" {
  return value.trim().toLowerCase() === "required" ? "required" : "optional";
}

function parseBulkPricing(value: unknown): Array<{ minQty: number; price: number }> {
  if (!value) return [];
  if (Array.isArray(value)) return value as Array<{ minQty: number; price: number }>;
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    if (raw.startsWith("[")) return JSON.parse(raw);
  } catch {
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

function parseTitleList(value: unknown): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseNamedPrices(
  value: unknown,
  idPrefix: string
): Array<{ id: string; name: string; price: number; isDefault?: boolean }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return (value as Array<{ id?: string; name: string; price: number; isDefault?: boolean }>).map(
      (item, index) => ({
        id: item.id || `${idPrefix}-${index + 1}`,
        name: String(item.name || "").trim(),
        price: Number(item.price) || 0,
        isDefault: !!item.isDefault,
      })
    );
  }
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    if (raw.startsWith("[")) {
      const parsed = JSON.parse(raw) as Array<{ name: string; price: number; isDefault?: boolean }>;
      return parsed.map((item, index) => ({
        id: `${idPrefix}-${index + 1}`,
        name: String(item.name || "").trim(),
        price: Number(item.price) || 0,
        isDefault: !!item.isDefault,
      }));
    }
  } catch {
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

function parseSpecifications(value: unknown): SpecRow[] {
  const parsed = parseNamedPrices(value, "spec");
  if (!parsed.length) return [];
  const hasDefault = parsed.some((s) => s.isDefault);
  return parsed.map((s, index) => ({
    id: s.id,
    name: s.name,
    price: s.price,
    saleStatus: "in_stock" as const,
    isDefault: s.isDefault || (!hasDefault && index === 0),
    sortOrder: index,
  }));
}

function parseExtras(value: unknown): Array<{ id: string; name: string; price: number }> {
  return parseNamedPrices(value, "extra").map(({ id, name, price }) => ({ id, name, price }));
}
