import type { CartLine } from '@/components/webpos/types';
import type { WebPosCustomer } from '@/components/WebPosCustomerPicker';
import { resolveOrderItemName } from '@/lib/order-item-name';
import {
  canCollectPayment,
  isPaidOrder,
  orderPublicRefs,
  type MerchantOrder,
} from '@/lib/order-management';

/** Cart identity used to match persisted POS orders (ticket #6832, tab, table). */
export type CartOrderLink = {
  ticketDisplay?: string | null;
  tabNumber?: string | null;
  tableId?: string | null;
  ticketOrderNumber?: string | null;
};

function normTicket(value?: string | null): string {
  const raw = String(value || '')
    .trim()
    .replace(/^#/, '');
  return raw ? `#${raw}` : '';
}

function normTab(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/^#/, '');
}

/** True when a server order belongs to the same open cart session. */
export function orderMatchesCartLink(order: MerchantOrder, link: CartOrderLink): boolean {
  const refs = orderPublicRefs(order);
  const cartTicket = normTicket(link.ticketDisplay);
  const cartTab = normTab(link.tabNumber);
  const orderTicket = normTicket(refs.ticketDisplay);
  const orderTab = normTab(refs.tabNumber);
  if (cartTicket && orderTicket && cartTicket === orderTicket) return true;
  if (cartTab && orderTab && cartTab === orderTab) return true;
  if (
    link.ticketOrderNumber?.trim() &&
    order.orderNumber?.trim() &&
    link.ticketOrderNumber.trim() === order.orderNumber.trim()
  ) {
    return true;
  }
  if (link.tableId && order.tableId && link.tableId === order.tableId) {
    // Same table can host many tickets over a shift — never inherit a different #.
    if (cartTicket && orderTicket) return cartTicket === orderTicket;
    if (cartTicket || orderTicket) return false;
    if (cartTab && orderTab) return cartTab === orderTab;
    if (cartTab || orderTab) return false;
    return true;
  }
  return false;
}

export function findOrdersMatchingCart(
  orders: MerchantOrder[],
  link: CartOrderLink
): MerchantOrder[] {
  return orders.filter((o) => orderMatchesCartLink(o, link));
}

export type CartCheckoutGuard =
  | { action: 'ok' }
  | { action: 'blocked'; order: MerchantOrder }
  | { action: 'collect'; order: MerchantOrder };

function isActiveOrder(o: MerchantOrder): boolean {
  return (o.status || '').toLowerCase() !== 'cancelled';
}

/** True when a masterOrderId group still has unpaid sibling checks (split-bill in progress). */
function splitBillStillOpen(orders: MerchantOrder[], masterOrderId: string): boolean {
  const siblings = orders.filter((o) => o.masterOrderId === masterOrderId);
  if (siblings.length <= 1) return false;
  return siblings.some((o) => isActiveOrder(o) && !isPaidOrder(o));
}

/** Block duplicate payment or redirect to collect on an existing unpaid ticket. */
export function resolveCartCheckoutGuard(
  orders: MerchantOrder[],
  link: CartOrderLink,
  opts?: { requireSent?: boolean }
): CartCheckoutGuard {
  const matches = findOrdersMatchingCart(orders, link);
  if (!matches.length) return { action: 'ok' };

  const active = matches.filter(isActiveOrder);
  const paid = active.filter((o) => isPaidOrder(o));
  const unpaid = active.filter((o) => !isPaidOrder(o));

  // Split-bill parts share one kitchen ticket — one paid check must not block the rest.
  if (paid.length > 0 && unpaid.length > 0 && paid.some((o) => o.masterOrderId)) {
    if (opts?.requireSent) {
      const open = unpaid.find(canCollectPayment);
      if (open) return { action: 'collect', order: open };
    }
    return { action: 'ok' };
  }

  for (const o of active) {
    const masterId = o.masterOrderId?.trim();
    if (masterId && splitBillStillOpen(orders, masterId)) {
      if (opts?.requireSent) {
        const open = unpaid.find(canCollectPayment);
        if (open) return { action: 'collect', order: open };
      }
      return { action: 'ok' };
    }
  }

  const paidOrder = paid[0];
  if (paidOrder && unpaid.length === 0) {
    return { action: 'blocked', order: paidOrder };
  }

  if (opts?.requireSent) {
    const open = unpaid.find(canCollectPayment);
    if (open) return { action: 'collect', order: open };
  }
  return { action: 'ok' };
}

type OrderLine = NonNullable<MerchantOrder['items']>[number];

function lineId(orderItemId?: string, index?: number) {
  return orderItemId ? `collect-${orderItemId}` : `collect-line-${index ?? 0}`;
}

/** Map persisted order lines into a read-only WebPOS cart for checkout collection. */
export function orderItemsToCartLines(items: OrderLine[]): CartLine[] {
  return items.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const totalPrice = Number(item.totalPrice) || 0;
    const unitPrice =
      item.unitPrice != null && Number(item.unitPrice) > 0
        ? Number(item.unitPrice)
        : qty > 0
          ? totalPrice / qty
          : totalPrice;
    const rawProductId = (item as { productId?: string | null }).productId;
    const productId =
      rawProductId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawProductId))
        ? String(rawProductId)
        : `item-${index}`;
    const name = resolveOrderItemName(item.productName, item.name, item.product?.name);
    return {
      lineId: lineId(item.id, index),
      productId,
      name,
      quantity: qty,
      unitPrice,
      lineTotal: totalPrice,
      taxable: true,
      selectedExtras: (item.selectedExtras || []).map((e) => ({
        id: e.id,
        name: e.name,
        price: Number(e.price) || 0,
      })),
      comboSelections: (item.comboSelections || []).map((c) => ({
        slotId: '',
        slotName: c.slotName,
        productId: '',
        productName: c.productName,
        extraPrice: 0,
        selectedExtras: (c.selectedExtras || []).map((e) => ({
          id: e.id,
          name: e.name,
          price: Number(e.price) || 0,
        })),
      })),
      sentToKitchen: true,
    };
  });
}

export function customerFromOrder(order: MerchantOrder): WebPosCustomer | null {
  if (!order.customerName && !order.customerPhone && !order.shippingAddress) return null;
  const parts = String(order.customerName || '')
    .trim()
    .split(/\s+/);
  const firstName = parts[0] || null;
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  return {
    id: `collect-${order.id}`,
    firstName,
    lastName,
    phone: order.customerPhone || null,
    email: (order as { customerEmail?: string | null }).customerEmail || null,
    defaultAddress: order.shippingAddress || null,
    defaultZip: null,
    defaultCity: null,
  };
}

/** Pick collect_payment vs complete_and_collect for unpaid order checkout. */
export function collectPaymentAction(status: string): 'collect_payment' | 'complete_and_collect' {
  const s = (status || '').toLowerCase();
  // complete_and_collect also completes fulfillment — only at handoff.
  // POS invoice / pay-later still in kitchen must use collect_payment.
  if (s === 'ready' || s === 'out_for_delivery') {
    return 'complete_and_collect';
  }
  return 'collect_payment';
}
