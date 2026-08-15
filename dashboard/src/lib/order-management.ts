import { parseOrderMetaNotes, type PosOrderForReceipt } from '@/lib/webpos-receipt';
import { parsePaymentBreakdown } from '@/lib/payment-breakdown';
import { paymentLabel as receiptPaymentLabel, receiptLabels, type ReceiptLang } from '@/lib/receipt-labels';
import { formatOrderNumberDisplay } from '@/lib/order-number';

export type MerchantOrder = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
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

/** Unpaid web shop or POS order — pay on pickup / collect at counter. */
export function isAwaitingPaymentOrder(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase();
  if (['cancelled', 'refunded', 'completed'].includes(status)) return false;
  if (pay === 'completed' || pay === 'paid' || pay === 'partially_refunded') return false;
  if (pay === 'awaiting_payment') return true;
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
  return status === 'ready' || status === 'out_for_delivery';
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
  if (method === 'pay_later' || method === 'pay-later') return true;
  return false;
}

export function canShowAwaitingPaymentBadge(o: MerchantOrder): boolean {
  return canCollectPayment(o);
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
  locale = 'en'
): string {
  const lang = (locale === 'fr' ? 'fr' : locale === 'de' ? 'de' : 'en') as ReceiptLang;
  const L = receiptLabels(lang);
  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    Number(order.total || 0)
  );
  if (tenders.length <= 1) {
    const method = tenders[0]?.method || order.paymentMethod || 'cash';
    return paymentLabelUi(method, t);
  }
  return tenders
    .map((p) => `${paymentLabelUi(p.method, t)} CHF ${Number(p.amount).toFixed(2)}`)
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

function paymentLabelUi(method: string, t: (k: string) => string): string {
  const m = String(method || '').toLowerCase().replace(/-/g, '_');
  if (m === 'cash') return t('webPosCash');
  if (m === 'card') return t('webPosCard');
  if (m === 'terminal') return t('webPosTerminal');
  if (m === 'gift_card') return t('giftCard');
  if (m === 'mixed') return t('webPosMixedPayment');
  if (m === 'pay_later') return t('webPosPayLater');
  return receiptPaymentLabel(receiptLabels('en'), method);
}
