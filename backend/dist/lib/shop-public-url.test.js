"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Shop public payment URLs — run: cd backend && npx tsx src/lib/shop-public-url.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const brand_ts_1 = require("./brand.ts");
const shop_public_url_ts_1 = require("./shop-public-url.ts");
const shopHost = (0, brand_ts_1.resolveShopPublicHost)();
strict_1.default.equal((0, shop_public_url_ts_1.isValidAdyenClientKey)("test_ABC123"), true);
strict_1.default.equal((0, shop_public_url_ts_1.shopAdyenCardReady)({
    adyenMerchantAccount: "MyAccount",
    adyenApiKey: "AQEabc",
    adyenClientId: "test_client",
}), true);
strict_1.default.equal((0, shop_public_url_ts_1.shopPublicBaseUrl)({ slug: "demo", subdomain: null, customDomain: "www.cliavo.com" }), "https://www.cliavo.com");
const merchant = { slug: "demo", subdomain: null, customDomain: null };
strict_1.default.equal((0, shop_public_url_ts_1.shopOrderPaymentReturnUrl)(merchant, "ord-1"), `https://${shopHost}/demo/order/ord-1?paid=1`);
strict_1.default.equal((0, shop_public_url_ts_1.shopOrderPaymentReturnUrl)({ slug: "demo", subdomain: null, customDomain: "www.cliavo.com" }, "ord-1"), "https://www.cliavo.com/order/ord-1?paid=1");
strict_1.default.equal((0, shop_public_url_ts_1.resolveShopCheckoutOrigin)(merchant, `https://${shopHost}`), `https://${shopHost}`);
strict_1.default.equal((0, shop_public_url_ts_1.resolveShopCheckoutOrigin)(merchant, "https://evil.example/phish"), `https://${shopHost}`);
strict_1.default.equal((0, shop_public_url_ts_1.resolveShopCheckoutOrigin)({ slug: "demo", subdomain: null, customDomain: "www.cliavo.com" }, "https://www.cliavo.com"), "https://www.cliavo.com");
strict_1.default.equal((0, shop_public_url_ts_1.sanitizeShopPathPrefix)("/shop/demo", merchant), "/shop/demo");
strict_1.default.equal((0, shop_public_url_ts_1.sanitizeShopPathPrefix)("/demo/l/centre", merchant), "/demo/l/centre");
strict_1.default.equal((0, shop_public_url_ts_1.sanitizeShopPathPrefix)("/not-this-shop", merchant), null);
strict_1.default.equal((0, shop_public_url_ts_1.sanitizeShopPathPrefix)("", merchant), "");
strict_1.default.equal((0, shop_public_url_ts_1.shopPathPrefixForOrigin)(merchant, "https://app.chaslay.com"), "/shop/demo");
strict_1.default.equal((0, shop_public_url_ts_1.shopPathPrefixForOrigin)(merchant, `https://${shopHost}`), "/demo");
strict_1.default.equal((0, shop_public_url_ts_1.shopPathPrefixForOrigin)({ slug: "demo", subdomain: null, customDomain: "www.cliavo.com" }, "https://www.cliavo.com"), "");
strict_1.default.equal((0, shop_public_url_ts_1.shopOrderPaymentReturnUrl)(merchant, "ord-9", {
    origin: "https://app.chaslay.com",
    shopPath: "/shop/demo",
}), "https://app.chaslay.com/shop/demo/order/ord-9?paid=1");
strict_1.default.equal((0, shop_public_url_ts_1.shopGiftCardPaymentReturnUrl)(merchant, "gc-1", {
    origin: "https://shop.chaslay.com",
    shopPath: "/demo",
}), "https://shop.chaslay.com/demo/gift-cards/confirm/gc-1?paid=1");
strict_1.default.match((0, shop_public_url_ts_1.shopTablePaymentReturnUrl)(merchant, "t1", { sessionToken: "abc" }), /\/table\/t1\?paid=1&s=abc$/);
console.log("shop-public-url.test.ts OK");
//# sourceMappingURL=shop-public-url.test.js.map