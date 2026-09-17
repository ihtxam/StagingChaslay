/**
 * Adyen checkout env helpers — run: cd backend && npx tsx src/lib/adyen-checkout-env.test.ts
 */
import assert from "node:assert/strict";
import {
  checkoutApiBase,
  environmentFromClientKey,
  isValidAdyenClientKey,
  liveCheckoutApiBase,
  shopAdyenCardReady,
  testCheckoutApiBase,
} from "./adyen-checkout-env.ts";

assert.equal(isValidAdyenClientKey("test_ABC123"), true);
assert.equal(isValidAdyenClientKey("live_XYZ"), true);
assert.equal(isValidAdyenClientKey("AQE1234567890"), false);
assert.equal(isValidAdyenClientKey(null), false);
assert.equal(isValidAdyenClientKey("client-uuid"), false);

assert.equal(environmentFromClientKey("live_abc"), "live");
assert.equal(environmentFromClientKey("test_abc"), "test");
assert.equal(environmentFromClientKey("AQEwrong"), "test");

assert.equal(
  shopAdyenCardReady({
    adyenMerchantAccount: "MyAccount",
    adyenApiKey: "AQEabc",
    adyenClientId: "test_client",
  }),
  true
);
assert.equal(
  shopAdyenCardReady({
    adyenMerchantAccount: "MyAccount",
    adyenApiKey: "AQEabc",
    adyenClientId: "AQEwrong",
  }),
  false
);

const prevApiBase = process.env.ADYEN_API_BASE;
const prevLive = process.env.ADYEN_API_BASE_LIVE;
const prevPrefix = process.env.ADYEN_LIVE_URL_PREFIX;
delete process.env.ADYEN_API_BASE;
delete process.env.ADYEN_API_BASE_LIVE;
delete process.env.ADYEN_LIVE_URL_PREFIX;

assert.equal(testCheckoutApiBase(), "https://checkout-test.adyen.com/v71");
assert.equal(liveCheckoutApiBase(), "https://checkout-live.adyen.com/checkout/v71");
assert.equal(checkoutApiBase("test_xxx"), "https://checkout-test.adyen.com/v71");
assert.equal(checkoutApiBase("live_xxx"), "https://checkout-live.adyen.com/checkout/v71");

process.env.ADYEN_API_BASE = "https://checkout-test.adyen.com/v71";
assert.equal(
  checkoutApiBase("live_xxx"),
  "https://checkout-live.adyen.com/checkout/v71",
  "live client key must not reuse ADYEN_API_BASE when it is the test host"
);

process.env.ADYEN_LIVE_URL_PREFIX = "1797a841fbb37ca7-Chaslay";
assert.equal(
  liveCheckoutApiBase(),
  "https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com/checkout/v71"
);

if (prevApiBase === undefined) delete process.env.ADYEN_API_BASE;
else process.env.ADYEN_API_BASE = prevApiBase;
if (prevLive === undefined) delete process.env.ADYEN_API_BASE_LIVE;
else process.env.ADYEN_API_BASE_LIVE = prevLive;
if (prevPrefix === undefined) delete process.env.ADYEN_LIVE_URL_PREFIX;
else process.env.ADYEN_LIVE_URL_PREFIX = prevPrefix;

console.log("adyen-checkout-env.test.ts OK");
