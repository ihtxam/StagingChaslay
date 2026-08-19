import { parseOrderMetaNotes, type PosOrderForReceipt } from '@/lib/webpos-receipt';
import { parsePaymentBreakdown, paymentMethodLabel } from '@/lib/payment-breakdown';
import { formatOrderNumberDisplay } from '@/lib/order-number';

export type MerchantOrder = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
  invoiceNumber?: string | null;
  paymentBreakdown?: Array<{ method: string; amount: number }> | null;
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

/**
 * Kitchen Type on /merchant/orders — kitchen-bound tickets, including paid
 * WebPOS/POS delivery. The old tab only listed online accepted/preparing.
 */
export function isKitchenTypeOrder(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status)) return false;
  const ch = orderChannel(o).toLowerCase();
  if (ch === 'dine_in' || ch === 'takeaway' || ch === 'delivery') return true;
  return isOnlineShopOrder(o) && (status === 'accepted' || status === 'preparing');
}

export function isOnlineShopOrder(o: MerchantOrder): boolean {
  const t = (o.orderType || '').toLowerCase();
  const src = String((o as { orderSource?: string | null }).orderSource || '').toLowerCase();
  const ch = orderChannel(o).toLowerCase();
  return (
    t === 'web_shop' ||
    t === 'online' ||
    src === 'online_shop' ||
    src === 'justeat' ||
    src === 'ubereats' ||
    ch.includes('uber') ||
    ch.includes('justeat') ||
    ch.includes('just-eat') ||
    ch.includes('doordash') ||
    ch.includes('deliveroo') ||
    ch === 'web_shop' ||
    ch === 'online'
  );
}

export function orderSourceLabel(source?: string | null): string {
  const s = String(source || '').toLowerCase();
  if (s === 'justeat') return 'Just Eat';
  if (s === 'ubereats') return 'Uber Eats';
  if (s === 'online_shop') return 'Online shop';
  return 'Online';
}

/** Commande-style platform badge colors */
export function orderPlatformKey(o: MerchantOrder): 'shop' | 'justeat' | 'ubereats' | 'other' {
  const src = String((o as { orderSource?: string | null }).orderSource || '').toLowerCase();
  if (src === 'justeat') return 'justeat';
  if (src === 'ubereats') return 'ubereats';
  if (src === 'online_shop' || isOnlineShopOrder(o)) return 'shop';
  return 'other';
}

export function orderPlatformLabel(o: MerchantOrder, t: (k: string) => string): string {
  const key = orderPlatformKey(o);
  if (key === 'justeat') return t('orderPlatformJustEat');
  if (key === 'ubereats') return t('orderPlatformUberEats');
  if (key === 'shop') return t('orderPlatformShop');
  return t('orderPlatformOnline');
}

export function orderPlatformBadgeClass(o: MerchantOrder): string {
  const key = orderPlatformKey(o);
  switch (key) {
    case 'justeat':
      return 'bg-orange-500 text-white';
    case 'ubereats':
      return 'bg-emerald-600 text-white';
    case 'shop':
      return 'bg-violet-600 text-white';
    default:
      return 'bg-stone-600 text-white';
  }
}

export function orderPlatformBorderClass(o: MerchantOrder): string {
  const key = orderPlatformKey(o);
  switch (key) {
    case 'justeat':
      return 'border-l-orange-500';
    case 'ubereats':
      return 'border-l-emerald-500';
    case 'shop':
      return 'border-l-violet-600';
    default:
      return 'border-l-stone-400';
  }
}

/** POS / WebPOS invoice sale — unpaid until bank transfer is recorded. */
export function isInvoiceOrder(o: {
  paymentMethod?: string | null;
  invoiceNumber?: string | null;
  paymentStatus?: string | null;
}): boolean {
  const method = String(o.paymentMethod || '')
    .toLowerCase()
    .replace(/-/g, '_');
  if (method === 'invoice') return true;
  if (o.invoiceNumber) return true;
  return false;
}

/** Unpaid web shop or POS order — pay on pickup / collect at counter. */
export function isAwaitingPaymentOrder(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase().replace(/-/g, '_');
  if (['cancelled', 'refunded'].includes(status)) return false;
  if (pay === 'completed' || pay === 'paid' || pay === 'partially_refunded') return false;
  // Invoice + awaiting_payment stays visible even when fulfillment status is completed
  // (same class of hide-bug as paid POS delivery vanishing from Kitchen / history).
  if (isInvoiceOrder(o) || pay === 'awaiting_payment') return true;
  if (status === 'completed') return false;
  if (method === 'pay_later' || method === 'pay-later') return true;
  if (isOnlineShopOrder(o) && (pay === 'cash' || method === 'cash')) return true;
  return false;
}

