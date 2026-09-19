/**
 * Shop Adyen session helpers — run: cd backend && npx tsx src/lib/shop-adyen-session.node-test.ts
 */
import assert from "node:assert/strict";
import {
  applyStoredPaymentOptions,
  applyWebCheckoutSessionOptions,
  buildShopCheckoutSessionAttempts,
  filterStoredShopCards,
  isAdyenStoredCardType,
  normalizeAdyenEcommerceTender,
  shopAdyenShopperReference,
} from "./shop-adyen-session.ts";

const web = applyWebCheckoutSessionOptions({ channel: "Web" }, null);
assert.equal(web.shopperInteraction, "Ecommerce");
assert.deepEqual(web.blockedPaymentMethods, ["twint_pos"]);
assert.equal(web.store, undefined);

const pola = applyWebCheckoutSessionOptions(
  { channel: "Web", blockedPaymentMethods: ["bcmc"] },
  { adyenStoreReference: "PolaCafe_ECOM" }
);
assert.equal(pola.store, "PolaCafe_ECOM");
assert.equal(pola.storeFiltrationMode, "inclusive");
assert.deepEqual(pola.blockedPaymentMethods, ["bcmc", "twint_pos"]);

const guest = applyStoredPaymentOptions({ channel: "Web" }, null);
assert.equal(guest.shopperReference, undefined);
assert.equal(guest.storePaymentMethod, undefined);
assert.equal(guest.recurringProcessingModel, undefined);

const loggedIn = applyStoredPaymentOptions(
  { channel: "Web" },
  {
    shopperReference: shopAdyenShopperReference("merchant-a", "customer-b"),
    shopperEmail: "Ada@Example.com",
    shopperName: { firstName: "Ada", lastName: "Lovelace" },
  }
);
assert.equal(loggedIn.shopperReference, "shop_merchant-a_customer-b");
assert.equal(loggedIn.storePaymentMethod, undefined);
assert.equal(loggedIn.storePaymentMethodMode, "askForConsent");
assert.equal(loggedIn.recurringProcessingModel, undefined);
assert.equal(loggedIn.shopperEmail, "ada@example.com");
assert.deepEqual(loggedIn.shopperName, { firstName: "Ada", lastName: "Lovelace" });

const shopperOnly = applyStoredPaymentOptions(
  { channel: "Web" },
  { shopperReference: "shop_m_c" },
  "shopperOnly"
);
assert.equal(shopperOnly.shopperReference, "shop_m_c");
assert.equal(shopperOnly.storePaymentMethodMode, undefined);

assert.equal(isAdyenStoredCardType("scheme"), true);
assert.equal(isAdyenStoredCardType("twint"), false);
assert.deepEqual(filterStoredShopCards([{ type: "scheme" }, { type: "twint" }]), [{ type: "scheme" }]);
assert.equal(normalizeAdyenEcommerceTender("twint"), "twint");
assert.equal(normalizeAdyenEcommerceTender({ type: "scheme" }), "card");

const storedAttempts = buildShopCheckoutSessionAttempts(
  { channel: "Web", store: "Store1" },
  { shopperReference: "shop_m_c" }
);
assert.equal(storedAttempts[0].stored, true);
assert.equal(storedAttempts[0].payload.shopperReference, "shop_m_c");
assert.equal(storedAttempts[0].payload.storePaymentMethodMode, "askForConsent");
assert.equal(storedAttempts[1]?.stored, true);
assert.equal(storedAttempts[1]?.payload.storePaymentMethodMode, undefined);
assert.equal(storedAttempts.at(-1)?.stored, false);

console.log("shop-adyen-session tests passed");
