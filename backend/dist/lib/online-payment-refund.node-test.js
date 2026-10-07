"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const online_payment_refund_ts_1 = require("./online-payment-refund.ts");
const merchant_settings_preserve_ts_1 = require("./merchant-settings-preserve.ts");
strict_1.default.equal((0, online_payment_refund_ts_1.isPaidOnlineEcommerce)({
    paymentMethod: "card",
    paymentStatus: "completed",
    orderType: "web_shop",
}), true);
strict_1.default.equal((0, online_payment_refund_ts_1.isPaidOnlineEcommerce)({
    paymentMethod: "cash",
    paymentStatus: "completed",
}), false);
strict_1.default.equal((0, online_payment_refund_ts_1.isUsableAdyenPspReference)("DEMO-WEB-1"), false);
strict_1.default.equal((0, online_payment_refund_ts_1.remainingRefundableAmount)({ total: 10, refundAmount: 2 }), 8);
strict_1.default.equal((0, merchant_settings_preserve_ts_1.shouldWriteCredential)(""), false);
strict_1.default.equal((0, merchant_settings_preserve_ts_1.shouldWriteCredential)("live_abc"), true);
strict_1.default.equal((0, merchant_settings_preserve_ts_1.incomingTaxRateOrPreserve)(undefined, "vatRate"), undefined);
strict_1.default.equal((0, merchant_settings_preserve_ts_1.incomingTaxRateOrPreserve)(2.6, "taxTakeawayRate"), "2.60");
console.log("refund + settings-preserve tests passed");
//# sourceMappingURL=online-payment-refund.node-test.js.map