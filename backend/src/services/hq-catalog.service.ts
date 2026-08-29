import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { roundMoney2 } from "@/lib/money";
import { v4 as uuidv4 } from "uuid";

export type BulkPricingPreviewRow = {
  productId: string;
  name: string;
  categoryId: string | null;
  currentPrice: number;
  newPrice: number;
};

export type BulkPricingPreview = {
  token: string;
  rows: BulkPricingPreviewRow[];
  affectedCount: number;
};

const previewCache = new Map<string, { merchantId: string; rows: BulkPricingPreviewRow[]; expires: number }>();
const PREVIEW_TTL_MS = 15 * 60 * 1000;

function roundTo(value: number, step: number | null | undefined): number {
  if (!step || step <= 0) return roundMoney2(value);
  return roundMoney2(Math.round(value / step) * step);
}

function applyOp(current: number, operation: string, valueType: string, value: number): number {
  let next = current;
  if (operation === "decrease") {
    next = valueType === "percent" ? current * (1 - value / 100) : current - value;
  } else {
    next = valueType === "percent" ? current * (1 + value / 100) : current + value;
  }
  return Math.max(0, next);
}

export class BulkPricingService {
  static async preview(
    merchantId: string,
    input: {
      locationIds?: string[];
      categoryIds?: string[];
      productIds?: string[];
      operation: "increase" | "decrease";
      valueType: "fixed" | "percent";
      value: number;
      roundTo?: number | null;
    }
  ): Promise<BulkPricingPreview> {
    const db = getDb();
    const productIds = (input.productIds || []).filter(Boolean);
    const categoryIds = (input.categoryIds || []).filter(Boolean);

    let products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      columns: { id: true, name: true, categoryId: true, price: true, isActive: true },
    });

    if (productIds.length > 0) {
      const set = new Set(productIds);
      products = products.filter((p) => set.has(p.id));
    } else if (categoryIds.length > 0) {
      const set = new Set(categoryIds);
      products = products.filter((p) => p.categoryId && set.has(p.categoryId));
    }

    products = products.filter((p) => p.isActive !== false);

    const rows: BulkPricingPreviewRow[] = products.map((p) => {
      const currentPrice = Number(p.price) || 0;
      const newPrice = roundTo(
        applyOp(currentPrice, input.operation, input.valueType, Number(input.value) || 0),
        input.roundTo
      );
      return {
        productId: p.id,
        name: p.name,
        categoryId: p.categoryId,
        currentPrice,
        newPrice,
      };
    });

    const token = uuidv4();
    previewCache.set(token, {
      merchantId,
      rows,
      expires: Date.now() + PREVIEW_TTL_MS,
    });

    return { token, rows, affectedCount: rows.length };
  }

  static async apply(
    merchantId: string,
    previewToken: string,
    opts?: { staffId?: string | null; staffName?: string | null; locationIds?: string[] }
  ) {
    const cached = previewCache.get(previewToken);
    if (!cached || cached.merchantId !== merchantId || cached.expires < Date.now()) {
      throw new Error("Preview expired — run preview again");
    }
    previewCache.delete(previewToken);

    const db = getDb();
    const locationIds = opts?.locationIds || [];

    await db.transaction(async (tx) => {
      for (const row of cached.rows) {
        if (row.newPrice === row.currentPrice) continue;

        if (locationIds.length > 0) {
          for (const locationId of locationIds) {
            const existing = await tx.query.locationProductOverrides.findFirst({
              where: and(
                eq(schema.locationProductOverrides.locationId, locationId),
                eq(schema.locationProductOverrides.productId, row.productId)
              ),
            });
            if (existing) {
              await tx
                .update(schema.locationProductOverrides)
                .set({
                  priceOverride: row.newPrice.toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(schema.locationProductOverrides.id, existing.id));
            } else {
              await tx.insert(schema.locationProductOverrides).values({
                merchantId,
                locationId,
                productId: row.productId,
                priceOverride: row.newPrice.toFixed(2),
              });
            }
          }
        } else {
          await tx
            .update(schema.products)
            .set({ price: row.newPrice.toFixed(2), updatedAt: new Date() })
            .where(and(eq(schema.products.id, row.productId), eq(schema.products.merchantId, merchantId)));
        }
      }

      await tx.insert(schema.pricingBulkJobs).values({
        merchantId,
        locationIds,
        categoryIds: [],
        productIds: cached.rows.map((r) => r.productId),
        operation: "bulk",
        valueType: "mixed",
        value: "0",
        affectedCount: cached.rows.length,
        createdByStaffId: opts?.staffId || null,
        createdByName: opts?.staffName || null,
      });
    });

    return { affectedCount: cached.rows.length };
  }

  static async listJobs(merchantId: string, limit = 20) {
    const db = getDb();
    return db.query.pricingBulkJobs.findMany({
      where: eq(schema.pricingBulkJobs.merchantId, merchantId),
      orderBy: [desc(schema.pricingBulkJobs.createdAt)],
      limit,
    });
  }
}

