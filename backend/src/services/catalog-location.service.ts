import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  isVisibleOnChannel,
  type CatalogChannel,
} from "@/lib/catalog-visibility";

type ProductRow = typeof schema.products.$inferSelect;

export class CatalogLocationService {
  /** Merge per-location price, visibility, and availability overrides onto products. */
  static async applyLocationOverrides<T extends ProductRow>(
    merchantId: string,
    locationId: string | null | undefined,
    products: T[]
  ): Promise<T[]> {
    const locId = String(locationId || "").trim();
    if (!locId || !products.length) return products;

    const db = getDb();
    const overrides = await db.query.locationProductOverrides.findMany({
      where: and(
        eq(schema.locationProductOverrides.merchantId, merchantId),
        eq(schema.locationProductOverrides.locationId, locId),
        inArray(
          schema.locationProductOverrides.productId,
          products.map((p) => p.id)
        )
      ),
    });
    if (!overrides.length) return products;

    const byProduct = new Map(overrides.map((o) => [o.productId, o]));
    return products.map((p) => {
      const o = byProduct.get(p.id);
      if (!o) return p;
      const next = { ...p } as T & ProductRow;
      if (o.priceOverride != null) {
        next.price = String(o.priceOverride);
      }
      if (o.visibility != null) {
        next.visibility = o.visibility as ProductRow["visibility"];
      }
      if (o.isAvailable === false) {
        next.isActive = false;
      }
      return next as T;
    });
  }

  /** Filter products to an active HQ time-based menu when one matches. */
  static filterByHqMenuProductIds<T extends { id: string }>(
    products: T[],
    allowedIds: Set<string> | null
  ): T[] {
    if (!allowedIds || allowedIds.size === 0) return products;
    return products.filter((p) => allowedIds.has(p.id));
  }

  static productVisibleAfterOverrides(
    product: { visibility?: unknown; isActive?: boolean | null },
    channel: CatalogChannel
  ): boolean {
    if (product.isActive === false) return false;
    return isVisibleOnChannel(product.visibility, channel);
  }
}
