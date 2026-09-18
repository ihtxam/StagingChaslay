/**
 * Adyen checkout env helpers — run: cd backend && npx tsx src/lib/adyen-checkout-env.test.ts
 */
import assert from "node:assert/strict";
import {
  checkoutApiBase,
  environmentFromClientKey,
  isUnprefixedLiveCheckoutHost,
  isValidAdyenClientKey,
  LIVE_CHECKOUT_PREFIX_REQUIRED,
  liveCheckoutApiBase,
  normalizeLiveUrlPrefix,
  PLATFORM_ADYEN_LIVE_URL_PREFIX,
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

assert.equal(isUnprefixedLiveCheckoutHost("https://checkout-live.adyen.com/checkout/v71"), true);
assert.equal(
  isUnprefixedLiveCheckoutHost(
    "https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com/checkout/v71"
  ),
  false
);
assert.equal(normalizeLiveUrlPrefix("https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com"), "1797a841fbb37ca7-Chaslay");
assert.equal(normalizeLiveUrlPrefix("1797a841fbb37ca7-Chaslay"), "1797a841fbb37ca7-Chaslay");

const prevApiBase = process.env.ADYEN_API_BASE;
const prevLive = process.env.ADYEN_API_BASE_LIVE;
const prevPrefix = process.env.ADYEN_LIVE_URL_PREFIX;
const prevPrefixAlt = process.env.ADYEN_LIVE_ENDPOINT_PREFIX;
const prevPlatformPrefix = process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX;
const prevPlatformLive = process.env.PLATFORM_ADYEN_API_BASE_LIVE;
delete process.env.ADYEN_API_BASE;
delete process.env.ADYEN_API_BASE_LIVE;
delete process.env.ADYEN_LIVE_URL_PREFIX;
delete process.env.ADYEN_LIVE_ENDPOINT_PREFIX;
delete process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX;
delete process.env.PLATFORM_ADYEN_API_BASE_LIVE;

assert.equal(testCheckoutApiBase(), "https://checkout-test.adyen.com/v71");
assert.equal(
  liveCheckoutApiBase(),
  `https://${PLATFORM_ADYEN_LIVE_URL_PREFIX}-checkout-live.adyen.com/checkout/v71`,
  "live Checkout uses the Swisspayout/Chaslay prefix when merchants do not enter an endpoint URL"
);
assert.equal(checkoutApiBase("test_xxx"), "https://checkout-test.adyen.com/v71");
assert.equal(
  checkoutApiBase("live_xxx"),
  `https://${PLATFORM_ADYEN_LIVE_URL_PREFIX}-checkout-live.adyen.com/checkout/v71`
);

process.env.ADYEN_API_BASE = "https://checkout-test.adyen.com/v71";
assert.equal(
  checkoutApiBase("live_xxx"),
  `https://${PLATFORM_ADYEN_LIVE_URL_PREFIX}-checkout-live.adyen.com/checkout/v71`,
  "live client key must not reuse ADYEN_API_BASE when it is the test host"
);

process.env.ADYEN_API_BASE_LIVE = "https://checkout-live.adyen.com/checkout/v71";
assert.throws(() => liveCheckoutApiBase(), (err: unknown) => {
  assert.ok(err instanceof Error);
  assert.equal(err.message, LIVE_CHECKOUT_PREFIX_REQUIRED);
  return true;
});
delete process.env.ADYEN_API_BASE_LIVE;

process.env.ADYEN_LIVE_URL_PREFIX = "1797a841fbb37ca7-Chaslay";
assert.equal(
  liveCheckoutApiBase(),
  "https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com/checkout/v71"
);

delete process.env.ADYEN_LIVE_URL_PREFIX;
assert.equal(
  liveCheckoutApiBase("1797a841fbb37ca7-Chaslay"),
  "https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com/checkout/v71",
  "merchant adyenLiveUrlPrefix is used when env prefix is unset"
);

if (prevApiBase === undefined) delete process.env.ADYEN_API_BASE;
else process.env.ADYEN_API_BASE = prevApiBase;
if (prevLive === undefined) delete process.env.ADYEN_API_BASE_LIVE;
else process.env.ADYEN_API_BASE_LIVE = prevLive;
if (prevPrefix === undefined) delete process.env.ADYEN_LIVE_URL_PREFIX;
else process.env.ADYEN_LIVE_URL_PREFIX = prevPrefix;
if (prevPrefixAlt === undefined) delete process.env.ADYEN_LIVE_ENDPOINT_PREFIX;
else process.env.ADYEN_LIVE_ENDPOINT_PREFIX = prevPrefixAlt;
if (prevPlatformPrefix === undefined) delete process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX;
else process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX = prevPlatformPrefix;
if (prevPlatformLive === undefined) delete process.env.PLATFORM_ADYEN_API_BASE_LIVE;
else process.env.PLATFORM_ADYEN_API_BASE_LIVE = prevPlatformLive;

console.log("adyen-checkout-env.test.ts OK");
