import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import type { WebPosReservationAlert } from '@/components/webpos/WebPosNotificationsPanel';

export const WEBPOS_RESERVATION_CREATED_EVENT = 'webpos:reservation-created';
export const WEBPOS_ORDER_COMPLETED_EVENT = 'webpos:order-completed';

/** Paid POS / waiter checkouts must not appear in the online-order bell. */
export function isPosPaymentNotification(order: {
  orderType?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
}): boolean {
  const type = String(order.orderType || '').toLowerCase();
  if (type === 'pos' || type === 'webpos' || type === 'waiter') return true;
  return false;
}

/** Bell tray: incoming shop / 3P only — never closed or paid-register sales. */
export function isBellVisibleOrder(order: {
  orderType?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
}): boolean {
  if (isPosPaymentNotification(order)) return false;
  const status = String(order.status || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  if (
    ['cancelled', 'refunded', 'rejected', 'completed', 'partially_refunded'].includes(status)
  ) {
    return false;
  }
  return true;
}

export function posSaleToNotificationOrder(params: {
  id: string;
  orderNumber?: string | null;
  total: number;
  customerName?: string | null;
  items?: Array<{ name: string; quantity: number }>;
}): OnlineOrder {
  return {
    id: params.id,
    orderNumber: params.orderNumber || undefined,
    orderType: 'pos',
    status: 'completed',
    paymentStatus: 'completed',
    total: params.total,
    customerName: params.customerName || undefined,
    createdAt: new Date().toISOString(),
    items: (params.items || []).map((item) => ({
      productName: item.name,
      quantity: item.quantity,
    })),
  };
}

export function dispatchWebPosReservationCreated(reservation: WebPosReservationAlert): void {
  window.dispatchEvent(
    new CustomEvent<WebPosReservationAlert>(WEBPOS_RESERVATION_CREATED_EVENT, {
      detail: reservation,
    })
  );
}

export function dispatchWebPosOrderCompleted(order: OnlineOrder): void {
  window.dispatchEvent(
    new CustomEvent<OnlineOrder>(WEBPOS_ORDER_COMPLETED_EVENT, { detail: order })
  );
}

export function subscribeWebPosReservationCreated(
  handler: (reservation: WebPosReservationAlert) => void
): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<WebPosReservationAlert>).detail);
  };
  window.addEventListener(WEBPOS_RESERVATION_CREATED_EVENT, listener);
  return () => window.removeEventListener(WEBPOS_RESERVATION_CREATED_EVENT, listener);
}

export function subscribeWebPosOrderCompleted(handler: (order: OnlineOrder) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<OnlineOrder>).detail);
  };
  window.addEventListener(WEBPOS_ORDER_COMPLETED_EVENT, listener);
  return () => window.removeEventListener(WEBPOS_ORDER_COMPLETED_EVENT, listener);
}
