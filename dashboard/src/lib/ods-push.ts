import api from '@/lib/api';
import { createAddonPollGate } from '@/lib/addon-poll';
import { resolveOdsPushNumber } from '@/lib/order-number';
import { parseOdsStatusPayload, type OdsBoardStatus } from '@/lib/ods-status-parse';

export { parseOdsStatusPayload, type OdsBoardStatus } from '@/lib/ods-status-parse';

const odsPollGate = createAddonPollGate();

export function isOdsPollingStopped(): boolean {
  return odsPollGate.isStopped();
}

export function resetOdsPollingGate(): void {
  odsPollGate.reset();
}

export async function fetchOdsStatus(): Promise<OdsBoardStatus> {
  if (odsPollGate.isStopped()) {
    return { licensed: false, preparing: [], ready: [] };
  }
  try {
    const res = await api.get('/merchant/ods/status');
    return parseOdsStatusPayload(res.data);
  } catch (e) {
    odsPollGate.noteError(e);
    return { licensed: false, preparing: [], ready: [] };
  }
}

export async function pushOrderToOds(opts: {
  orderNumber: string;
  status: 'preparing' | 'ready';
}): Promise<void> {
  const orderNumber = resolveOdsPushNumber(opts.orderNumber);
  if (!orderNumber) return;
  try {
    await api.post('/merchant/ods/push', {
      orderNumber,
      status: opts.status,
    });
  } catch (e) {
    odsPollGate.noteError(e);
    console.warn('[ods] push failed', e);
  }
}

export async function dismissOrderFromOds(orderNumber: string): Promise<void> {
  const num = resolveOdsPushNumber(orderNumber) || String(orderNumber || '').trim();
  if (!num) return;
  try {
    await api.post('/merchant/ods/dismiss', { orderNumber: num });
  } catch (e) {
    odsPollGate.noteError(e);
    console.warn('[ods] dismiss failed', e);
  }
}

export async function clearAllOdsOrders(): Promise<{
  removed: number;
  dismissed: number;
  closedLive: number;
}> {
  const res = await api.post('/merchant/ods/clear-all');
  return {
    removed: Number(res.data?.removed) || 0,
    dismissed: Number(res.data?.dismissed) || 0,
    closedLive: Number(res.data?.closedLive) || 0,
  };
}
