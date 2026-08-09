import { idbDelete, idbGet, idbGetAll, idbPut } from './db';
import type { OfflineSalePayload, OutboxSale, OutboxSaleStatus } from './types';

export async function enqueueOutboxSale(payload: OfflineSalePayload): Promise<OutboxSale> {
  const now = Date.now();
  const existing = await idbGet<OutboxSale>('outbox', payload.clientId);
  if (existing && (existing.status === 'pending' || existing.status === 'syncing' || existing.status === 'synced')) {
    return existing;
  }
  const row: OutboxSale = {
    clientId: payload.clientId,
    payload,
    status: 'pending',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    attempts: existing?.attempts || 0,
    lastError: null,
    serverOrderId: existing?.serverOrderId || null,
  };
  await idbPut('outbox', row);
  return row;
}

export async function listOutboxSales(): Promise<OutboxSale[]> {
  const rows = await idbGetAll<OutboxSale>('outbox');
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listPendingOutboxSales(): Promise<OutboxSale[]> {
  const rows = await listOutboxSales();
  return rows.filter((r) => r.status === 'pending' || r.status === 'failed');
}

export async function updateOutboxSale(
  clientId: string,
  patch: Partial<Pick<OutboxSale, 'status' | 'attempts' | 'lastError' | 'serverOrderId' | 'updatedAt'>>
): Promise<void> {
  const existing = await idbGet<OutboxSale>('outbox', clientId);
  if (!existing) return;
  await idbPut('outbox', {
    ...existing,
    ...patch,
    updatedAt: patch.updatedAt ?? Date.now(),
  });
}

export async function removeOutboxSale(clientId: string): Promise<void> {
  await idbDelete('outbox', clientId);
}

export async function countOutboxByStatus(): Promise<{
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
}> {
  const rows = await listOutboxSales();
  const counts = { pending: 0, syncing: 0, failed: 0, synced: 0 };
  for (const r of rows) {
    const s = r.status as OutboxSaleStatus;
    if (s in counts) counts[s] += 1;
  }
  return counts;
}

/** Drop already-synced rows older than keepMs (default 7d) to keep IDB small. */
export async function pruneSyncedOutbox(keepMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - keepMs;
  const rows = await listOutboxSales();
  await Promise.all(
    rows
      .filter((r) => r.status === 'synced' && r.updatedAt < cutoff)
      .map((r) => removeOutboxSale(r.clientId))
  );
}
