import { parseOrderMetaNotes, type PosOrderForReceipt } from '@/lib/webpos-receipt';
import { parsePaymentBreakdown, paymentMethodLabel } from '@/lib/payment-breakdown';
import { formatOrderNumberDisplay, guestOrderNumber } from '@/lib/order-number';
import { ticketQueryMatches } from '@/lib/webpos-held';

export type MerchantOrder = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
  invoiceNumber?: string | null;
  invoiceIssuedAt?: string | Date | null;
  invoiceDueAt?: string | Date | null;
  paymentBreakdown?: Array<{ method: string; amount: number }> | null;
  refundAmount: number;
  cancelReason?: string | null;
  refundReason?: string | null;
  refundHistory?: Array<{
    id?: string;
    kind?: string;
    amount: number;
    reason?: string | null;
    staffName?: string | null;
    createdAt?: string | null;
    items?: Array<{ orderItemId?: string; productName?: string; quantity: number }>;
    allocation?: {
      giftCard?: number;
      cash?: number;
      terminal?: number;
      other?: number;
    } | null;
  }>;
  notes?: string | null;
  masterOrderId?: string | null;
  orderType?: string | null;
  fulfillmentChannel?: string | null;
  scheduledFor?: string | null;
  shippingAddress?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  assignedDeliveryStaffId?: string | null;
  assignedDriverName?: string | null;
  deliveryTrackingToken?: string | null;
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

/** Delivery fulfillment (POS or online shop). */
export function isDeliveryOrder(o: {
  channel?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  return orderChannel(o as MerchantOrder) === 'delivery';
}

/** Takeaway / delivery channels used by in-store POS (not JustEat / Uber). */
export function isKitchenFulfillmentChannel(channel?: string | null): boolean {
  const ch = String(channel || '').toLowerCase();
  return ch === 'takeaway' || ch === 'delivery';
}

/**
 * Paid internal POS (dine-in / takeaway / self-delivery) closes immediately.
 * Unpaid pay-later / invoice stay open until collection. Online / 3P use
 * their own kitchen lifecycle and never go through this helper.
 */
export function posSaleFulfillmentStatus(opts: {
  channel?: string | null;
  payLater: boolean;
  scheduledFor?: string | number | null;
}): string {
  if (opts.payLater) {
    return opts.scheduledFor ? 'accepted' : 'preparing';
  }
  return 'completed';
}

/** Preparing / Accepted / Ready / Out for delivery — online shop & 3P only. */
export function showsKitchenFulfillmentStages(o: {
  orderType?: string | null;
  orderSource?: string | null;
  channel?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  return isOnlineShopOrder(o as MerchantOrder);
}

/**
 * Kitchen Type on /merchant/orders — open online/3P kitchen tickets, plus
 * unpaid internal pay-later / invoice. Paid internal POS is completed.
 */
export function isKitchenTypeOrder(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status)) {
    return false;
  }
  if (isOnlineShopOrder(o)) {
    return [
      'accepted',
      'preparing',
      'ready',
      'out_for_delivery',
      'pending',
      'pending_approval',
    ].includes(status);
  }
  return isAwaitingPaymentOrder(o);
}

const TERMINAL_ORDER_STATUSES = new Set([
  'cancelled',
  'refunded',
  'completed',
  'partially_refunded',
]);

