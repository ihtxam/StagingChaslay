export type CatalogChannel = 'pos' | 'shop' | 'qr_table' | 'delivery' | 'kiosk';

export type CatalogVisibility = {
  channels: CatalogChannel[];
};

/** Legacy / API may still mention delivery; UI treats it as part of shop. */
export const ALL_CATALOG_CHANNELS: CatalogChannel[] = ['pos', 'shop', 'qr_table', 'delivery', 'kiosk'];

/** Channels merchants pick for product/category visibility and schedule menus. */
export const CATALOG_VISIBILITY_UI_CHANNELS: CatalogChannel[] = ['pos', 'shop', 'qr_table', 'kiosk'];

export const DEFAULT_CATALOG_VISIBILITY: CatalogVisibility = {
  channels: [...CATALOG_VISIBILITY_UI_CHANNELS],
};

const CHANNEL_SET = new Set<string>(ALL_CATALOG_CHANNELS);

function collapseDeliveryIntoShop(channels: CatalogChannel[]): CatalogChannel[] {
  const set = new Set<CatalogChannel>(channels);
  if (set.delete('delivery')) {
    set.add('shop');
  }
  return [...set];
}

export function normalizeCatalogVisibility(raw: unknown): CatalogVisibility {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CATALOG_VISIBILITY };
  const channelsRaw = (raw as CatalogVisibility).channels;
  if (!Array.isArray(channelsRaw)) return { ...DEFAULT_CATALOG_VISIBILITY };
  const channels = channelsRaw
    .map((c) => String(c).trim().toLowerCase())
    .filter((c): c is CatalogChannel => CHANNEL_SET.has(c));
  if (!channels.length) return { ...DEFAULT_CATALOG_VISIBILITY };
  return { channels: collapseDeliveryIntoShop([...new Set(channels)]) };
}

export function isVisibleOnChannel(visibility: unknown, channel: CatalogChannel): boolean {
  const effective: CatalogChannel = channel === 'delivery' ? 'shop' : channel;
  const normalized = normalizeCatalogVisibility(visibility);
  if (!normalized.channels.length) return false;
  return normalized.channels.includes(effective);
}

export function productVisibleOnChannel(
  product: { visibility?: unknown; isActive?: boolean },
  category: { visibility?: unknown } | null | undefined,
  channel: CatalogChannel
): boolean {
  if (product.isActive === false) return false;
  if (!isVisibleOnChannel(product.visibility, channel)) return false;
  // POS honors per-product visibility even when the category omits POS (common after shop-only setup).
  if (channel === 'pos') return true;
  if (category && !isVisibleOnChannel(category.visibility, channel)) return false;
  return true;
}

/** Schedule / HQ menu channel pickers (delivery folds into shop). */
export function normalizeMenuCatalogChannels(channels: unknown): CatalogChannel[] {
  if (!Array.isArray(channels)) return [];
  const out = new Set<CatalogChannel>();
  for (const c of channels) {
    const k = String(c || '').trim().toLowerCase();
    if (k === 'delivery') {
      out.add('shop');
      continue;
    }
    if (CHANNEL_SET.has(k)) out.add(k as CatalogChannel);
  }
  return [...out];
}

export const CATALOG_CHANNEL_LABELS: Record<CatalogChannel, string> = {
  pos: 'POS',
  shop: 'Online shop',
  qr_table: 'QR table ordering',
  delivery: 'Online shop',
  kiosk: 'Self-order kiosk',
};
