import assert from "node:assert/strict";
import {
  isPaidOnlineEcommerce,
  isUsableAdyenPspReference,
  remainingRefundableAmount,
} from "./online-payment-refund.ts";
import {
  incomingTaxRateOrPreserve,
  shouldWriteCredential,
} from "./merchant-settings-preserve.ts";

assert.equal(
  isPaidOnlineEcommerce({
    paymentMethod: "card",
    paymentStatus: "completed",
    orderType: "web_shop",
  }),
  true
);
assert.equal(
  isPaidOnlineEcommerce({
    paymentMethod: "cash",
    paymentStatus: "completed",
  }),
  false
);
assert.equal(isUsableAdyenPspReference("DEMO-WEB-1"), false);
assert.equal(remainingRefundableAmount({ total: 10, refundAmount: 2 }), 8);

assert.equal(shouldWriteCredential(""), false);
assert.equal(shouldWriteCredential("live_abc"), true);
assert.equal(incomingTaxRateOrPreserve(undefined, "vatRate"), undefined);
assert.equal(incomingTaxRateOrPreserve(2.6, "taxTakeawayRate"), "2.60");

console.log("refund + settings-preserve tests passed");
