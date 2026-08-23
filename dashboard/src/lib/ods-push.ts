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
