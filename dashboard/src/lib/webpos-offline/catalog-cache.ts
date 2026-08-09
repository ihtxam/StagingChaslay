import { idbGet, idbPut, metaGet, metaSet } from './db';
import type { OfflineConfigSnapshot, OfflineSnapshotMeta } from './types';

const SNAPSHOT_KEY = 'snapshot';
const CONFIG_KEY = 'config';
const CATALOG_KEY = 'catalog_blob';

export type CachedCatalogBlob = {
  key: typeof CATALOG_KEY;
  merchantId: string;
  savedAt: number;
  categories: unknown[];
  products: unknown[];
};

export type WebPosOfflineSnapshot = {
  meta: OfflineSnapshotMeta;
  config: OfflineConfigSnapshot;
  catalog: CachedCatalogBlob;
};

function readSessionMerchantId(): string | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as {
      merchantId?: string;
      merchant?: { id?: string };
    };
    return u?.merchantId || u?.merchant?.id || null;
  } catch {
    return null;
  }
}

export async function saveWebPosOfflineSnapshot(input: {
  merchantId: string;
  categories: unknown[];
  products: unknown[];
  merchant: unknown;
  paymentConfig: unknown;
  entitlement: unknown;
  printSettings: unknown;
  staff: unknown[];
  lastPullAt?: string | null;
  serverTime?: string | null;
}): Promise<void> {
  const savedAt = Date.now();
  const meta: OfflineSnapshotMeta = {
    key: SNAPSHOT_KEY,
    merchantId: input.merchantId,
    savedAt,
    lastPullAt: input.lastPullAt ?? new Date(savedAt).toISOString(),
    serverTime: input.serverTime ?? null,
  };
  const config: OfflineConfigSnapshot = {
    key: CONFIG_KEY,
    merchantId: input.merchantId,
    savedAt,
    merchant: input.merchant,
    paymentConfig: input.paymentConfig,
    entitlement: input.entitlement,
    printSettings: input.printSettings,
    staff: input.staff || [],
  };
  const catalog: CachedCatalogBlob = {
    key: CATALOG_KEY,
    merchantId: input.merchantId,
    savedAt,
    categories: input.categories || [],
    products: input.products || [],
  };
  await Promise.all([
    idbPut('meta', { key: SNAPSHOT_KEY, value: meta }),
    idbPut('catalog', catalog),
    idbPut('catalog', config),
    metaSet('lastCatalogSavedAt', savedAt),
  ]);
}

export async function loadWebPosOfflineSnapshot(
  expectedMerchantId?: string | null
): Promise<WebPosOfflineSnapshot | null> {
  const merchantId = expectedMerchantId || readSessionMerchantId();
  if (!merchantId) return null;

  const metaRow = await metaGet<OfflineSnapshotMeta>(SNAPSHOT_KEY);
  const catalog = await idbGet<CachedCatalogBlob>('catalog', CATALOG_KEY);
  const config = await idbGet<OfflineConfigSnapshot & { key: string }>('catalog', CONFIG_KEY);

  if (!metaRow || !catalog || !config) return null;
  if (metaRow.merchantId !== merchantId) return null;
  if (catalog.merchantId !== merchantId || config.merchantId !== merchantId) return null;
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products)) return null;
  if (catalog.products.length === 0) return null;

  return {
    meta: { ...metaRow, key: SNAPSHOT_KEY },
    config: {
      key: CONFIG_KEY,
      merchantId: config.merchantId,
      savedAt: config.savedAt,
      merchant: config.merchant,
      paymentConfig: config.paymentConfig,
      entitlement: config.entitlement,
      printSettings: config.printSettings,
      staff: Array.isArray(config.staff) ? config.staff : [],
    },
    catalog,
  };
}

export async function getCatalogCachedAt(): Promise<number | null> {
  const v = await metaGet<number>('lastCatalogSavedAt');
  return typeof v === 'number' ? v : null;
}
