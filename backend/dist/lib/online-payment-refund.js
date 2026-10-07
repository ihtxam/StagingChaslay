"use strict";
/**
 * Detect Adyen Checkout (shop / e-commerce) payments vs cash / POS terminal.
 * Paid-online card/TWINT must be refunded through Checkout, not Terminal API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPaidOnlineEcommerce = isPaidOnlineEcommerce;
exports.remainingRefundableAmount = remainingRefundableAmount;
exports.isUsableAdyenPspReference = isUsableAdyenPspReference;
exports.onlineCancelPaymentPatch = onlineCancelPaymentPatch;
const CASH_LIKE = new Set([
    "cash",
    "pay_later",
    "paylater",
    "invoice",
    "gift_card",
    "giftcard",
    "bank_transfer",
    "bank",
]);
const TERMINAL_LIKE = new Set(["terminal", "tap_to_pay", "taptopay", "softpos"]);
const PAID_STATUSES = new Set([
    "completed",
    "paid",
    "captured",
    "authorised",
    "authorized",
    "partially_refunded",
]);
const ECOMMERCE_METHODS = new Set([
    "card",
    "credit_card",
    "creditcard",
    "scheme",
    "visa",
    "mc",
    "amex",
    "maestro",
    "twint",
    "online",
]);
function norm(raw) {
    return String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
}
/** True when the order was collected via Adyen Checkout (card/TWINT/etc.), not cash or POS terminal. */
function isPaidOnlineEcommerce(order) {
    if (!order)
        return false;
    const method = norm(order.paymentMethod);
    const pay = norm(order.paymentStatus);
    if (CASH_LIKE.has(method))
        return false;
    if (!PAID_STATUSES.has(pay))
        return false;
    if (order.adyenPoiTransactionTs)
        return false;
    if (TERMINAL_LIKE.has(method))
        return false;
    if (ECOMMERCE_METHODS.has(method) || method.includes("twint"))
        return true;
    if (order.orderType === "web_shop" && String(order.adyenReference || "").trim())
        return true;
    const source = norm(order.orderSource);
    if ((source === "online_shop" || source === "web_shop") && method === "card")
        return true;
    return false;
}
function remainingRefundableAmount(order) {
    const total = Number(order.total) || 0;
    const already = Number(order.refundAmount) || 0;
    return Math.max(0, Math.round((total - already) * 100) / 100);
}
function isUsableAdyenPspReference(raw) {
    const ref = String(raw || "").trim();
    if (ref.length < 8)
        return false;
    if (/^DEMO[-_]/i.test(ref))
        return false;
    if (/^auth-/i.test(ref))
        return false;
    return true;
}
function onlineCancelPaymentPatch(refund) {
    if (!refund.refunded || refund.amount <= 0) {
        return { paymentStatus: "cancelled" };
    }
    return {
        paymentStatus: "refunded",
        refundAmount: refund.amount.toFixed(2),
    };
}
//# sourceMappingURL=online-payment-refund.js.map