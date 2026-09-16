/**
 * Shop public URL + gift-card Adyen helpers — run: npx tsx backend/src/lib/shop-public-url.test.ts
 */
import assert from "node:assert/strict";
import {
  giftCardPurchaseIdFromAdyenReference,
  isValidAdyenClientKey,
  shopAdyenCardReady,
  shopGiftCardPaymentReturnUrl,
  shopPublicBaseUrl,
} from "./shop-public-url";

assert.equal(isValidAdyenClientKey("test_ABC123"), true);
assert.equal(isValidAdyenClientKey("live_XYZ"), true);
assert.equal(isValidAdyenClientKey("AQE1234567890"), false);
assert.equal(isValidAdyenClientKey(null), false);

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

assert.equal(
  shopPublicBaseUrl({ slug: "demo", subdomain: null, customDomain: "www.cliavo.com" }),
  "https://www.cliavo.com"
);

assert.equal(
  shopGiftCardPaymentReturnUrl(
    { slug: "demo", subdomain: null, customDomain: "www.cliavo.com" },
    "ord-1"
  ),
  "https://www.cliavo.com/gift-cards/confirm/ord-1?paid=1"
);

const merchantId = "11111111-1111-4111-8111-111111111111";
const purchaseId = "22222222-2222-4222-8222-222222222222";
assert.equal(
  giftCardPurchaseIdFromAdyenReference(merchantId, `${merchantId}-${purchaseId}`),
  purchaseId
);
assert.equal(giftCardPurchaseIdFromAdyenReference(merchantId, "webpos-ttp-1"), null);
assert.equal(giftCardPurchaseIdFromAdyenReference(merchantId, `${merchantId}-not-a-uuid`), null);

console.log("shop-public-url.test.ts: ok");
