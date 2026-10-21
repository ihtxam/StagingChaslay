import { and, eq, like } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizeCateringConfig } from "@/lib/catering-config";
import { writeCateringAddonEnabled } from "@/lib/catering-addon";
import { ProductService } from "@/services/product.service";
import { ModifierService } from "@/services/modifier.service";

const MARKER_CLIENT_ID = "demo-catering-showcase-v1";

const IMAGES = {
  taco: "https://picsum.photos/seed/reborn-catering-taco/800/600",
  package: "https://picsum.photos/seed/reborn-catering-box/800/600",
  buffet: "https://picsum.photos/seed/reborn-catering-buffet/800/600",
  mixed: "https://picsum.photos/seed/reborn-catering-mixed/800/600",
  extras: "https://picsum.photos/seed/reborn-catering-extras/800/600",
} as const;

async function findByClientId(merchantId: string, clientId: string) {
  const db = getDb();
  const rows = await db.query.products.findMany({
    where: and(
      eq(schema.products.merchantId, merchantId),
      eq(schema.products.clientId, clientId)
    ),
    limit: 1,
  });
  return rows[0] ?? null;
}

async function ensureCategory(
  merchantId: string,
  name: string,
  sortOrder: number,
  description?: string
) {
  const db = getDb();
  const existing = await db.query.categories.findFirst({
    where: and(eq(schema.categories.merchantId, merchantId), eq(schema.categories.name, name)),
  });
  if (existing) {
    if (description && !existing.description) {
      await db
        .update(schema.categories)
        .set({ description, sortOrder, updatedAt: new Date() })
        .where(eq(schema.categories.id, existing.id));
    }
    return existing.id;
  }
  const [row] = await db
    .insert(schema.categories)
    .values({
      merchantId,
      name,
      sortOrder,
      description: description ?? null,
      isActive: true,
    })
    .returning();
  return row.id;
}

async function ensureComponent(
  merchantId: string,
  categoryId: string,
  clientId: string,
  name: string
) {
  const hit = await findByClientId(merchantId, clientId);
  if (hit) return hit.id;
  const p = await ProductService.createProduct(merchantId, name, 0, categoryId, undefined, undefined, undefined, 0, true, undefined, undefined, {
    clientId,
    productType: "standard",
  });
  const db = getDb();
  await db
    .update(schema.products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(schema.products.id, p.id));
  return p.id;
}

export class DemoCateringService {
  static async hasShowcase(merchantId: string): Promise<boolean> {
    const hit = await findByClientId(merchantId, MARKER_CLIENT_ID);
    return !!hit;
  }

