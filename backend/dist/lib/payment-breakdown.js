"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_PAYMENT_METHODS = void 0;
exports.normalizePaymentMethod = normalizePaymentMethod;
exports.paymentMethodLabelEn = paymentMethodLabelEn;
exports.parsePaymentBreakdown = parsePaymentBreakdown;
exports.paymentBreakdownTotals = paymentBreakdownTotals;
exports.allocateRefundGiftFirst = allocateRefundGiftFirst;
exports.refundDeltaGiftFirst = refundDeltaGiftFirst;
exports.resolveSalePaymentMethod = resolveSalePaymentMethod;
exports.hasTerminalPortion = hasTerminalPortion;
exports.refundBucketsFromCumulative = refundBucketsFromCumulative;
exports.netPaymentBucketsAfterRefund = netPaymentBucketsAfterRefund;
exports.netTaxableSale = netTaxableSale;
const money_1 = require("@/lib/money");
const TERMINAL_METHODS = new Set(["terminal", "card"]);
const GIFT_METHODS = new Set(["gift_card"]);
const CASH_METHODS = new Set(["cash"]);
/** Canonical report buckets. Mixed stays its own slice (not split into cash+card). */
exports.CANONICAL_PAYMENT_METHODS = [
    "cash",
    "card",
    "terminal",
    "mixed",
    "gift_card",
    "invoice",
    "pay_later",
    "bank_transfer",
];
const PAYMENT_METHOD_ALIASES = {
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
function normalizePaymentMethod(method) {
    const raw = String(method || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    if (!raw)
        return "";
    const later = raw.match(/^pay_later[:_](.+)$/);
    if (later) {
        return PAYMENT_METHOD_ALIASES[later[1]] || later[1];
    }
    return PAYMENT_METHOD_ALIASES[raw] || raw;
}
function paymentMethodLabelEn(method) {
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
function parsePaymentBreakdown(raw, paymentMethod, orderTotal) {
    if (Array.isArray(raw) && raw.length) {
        return raw
            .map((row) => ({
            method: normalizePaymentMethod(String(row.method || "")),
            amount: (0, money_1.roundMoney2)(Number(row.amount) || 0),
        }))
            .filter((t) => t.method && t.amount > 0);
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return Object.entries(raw)
            .map(([method, amount]) => ({
            method: normalizePaymentMethod(method),
            amount: (0, money_1.roundMoney2)(Number(amount) || 0),
        }))
            .filter((t) => t.method && t.amount > 0);
    }
    const method = normalizePaymentMethod(String(paymentMethod || ""));
    const total = (0, money_1.roundMoney2)(Number(orderTotal) || 0);
    if (method && method !== "mixed" && total > 0) {
        return [{ method, amount: total }];
    }
    return [];
}
function paymentBreakdownTotals(tenders) {
    let giftCard = 0;
    let cash = 0;
    let terminal = 0;
    let other = 0;
    for (const t of tenders) {
        const m = normalizePaymentMethod(t.method);
        const amt = (0, money_1.roundMoney2)(t.amount);
        if (GIFT_METHODS.has(m))
            giftCard = (0, money_1.roundMoney2)(giftCard + amt);
        else if (CASH_METHODS.has(m))
            cash = (0, money_1.roundMoney2)(cash + amt);
        else if (TERMINAL_METHODS.has(m))
            terminal = (0, money_1.roundMoney2)(terminal + amt);
        else
            other = (0, money_1.roundMoney2)(other + amt);
    }
    return { giftCard, cash, terminal, other };
}
/** Gift-first cumulative allocation for refunds (partial + full). */
function allocateRefundGiftFirst(cumulativeRefund, tenders) {
    const { giftCard, cash, terminal, other } = paymentBreakdownTotals(tenders);
    let left = (0, money_1.roundMoney2)(Math.max(0, cumulativeRefund));
    const toGift = (0, money_1.roundMoney2)(Math.min(left, giftCard));
    left = (0, money_1.roundMoney2)(left - toGift);
    const toCash = (0, money_1.roundMoney2)(Math.min(left, cash));
    left = (0, money_1.roundMoney2)(left - toCash);
    const toTerminal = (0, money_1.roundMoney2)(Math.min(left, terminal));
    left = (0, money_1.roundMoney2)(left - toTerminal);
    const toOther = (0, money_1.roundMoney2)(Math.min(left, other));
    return { giftCard: toGift, cash: toCash, terminal: toTerminal, other: toOther };
}
function refundDeltaGiftFirst(alreadyRefunded, newRefundAmount, tenders) {
    const prev = allocateRefundGiftFirst(alreadyRefunded, tenders);
    const next = allocateRefundGiftFirst((0, money_1.roundMoney2)(alreadyRefunded + newRefundAmount), tenders);
    return {
        giftCard: (0, money_1.roundMoney2)(next.giftCard - prev.giftCard),
        cash: (0, money_1.roundMoney2)(next.cash - prev.cash),
        terminal: (0, money_1.roundMoney2)(next.terminal - prev.terminal),
        other: (0, money_1.roundMoney2)(next.other - prev.other),
    };
}
function resolveSalePaymentMethod(tenders, fallback) {
    const active = tenders.filter((t) => t.amount > 0);
    if (active.length > 1)
        return "mixed";
    if (active.length === 1)
        return normalizePaymentMethod(active[0].method) || "cash";
    return normalizePaymentMethod(fallback) || "cash";
}
function hasTerminalPortion(tenders) {
    return paymentBreakdownTotals(tenders).terminal > 0.001;
}
function splitCardTerminalNet(netCardTerminal, tenders) {
    let cardGross = 0;
    let termGross = 0;
    for (const t of tenders) {
        const m = normalizePaymentMethod(t.method);
        const amt = (0, money_1.roundMoney2)(t.amount);
        if (m === "card")
            cardGross = (0, money_1.roundMoney2)(cardGross + amt);
        else if (m === "terminal")
            termGross = (0, money_1.roundMoney2)(termGross + amt);
    }
    const sum = (0, money_1.roundMoney2)(cardGross + termGross);
    if (sum <= 0.001)
        return { card: 0, terminal: (0, money_1.roundMoney2)(Math.max(0, netCardTerminal)) };
    return {
        card: (0, money_1.roundMoney2)(Math.max(0, netCardTerminal * (cardGross / sum))),
        terminal: (0, money_1.roundMoney2)(Math.max(0, netCardTerminal * (termGross / sum))),
    };
}
/** Cumulative refund amount allocated to each canonical payment bucket (gift-first). */
function refundBucketsFromCumulative(refundAmount, rawBreakdown, paymentMethod, orderTotal) {
    const refund = (0, money_1.roundMoney2)(Math.max(0, Number(refundAmount) || 0));
    if (refund <= 0)
        return new Map();
    const total = (0, money_1.roundMoney2)(Number(orderTotal) || 0);
    const tenders = parsePaymentBreakdown(rawBreakdown, paymentMethod, total);
    const pm = resolveSalePaymentMethod(tenders, String(paymentMethod || ""));
    if (pm === "mixed")
        return new Map([["mixed", refund]]);
    const allocated = allocateRefundGiftFirst(refund, tenders);
    const out = new Map();
    if (allocated.giftCard > 0)
        out.set("gift_card", allocated.giftCard);
    if (allocated.cash > 0)
        out.set("cash", allocated.cash);
    if (allocated.other > 0)
        out.set("other", allocated.other);
    if (allocated.terminal > 0) {
        const { card, terminal } = splitCardTerminalNet(allocated.terminal, tenders);
        if (card > 0)
            out.set("card", card);
        if (terminal > 0)
            out.set("terminal", terminal);
        if (card <= 0 && terminal <= 0)
            out.set("terminal", allocated.terminal);
    }
    return out;
}
/** Net collected per canonical bucket after cumulative refunds (Mixed stays one slice). */
function netPaymentBucketsAfterRefund(orderTotal, refundAmount, rawBreakdown, paymentMethod) {
    const total = (0, money_1.roundMoney2)(Number(orderTotal) || 0);
    const refund = (0, money_1.roundMoney2)(Math.max(0, Number(refundAmount) || 0));
    const tenders = parsePaymentBreakdown(rawBreakdown, paymentMethod, total);
    const pm = resolveSalePaymentMethod(tenders, String(paymentMethod || ""));
    if (pm === "mixed") {
        return new Map([["mixed", (0, money_1.roundMoney2)(Math.max(0, total - refund))]]);
    }
    if (!tenders.length) {
        const key = normalizePaymentMethod(paymentMethod || "") || "other";
        return new Map([[key, (0, money_1.roundMoney2)(Math.max(0, total - refund))]]);
    }
    const allocated = allocateRefundGiftFirst(refund, tenders);
    const gross = paymentBreakdownTotals(tenders);
    const out = new Map();
    const push = (key, grossAmt, refundPart) => {
        const net = (0, money_1.roundMoney2)(Math.max(0, grossAmt - refundPart));
        if (net > 0)
            out.set(key, (0, money_1.roundMoney2)((out.get(key) || 0) + net));
    };
    push("gift_card", gross.giftCard, allocated.giftCard);
    push("cash", gross.cash, allocated.cash);
    push("other", gross.other, allocated.other);
    const netCardTerminal = (0, money_1.roundMoney2)(Math.max(0, gross.terminal - allocated.terminal));
    if (netCardTerminal > 0) {
        const { card, terminal } = splitCardTerminalNet(netCardTerminal, tenders);
        if (card > 0)
            out.set("card", (0, money_1.roundMoney2)((out.get("card") || 0) + card));
        if (terminal > 0)
            out.set("terminal", (0, money_1.roundMoney2)((out.get("terminal") || 0) + terminal));
        if (card <= 0 && terminal <= 0) {
            out.set("terminal", (0, money_1.roundMoney2)((out.get("terminal") || 0) + netCardTerminal));
        }
    }
    return out;
}
/** Taxable net sales for one paid ticket (excl. tips, after refunds). */
function netTaxableSale(total, tipAmount, refundAmount) {
    const brut = Math.max(0, (0, money_1.roundMoney2)(Number(total) || 0) - (0, money_1.roundMoney2)(Number(tipAmount) || 0));
    const refund = (0, money_1.roundMoney2)(Math.max(0, Number(refundAmount) || 0));
    return (0, money_1.roundMoney2)(Math.max(0, brut - Math.min(refund, brut)));
}
//# sourceMappingURL=payment-breakdown.js.map