export function isProgrammedOrder(o: MerchantOrder): boolean {
  if (!isAwaitingPaymentOrder(o)) return false;
  return o.orderType === 'pos' || isOnlineShopOrder(o);
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
    o.paymentStatus === 'paid' ||
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

/** Pickup / handoff stage — unpaid orders can be collected at the till. */
export function isReadyForPaymentCollection(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  if (status === 'ready' || status === 'out_for_delivery') return true;
  // Counter POS pay-later / invoice / delivery: collect while still in kitchen
  // (or after fulfillment if payment is still outstanding).
  if (
    ['preparing', 'accepted', 'sent_to_kitchen', 'completed'].includes(status) &&
    isAwaitingPaymentOrder(o) &&
    !isOnlineShopOrder(o)
  ) {
    return true;
  }
  return false;
}

export function isPaidOrder(o: MerchantOrder): boolean {
  const pay = (o.paymentStatus || '').toLowerCase();
  return pay === 'completed' || pay === 'paid';
}

export function canCollectPayment(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status)) return false;
  if (pay === 'completed' || pay === 'paid' || pay === 'partially_refunded') return false;
  if (Number(o.total || 0) <= 0.001) return false;
  if (!isReadyForPaymentCollection(o)) return false;
  if (pay === 'awaiting_payment') return true;
  if (isOnlineShopOrder(o) && (pay === 'cash' || method === 'cash')) return true;
  if (method === 'pay_later' || method === 'pay-later' || method === 'invoice') return true;
  return false;
}

export function canShowAwaitingPaymentBadge(o: MerchantOrder): boolean {
  return isAwaitingPaymentOrder(o);
}

/** Friendly order lifecycle label (FR/EN/DE via i18n keys). */
export function orderStatusLabel(status: string, t: (k: string) => string): string {
  const key = status?.toLowerCase().replace(/-/g, '_');
  const map: Record<string, string> = {
    pending: t('orderStatusPending'),
    pending_approval: t('orderStatusPending'),
    accepted: t('orderStatusAccepted'),
    preparing: t('orderStatusPreparing'),
    ready: t('orderStatusReady'),
    out_for_delivery: t('orderStatusOutForDelivery'),
    completed: t('webPosStatusCompleted'),
    cancelled: t('webPosStatusCancelled'),
    refunded: t('webPosStatusRefunded'),
    partially_refunded: t('webPosStatusPartialRefund'),
    held: t('webPosOngoing'),
    sent_to_kitchen: t('webPosOngoing'),
    confirmed: t('orderStatusAccepted'),
  };
  return map[key] || status;
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

export const ONLINE_CHANNEL_BADGE =
  'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200';
export const ONLINE_CHANNEL_HEADER = 'bg-violet-600';
export const ONLINE_CHANNEL_STYLE =
  'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900';
export const ONLINE_CHANNEL_BORDER = 'border-l-violet-500';

export function orderChannelBadgeClass(o: MerchantOrder): string {
  if (isOnlineShopOrder(o)) return ONLINE_CHANNEL_BADGE;
  const ch = orderChannel(o);
  switch (ch) {
    case 'dine_in':
      return 'bg-sky-100 text-sky-800';
    case 'takeaway':
      return 'bg-amber-100 text-amber-900';
    case 'delivery':
      return 'bg-orange-100 text-orange-900';
    default:
      return 'bg-stone-100 text-stone-800';
  }
}

export function orderChannelHeaderClass(o: MerchantOrder): string {
  if (isOnlineShopOrder(o)) return ONLINE_CHANNEL_HEADER;
  const ch = orderChannel(o).toLowerCase();
  switch (ch) {
    case 'dine_in':
      return 'bg-emerald-600';
    case 'delivery':
      return 'bg-orange-500';
    case 'takeaway':
      return 'bg-sky-600';
    default:
      return 'bg-stone-600';
  }
}

export function orderSearchHaystack(o: MerchantOrder): string {
  const refs = orderPublicRefs(o);
  const ch = orderChannel(o);
  return [
    o.orderNumber,
    formatOrderNumberDisplay(o.orderNumber),
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
    o.invoiceNumber,
    o.paymentStatus,
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

/** Human-readable payment line(s) for order history / detail. */
export function formatOrderPaymentDisplay(
  order: {
    paymentMethod?: string | null;
    paymentBreakdown?: unknown;
    total?: number;
  },
  t: (k: string) => string,
  _locale = 'en'
): string {
  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    Number(order.total || 0)
  );
  if (tenders.length <= 1) {
    const method = tenders[0]?.method || order.paymentMethod || 'cash';
    return paymentMethodLabel(method, t);
  }
  return tenders
    .map((p) => `${paymentMethodLabel(p.method, t)} CHF ${Number(p.amount).toFixed(2)}`)
    .join(' + ');
}

export function orderPaymentLines(order: {
  paymentMethod?: string | null;
  paymentBreakdown?: unknown;
  total?: number;
}): Array<{ method: string; amount: number }> {
  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    Number(order.total || 0)
  );
  if (tenders.length) return tenders;
  const total = Number(order.total || 0);
  const method = String(order.paymentMethod || 'cash');
  return total > 0 ? [{ method, amount: total }] : [{ method, amount: 0 }];
}

