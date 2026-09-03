/**
 * Shop URL filtering + delivery mode helpers — run: cd backend && npx tsx src/lib/shop-delivery-mode.test.ts
 */
import assert from "node:assert/strict";
import { isHiddenMerchantShopUrl, filterMerchantShopUrl } from "./shop-public-urls";
import { normalizeDeliveryMode, normalizeZipCode } from "./delivery-match";

assert.equal(isHiddenMerchantShopUrl("https://demo.chaslay.com"), true);
assert.equal(isHiddenMerchantShopUrl("https://demo.chaslay.com/menu"), true);
assert.equal(isHiddenMerchantShopUrl("https://shop.app.chaslay.com/demo/menu"), true);
assert.equal(filterMerchantShopUrl("https://shop.chaslay.com/my-cafe"), "https://shop.chaslay.com/my-cafe");
assert.equal(filterMerchantShopUrl("https://demo.chaslay.com"), null);

assert.equal(normalizeDeliveryMode("zipcode"), "zipcode");
assert.equal(normalizeDeliveryMode("zones"), "zones");
assert.equal(normalizeDeliveryMode("invalid"), "zones");
assert.equal(normalizeZipCode(" 8001 "), "8001");

console.log("shop-delivery-mode.test.ts: ok");
