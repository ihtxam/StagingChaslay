import api from '@/lib/api';
import { shouldAutoAcceptOrderOnArrival } from '@/lib/delivery-auto-accept';
import {
  extractZipFromAddress,
  newOrderSpeechLine,
  onlineShopOrderSpeechLine,
  speakDeliveryAlert,
} from '@/lib/delivery-hub-alerts';
import { isAwaitingApproval } from '@/lib/order-management';
import { maybePrintOnlineOrderOnArrival } from '@/lib/online-order-arrival-print';
import { startAutoAcceptArrivalAlert } from '@/lib/order-alert';

type ArrivalOrder = {
  id: string;
  status?: string;
  orderSource?: string | null;
  fulfillmentChannel?: string | null;
  shippingAddress?: string | null;
};

/** Persist accepted + kitchen print the same way Accept does (server accept action). */
export async function persistAutoAcceptOnArrival<T extends ArrivalOrder>(
  order: T,
  opts?: { skipAutoPrintKitchen?: boolean }
): Promise<T> {
  if (!isAwaitingApproval(String(order.status || '')) || !shouldAutoAcceptOrderOnArrival(order)) {
    return order;
  }
  try {
    const actionRes = await api.post(`/merchant/orders/${order.id}/action`, {
      action: 'accept',
      ...(opts?.skipAutoPrintKitchen ? { skipAutoPrintKitchen: true } : {}),
    });
    return ((actionRes.data?.order as T | undefined) || { ...order, status: 'preparing' }) as T;
  } catch {
    /* Already accepted on the server, or transient — treat as preparing for print/popup. */
    return { ...order, status: 'preparing' };
  }
}

/** Kitchen tickets only — same flags as Accept & print (no extra guest receipt). */
export function printKitchenForAutoAcceptedOrder(
  order: ArrivalOrder,
  settings: Record<string, unknown>
): void {
  void maybePrintOnlineOrderOnArrival({ ...order, status: 'preparing' }, settings);
}

export function startAutoAcceptArrivalCue(
  t: (key: string) => string,
  order: { orderSource?: string | null; shippingAddress?: string | null }
): void {
  const zip = extractZipFromAddress(order.shippingAddress);
  const src = String(order.orderSource || '').toLowerCase();
  const line =
    src === 'justeat' || src === 'ubereats'
      ? newOrderSpeechLine(t, order.orderSource, zip)
      : onlineShopOrderSpeechLine(t, zip);
  startAutoAcceptArrivalAlert(() => speakDeliveryAlert(line));
}
