/**
 * Shop public payment URLs — run: cd backend && npx tsx src/lib/shop-public-url.test.ts
 */
import assert from "node:assert/strict";
import { resolveShopPublicHost } from "./brand.ts";
import {
  isValidAdyenClientKey,
  shopAdyenCardReady,
  shopGiftCardPaymentReturnUrl,
  shopOrderPaymentReturnUrl,
  shopPathPrefixForOrigin,
  shopPublicBaseUrl,
  shopTablePaymentReturnUrl,
  resolveShopCheckoutOrigin,
  sanitizeShopPathPrefix,
} from "./shop-public-url.ts";

const shopHost = resolveShopPublicHost();

assert.equal(isValidAdyenClientKey("test_ABC123"), true);
assert.equal(
  shopAdyenCardReady({
    adyenMerchantAccount: "MyAccount",
    adyenApiKey: "AQEabc",
    adyenClientId: "test_client",
  }),
  true
);

assert.equal(
  shopPublicBaseUrl({ slug: "demo", subdomain: null, customDomain: "www.cliavo.com" }),
  "https://www.cliavo.com"
);

const merchant = { slug: "demo", subdomain: null, customDomain: null as string | null };

assert.equal(
  shopOrderPaymentReturnUrl(merchant, "ord-1"),
  `https://${shopHost}/demo/order/ord-1?paid=1`
);

assert.equal(
  shopOrderPaymentReturnUrl(
    { slug: "demo", subdomain: null, customDomain: "www.cliavo.com" },
    "ord-1"
  ),
  "https://www.cliavo.com/order/ord-1?paid=1"
);

assert.equal(
  resolveShopCheckoutOrigin(merchant, `https://${shopHost}`),
  `https://${shopHost}`
);
assert.equal(
  resolveShopCheckoutOrigin(merchant, "https://evil.example/phish"),
  `https://${shopHost}`
);
assert.equal(
  resolveShopCheckoutOrigin(
    { slug: "demo", subdomain: null, customDomain: "www.cliavo.com" },
    "https://www.cliavo.com"
  ),
  "https://www.cliavo.com"
);

assert.equal(sanitizeShopPathPrefix("/shop/demo", merchant), "/shop/demo");
assert.equal(sanitizeShopPathPrefix("/demo/l/centre", merchant), "/demo/l/centre");
assert.equal(sanitizeShopPathPrefix("/not-this-shop", merchant), null);
assert.equal(sanitizeShopPathPrefix("", merchant), "");

assert.equal(shopPathPrefixForOrigin(merchant, "https://app.chaslay.com"), "/shop/demo");
assert.equal(shopPathPrefixForOrigin(merchant, `https://${shopHost}`), "/demo");
assert.equal(
  shopPathPrefixForOrigin(
    { slug: "demo", subdomain: null, customDomain: "www.cliavo.com" },
    "https://www.cliavo.com"
  ),
  ""
);

assert.equal(
  shopOrderPaymentReturnUrl(merchant, "ord-9", {
    origin: "https://app.chaslay.com",
    shopPath: "/shop/demo",
  }),
  "https://app.chaslay.com/shop/demo/order/ord-9?paid=1"
);

assert.equal(
  shopGiftCardPaymentReturnUrl(merchant, "gc-1", {
    origin: "https://shop.chaslay.com",
    shopPath: "/demo",
  }),
  "https://shop.chaslay.com/demo/gift-cards/confirm/gc-1"
);

assert.match(
  shopTablePaymentReturnUrl(merchant, "t1", { sessionToken: "abc" }),
  /\/table\/t1\?paid=1&s=abc$/
);

console.log("shop-public-url.test.ts OK");