  /**
   * Idempotent demo catering catalog for shop showcase (slug demo / shop.chaslay.com/demo).
   * Creates mobile-friendly categories (prefix "Catering ·") and all pricing scenarios.
   */
  static async importShowcase(merchantId: string, opts?: { force?: boolean }) {
    if (opts?.force !== true && (await this.hasShowcase(merchantId))) {
      return { skipped: true, message: "Demo catering showcase already present" };
    }

    await writeCateringAddonEnabled(merchantId, true);

    const catTiers = await ensureCategory(
      merchantId,
      "Catering · Protein tiers",
      200,
      "Per-person pricing with protein tier bar (15+ guests)."
    );
    const catPackage = await ensureCategory(
      merchantId,
      "Catering · Flat packages",
      201,
      "Fixed package price — great for boxed lunches."
    );
    const catBuffet = await ensureCategory(
      merchantId,
      "Catering · Per-guest buffet",
      202,
      "Simple CHF rate × guest count."
    );
    const catMixed = await ensureCategory(
      merchantId,
      "Catering · Mixed pricing",
      203,
      "Flat base fee plus per-head rate."
    );
    const catExtras = await ensureCategory(
      merchantId,
      "Catering · Staff & extras",
      204,
      "Fixed vs per-guest modifier surcharges."
    );

    const proteinSlotId = "protein-tier";
    const beefId = await ensureComponent(merchantId, catTiers, "demo-catering-comp-beef", "Tier — Chicken & beef");
    const steakId = await ensureComponent(merchantId, catTiers, "demo-catering-comp-steak", "Tier — Chicken & steak");
    const allSteakId = await ensureComponent(merchantId, catTiers, "demo-catering-comp-all-steak", "Tier — All steak");
    const beansId = await ensureComponent(merchantId, catTiers, "demo-catering-comp-beans", "Side — Black beans");
    const salsaId = await ensureComponent(merchantId, catTiers, "demo-catering-comp-salsa", "Side — Pico de gallo");

    if (!(await findByClientId(merchantId, MARKER_CLIENT_ID))) {
      await ProductService.createProduct(
        merchantId,
        "Taco bar (demo showcase)",
        0,
        catTiers,
        undefined,
        undefined,
        undefined,
        0,
        true,
        "Per-person taco bar with protein tiers. Prices are per guest (15 minimum). Pick beans and two salsas.",
        IMAGES.taco,
        {
          clientId: MARKER_CLIENT_ID,
          productType: "combo",
          comboItems: [
            {
              id: proteinSlotId,
              name: "Select protein combination",
              minPick: 1,
              maxPick: 1,
              options: [
                { productId: beefId, extraPrice: 12 },
                { productId: steakId, extraPrice: 14 },
                { productId: allSteakId, extraPrice: 17 },
              ],
            },
            {
              id: "beans",
              name: "Beans (included)",
              minPick: 1,
              maxPick: 1,
              options: [{ productId: beansId, extraPrice: 0 }],
            },
            {
              id: "salsa",
              name: "Salsas (pick 2)",
              minPick: 2,
              maxPick: 2,
              options: [{ productId: salsaId, extraPrice: 0 }],
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
        }
      );
    }

    if (!(await findByClientId(merchantId, "demo-catering-boxed"))) {
      await ProductService.createProduct(
        merchantId,
        "Boxed lunch platter (demo)",
        189,
        catPackage,
        undefined,
        undefined,
        undefined,
        0,
        true,
        "Feeds your team — one flat package price. Minimum 10 guests.",
        IMAGES.package,
        {
          clientId: "demo-catering-boxed",
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

    if (!(await findByClientId(merchantId, "demo-catering-buffet"))) {
      await ProductService.createProduct(
        merchantId,
        "Buffet line (demo per guest)",
        0,
        catBuffet,
        undefined,
        undefined,
        undefined,
        0,
        true,
        "Simple per-head buffet — CHF 18 × guest count. 20 guest minimum.",
        IMAGES.buffet,
        {
          clientId: "demo-catering-buffet",
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

    if (!(await findByClientId(merchantId, "demo-catering-mixed"))) {
      await ProductService.createProduct(
        merchantId,
        "Conference package (demo mixed)",
        0,
        catMixed,
        undefined,
        undefined,
        undefined,
        0,
        true,
        "CHF 120 flat setup + CHF 9 per guest. Ideal for meetings with AV and room setup.",
        IMAGES.mixed,
        {
          clientId: "demo-catering-mixed",
          productType: "combo",
          comboItems: [],
          cateringConfig: normalizeCateringConfig({
            enabled: true,
            pricingMode: "mixed",
            packagePrice: 120,
            perPersonPrice: 9,
            minGuests: 12,
            defaultGuests: 20,
            servesCount: 20,
            leadTimeHours: 48,
          }),
        }
      );
    }

    let extrasComboId: string | null = null;
    const extrasHit = await findByClientId(merchantId, "demo-catering-extras");
    if (!extrasHit) {
      const created = await ProductService.createProduct(
        merchantId,
        "Corporate lunch + add-ons (demo)",
        149,
        catExtras,
        undefined,
        undefined,
        undefined,
        0,
        true,
        "Flat package with optional staff and per-guest cutlery. Try fixed vs per-guest modifiers.",
        IMAGES.extras,
        {
          clientId: "demo-catering-extras",
          productType: "combo",
          comboItems: [],
          cateringConfig: normalizeCateringConfig({
            enabled: true,
            pricingMode: "package",
            packagePrice: 149,
            minGuests: 8,
            defaultGuests: 12,
            servesCount: 12,
            leadTimeHours: 36,
          }),
          allowExtras: true,
        }
      );
      extrasComboId = created.id;
    } else {
      extrasComboId = extrasHit.id;
    }

    if (extrasComboId) {
      const db = getDb();
      const fixedGroup = await db.query.modifierGroups.findFirst({
        where: and(
          eq(schema.modifierGroups.merchantId, merchantId),
          eq(schema.modifierGroups.title, "Catering demo — fixed fees")
        ),
      });
      if (!fixedGroup) {
        await ModifierService.create(merchantId, {
          title: "Catering demo — fixed fees",
          pricingType: "fixed",
          selectionType: "optional",
          priceScope: "fixed",
          minSelectable: 0,
          maxSelectable: 2,
          sortOrder: 50,
          options: [
            { name: "On-site server (2h)", price: 150, sortOrder: 0 },
            { name: "Delivery & setup fee", price: 35, sortOrder: 1 },
          ],
          productIds: [extrasComboId],
        });
      }
      const perGuestGroup = await db.query.modifierGroups.findFirst({
        where: and(
          eq(schema.modifierGroups.merchantId, merchantId),
          eq(schema.modifierGroups.title, "Catering demo — per guest")
        ),
      });
      if (!perGuestGroup) {
        await ModifierService.create(merchantId, {
          title: "Catering demo — per guest",
          pricingType: "fixed",
          selectionType: "optional",
          priceScope: "per_guest",
          minSelectable: 0,
          maxSelectable: 2,
          sortOrder: 51,
          options: [{ name: "Cutlery pack", price: 2.5, sortOrder: 0 }],
          productIds: [extrasComboId],
        });
      }
    }

    return {
      skipped: false,
      message: "Demo catering showcase imported",
      categories: 5,
      cateringEnabled: true,
    };
  }

  /** Remove demo-catering-* products and Catering · categories (optional cleanup). */
  static async removeShowcase(merchantId: string) {
    const db = getDb();
    await db
      .delete(schema.products)
      .where(
        and(
          eq(schema.products.merchantId, merchantId),
          like(schema.products.clientId, "demo-catering-%")
        )
      );
    const cats = await db.query.categories.findMany({
      where: and(eq(schema.categories.merchantId, merchantId), like(schema.categories.name, "Catering ·%")),
    });
    for (const c of cats) {
      await db.delete(schema.categories).where(eq(schema.categories.id, c.id));
    }
    return { success: true };
  }
}
