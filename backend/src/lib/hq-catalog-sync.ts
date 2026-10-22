/** Pure helpers for HQ menu sync pending detection (unit-tested). */

export type HqSyncProductRef = {
  id: string;
  categoryId: string | null;
  updatedAtMs: number;
};

export type HqSyncLinkRef = {
  hqProductId: string;
  localProductId: string | null;
  updatedAtMs: number;
};

export type HqSyncLocationRef = {
  id: string;
  name: string;
  linkCount: number;
};

/** Matches HQ sync UI sentinel for products without a category. */
export const HQ_SYNC_UNCATEGORIZED = "__uncategorized__";

export function parseSyncCategoryIds(categoryIds: string[]): {
  categoryIds: Set<string>;
  includeUncategorized: boolean;
} {
  const categoryIdsSet = new Set<string>();
  let includeUncategorized = false;
  for (const raw of categoryIds) {
    const id = String(raw || "").trim();
    if (!id) continue;
    if (id === HQ_SYNC_UNCATEGORIZED) includeUncategorized = true;
    else categoryIdsSet.add(id);
  }
  return { categoryIds: categoryIdsSet, includeUncategorized };
}

export function productMatchesSyncCategories(
  product: HqSyncProductRef,
  categoryIds: Set<string>,
  includeUncategorized: boolean
): boolean {
  if (product.categoryId === null || product.categoryId === undefined) {
    return includeUncategorized;
  }
  return categoryIds.has(product.categoryId);
}

export function resolveSyncProductIds(
  allProducts: HqSyncProductRef[],
  productIds: string[],
  categoryIds: string[]
): string[] {
  const { categoryIds: cats, includeUncategorized } = parseSyncCategoryIds(categoryIds);
  const hasCategoryScope = cats.size > 0 || includeUncategorized;

  const ids = productIds.filter(Boolean);
  if (ids.length) {
    const idSet = new Set(ids);
    if (!hasCategoryScope) return [...idSet];
    return [
      ...new Set(
        allProducts
          .filter((p) => idSet.has(p.id) && productMatchesSyncCategories(p, cats, includeUncategorized))
          .map((p) => p.id)
      ),
    ];
  }

  if (hasCategoryScope) {
    return [
      ...new Set(
        allProducts
          .filter((p) => productMatchesSyncCategories(p, cats, includeUncategorized))
          .map((p) => p.id)
      ),
    ];
  }
  return allProducts.map((p) => p.id);
}

/** HQ product ids in the selected category scope (for scoped link cleanup). */
export function productIdsInSyncCategoryScope(
  allProducts: HqSyncProductRef[],
  categoryIds: string[]
): string[] {
  const { categoryIds: cats, includeUncategorized } = parseSyncCategoryIds(categoryIds);
  if (!cats.size && !includeUncategorized) return [];
  return allProducts
    .filter((p) => productMatchesSyncCategories(p, cats, includeUncategorized))
    .map((p) => p.id);
}

export function productPendingForLocation(
  product: HqSyncProductRef,
  link: HqSyncLinkRef | undefined,
  locationUsesCatalogLinks: boolean
): boolean {
  if (!locationUsesCatalogLinks) return false;
  if (!link) return true;
  return product.updatedAtMs > link.updatedAtMs;
}

export function collectPendingProductIds(
  products: HqSyncProductRef[],
  linksByLocation: Map<string, HqSyncLinkRef[]>,
  locations: HqSyncLocationRef[]
): string[] {
  const pending = new Set<string>();
  for (const loc of locations) {
    const links = linksByLocation.get(loc.id) || [];
    const byHq = new Map(links.map((l) => [l.hqProductId, l]));
    const usesLinks = loc.linkCount > 0;
    for (const p of products) {
      const link = byHq.get(p.id);
      if (productPendingForLocation(p, link, usesLinks)) pending.add(p.id);
    }
  }
  return [...pending];
}

export function hasNeverSynced(locations: HqSyncLocationRef[]): boolean {
  return locations.length > 0 && locations.every((l) => l.linkCount === 0);
}
