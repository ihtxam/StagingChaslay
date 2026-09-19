/** Paid Adyen Checkout (shop card/TWINT) — cancel should refund. Not cash or POS terminal. */
export function isPaidOnlineEcommerceOrder(order: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  orderType?: string | null;
  orderSource?: string | null;
  adyenReference?: string | null;
  adyenPoiTransactionTs?: string | Date | null;
} | null | undefined): boolean {
  if (!order) return false;
  const method = String(order.paymentMethod || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const pay = String(order.paymentStatus || '')
    .trim()
    .toLowerCase();
  if (['cash', 'pay_later', 'paylater', 'invoice', 'gift_card', 'giftcard', 'bank_transfer'].includes(method)) {
    return false;
  }
  if (!['completed', 'paid', 'captured', 'authorised', 'authorized', 'partially_refunded'].includes(pay)) {
    return false;
  }
  if (order.adyenPoiTransactionTs) return false;
  if (method === 'terminal' || method === 'tap_to_pay') return false;
  if (['card', 'credit_card', 'scheme', 'twint', 'online'].includes(method) || method.includes('twint')) {
    return true;
  }
  if (order.orderType === 'web_shop' && String(order.adyenReference || '').trim()) return true;
  return false;
}
