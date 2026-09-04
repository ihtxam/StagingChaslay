import {
  normalizePaymentMethod,
  parsePaymentBreakdown,
  paymentBreakdownTotals,
} from '@/lib/payment-breakdown';

type PurgeOrder = {
  status?: string | null;
  paymentStatus?: string | null;
  invoiceNumber?: string | null;
  paymentMethod?: string | null;
  paymentBreakdown?: unknown;
  total: unknown;
  refundAmount?: unknown | null;
};

function orderNetTotal(order: PurgeOrder): number {
  const total = Number(order.total) || 0;
  const refunded = Number(order.refundAmount) || 0;
  return Math.max(0, total - refunded);
}

/** Completed, fully paid ticket — not invoice / pay-later / bank. */
export function isCompletedPaidCashOrder(order: PurgeOrder): boolean {
  const status = String(order.status || '').toLowerCase();
  const payStatus = String(order.paymentStatus || '').toLowerCase();
  if (status !== 'completed') return false;
  if (!['completed', 'paid'].includes(payStatus)) return false;
  if (order.invoiceNumber) return false;

  const rawMethod = String(order.paymentMethod || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (
    rawMethod === 'pay_later' ||
    rawMethod.startsWith('pay_later:') ||
    rawMethod.startsWith('pay_later_') ||
    rawMethod === 'invoice' ||
    rawMethod === 'bank_transfer' ||
    rawMethod === 'bank'
  ) {
    return false;
  }

  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    Number(order.total) || 0
  );
  for (const tender of tenders) {
    const raw = String(tender.method || '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_');
    const method = normalizePaymentMethod(tender.method);
    if (
      method === 'pay_later' ||
      method === 'invoice' ||
      method === 'bank_transfer' ||
      raw.startsWith('pay_later')
    ) {
      return false;
    }
  }

  return true;
}

/** Order was paid entirely in cash (no card/terminal/gift portions). */
export function isCashOnlyOrder(order: PurgeOrder): boolean {
  const net = orderNetTotal(order);
  if (net <= 0) return false;

  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    Number(order.total) || 0
  );
  if (!tenders.length) {
    return normalizePaymentMethod(String(order.paymentMethod || '')) === 'cash';
  }

  const { cash, terminal, giftCard, other } = paymentBreakdownTotals(tenders);
  if (terminal > 0.001 || giftCard > 0.001 || other > 0.001) return false;
  return cash >= net - 0.01;
}

export function isGandolaPurgeEligible(order: PurgeOrder): boolean {
  return isCompletedPaidCashOrder(order) && isCashOnlyOrder(order);
}

export function orderMatchesPaymentFilter(
  order: { paymentMethod?: string | null; paymentBreakdown?: unknown; total?: unknown },
  filter: string
): boolean {
  if (filter === 'all') return true;
  if (filter === 'cash') return isCashOnlyOrder(order as PurgeOrder);
  return (order.paymentMethod || '').toLowerCase() === filter;
}
