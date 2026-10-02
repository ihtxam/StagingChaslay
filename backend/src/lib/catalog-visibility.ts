/** Where a product/category may appear in the catalog. */
export type CatalogChannel = "pos" | "shop" | "qr_table" | "delivery" | "kiosk";

export type CatalogVisibility = {
  channels: CatalogChannel[];
};

/** All channels stored in DB (legacy rows may still list delivery). */
export const ALL_CATALOG_CHANNELS: CatalogChannel[] = ["pos", "shop", "qr_table", "delivery", "kiosk"];

/** Channels shown in merchant UI — delivery is controlled via shop pickup/delivery settings. */
export const CATALOG_VISIBILITY_UI_CHANNELS: CatalogChannel[] = ["pos", "shop", "qr_table", "kiosk"];

const CHANNEL_SET = new Set<string>(ALL_CATALOG_CHANNELS);

export const DEFAULT_CATALOG_VISIBILITY: CatalogVisibility = {
  channels: [...CATALOG_VISIBILITY_UI_CHANNELS],
};

function collapseDeliveryIntoShop(channels: CatalogChannel[]): CatalogChannel[] {
  const set = new Set<CatalogChannel>(channels);
  if (set.delete("delivery")) {
    set.add("shop");
  }
  return [...set];
}

export function normalizeCatalogVisibility(raw: unknown): CatalogVisibility {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CATALOG_VISIBILITY };
  const src = raw as Record<string, unknown>;
  const channelsRaw = src.channels;
  if (!Array.isArray(channelsRaw)) return { ...DEFAULT_CATALOG_VISIBILITY };
  const channels = channelsRaw
    .map((c) => String(c).trim().toLowerCase())
    .filter((c): c is CatalogChannel => CHANNEL_SET.has(c));
  if (!channels.length) return { ...DEFAULT_CATALOG_VISIBILITY };
  return { channels: collapseDeliveryIntoShop([...new Set(channels)]) };
}

/** Normalize schedule-menu / HQ menu channel list (delivery → shop). */
export function normalizeMenuCatalogChannels(channels: unknown): string[] {
  if (!Array.isArray(channels)) return [];
  const out = new Set<string>();
  for (const c of channels) {
    const k = String(c || "").trim().toLowerCase();
    if (k === "delivery") {
      out.add("shop");
      continue;
    }
    if (CHANNEL_SET.has(k)) out.add(k);
  }
  return [...out];
}

export function menuIncludesCatalogChannel(menuChannels: unknown, channel: CatalogChannel): boolean {
  const normalized = normalizeMenuCatalogChannels(menuChannels);
  if (!normalized.length) return true;
  return normalized.includes(channel);
}

export function isVisibleOnChannel(
  visibility: unknown,
  channel: CatalogChannel
): boolean {
  const effective: CatalogChannel = channel === "delivery" ? "shop" : channel;
  const normalized = normalizeCatalogVisibility(visibility);
  if (!normalized.channels.length) return false;
  return normalized.channels.includes(effective);
}

export function productVisibleOnChannel(
  product: { visibility?: unknown; isActive?: boolean | null },
  category: { visibility?: unknown } | null | undefined,
  channel: CatalogChannel
): boolean {
  if (product.isActive === false) return false;
  if (!isVisibleOnChannel(product.visibility, channel)) return false;
  // POS honors per-product visibility even when the category omits POS (common after shop-only setup).
  if (channel === "pos") return true;
  if (category && !isVisibleOnChannel(category.visibility, channel)) return false;
  return true;
}

/** Catalog rows saved before the kiosk channel existed (no explicit kiosk flag). */
export function isPreKioskCatalogVisibility(visibility: unknown): boolean {
  const normalized = normalizeCatalogVisibility(visibility);
  return normalized.channels.length > 0 && !normalized.channels.includes("kiosk");
}

/** Kiosk menu visibility — honors kiosk channel, with shop/POS fallback for legacy catalogs. */
export function productVisibleOnKioskChannel(
  product: { visibility?: unknown; isActive?: boolean | null },
  category: { visibility?: unknown } | null | undefined
): boolean {
  if (product.isActive === false) return false;
  if (isVisibleOnChannel(product.visibility, "kiosk")) {
    if (category && !isVisibleOnChannel(category.visibility, "kiosk")) return false;
    return true;
  }
  if (!isPreKioskCatalogVisibility(product.visibility)) return false;
  return (
    productVisibleOnChannel(product, category, "shop") ||
    productVisibleOnChannel(product, category, "pos")
  );
}

export function categoryVisibleOnKioskChannel(category: { visibility?: unknown }): boolean {
  if (isVisibleOnChannel(category.visibility, "kiosk")) return true;
  if (!isPreKioskCatalogVisibility(category.visibility)) return false;
  return (
    isVisibleOnChannel(category.visibility, "shop") ||
    isVisibleOnChannel(category.visibility, "pos")
  );
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

export function filterCatalogForKioskChannel<
  T extends { id: string; categoryId?: string | null; visibility?: unknown; isActive?: boolean | null },
  C extends { id: string; visibility?: unknown; isOffersCategory?: boolean | null }
>(products: T[], categories: C[]): { products: T[]; categories: C[] } {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const visibleProducts = products.filter((p) =>
    productVisibleOnKioskChannel(p, p.categoryId ? categoryById.get(p.categoryId) : null)
  );
  const categoryIdsWithProducts = new Set(
    visibleProducts.map((p) => p.categoryId).filter(Boolean) as string[]
  );
  const visibleCategories = categories.filter(
    (c) =>
      categoryIdsWithProducts.has(c.id) ||
      c.isOffersCategory ||
      categoryVisibleOnKioskChannel(c)
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
  if (c === "kiosk") return "kiosk";
  if (c === "dine_in") return "qr_table";
  // takeaway, delivery, and default shop checkout → same catalog visibility as online shop
  return "shop";
}
