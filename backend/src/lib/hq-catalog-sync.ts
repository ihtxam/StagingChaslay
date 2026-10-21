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

export function resolveSyncProductIds(
  allProducts: HqSyncProductRef[],
  productIds: string[],
  categoryIds: string[]
): string[] {
  const ids = productIds.filter(Boolean);
  if (ids.length) return [...new Set(ids)];
  const cats = new Set(categoryIds.filter(Boolean));
  if (cats.size) {
    return [
      ...new Set(
        allProducts.filter((p) => p.categoryId && cats.has(p.categoryId)).map((p) => p.id)
      ),
    ];
  }
  return allProducts.map((p) => p.id);
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
