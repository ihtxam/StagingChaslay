import { roundMoney2 } from '@/lib/money';

export type PosFulfillmentChannel = 'takeaway' | 'dine_in' | 'delivery';

export function normalizePosFulfillmentChannel(
  raw?: string | null
): PosFulfillmentChannel {
  const ch = String(raw || 'takeaway')
    .toLowerCase()
    .replace(/-/g, '_');
  if (ch === 'dine_in' || ch === 'dinein') return 'dine_in';
  if (ch === 'delivery' || ch === 'deliver') return 'delivery';
  return 'takeaway';
}

export function isCounterDineInOrderEvidence(opts: {
  orderNumber?: string | null;
  ticketDisplay?: string | null;
}): boolean {
  const orderNo = String(opts.orderNumber || '').trim();
  if (/^DI-/i.test(orderNo)) return true;
  const ticket = String(opts.ticketDisplay || '').trim();
  return /^D-\d{3}$/i.test(ticket);
}

export function dineInEligibleFromService(opts: {
  tableId?: string | null;
  tableLabel?: string | null;
  orderNumber?: string | null;
  ticketDisplay?: string | null;
}): boolean {
  if (String(opts.tableId || '').trim()) return true;
  if (String(opts.tableLabel || '').trim()) return true;
  return isCounterDineInOrderEvidence(opts);
}

function impliedVatRatePercent(subtotal: number, taxAmount: number): number | undefined {
  if (subtotal > 0.001 && taxAmount > 0.001) {
    return roundMoney2((taxAmount / subtotal) * 100);
  }
  return undefined;
}

export function resolvePosOrderFulfillmentChannel(
  order: {
    fulfillmentChannel?: string | null;
    channel?: string | null;
    orderType?: string | null;
    tableId?: string | null;
    tableLabel?: string | null;
    orderNumber?: string | null;
    ticketDisplay?: string | null;
    subtotal?: number | string | null;
    taxAmount?: number | string | null;
  },
  opts?: {
    taxIncludedInPrice?: boolean;
    taxTakeawayRate?: number;
    taxDineInRate?: number;
  }
): PosFulfillmentChannel {
  const raw = normalizePosFulfillmentChannel(
    order.fulfillmentChannel || order.channel || 'takeaway'
  );
  if (raw === 'delivery') return 'delivery';
  const orderType = String(order.orderType || '').toLowerCase();
  if (orderType && orderType !== 'pos') return raw;

  if (raw !== 'dine_in') return 'takeaway';

  if (
    dineInEligibleFromService({
      tableId: order.tableId,
      tableLabel: order.tableLabel,
      orderNumber: order.orderNumber,
      ticketDisplay: order.ticketDisplay,
    })
  ) {
    return 'dine_in';
  }

  const takeawayRate = Number(opts?.taxTakeawayRate);
  const dineInRate = Number(opts?.taxDineInRate);
  const subtotal = Number(order.subtotal ?? 0);
  const taxAmount = Number(order.taxAmount ?? 0);
  if (
    opts?.taxIncludedInPrice === true &&
    subtotal > 0.001 &&
    taxAmount > 0.001 &&
    takeawayRate > 0 &&
    dineInRate > 0
  ) {
    const implied = impliedVatRatePercent(subtotal, taxAmount);
    if (implied != null) {
      const distTakeaway = Math.abs(implied - takeawayRate);
      const distDineIn = Math.abs(implied - dineInRate);
      if (distTakeaway + 0.05 < distDineIn) return 'takeaway';
      if (distDineIn + 0.05 < distTakeaway) return 'dine_in';
    }
  }

  return 'takeaway';
}
