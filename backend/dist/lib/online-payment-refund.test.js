"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const online_payment_refund_1 = require("./online-payment-refund");
(0, vitest_1.describe)("isPaidOnlineEcommerce", () => {
    (0, vitest_1.it)("refunds paid-online shop card orders", () => {
        (0, vitest_1.expect)((0, online_payment_refund_1.isPaidOnlineEcommerce)({
            paymentMethod: "card",
            paymentStatus: "completed",
            orderType: "web_shop",
            orderSource: "online_shop",
            adyenReference: "K8Q2XXXX",
        })).toBe(true);
    });
    (0, vitest_1.it)("refunds TWINT ecommerce (still Adyen Checkout, just not tokenizable)", () => {
        (0, vitest_1.expect)((0, online_payment_refund_1.isPaidOnlineEcommerce)({
            paymentMethod: "twint",
            paymentStatus: "paid",
            orderType: "web_shop",
        })).toBe(true);
    });
    (0, vitest_1.it)("does not refund cash or unpaid", () => {
        (0, vitest_1.expect)((0, online_payment_refund_1.isPaidOnlineEcommerce)({
            paymentMethod: "cash",
            paymentStatus: "completed",
            orderType: "web_shop",
        })).toBe(false);
        (0, vitest_1.expect)((0, online_payment_refund_1.isPaidOnlineEcommerce)({
            paymentMethod: "card",
            paymentStatus: "awaiting_payment",
            orderType: "web_shop",
        })).toBe(false);
    });
    (0, vitest_1.it)("does not treat POS terminal card as ecommerce", () => {
        (0, vitest_1.expect)((0, online_payment_refund_1.isPaidOnlineEcommerce)({
            paymentMethod: "card",
            paymentStatus: "completed",
            adyenPoiTransactionTs: new Date(),
        })).toBe(false);
        (0, vitest_1.expect)((0, online_payment_refund_1.isPaidOnlineEcommerce)({
            paymentMethod: "terminal",
            paymentStatus: "completed",
        })).toBe(false);
    });
});
(0, vitest_1.describe)("psp + remaining", () => {
    (0, vitest_1.it)("rejects demo/placeholder Adyen references", () => {
        (0, vitest_1.expect)((0, online_payment_refund_1.isUsableAdyenPspReference)("DEMO-WEB-B335-11")).toBe(false);
        (0, vitest_1.expect)((0, online_payment_refund_1.isUsableAdyenPspReference)("K8Q2ABCD1234")).toBe(true);
    });
    (0, vitest_1.it)("computes remaining refund", () => {
        (0, vitest_1.expect)((0, online_payment_refund_1.remainingRefundableAmount)({ total: "20.00", refundAmount: "5" })).toBe(15);
    });
});
//# sourceMappingURL=online-payment-refund.test.js.map