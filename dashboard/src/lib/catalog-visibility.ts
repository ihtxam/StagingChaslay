export type CatalogChannel = 'pos' | 'shop' | 'qr_table' | 'delivery' | 'kiosk';

export type CatalogVisibility = {
  channels: CatalogChannel[];
};

export const ALL_CATALOG_CHANNELS: CatalogChannel[] = ['pos', 'shop', 'qr_table', 'delivery', 'kiosk'];

export const DEFAULT_CATALOG_VISIBILITY: CatalogVisibility = {
  channels: [...ALL_CATALOG_CHANNELS],
};

const CHANNEL_SET = new Set<string>(ALL_CATALOG_CHANNELS);

export function normalizeCatalogVisibility(raw: unknown): CatalogVisibility {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CATALOG_VISIBILITY };
  const channelsRaw = (raw as CatalogVisibility).channels;
  if (!Array.isArray(channelsRaw)) return { ...DEFAULT_CATALOG_VISIBILITY };
  const channels = channelsRaw
    .map((c) => String(c).trim().toLowerCase())
    .filter((c): c is CatalogChannel => CHANNEL_SET.has(c));
  return { channels: [...new Set(channels)] };
}

export function isVisibleOnChannel(visibility: unknown, channel: CatalogChannel): boolean {
  const normalized = normalizeCatalogVisibility(visibility);
  if (!normalized.channels.length) return false;
  return normalized.channels.includes(channel);
}

export function productVisibleOnChannel(
  product: { visibility?: unknown; isActive?: boolean },
  category: { visibility?: unknown } | null | undefined,
  channel: CatalogChannel
): boolean {
  if (product.isActive === false) return false;
  if (!isVisibleOnChannel(product.visibility, channel)) return false;
  if (category && !isVisibleOnChannel(category.visibility, channel)) return false;
  return true;
}

export const CATALOG_CHANNEL_LABELS: Record<CatalogChannel, string> = {
  pos: 'POS',
  shop: 'Online shop',
  qr_table: 'QR table ordering',
  delivery: 'Delivery',
};
