import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  filterCatalogForChannel,
  isVisibleOnChannel,
  type CatalogChannel,
} from "@/lib/catalog-visibility";

type ProductRow = typeof schema.products.$inferSelect;
type CategoryRow = typeof schema.categories.$inferSelect;

export type LocationChannelCatalog = {
  categories: CategoryRow[];
  products: ProductRow[];
  locationId: string;
};

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

  /**
   * POS / shop menu for one location: overrides, optional HQ location links, channel visibility, HQ time menus.
   */
  static async buildLocationChannelCatalog(
    merchantId: string,
    locationId: string,
    channel: CatalogChannel
  ): Promise<LocationChannelCatalog> {
    const db = getDb();
    const locId = String(locationId || "").trim();
    if (!locId) {
      return { categories: [], products: [], locationId: locId };
    }

    const [categories, products, links] = await Promise.all([
      db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchantId),
        orderBy: [asc(schema.categories.sortOrder)],
      }),
      db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.isActive, true)),
        orderBy: [asc(schema.products.sortOrder), asc(schema.products.name)],
      }),
      db.query.locationCatalogLinks.findMany({
        where: and(
          eq(schema.locationCatalogLinks.merchantId, merchantId),
          eq(schema.locationCatalogLinks.locationId, locId)
        ),
      }),
    ]);

    let productPool = products;
    if (links.length) {
      const allowed = new Set(
        links.map((l) => l.localProductId).filter((id): id is string => !!id)
      );
      productPool = products.filter((p) => allowed.has(p.id));
    }

    const withOverrides = await this.applyLocationOverrides(merchantId, locId, productPool);
    const filtered = filterCatalogForChannel(withOverrides, categories, channel);

    const { HqMenuService } = await import("@/services/hq-menu.service");
    const menuProductIds = await HqMenuService.resolveActiveProductIds(
      merchantId,
      locId,
      channel
    );
    const visibleProducts = this.filterByHqMenuProductIds(filtered.products, menuProductIds);

    const categoryIdsWithProducts = new Set(
      visibleProducts.map((p) => p.categoryId).filter(Boolean) as string[]
    );
    const visibleCategories = filtered.categories.filter(
      (c) =>
        categoryIdsWithProducts.has(c.id) ||
        !!(c as { isOffersCategory?: boolean }).isOffersCategory
    );

    return {
      categories: visibleCategories,
      products: visibleProducts,
      locationId: locId,
    };
  }
}