function normalizeOrderStatus(status?: string | null): string {
  return String(status || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
}

/** Order lifecycle is closed — no longer belongs in Active / kitchen queues. */
export function isTerminalOrderStatus(status?: string | null): boolean {
  return TERMINAL_ORDER_STATUSES.has(normalizeOrderStatus(status));
}

/**
 * WebPOS Orders panel — still in kitchen / fulfillment.
 * Paid internal POS closes after payment; online / 3P stay open until status=completed.
 */
export function isOpenWebPosOrder(o: MerchantOrder): boolean {
  if (isTerminalOrderStatus(o.status)) return false;
  if (!isOnlineShopOrder(o) && isPaidOrder(o)) return false;
  return true;
}

/**
 * Paid in-store POS delivery/takeaway with a future slot — kitchen ticket stays in
 * Active until the slot passes. Online / 3P orders use their own lifecycle and must
 * leave Active once status=completed even when scheduledFor is still in the future.
 */
export function isScheduledPosKitchenTicket(o: MerchantOrder): boolean {
  const status = normalizeOrderStatus(o.status);
  if (status !== 'completed' && status !== 'partially_refunded') return false;
  if (isOnlineShopOrder(o)) return false;
  const ch = orderChannel(o).toLowerCase();
  if (ch !== 'delivery' && ch !== 'takeaway') return false;
  if (o.scheduledFor == null || o.scheduledFor === '') return false;
  const when = new Date(o.scheduledFor as string | number | Date).getTime();
  return Number.isFinite(when) && when > Date.now();
}

/** Online order center — Active tab (pending through out_for_delivery). */
export function isActiveOnlineOrder(o: { status?: string | null }): boolean {
  return !isTerminalOrderStatus(o.status);
}

export function isOnlineShopOrder(o: {
  orderType?: string | null;
  orderSource?: string | null;
  channel?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  const t = (o.orderType || '').toLowerCase();
  const src = String(o.orderSource || '').toLowerCase();
  const ch = orderChannel(o as MerchantOrder).toLowerCase();
  return (
    t === 'web_shop' ||
    t === 'online' ||
    src === 'online_shop' ||
    src === 'kiosk' ||
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

/** Web shop delivery or pickup (takeaway) — ETA accept popup applies; excludes kiosk/QR table. */
export function isDeliveryOrPickupShopOrder(o: {
  orderType?: string | null;
  orderSource?: string | null;
  channel?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  if (!isOnlineShopOrder(o)) return false;
  const src = String(o.orderSource || '').toLowerCase();
  if (src === 'kiosk' || src === 'qr_table') return false;
  const ch = String(o.fulfillmentChannel || 'takeaway').toLowerCase();
  return ch === 'delivery' || ch === 'takeaway';
}

export function orderSourceLabel(source?: string | null): string {
  const s = String(source || '').toLowerCase();
  if (s === 'justeat') return 'Just Eat';
  if (s === 'ubereats') return 'Uber Eats';
  if (s === 'online_shop') return 'Online shop';
  if (s === 'qr_table') return 'QR table';
  if (s === 'kiosk') return 'Self-order kiosk';
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

/** Stored method after an invoice is settled by bank transfer. Never cash/card. */
export const INVOICE_SETTLEMENT_METHOD = 'invoice' as const;

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

/** Scheduled pickup/delivery ticket still open or awaiting payment. */
export function isProgrammedOrder(o: MerchantOrder): boolean {
  if (o.scheduledFor == null || o.scheduledFor === '') return false;
  const status = (o.status || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status)) return false;
  if (status === 'completed' && !isAwaitingPaymentOrder(o)) return false;
  return true;
}

/** Best-effort customer label for order lists and detail panels. */
export function resolveOrderCustomerDisplay(
  o: MerchantOrder & {
    customer?: { firstName?: string | null; lastName?: string | null } | null;
  }
): string | null {
  const direct = String(o.customerName || '').trim();
  if (direct) return direct;
  const linked = o.customer;
  if (linked) {
    const name = [linked.firstName, linked.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
  }
  const meta = parseOrderMetaNotes(o.notes);
  if (meta.memberName?.trim()) return meta.memberName.trim();
  const ch = orderChannel(o);
  const table = String(o.tableLabel || '').trim();
  if (table && ch !== 'dine_in') return table;
  return null;
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

/** Unpaid in-store POS ticket — allow cancel even when fulfillment status is completed. */
export function canCancelPosAwaitingOrder(o: MerchantOrder): boolean {
  if (isOnlineShopOrder(o)) return false;
  if (!isAwaitingPaymentOrder(o)) return false;
  const status = (o.status || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status)) return false;
  return true;
}

/** Primary label for order lists — kitchen ticket / tab over opaque WP-/DI- ids. */
export function orderListPrimaryLabel(o: MerchantOrder): string {
  const refs = orderPublicRefs(o);
  const guest = guestOrderNumber({
    orderNumber: o.orderNumber,
    orderDisplay: refs.ticketDisplay || undefined,
    tabNumber: refs.tabNumber || undefined,
  });
  if (guest) return guest;
  const parts = [
    refs.ticketDisplay,
    refs.tabNumber ? `#${refs.tabNumber.replace(/^#/, '')}` : null,
    o.tableLabel ? String(o.tableLabel) : null,
    resolveOrderCustomerDisplay(o),
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return formatOrderNumberDisplay(o.orderNumber) || o.orderNumber || o.id.slice(0, 8);
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

/** Pickup / handoff stage — default shop-pickup collect is Ready-first. */
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

/** Staff/admin may collect unpaid tickets before Ready (shop pickup stays Ready-first by default). */
export function canAdminCollectPayment(o: MerchantOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status)) return false;
  if (pay === 'completed' || pay === 'paid' || pay === 'partially_refunded') return false;
  if (Number(o.total || 0) <= 0.001) return false;
  if (pay === 'awaiting_payment') return true;
  if (isOnlineShopOrder(o) && (pay === 'cash' || method === 'cash')) return true;
  if (method === 'pay_later' || method === 'pay-later' || method === 'invoice') return true;
  return false;
}

export function canMarkReady(o: { status?: string | null }): boolean {
  const status = (o.status || '').toLowerCase();
  return status === 'accepted' || status === 'preparing';
}

/** Mark ready / kitchen stages — online shop and third-party only. */
export function canMarkReadyOrder(o: {
  status?: string | null;
  orderType?: string | null;
  orderSource?: string | null;
  channel?: string | null;
  fulfillmentChannel?: string | null;
}): boolean {
  return showsKitchenFulfillmentStages(o) && canMarkReady(o);
}

export function isPaidOrder(o: { paymentStatus?: string | null }): boolean {
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

/** Colored kitchen / fulfillment badge (Preparing, Ready, …). */
export function orderStatusBadgeClass(status: string): string {
  switch ((status || '').toLowerCase().replace(/-/g, '_')) {
    case 'pending':
    case 'pending_approval':
      return 'bg-violet-100 text-violet-800';
    case 'accepted':
    case 'confirmed':
      return 'bg-sky-100 text-sky-800';
    case 'preparing':
    case 'sent_to_kitchen':
    case 'held':
      return 'bg-amber-100 text-amber-900';
    case 'ready':
      return 'bg-emerald-100 text-emerald-800';
    case 'out_for_delivery':
      return 'bg-orange-100 text-orange-900';
    case 'completed':
      return 'bg-stone-200 text-stone-700';
    case 'cancelled':
    case 'refunded':
      return 'bg-rose-100 text-rose-800';
    case 'partially_refunded':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-stone-100 text-stone-600';
  }
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

/** Full card outline color for POS order grid cards — matches orderChannelHeaderClass. */
export function orderChannelBorderClass(o: MerchantOrder): string {
  if (isOnlineShopOrder(o)) return 'border-violet-600';
  const ch = orderChannel(o).toLowerCase();
  switch (ch) {
    case 'dine_in':
      return 'border-emerald-600';
    case 'delivery':
      return 'border-orange-500';
    case 'takeaway':
      return 'border-sky-600';
    default:
      return 'border-stone-600';
  }
}

export function orderSearchHaystack(o: MerchantOrder): string {
  const refs = orderPublicRefs(o);
  const ch = orderChannel(o);
  const guest = guestOrderNumber({
    orderNumber: o.orderNumber,
    orderDisplay: refs.ticketDisplay || undefined,
    tabNumber: refs.tabNumber || undefined,
  });
  return [
    guest,
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
    (o as { orderSource?: string | null }).orderSource,
    (o as { externalOrderId?: string | null }).externalOrderId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Match kitchen shout / tab / opaque ids — same rules as WebPOS Orders search. */
export function orderMatchesSearchQuery(o: MerchantOrder, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const refs = orderPublicRefs(o);
  const guest = guestOrderNumber({
    orderNumber: o.orderNumber,
    orderDisplay: refs.ticketDisplay || undefined,
    tabNumber: refs.tabNumber || undefined,
  });
  return ticketQueryMatches(
    q,
    guest,
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
    o.invoiceNumber,
    o.paymentMethod,
    (o as { orderSource?: string | null }).orderSource,
    (o as { externalOrderId?: string | null }).externalOrderId
  );
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

