import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { normalizeCateringConfig } from "@/lib/catering-config";
import { ProductService } from "@/services/product.service";

export type CateringTemplateId = "taco_bar" | "boxed_lunch" | "buffet_per_person";

async function findOrCreateCategory(merchantId: string, name: string) {
  const db = getDb();
  const cats = await db.query.categories.findMany({
    where: eq(schema.categories.merchantId, merchantId),
  });
  const hit = cats.find((c) => c.name === name);
  if (hit) return hit.id;
  const [row] = await db
    .insert(schema.categories)
    .values({ merchantId, name, sortOrder: 0 })
    .returning();
  return row.id;
}

async function findProductByName(merchantId: string, name: string) {
  const db = getDb();
  const rows = await db.query.products.findMany({
    where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.isActive, true)),
  });
  return rows.find((p) => p.name === name) ?? null;
}

export class CateringTemplatesService {
  static async apply(merchantId: string, templateId: CateringTemplateId) {
    const categoryId = await findOrCreateCategory(merchantId, "Catering");

    if (templateId === "taco_bar") {
      const components = [
        { name: "Catering — Chicken & beef", price: 0 },
        { name: "Catering — Chicken & steak", price: 0 },
        { name: "Catering — All steak", price: 0 },
        { name: "Catering — Black beans", price: 0 },
        { name: "Catering — Pico de gallo", price: 0 },
      ];
      const ids: Record<string, string> = {};
      for (const c of components) {
        let p = await findProductByName(merchantId, c.name);
        if (!p) {
          p = await ProductService.createProduct(merchantId, c.name, c.price, categoryId);
        }
        ids[c.name] = p.id;
      }
      const proteinSlotId = "protein-tier";
      const comboName = "Taco bar (demo template)";
      let combo = await findProductByName(merchantId, comboName);
      if (!combo) {
        combo = await ProductService.createProduct(merchantId, comboName, 0, categoryId, undefined, undefined, undefined, 0, true, "Per-person taco bar — pick protein tier. 15 guest minimum.", undefined, {
          productType: "combo",
          comboItems: [
            {
              id: proteinSlotId,
              name: "Select protein combination",
              minPick: 1,
              maxPick: 1,
              options: [
                { productId: ids["Catering — Chicken & beef"], extraPrice: 12 },
                { productId: ids["Catering — Chicken & steak"], extraPrice: 14 },
                { productId: ids["Catering — All steak"], extraPrice: 17 },
              ],
            },
            {
              id: "beans",
              name: "Beans (included)",
              minPick: 1,
              maxPick: 1,
              options: [{ productId: ids["Catering — Black beans"], extraPrice: 0 }],
            },
            {
              id: "salsa",
              name: "Salsas (pick 2)",
              minPick: 2,
              maxPick: 2,
              options: [{ productId: ids["Catering — Pico de gallo"], extraPrice: 0 }],
            },
          ],
          cateringConfig: normalizeCateringConfig({
            enabled: true,
            pricingMode: "per_person",
            perPersonPrice: 0,
            minGuests: 15,
            defaultGuests: 15,
            maxGuests: 200,
            tierSlotId: proteinSlotId,
            servesCount: 15,
            leadTimeHours: 24,
          }),
        });
      }
      return { templateId, products: [combo.id] };
    }

    if (templateId === "boxed_lunch") {
      const comboName = "Boxed lunch platter (demo)";
      let combo = await findProductByName(merchantId, comboName);
      if (!combo) {
        combo = await ProductService.createProduct(
          merchantId,
          comboName,
          189,
          categoryId,
          undefined,
          undefined,
          undefined,
          0,
          true,
          "Feeds a team — flat package price.",
          undefined,
          {
            productType: "combo",
            comboItems: [],
            cateringConfig: normalizeCateringConfig({
              enabled: true,
              pricingMode: "package",
              packagePrice: 189,
              minGuests: 10,
              defaultGuests: 15,
              servesCount: 15,
              leadTimeHours: 48,
              minOrderQty: 1,
            }),
          }
        );
      }
      return { templateId, products: [combo.id] };
    }

    const comboName = "Buffet line (demo per guest)";
    let combo = await findProductByName(merchantId, comboName);
    if (!combo) {
      combo = await ProductService.createProduct(
        merchantId,
        comboName,
        0,
        categoryId,
        undefined,
        undefined,
        undefined,
        0,
        true,
        "Simple per-head buffet pricing.",
        undefined,
        {
          productType: "combo",
          comboItems: [],
          cateringConfig: normalizeCateringConfig({
            enabled: true,
            pricingMode: "per_person",
            perPersonPrice: 18,
            minGuests: 20,
            defaultGuests: 25,
            servesCount: 25,
            leadTimeHours: 72,
          }),
        }
      );
    }
    return { templateId: "buffet_per_person", products: [combo.id] };
  }
}
