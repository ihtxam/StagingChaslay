/**
 * Merchant Adyen Checkout env helpers — run: npx tsx backend/src/lib/adyen-checkout-env.test.ts
 */
import assert from "node:assert/strict";
import {
  adyenCheckoutApiBase,
  adyenEnvironmentFromClientKey,
  formatMerchantAdyenSessionError,
} from "./adyen-checkout-env";

assert.equal(adyenEnvironmentFromClientKey("test_abc"), "test");
assert.equal(adyenEnvironmentFromClientKey("live_xyz"), "live");
assert.equal(adyenEnvironmentFromClientKey("AQEwrong"), "test");
assert.equal(adyenEnvironmentFromClientKey(null), "test");

assert.equal(adyenCheckoutApiBase("test_abc"), "https://checkout-test.adyen.com/v71");
assert.equal(adyenCheckoutApiBase("live_xyz"), "https://checkout-live.adyen.com/v71");

const unauthorized = formatMerchantAdyenSessionError({
  response: { status: 401, data: { message: "HTTP Status Response - Unauthorized" } },
});
assert.match(unauthorized, /Settings → Payments/);
assert.doesNotMatch(unauthorized, /Superadmin/);

const forbidden = formatMerchantAdyenSessionError({
  response: { status: 403, data: { message: "Not allowed" } },
});
assert.match(forbidden, /permission denied/i);

const adyenMsg = formatMerchantAdyenSessionError({
  response: { status: 422, data: { message: "Invalid merchant account" } },
});
assert.equal(adyenMsg, "Invalid merchant account");

console.log("adyen-checkout-env.test.ts: ok");
