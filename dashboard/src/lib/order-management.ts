import { parseOrderMetaNotes, type PosOrderForReceipt } from '@/lib/webpos-receipt';

export type MerchantOrder = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
  refundAmount: number;
  cancelReason?: string | null;
  refundReason?: string | null;
  notes?: string | null;
  masterOrderId?: string | null;
  orderType?: string | null;
  fulfillmentChannel?: string | null;
  scheduledFor?: string | null;
  shippingAddress?: string | null;
  items?: Array<{
    id?: string;
    name?: string | null;
    productName?: string | null;
    quantity: number | string;
    totalPrice: number | string;
    unitPrice?: number | string;
    refundedQuantity?: number;
    selectedExtras?: Array<{ id: string; name: string; price: number }> | null;
    comboSelections?: Array<{
      slotName: string;
      productName: string;
      selectedExtras?: Array<{ id: string; name: string; price: number }>;
    }> | null;
    product?: { name?: string | null } | null;
  }>;
};

export function orderChannel(o: MerchantOrder): string {
  return o.channel || o.fulfillmentChannel || 'takeaway';
}

export function isOnlineShopOrder(o: MerchantOrder): boolean {
  const t = (o.orderType || '').toLowerCase();
  const ch = orderChannel(o).toLowerCase();
  return (
    t === 'web_shop' ||
    t === 'online' ||
    ch.includes('uber') ||
    ch.includes('doordash') ||
    ch.includes('deliveroo') ||
    ch === 'web_shop' ||
    ch === 'online'
  );
}

export function isProgrammedOrder(o: MerchantOrder): boolean {
  const unpaid =
    o.paymentStatus === 'awaiting_payment' ||
    o.paymentMethod === 'pay_later' ||
    o.paymentMethod === 'pay-later';
  return (
    o.orderType === 'pos' &&
    unpaid &&
    o.status !== 'completed' &&
    o.status !== 'cancelled' &&
    o.status !== 'refunded'
  );
}

export function isAwaitingApproval(status: string): boolean {
  return status === 'pending' || status === 'pending_approval';
}

export function canCancelOrder(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status)) return false;
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(pay)) return false;
  return true;
}

export function canRefundOrder(o: MerchantOrder): boolean {
  if (o.status === 'cancelled' || o.paymentStatus === 'cancelled') return false;
  const remaining = Number(o.total || 0) - Number(o.refundAmount || 0);
  if (remaining <= 0.001) return false;
  return (
    o.status === 'completed' ||
    o.status === 'partially_refunded' ||
    o.paymentStatus === 'completed' ||
    o.paymentStatus === 'partially_refunded'
  );
}

export function canEditPayment(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status) || ['cancelled', 'refunded'].includes(pay)) {
    return false;
  }
  return (
    status === 'completed' ||
    status === 'partially_refunded' ||
    pay === 'completed' ||
    pay === 'partially_refunded'
  );
}

export function canCollectPayment(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status)) return false;
  if (pay === 'completed' || pay === 'paid' || pay === 'partially_refunded') return false;
  if (Number(o.total || 0) <= 0.001) return false;
  if (pay === 'awaiting_payment') return true;
  if (method === 'pay_later' || method === 'pay-later') {
    return ['preparing', 'accepted', 'ready', 'out_for_delivery', 'pending', 'confirmed'].includes(
      status
    );
  }
  return false;
}

export function orderPublicRefs(o: MerchantOrder) {
  const meta = parseOrderMetaNotes(o.notes);
  const ticketDisplay = o.ticketDisplay || meta.ticketDisplay || null;
  const tabNumber =
    o.tabNumber ||
    meta.tabNumber ||
    (o.guestCount != null && Number(o.guestCount) > 0 ? String(o.guestCount) : null);
  return { ticketDisplay, tabNumber };
}

export function orderSearchHaystack(o: MerchantOrder): string {
  const refs = orderPublicRefs(o);
  const ch = orderChannel(o);
  return [
    o.orderNumber,
    o.clientId,
    o.customerName,
    o.customerPhone,
    o.tableLabel,
    o.orderType,
    o.staffName,
    refs.ticketDisplay,
    refs.tabNumber,
    ch,
    o.paymentMethod,
    o.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}
