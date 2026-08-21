import type { CartLine } from '@/components/webpos/types';
import type { WebPosCustomer } from '@/components/WebPosCustomerPicker';
import { resolveOrderItemName } from '@/lib/order-item-name';
import type { MerchantOrder } from '@/lib/order-management';

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