export class HqCatalogService {
  static async listVersions(merchantId: string) {
    const db = getDb();
    return db.query.hqCatalogVersions.findMany({
      where: eq(schema.hqCatalogVersions.merchantId, merchantId),
      orderBy: [desc(schema.hqCatalogVersions.createdAt)],
      limit: 50,
    });
  }

  static async createVersion(
    merchantId: string,
    input: { name?: string; productIds?: string[]; staffId?: string | null }
  ) {
    const db = getDb();
    const products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
    });

    let selected = products;
    if (input.productIds?.length) {
      const set = new Set(input.productIds);
      selected = products.filter((p) => set.has(p.id));
    }

    const payload = {
      products: selected.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        categoryId: p.categoryId,
        visibility: p.visibility,
        isActive: p.isActive,
      })),
      categories: await db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchantId),
      }),
    };

    const [latest] = await db
      .select({ max: sql<number>`coalesce(max(${schema.hqCatalogVersions.version}), 0)` })
      .from(schema.hqCatalogVersions)
      .where(eq(schema.hqCatalogVersions.merchantId, merchantId));

    const [row] = await db
      .insert(schema.hqCatalogVersions)
      .values({
        merchantId,
        version: Number(latest?.max || 0) + 1,
        name: input.name?.trim() || `HQ Menu v${Number(latest?.max || 0) + 1}`,
        payloadJson: payload,
        createdByStaffId: input.staffId || null,
      })
      .returning();
    return row;
  }

  static async pushToLocations(
    merchantId: string,
    input: {
      versionId: string;
      locationIds: string[];
      overwritePrices?: boolean;
    }
  ) {
    const db = getDb();
    const version = await db.query.hqCatalogVersions.findFirst({
      where: and(
        eq(schema.hqCatalogVersions.id, input.versionId),
        eq(schema.hqCatalogVersions.merchantId, merchantId)
      ),
    });
    if (!version) throw new Error("HQ catalog version not found");

    const payload = version.payloadJson as {
      products?: Array<{
        id: string;
        name: string;
        description?: string | null;
        price: string | number;
        categoryId?: string | null;
        visibility?: unknown;
        isActive?: boolean;
      }>;
    };
    const hqProducts = payload.products || [];
    let linked = 0;

    for (const locationId of input.locationIds) {
      for (const hp of hqProducts) {
        const local = await db.query.products.findFirst({
          where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.id, hp.id)),
        });
        if (!local) continue;

        const existingLink = await db.query.locationCatalogLinks.findFirst({
          where: and(
            eq(schema.locationCatalogLinks.locationId, locationId),
            eq(schema.locationCatalogLinks.hqProductId, hp.id)
          ),
        });

        if (existingLink) {
          await db
            .update(schema.locationCatalogLinks)
            .set({
              localProductId: local.id,
              syncStatus: "synced",
              fromHqVersionId: version.id,
              updatedAt: new Date(),
            })
            .where(eq(schema.locationCatalogLinks.id, existingLink.id));
        } else {
          await db.insert(schema.locationCatalogLinks).values({
            merchantId,
            locationId,
            hqProductId: hp.id,
            localProductId: local.id,
            syncStatus: "synced",
            fromHqVersionId: version.id,
          });
        }

        if (input.overwritePrices) {
          const override = await db.query.locationProductOverrides.findFirst({
            where: and(
              eq(schema.locationProductOverrides.locationId, locationId),
              eq(schema.locationProductOverrides.productId, local.id)
            ),
          });
          const price = String(hp.price);
          if (override) {
            await db
              .update(schema.locationProductOverrides)
              .set({ priceOverride: price, updatedAt: new Date() })
              .where(eq(schema.locationProductOverrides.id, override.id));
          } else {
            await db.insert(schema.locationProductOverrides).values({
              merchantId,
              locationId,
              productId: local.id,
              priceOverride: price,
            });
          }
        }
        linked += 1;
      }
    }

    return { linked, locationCount: input.locationIds.length };
  }

  static async listLocationLinks(merchantId: string, locationId: string) {
    const db = getDb();
    return db.query.locationCatalogLinks.findMany({
      where: and(
        eq(schema.locationCatalogLinks.merchantId, merchantId),
        eq(schema.locationCatalogLinks.locationId, locationId)
      ),
      orderBy: [asc(schema.locationCatalogLinks.createdAt)],
    });
  }
}
