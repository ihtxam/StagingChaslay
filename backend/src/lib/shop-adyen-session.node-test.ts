/**
 * Shop Adyen session helpers — run: cd backend && npx tsx src/lib/shop-adyen-session.test.ts
 * (vitest describe/it also work when a runner is present)
 */
import assert from "node:assert/strict";
import {
  applyStoredPaymentOptions,
  applyWebCheckoutSessionOptions,
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
assert.equal(pola.storeFiltrationMode, "exclusive");
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
assert.equal(loggedIn.storePaymentMethod, true);
assert.equal(loggedIn.storePaymentMethodMode, "enabled");
assert.equal(loggedIn.recurringProcessingModel, "CardOnFile");
assert.equal(loggedIn.shopperEmail, "ada@example.com");
assert.deepEqual(loggedIn.shopperName, { firstName: "Ada", lastName: "Lovelace" });

console.log("shop-adyen-session tests passed");
