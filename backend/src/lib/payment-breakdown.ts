import { roundMoney2 } from "@/lib/money";

export type PaymentTender = { method: string; amount: number };

const TERMINAL_METHODS = new Set(["terminal", "card", "adyen_terminal", "adyen-terminal"]);
const GIFT_METHODS = new Set(["gift_card", "gift-card", "giftcard"]);
const CASH_METHODS = new Set(["cash"]);

export function normalizePaymentMethod(method: string): string {
  return String(method || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

/** Parse stored payment_breakdown JSON or legacy single paymentMethod. */
export function parsePaymentBreakdown(
  raw: unknown,
  paymentMethod?: string | null,
  orderTotal?: number
): PaymentTender[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row) => ({
        method: normalizePaymentMethod(String((row as PaymentTender).method || "")),
        amount: roundMoney2(Number((row as PaymentTender).amount) || 0),
      }))
      .filter((t) => t.method && t.amount > 0);
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .map(([method, amount]) => ({
        method: normalizePaymentMethod(method),
        amount: roundMoney2(Number(amount) || 0),
      }))
      .filter((t) => t.method && t.amount > 0);
  }
  const method = normalizePaymentMethod(String(paymentMethod || ""));
  const total = roundMoney2(Number(orderTotal) || 0);
  if (method && method !== "mixed" && total > 0) {
    return [{ method, amount: total }];
  }
  return [];
}

export function paymentBreakdownTotals(tenders: PaymentTender[]) {
  let giftCard = 0;
  let cash = 0;
  let terminal = 0;
  let other = 0;
  for (const t of tenders) {
    const m = normalizePaymentMethod(t.method);
    const amt = roundMoney2(t.amount);
    if (GIFT_METHODS.has(m)) giftCard = roundMoney2(giftCard + amt);
    else if (CASH_METHODS.has(m)) cash = roundMoney2(cash + amt);
    else if (TERMINAL_METHODS.has(m)) terminal = roundMoney2(terminal + amt);
    else other = roundMoney2(other + amt);
  }
  return { giftCard, cash, terminal, other };
}

/** Gift-first cumulative allocation for refunds (partial + full). */
export function allocateRefundGiftFirst(
  cumulativeRefund: number,
  tenders: PaymentTender[]
): { giftCard: number; cash: number; terminal: number; other: number } {
  const { giftCard, cash, terminal, other } = paymentBreakdownTotals(tenders);
  let left = roundMoney2(Math.max(0, cumulativeRefund));
  const toGift = roundMoney2(Math.min(left, giftCard));
  left = roundMoney2(left - toGift);
  const toCash = roundMoney2(Math.min(left, cash));
  left = roundMoney2(left - toCash);
  const toTerminal = roundMoney2(Math.min(left, terminal));
  left = roundMoney2(left - toTerminal);
  const toOther = roundMoney2(Math.min(left, other));
  return { giftCard: toGift, cash: toCash, terminal: toTerminal, other: toOther };
}

export function refundDeltaGiftFirst(
  alreadyRefunded: number,
  newRefundAmount: number,
  tenders: PaymentTender[]
) {
  const prev = allocateRefundGiftFirst(alreadyRefunded, tenders);
  const next = allocateRefundGiftFirst(roundMoney2(alreadyRefunded + newRefundAmount), tenders);
  return {
    giftCard: roundMoney2(next.giftCard - prev.giftCard),
    cash: roundMoney2(next.cash - prev.cash),
    terminal: roundMoney2(next.terminal - prev.terminal),
    other: roundMoney2(next.other - prev.other),
  };
}

export function resolveSalePaymentMethod(
  tenders: PaymentTender[],
  fallback: string
): string {
  const active = tenders.filter((t) => t.amount > 0);
  if (active.length > 1) return "mixed";
  if (active.length === 1) return active[0]!.method;
  return normalizePaymentMethod(fallback) || "cash";
}

export function hasTerminalPortion(tenders: PaymentTender[]): boolean {
  return paymentBreakdownTotals(tenders).terminal > 0.001;
}
