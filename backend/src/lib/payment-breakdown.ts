import { roundMoney2 } from "@/lib/money";

export type PaymentTender = { method: string; amount: number };

const TERMINAL_METHODS = new Set(["terminal", "card"]);
const GIFT_METHODS = new Set(["gift_card"]);
const CASH_METHODS = new Set(["cash"]);

/** Canonical report buckets. Mixed stays its own slice (not split into cash+card). */
export const CANONICAL_PAYMENT_METHODS = [
  "cash",
  "card",
  "terminal",
  "mixed",
  "gift_card",
  "invoice",
  "pay_later",
  "bank_transfer",
] as const;

const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  cash: "cash",
  express: "cash",
  especes: "cash",
  espece: "cash",
  bar: "cash",
  bargeld: "cash",
  liquide: "cash",
  card: "card",
  carte: "card",
  karte: "card",
  credit_card: "card",
  creditcard: "card",
  debit: "card",
  debit_card: "card",
  tap_to_pay: "card",
  taptopay: "card",
  terminal: "terminal",
  adyen: "terminal",
  adyen_terminal: "terminal",
  mixed: "mixed",
  split: "mixed",
  split_tender: "mixed",
  paiement_mixte: "mixed",
  gemischte_zahlung: "mixed",
  gift_card: "gift_card",
  giftcard: "gift_card",
  gift: "gift_card",
  carte_cadeau: "gift_card",
  geschenkkarte: "gift_card",
  invoice: "invoice",
  facture: "invoice",
  rechnung: "invoice",
  pay_later: "pay_later",
  paylater: "pay_later",
  bank_transfer: "bank_transfer",
  virement: "bank_transfer",
  uberweisung: "bank_transfer",
};

/** Fold case, diacritics, spaces, and known aliases into one report key. */
export function normalizePaymentMethod(method: string): string {
  const raw = String(method || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!raw) return "";
  const later = raw.match(/^pay_later[:_](.+)$/);
  if (later) {
    return PAYMENT_METHOD_ALIASES[later[1]] || later[1];
  }
  return PAYMENT_METHOD_ALIASES[raw] || raw;
}

export function paymentMethodLabelEn(method: string): string {
  switch (normalizePaymentMethod(method)) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    case "terminal":
      return "Terminal";
    case "mixed":
      return "Mixed";
    case "gift_card":
      return "Gift card";
    case "invoice":
      return "Invoice";
    case "pay_later":
      return "Pay later";
    case "bank_transfer":
      return "Bank transfer";
    case "other":
    case "":
      return "Other";
    default:
      return method || "Other";
  }
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

/** Scale tender amounts proportionally so they sum to orderTotal (fixes stale oversized breakdowns). */
export function scaleTendersToOrderTotal(
  tenders: PaymentTender[],
  orderTotal: number
): PaymentTender[] {
  if (!tenders.length) return tenders;
  const target = roundMoney2(Math.max(0, Number(orderTotal) || 0));
  if (target <= 0) return [];
  const sum = roundMoney2(tenders.reduce((s, t) => s + t.amount, 0));
  if (sum <= 0) return [];
  if (Math.abs(sum - target) < 0.01) return tenders;
  const ratio = target / sum;
  const scaled = tenders.map((t) => ({
    method: t.method,
    amount: roundMoney2(t.amount * ratio),
  }));
  const scaledSum = roundMoney2(scaled.reduce((s, t) => s + t.amount, 0));
  const diff = roundMoney2(target - scaledSum);
  if (Math.abs(diff) >= 0.01 && scaled.length) {
    scaled[0]!.amount = roundMoney2(scaled[0]!.amount + diff);
  }
  return scaled;
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
  if (active.length === 1) return normalizePaymentMethod(active[0]!.method) || "cash";
  return normalizePaymentMethod(fallback) || "cash";
}

export function hasTerminalPortion(tenders: PaymentTender[]): boolean {
  return paymentBreakdownTotals(tenders).terminal > 0.001;
}

function splitCardTerminalNet(
  netCardTerminal: number,
  tenders: PaymentTender[]
): { card: number; terminal: number } {
  let cardGross = 0;
  let termGross = 0;
  for (const t of tenders) {
    const m = normalizePaymentMethod(t.method);
    const amt = roundMoney2(t.amount);
    if (m === "card") cardGross = roundMoney2(cardGross + amt);
    else if (m === "terminal") termGross = roundMoney2(termGross + amt);
  }
  const sum = roundMoney2(cardGross + termGross);
  if (sum <= 0.001) return { card: 0, terminal: roundMoney2(Math.max(0, netCardTerminal)) };
  return {
    card: roundMoney2(Math.max(0, netCardTerminal * (cardGross / sum))),
    terminal: roundMoney2(Math.max(0, netCardTerminal * (termGross / sum))),
  };
}

