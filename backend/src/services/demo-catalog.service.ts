import { count, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb, schema } from "@/db";
import {
  DEMO_CATEGORIES,
  DEMO_COMBOS,
  DEMO_MODIFIER_GROUPS,
  DEMO_PRODUCTS,
} from "@/lib/demo-catalog.data";
import { ModifierService } from "@/services/modifier.service";

export type DemoImportResult = {
  success: true;
  categoriesCreated: number;
  productsCreated: number;
  modifierGroupsCreated: number;
  combosCreated: number;
  categoryNames: string[];
};

export class DemoCatalogService {
  static async importDemo(
    merchantId: string,
    options: { force?: boolean } = {}
  ): Promise<DemoImportResult> {
    const db = getDb();
    const force = options.force === true;

    const [{ existing }] = await db
      .select({ existing: count() })
      .from(schema.categories)
      .where(eq(schema.categories.merchantId, merchantId));

    if (Number(existing) > 0 && !force) {
      throw new Error(
        "Catalog already has categories. Pass force: true to import demo content anyway."
      );
    }

    const categoryIds = new Map<string, string>();
    const groupIds = new Map<string, string>();
    const productIds = new Map<string, string>();
    const linkedProductIds: string[] = [];

    await db.transaction(async (tx) => {
      for (let i = 0; i < DEMO_CATEGORIES.length; i++) {
        const cat = DEMO_CATEGORIES[i]!;
        const [row] = await tx
          .insert(schema.categories)
          .values({
            merchantId,
            name: cat.name,
            description: cat.description,
            color: cat.color,
            sortOrder: i,
            clientId: `demo-cat-${cat.key}`,
          })
          .returning({ id: schema.categories.id });
        categoryIds.set(cat.key, row!.id);
      }

      for (let gi = 0; gi < DEMO_MODIFIER_GROUPS.length; gi++) {
        const g = DEMO_MODIFIER_GROUPS[gi]!;
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
            sortOrder: gi,
          })
          .returning({ id: schema.modifierGroups.id });

        groupIds.set(g.key, group!.id);

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
            isActive: true,
            isTaxable: true,
            productType: "standard",
            sortOrder: pi,
            clientId: `demo-prod-${p.key}`,
          })
          .returning({ id: schema.products.id });

        productIds.set(p.key, row!.id);

        const groupKeys = p.modifierGroupKeys || [];
        if (groupKeys.length) {
          linkedProductIds.push(row!.id);
          await tx.insert(schema.productModifierGroups).values(
            groupKeys.map((gk, idx) => ({
              productId: row!.id,
              groupId: groupIds.get(gk)!,
              sortOrder: idx,
            }))
          );
        }
      }

      let comboSort = DEMO_PRODUCTS.length;
      for (const combo of DEMO_COMBOS) {
        const categoryId = categoryIds.get(combo.categoryKey);
        if (!categoryId) continue;

        const comboItems = combo.slots.map((slot, si) => ({
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
            isActive: true,
            isTaxable: true,
            productType: "combo",
            comboItems,
            sortOrder: comboSort++,
            clientId: `demo-combo-${combo.key}`,
          })
          .returning({ id: schema.products.id });

        productIds.set(combo.key, row!.id);
      }
    });

    for (const productId of linkedProductIds) {
      await ModifierService.refreshProductExtras(merchantId, productId);
    }

    return {
      success: true,
      categoriesCreated: DEMO_CATEGORIES.length,
      productsCreated: DEMO_PRODUCTS.length + DEMO_COMBOS.length,
      modifierGroupsCreated: DEMO_MODIFIER_GROUPS.length,
      combosCreated: DEMO_COMBOS.length,
      categoryNames: DEMO_CATEGORIES.map((c) => c.name),
    };
  }
}
