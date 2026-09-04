import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import type { PosOrderForReceipt } from '@/lib/webpos-receipt';

export type PosOrdersChannelFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery' | 'online';

export type PosOrderListRow = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
  refundAmount: number;
  orderType?: string | null;
  orderSource?: string | null;
  fulfillmentChannel?: string | null;
};

/** Map polled online-shop rows into the POS order shape for the shared list/detail UI. */
export function onlineOrderAsPosOrder(o: OnlineOrder): PosOrderListRow {
  const channel = o.fulfillmentChannel || 'takeaway';
  return {
    id: o.id,
    orderNumber: o.orderNumber || '',
    orderType: o.orderType || 'web_shop',
    orderSource: o.orderSource || 'online_shop',
    channel,
    fulfillmentChannel: o.fulfillmentChannel,
    status: o.status,
    paymentStatus: o.paymentStatus ?? null,
    paymentMethod: o.paymentMethod ?? null,
    customerName: o.customerName ?? null,
    customerPhone: o.customerPhone ?? null,
    shippingAddress: o.shippingAddress ?? null,
    scheduledFor: o.scheduledFor ?? null,
    total: Number(o.total) || 0,
    refundAmount: 0,
    createdAt: o.createdAt,
    notes: o.notes ?? null,
    items: (o.items || []).map((it) => ({
      name: it.productName || '',
      quantity: Number(it.quantity) || 0,
      totalPrice: Number(it.totalPrice) || 0,
    })),
  };
}

/** All-channel view merges incoming online orders that are not already in today's POS list. */
export function mergeOrdersWithOnlineForAllFilter(
  posOrders: PosOrderListRow[],
  online: OnlineOrder[],
  channelFilter: PosOrdersChannelFilter
): PosOrderListRow[] {
  if (channelFilter !== 'all' || online.length === 0) return posOrders;
  const byId = new Map(posOrders.map((o) => [o.id, o]));
  for (const row of online) {
    if (!byId.has(row.id)) byId.set(row.id, onlineOrderAsPosOrder(row));
  }
  return [...byId.values()];
}
