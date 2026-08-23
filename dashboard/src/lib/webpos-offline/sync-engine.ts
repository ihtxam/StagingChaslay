import api from '@/lib/api';
import { logWebPosError, logWebPosEvent } from '@/lib/webpos-log';
import { getCatalogCachedAt } from './catalog-cache';
import { isFatalPushStatus, isNetworkError, pushErrorMessage } from './network';
import {
  countOutboxByStatus,
  listPendingOutboxSales,
  pruneSyncedOutbox,
  removeOutboxSale,
  updateOutboxSale,
} from './outbox';
import {
  isBrowserOnline,
  isWebPosOfflineEnabled,
  type OfflineSyncState,
  type OutboxSale,
} from './types';

type Listener = (state: OfflineSyncState) => void;
type SaleSyncedListener = (info: { clientId: string; orderId: string }) => void;

let syncing = false;
let lastSyncAt: number | null = null;
let lastError: string | null = null;
let started = false;
const listeners = new Set<Listener>();
const saleSyncedListeners = new Set<SaleSyncedListener>();

async function buildState(): Promise<OfflineSyncState> {
  const counts = await countOutboxByStatus();
  return {
    online: isBrowserOnline(),
    syncing,
    pendingCount: counts.pending + counts.syncing,
    failedCount: counts.failed,
    lastSyncAt,
    lastError,
    catalogCachedAt: await getCatalogCachedAt(),
  };
}

async function emit(): Promise<OfflineSyncState> {
  const state = await buildState();
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* ignore listener errors */
    }
  });
  return state;
}

export function subscribeOfflineSync(listener: Listener): () => void {
  listeners.add(listener);
  void emit();
  return () => {
    listeners.delete(listener);
  };
}

export function onOfflineSaleSynced(listener: SaleSyncedListener): () => void {
  saleSyncedListeners.add(listener);
  return () => {
    saleSyncedListeners.delete(listener);
  };
}

export async function getOfflineSyncState(): Promise<OfflineSyncState> {
  return buildState();
}

async function pushOne(sale: OutboxSale): Promise<'ok' | 'fatal' | 'retry'> {
  await updateOutboxSale(sale.clientId, { status: 'syncing', attempts: sale.attempts + 1 });
  try {
    const res = await api.post('/sync/push-sales', { sales: [sale.payload] });
    const orderId =
      (() => {
        const match = res.data?.results?.find(
          (r: { clientId?: string; orderId?: string; skipped?: boolean }) =>
            r.clientId === sale.clientId
        );
        const first = res.data?.results?.[0];
        const pick = (row?: { orderId?: string; skipped?: boolean }) =>
          row?.orderId && !row.skipped ? row.orderId : null;
        return pick(match) || pick(first) || null;
      })();
    await updateOutboxSale(sale.clientId, {
      status: 'synced',
      lastError: null,
      serverOrderId: orderId,
    });
    // Keep briefly for idempotency, then prune on next flush
    if (orderId) {
      saleSyncedListeners.forEach((fn) => {
        try {
          fn({ clientId: sale.clientId, orderId: String(orderId) });
        } catch {
          /* ignore */
        }
      });
    }
    // Remove synced row soon so outbox stays lean
    await removeOutboxSale(sale.clientId);
    return 'ok';
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const msg = pushErrorMessage(err);
    if (isFatalPushStatus(status) || (!isNetworkError(err) && status != null && status < 500)) {
      await updateOutboxSale(sale.clientId, { status: 'failed', lastError: msg });
      lastError = msg;
      logWebPosError('sync', `Offline sale sync failed (fatal) clientId=${sale.clientId}`, err);
      return 'fatal';
    }
    await updateOutboxSale(sale.clientId, { status: 'pending', lastError: msg });
    lastError = msg;
    logWebPosEvent('sync', `Offline sale sync retry clientId=${sale.clientId}: ${msg}`, 'warn');
    return 'retry';
  }
}

/** Flush pending offline sales (idempotent server-side via clientId). */
export async function flushOfflineOutbox(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (!isWebPosOfflineEnabled()) {
    return { synced: 0, failed: 0, remaining: 0 };
  }
  if (syncing) {
    const counts = await countOutboxByStatus();
    return {
      synced: 0,
      failed: counts.failed,
      remaining: counts.pending + counts.syncing,
    };
  }
  if (!isBrowserOnline()) {
    await emit();
    const counts = await countOutboxByStatus();
    return {
      synced: 0,
      failed: counts.failed,
      remaining: counts.pending + counts.syncing,
    };
  }

  syncing = true;
  await emit();
  let synced = 0;
  let failed = 0;
  try {
    const pending = await listPendingOutboxSales();
    for (const sale of pending) {
      if (!isBrowserOnline()) break;
      // Cap attempts for transient failures to avoid hammering
      if (sale.attempts >= 20 && sale.status === 'failed') {
        failed += 1;
        continue;
      }
      const result = await pushOne(sale);
      if (result === 'ok') synced += 1;
      else if (result === 'fatal') failed += 1;
    }
    await pruneSyncedOutbox();
    lastSyncAt = Date.now();
    if (synced > 0 && failed === 0) lastError = null;
    if (synced > 0 || failed > 0) {
      logWebPosEvent(
        'sync',
        `Outbox flush synced=${synced} failed=${failed}`,
        failed > 0 ? 'warn' : 'info'
      );
    }
  } finally {
    syncing = false;
    await emit();
  }
  const counts = await countOutboxByStatus();
  return {
    synced,
    failed,
    remaining: counts.pending + counts.syncing,
  };
}

/** Start online/offline listeners once (safe to call repeatedly). */
export function startOfflineSyncEngine(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (started) {
    void flushOfflineOutbox();
    return () => undefined;
  }
  started = true;

  const onOnline = () => {
    void flushOfflineOutbox();
  };
  const onOffline = () => {
    void emit();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // Periodic gentle flush while the register is open
  const interval = window.setInterval(() => {
    if (isBrowserOnline()) void flushOfflineOutbox();
    else void emit();
  }, 30_000);

  void flushOfflineOutbox();

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    window.clearInterval(interval);
    started = false;
  };
}
