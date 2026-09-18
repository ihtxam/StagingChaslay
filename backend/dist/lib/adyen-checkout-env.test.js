"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Adyen checkout env helpers — run: cd backend && npx tsx src/lib/adyen-checkout-env.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const adyen_checkout_env_ts_1 = require("./adyen-checkout-env.ts");
strict_1.default.equal((0, adyen_checkout_env_ts_1.isValidAdyenClientKey)("test_ABC123"), true);
strict_1.default.equal((0, adyen_checkout_env_ts_1.isValidAdyenClientKey)("live_XYZ"), true);
strict_1.default.equal((0, adyen_checkout_env_ts_1.isValidAdyenClientKey)("AQE1234567890"), false);
strict_1.default.equal((0, adyen_checkout_env_ts_1.isValidAdyenClientKey)(null), false);
strict_1.default.equal((0, adyen_checkout_env_ts_1.isValidAdyenClientKey)("client-uuid"), false);
strict_1.default.equal((0, adyen_checkout_env_ts_1.environmentFromClientKey)("live_abc"), "live");
strict_1.default.equal((0, adyen_checkout_env_ts_1.environmentFromClientKey)("test_abc"), "test");
strict_1.default.equal((0, adyen_checkout_env_ts_1.environmentFromClientKey)("AQEwrong"), "test");
strict_1.default.equal((0, adyen_checkout_env_ts_1.shopAdyenCardReady)({
    adyenMerchantAccount: "MyAccount",
    adyenApiKey: "AQEabc",
    adyenClientId: "test_client",
}), true);
strict_1.default.equal((0, adyen_checkout_env_ts_1.shopAdyenCardReady)({
    adyenMerchantAccount: "MyAccount",
    adyenApiKey: "AQEabc",
    adyenClientId: "AQEwrong",
}), false);
strict_1.default.equal((0, adyen_checkout_env_ts_1.isUnprefixedLiveCheckoutHost)("https://checkout-live.adyen.com/checkout/v71"), true);
strict_1.default.equal((0, adyen_checkout_env_ts_1.isUnprefixedLiveCheckoutHost)("https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com/checkout/v71"), false);
strict_1.default.equal((0, adyen_checkout_env_ts_1.normalizeLiveUrlPrefix)("https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com"), "1797a841fbb37ca7-Chaslay");
strict_1.default.equal((0, adyen_checkout_env_ts_1.normalizeLiveUrlPrefix)("1797a841fbb37ca7-Chaslay"), "1797a841fbb37ca7-Chaslay");
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
strict_1.default.equal((0, adyen_checkout_env_ts_1.testCheckoutApiBase)(), "https://checkout-test.adyen.com/v71");
strict_1.default.throws(() => (0, adyen_checkout_env_ts_1.liveCheckoutApiBase)(), (err) => {
    strict_1.default.ok(err instanceof Error);
    strict_1.default.equal(err.message, adyen_checkout_env_ts_1.LIVE_CHECKOUT_PREFIX_REQUIRED);
    return true;
});
strict_1.default.equal((0, adyen_checkout_env_ts_1.checkoutApiBase)("test_xxx"), "https://checkout-test.adyen.com/v71");
strict_1.default.throws(() => (0, adyen_checkout_env_ts_1.checkoutApiBase)("live_xxx"), (err) => {
    strict_1.default.ok(err instanceof Error);
    strict_1.default.equal(err.message, adyen_checkout_env_ts_1.LIVE_CHECKOUT_PREFIX_REQUIRED);
    return true;
});
process.env.ADYEN_API_BASE = "https://checkout-test.adyen.com/v71";
strict_1.default.throws(() => (0, adyen_checkout_env_ts_1.checkoutApiBase)("live_xxx"), (err) => {
    strict_1.default.ok(err instanceof Error);
    strict_1.default.equal(err.message, adyen_checkout_env_ts_1.LIVE_CHECKOUT_PREFIX_REQUIRED);
    return true;
}, "live client key must not reuse ADYEN_API_BASE when it is the test host, and must not fall back to checkout-live.adyen.com");
process.env.ADYEN_API_BASE_LIVE = "https://checkout-live.adyen.com/checkout/v71";
strict_1.default.throws(() => (0, adyen_checkout_env_ts_1.liveCheckoutApiBase)(), (err) => {
    strict_1.default.ok(err instanceof Error);
    strict_1.default.equal(err.message, adyen_checkout_env_ts_1.LIVE_CHECKOUT_PREFIX_REQUIRED);
    return true;
});
delete process.env.ADYEN_API_BASE_LIVE;
process.env.ADYEN_LIVE_URL_PREFIX = "1797a841fbb37ca7-Chaslay";
strict_1.default.equal((0, adyen_checkout_env_ts_1.liveCheckoutApiBase)(), "https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com/checkout/v71");
delete process.env.ADYEN_LIVE_URL_PREFIX;
strict_1.default.equal((0, adyen_checkout_env_ts_1.liveCheckoutApiBase)("1797a841fbb37ca7-Chaslay"), "https://1797a841fbb37ca7-Chaslay-checkout-live.adyen.com/checkout/v71", "merchant adyenLiveUrlPrefix is used when env prefix is unset");
if (prevApiBase === undefined)
    delete process.env.ADYEN_API_BASE;
else
    process.env.ADYEN_API_BASE = prevApiBase;
if (prevLive === undefined)
    delete process.env.ADYEN_API_BASE_LIVE;
else
    process.env.ADYEN_API_BASE_LIVE = prevLive;
if (prevPrefix === undefined)
    delete process.env.ADYEN_LIVE_URL_PREFIX;
else
    process.env.ADYEN_LIVE_URL_PREFIX = prevPrefix;
if (prevPrefixAlt === undefined)
    delete process.env.ADYEN_LIVE_ENDPOINT_PREFIX;
else
    process.env.ADYEN_LIVE_ENDPOINT_PREFIX = prevPrefixAlt;
if (prevPlatformPrefix === undefined)
    delete process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX;
else
    process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX = prevPlatformPrefix;
if (prevPlatformLive === undefined)
    delete process.env.PLATFORM_ADYEN_API_BASE_LIVE;
else
    process.env.PLATFORM_ADYEN_API_BASE_LIVE = prevPlatformLive;
console.log("adyen-checkout-env.test.ts OK");
//# sourceMappingURL=adyen-checkout-env.test.js.map