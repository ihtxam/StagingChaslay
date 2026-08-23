import api from '@/lib/api';

export async function pushOrderToOds(opts: {
  orderNumber: string;
  status: 'preparing' | 'ready';
}): Promise<void> {
  const orderNumber = String(opts.orderNumber || '').trim();
  if (!orderNumber) return;
  try {
    await api.post('/merchant/ods/push', {
      orderNumber,
      status: opts.status,
    });
  } catch (e) {
    console.warn('[ods] push failed', e);
  }
}

export async function dismissOrderFromOds(orderNumber: string): Promise<void> {
  const num = String(orderNumber || '').trim();
  if (!num) return;
  try {
    await api.post('/merchant/ods/dismiss', { orderNumber: num });
  } catch (e) {
    console.warn('[ods] dismiss failed', e);
  }
}

export async function clearAllOdsOrders(): Promise<number> {
  const res = await api.post('/merchant/ods/clear-all');
  return Number(res.data?.removed) || 0;
}