/** Cumulative refund amount allocated to each canonical payment bucket (gift-first). */
export function refundBucketsFromCumulative(
  refundAmount: number,
  rawBreakdown: unknown,
  paymentMethod?: string | null,
  orderTotal?: number
): Map<string, number> {
  const refund = roundMoney2(Math.max(0, Number(refundAmount) || 0));
  if (refund <= 0) return new Map();
  const total = roundMoney2(Number(orderTotal) || 0);
  const tenders = scaleTendersToOrderTotal(
    parsePaymentBreakdown(rawBreakdown, paymentMethod, total),
    total
  );
  const pm = resolveSalePaymentMethod(tenders, String(paymentMethod || ""));
  if (pm === "mixed") return new Map([["mixed", refund]]);

  const allocated = allocateRefundGiftFirst(refund, tenders);
  const out = new Map<string, number>();
  if (allocated.giftCard > 0) out.set("gift_card", allocated.giftCard);
  if (allocated.cash > 0) out.set("cash", allocated.cash);
  if (allocated.other > 0) out.set("other", allocated.other);
  if (allocated.terminal > 0) {
    const { card, terminal } = splitCardTerminalNet(allocated.terminal, tenders);
    if (card > 0) out.set("card", card);
    if (terminal > 0) out.set("terminal", terminal);
    if (card <= 0 && terminal <= 0) out.set("terminal", allocated.terminal);
  }
  return out;
}

/** Net collected per canonical bucket after cumulative refunds (Mixed stays one slice). */
export function netPaymentBucketsAfterRefund(
  orderTotal: number,
  refundAmount: number,
  rawBreakdown: unknown,
  paymentMethod?: string | null
): Map<string, number> {
  const total = roundMoney2(Number(orderTotal) || 0);
  const refund = roundMoney2(Math.max(0, Number(refundAmount) || 0));
  const tenders = scaleTendersToOrderTotal(
    parsePaymentBreakdown(rawBreakdown, paymentMethod, total),
    total
  );
  const pm = resolveSalePaymentMethod(tenders, String(paymentMethod || ""));

  if (pm === "mixed") {
    return new Map([["mixed", roundMoney2(Math.max(0, total - refund))]]);
  }
  if (!tenders.length) {
    const key = normalizePaymentMethod(paymentMethod || "") || "other";
    return new Map([[key, roundMoney2(Math.max(0, total - refund))]]);
  }

  const allocated = allocateRefundGiftFirst(refund, tenders);
  const gross = paymentBreakdownTotals(tenders);
  const out = new Map<string, number>();

  const push = (key: string, grossAmt: number, refundPart: number) => {
    const net = roundMoney2(Math.max(0, grossAmt - refundPart));
    if (net > 0) out.set(key, roundMoney2((out.get(key) || 0) + net));
  };

  push("gift_card", gross.giftCard, allocated.giftCard);
  push("cash", gross.cash, allocated.cash);
  push("other", gross.other, allocated.other);

  const netCardTerminal = roundMoney2(Math.max(0, gross.terminal - allocated.terminal));
  if (netCardTerminal > 0) {
    const { card, terminal } = splitCardTerminalNet(netCardTerminal, tenders);
    if (card > 0) out.set("card", roundMoney2((out.get("card") || 0) + card));
    if (terminal > 0) out.set("terminal", roundMoney2((out.get("terminal") || 0) + terminal));
    if (card <= 0 && terminal <= 0) {
      out.set("terminal", roundMoney2((out.get("terminal") || 0) + netCardTerminal));
    }
  }

  return out;
}

/** Taxable net sales for one paid ticket (excl. tips, after refunds). */
export function netTaxableSale(
  total: number,
  tipAmount: number,
  refundAmount: number
): number {
  const brut = Math.max(0, roundMoney2(Number(total) || 0) - roundMoney2(Number(tipAmount) || 0));
  const refund = roundMoney2(Math.max(0, Number(refundAmount) || 0));
  return roundMoney2(Math.max(0, brut - Math.min(refund, brut)));
}
