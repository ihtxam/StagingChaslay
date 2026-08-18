import { count, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb, schema } from "@/db";
import {
  DEMO_CATEGORIES,
  DEMO_COMBOS,
  DEMO_MODIFIER_GROUPS,
  DEMO_PRODUCTS,
} from "@/lib/demo-catalog.data";
import { allocateInternalBarcode } from "@/services/barcode.service";
import { ModifierService } from "@/services/modifier.service";

export type DemoImportMode = "replace" | "merge";

export type DemoImportResult = {
  success: true;
  mode: DemoImportMode;
  categoriesCreated: number;
  productsCreated: number;
  modifierGroupsCreated: number;
  combosCreated: number;
  categoriesSkipped: number;
  productsSkipped: number;
  modifierGroupsSkipped: number;
  combosSkipped: number;
  categoryNames: string[];
};

type ImportCounters = {
  categoriesCreated: number;
  productsCreated: number;
  modifierGroupsCreated: number;
  combosCreated: number;
  categoriesSkipped: number;
  productsSkipped: number;
  modifierGroupsSkipped: number;
  combosSkipped: number;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function productConflictKey(name: string, sku?: string | null): string {
  const trimmedSku = sku?.trim();
  if (trimmedSku) return `sku:${norm(trimmedSku)}`;
  return `name:${norm(name)}`;
}

export class DemoCatalogService {
  static async importDemo(
    merchantId: string,
    options: { mode?: DemoImportMode; force?: boolean } = {}
  ): Promise<DemoImportResult> {
    const db = getDb();

    const [{ existing }] = await db
      .select({ existing: count() })
      .from(schema.categories)
      .where(eq(schema.categories.merchantId, merchantId));

    const hasExisting = Number(existing) > 0;
    const mode: DemoImportMode =
      options.mode === "replace" || options.mode === "merge"
        ? options.mode
        : options.force === true
          ? "replace"
          : hasExisting
            ? (() => {
                throw new Error(
                  "Catalog already has categories. Pass mode: 'replace' or 'merge'."
                );
              })()
            : "merge";

    const categoryIds = new Map<string, string>();
    const groupIds = new Map<string, string>();
    const productIds = new Map<string, string>();
    const linkedProductIds: string[] = [];
    const counters: ImportCounters = {
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
        await tx.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
        await tx
          .delete(schema.modifierGroups)
          .where(eq(schema.modifierGroups.merchantId, merchantId));
        await tx.delete(schema.categories).where(eq(schema.categories.merchantId, merchantId));
      }

      const existingCategories =
        mode === "merge"
          ? await tx
              .select({
                id: schema.categories.id,
                name: schema.categories.name,
                sortOrder: schema.categories.sortOrder,
              })
              .from(schema.categories)
              .where(eq(schema.categories.merchantId, merchantId))
          : [];

      const categoryByName = new Map(
        existingCategories.map((c) => [norm(c.name), c])
      );
      let categorySortBase =
        existingCategories.reduce((maxSoFar, c) => Math.max(maxSoFar, c.sortOrder ?? 0), -1) + 1;

      const existingProducts =
        mode === "merge"
          ? await tx
              .select({
                id: schema.products.id,
                name: schema.products.name,
                sku: schema.products.sku,
                barcode: schema.products.barcode,
                clientId: schema.products.clientId,
                sortOrder: schema.products.sortOrder,
              })
              .from(schema.products)
              .where(eq(schema.products.merchantId, merchantId))
          : [];
      const takenBarcodes = new Set(
        existingProducts
          .map((p) => String(p.barcode || "").trim())
          .filter(Boolean)
      );

      const productByKey = new Map<string, { id: string; sortOrder: number }>();
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
      let productSortBase =
        existingProducts.reduce((maxSoFar, p) => Math.max(maxSoFar, p.sortOrder ?? 0), -1) + 1;
      let comboSortBase =
        mode === "merge" ? productSortBase : DEMO_PRODUCTS.length;

      const existingGroups =
        mode === "merge"
          ? await tx
              .select({
                id: schema.modifierGroups.id,
                title: schema.modifierGroups.title,
                sortOrder: schema.modifierGroups.sortOrder,
              })
              .from(schema.modifierGroups)
              .where(eq(schema.modifierGroups.merchantId, merchantId))
          : [];

      const groupByTitle = new Map(existingGroups.map((g) => [norm(g.title), g]));
      let groupSortBase =
        existingGroups.reduce((maxSoFar, g) => Math.max(maxSoFar, g.sortOrder ?? 0), -1) + 1;

      for (let i = 0; i < DEMO_CATEGORIES.length; i++) {
        const cat = DEMO_CATEGORIES[i]!;
        const existing = mode === "merge" ? categoryByName.get(norm(cat.name)) : undefined;
        if (existing) {
          categoryIds.set(cat.key, existing.id);
          counters.categoriesSkipped++;
          continue;
        }

        const [row] = await tx
          .insert(schema.categories)
          .values({
            merchantId,
            name: cat.name,
            description: cat.description,
            color: cat.color,
            sortOrder: mode === "merge" ? categorySortBase++ : i,
            clientId: `demo-cat-${cat.key}`,
          })
          .returning({ id: schema.categories.id });
        categoryIds.set(cat.key, row!.id);
        counters.categoriesCreated++;
      }

      for (let gi = 0; gi < DEMO_MODIFIER_GROUPS.length; gi++) {
        const g = DEMO_MODIFIER_GROUPS[gi]!;
        const existing = mode === "merge" ? groupByTitle.get(norm(g.title)) : undefined;
        if (existing) {
          groupIds.set(g.key, existing.id);
          counters.modifierGroupsSkipped++;
          continue;
        }

        const minSelectable =
          g.selectionType === "required"
            ? Math.max(1, g.minSelectable ?? 1)
            : Math.max(0, g.minSelectable ?? 0);
        const maxSelectable = Math.max(minSelectable, g.maxSelectable ?? 1);

        const [group] = await tx
          .insert(schema.modifierGroups)
          .values({
            merchantId,
            title: g.title,
            pricingType: g.pricingType,
            selectionType: g.selectionType,
            minSelectable,
            maxSelectable,
            sortOrder: mode === "merge" ? groupSortBase++ : gi,
          })
          .returning({ id: schema.modifierGroups.id });

        groupIds.set(g.key, group!.id);
        counters.modifierGroupsCreated++;

        if (g.options.length) {
          await tx.insert(schema.modifierOptions).values(
            g.options.map((o, oi) => ({
              groupId: group!.id,
              name: o.name,
              price: g.pricingType === "free" ? "0" : String(o.price ?? 0),
              isDefault: !!o.isDefault,
              sortOrder: oi,
            }))
          );
        }
      }

      for (let pi = 0; pi < DEMO_PRODUCTS.length; pi++) {
        const p = DEMO_PRODUCTS[pi]!;
        const categoryId = categoryIds.get(p.categoryKey);
        if (!categoryId) continue;

        const demoClientId = `demo-prod-${p.key}`;
        const conflictKey = productConflictKey(p.name, p.sku);
        const existing =
          mode === "merge"
            ? productByKey.get(conflictKey) ||
              productByKey.get(`client:${norm(demoClientId)}`)
            : undefined;

        if (existing) {
          productIds.set(p.key, existing.id);
          counters.productsSkipped++;
          continue;
        }

        const [row] = await tx
          .insert(schema.products)
          .values({
            merchantId,
            categoryId,
            name: p.name,
            description: p.description,
            price: p.price.toFixed(2),
            stock: p.stock ?? 100,
            sku: p.sku,
            barcode: allocateInternalBarcode(takenBarcodes),
            isActive: true,
            isTaxable: true,
            productType: "standard",
            sortOrder: mode === "merge" ? productSortBase++ : pi,
            clientId: demoClientId,
          })
          .returning({ id: schema.products.id });

        productIds.set(p.key, row!.id);
        counters.productsCreated++;

        const groupKeys = p.modifierGroupKeys || [];
        if (groupKeys.length) {
          linkedProductIds.push(row!.id);
          await tx.insert(schema.productModifierGroups).values(
            groupKeys
              .filter((gk) => groupIds.has(gk))
              .map((gk, idx) => ({
                productId: row!.id,
                groupId: groupIds.get(gk)!,
                sortOrder: idx,
              }))
          );
        }
      }

      for (const combo of DEMO_COMBOS) {
        const categoryId = categoryIds.get(combo.categoryKey);
        if (!categoryId) {
          counters.combosSkipped++;
          continue;
        }

        const demoClientId = `demo-combo-${combo.key}`;
        const conflictKey = productConflictKey(combo.name, combo.sku);
        const existing =
          mode === "merge"
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
          id: uuidv4(),
          name: slot.name,
          minPick: slot.minPick,
          maxPick: slot.maxPick,
          options: slot.productKeys.map((pk, oi) => ({
            productId: productIds.get(pk)!,
            extraPrice: slot.extraPrices?.[oi] ?? 0,
          })),
        }));

        const [row] = await tx
          .insert(schema.products)
          .values({
            merchantId,
            categoryId,
            name: combo.name,
            description: combo.description,
            price: combo.price.toFixed(2),
            stock: 100,
            sku: combo.sku,
            barcode: allocateInternalBarcode(takenBarcodes),
            isActive: true,
            isTaxable: true,
            productType: "combo",
            comboItems,
            sortOrder: mode === "merge" ? productSortBase++ : comboSortBase++,
            clientId: demoClientId,
          })
          .returning({ id: schema.products.id });

        productIds.set(combo.key, row!.id);
        counters.combosCreated++;
      }
    });

    for (const productId of linkedProductIds) {
      await ModifierService.refreshProductExtras(merchantId, productId);
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
      categoryNames: DEMO_CATEGORIES.map((c) => c.name),
    };
  }
}
