/** Where a product/category may appear in the catalog. */
export type CatalogChannel = "pos" | "shop" | "qr_table" | "delivery";

export type CatalogVisibility = {
  channels: CatalogChannel[];
};

export const ALL_CATALOG_CHANNELS: CatalogChannel[] = ["pos", "shop", "qr_table", "delivery"];

const CHANNEL_SET = new Set<string>(ALL_CATALOG_CHANNELS);

export const DEFAULT_CATALOG_VISIBILITY: CatalogVisibility = {
  channels: [...ALL_CATALOG_CHANNELS],
};

export function normalizeCatalogVisibility(raw: unknown): CatalogVisibility {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CATALOG_VISIBILITY };
  const src = raw as Record<string, unknown>;
  const channelsRaw = src.channels;
  if (!Array.isArray(channelsRaw)) return { ...DEFAULT_CATALOG_VISIBILITY };
  const channels = channelsRaw
    .map((c) => String(c).trim().toLowerCase())
    .filter((c): c is CatalogChannel => CHANNEL_SET.has(c));
  if (!channels.length) return { channels: [] };
  return { channels: [...new Set(channels)] };
}

export function isVisibleOnChannel(
  visibility: unknown,
  channel: CatalogChannel
): boolean {
  const normalized = normalizeCatalogVisibility(visibility);
  if (!normalized.channels.length) return false;
  return normalized.channels.includes(channel);
}

export function productVisibleOnChannel(
  product: { visibility?: unknown; isActive?: boolean | null },
  category: { visibility?: unknown } | null | undefined,
  channel: CatalogChannel
): boolean {
  if (product.isActive === false) return false;
  if (!isVisibleOnChannel(product.visibility, channel)) return false;
  if (category && !isVisibleOnChannel(category.visibility, channel)) return false;
  return true;
}

export function filterCatalogForChannel<
  T extends { id: string; categoryId?: string | null; visibility?: unknown; isActive?: boolean | null },
  C extends { id: string; visibility?: unknown }
>(products: T[], categories: C[], channel: CatalogChannel): { products: T[]; categories: C[] } {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const visibleProducts = products.filter((p) =>
    productVisibleOnChannel(p, p.categoryId ? categoryById.get(p.categoryId) : null, channel)
  );
  const categoryIdsWithProducts = new Set(
    visibleProducts.map((p) => p.categoryId).filter(Boolean) as string[]
  );
  const visibleCategories = categories.filter(
    (c) => categoryIdsWithProducts.has(c.id) || isVisibleOnChannel(c.visibility, channel)
  );
  return { products: visibleProducts, categories: visibleCategories };
}

/** Map shop fulfillment channel query to catalog visibility channel. */
export function shopMenuCatalogChannel(
  channelParam?: string | null,
  tableId?: string | null
): CatalogChannel {
  if (tableId) return "qr_table";
  const c = String(channelParam || "").toLowerCase();
  if (c === "delivery") return "delivery";
  if (c === "dine_in") return "qr_table";
  return "shop";
}
