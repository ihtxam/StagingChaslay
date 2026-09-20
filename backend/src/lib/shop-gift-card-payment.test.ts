/**
 * Gift card online payment guards — run: cd backend && npx tsx src/lib/shop-gift-card-payment.test.ts
 */
import assert from "node:assert/strict";
import { isAdyenPaymentSuccess } from "./adyen-result-codes.ts";

assert.equal(isAdyenPaymentSuccess("Authorised"), true);
assert.equal(isAdyenPaymentSuccess("Cancelled"), false);
assert.equal(isAdyenPaymentSuccess("Refused"), false);
assert.equal(isAdyenPaymentSuccess(""), false);

console.log("shop-gift-card-payment.test.ts OK");
