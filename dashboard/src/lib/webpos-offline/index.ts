export {
  OFFLINE_SAFE_PAYMENT_METHODS,
  isBrowserOnline,
  isWebPosOfflineEnabled,
  type OfflineSalePayload,
  type OfflineSyncState,
  type OutboxSale,
} from './types';

export {
  canCompleteSaleOffline,
  cartHasOfflineUnsafeLines,
  isOfflineSafePaymentMethod,
  isWebPosCurrentlyOffline,
  offlineSaleBlockReason,
  type OfflineBlockReason,
} from './guards';

export { isNetworkError, isFatalPushStatus, WEBPOS_CATALOG_FETCH_TIMEOUT_MS } from './network';

export {
  saveWebPosOfflineSnapshot,
  loadWebPosOfflineSnapshot,
  getCatalogCachedAt,
  type WebPosOfflineSnapshot,
} from './catalog-cache';

export { enqueueOutboxSale, listPendingOutboxSales, countOutboxByStatus } from './outbox';

export {
  flushOfflineOutbox,
  getOfflineSyncState,
  onOfflineSaleSynced,
  startOfflineSyncEngine,
  subscribeOfflineSync,
} from './sync-engine';
