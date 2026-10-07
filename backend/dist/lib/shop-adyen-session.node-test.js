"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Shop Adyen session helpers — run: cd backend && npx tsx src/lib/shop-adyen-session.node-test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const shop_adyen_session_ts_1 = require("./shop-adyen-session.ts");
const web = (0, shop_adyen_session_ts_1.applyWebCheckoutSessionOptions)({ channel: "Web" }, null);
strict_1.default.equal(web.shopperInteraction, "Ecommerce");
strict_1.default.deepEqual(web.blockedPaymentMethods, ["twint_pos"]);
strict_1.default.equal(web.store, undefined);
const pola = (0, shop_adyen_session_ts_1.applyWebCheckoutSessionOptions)({ channel: "Web", blockedPaymentMethods: ["bcmc"] }, { adyenStoreReference: "PolaCafe_ECOM" });
strict_1.default.equal(pola.store, "PolaCafe_ECOM");
strict_1.default.equal(pola.storeFiltrationMode, "inclusive");
strict_1.default.deepEqual(pola.blockedPaymentMethods, ["bcmc", "twint_pos"]);
const guest = (0, shop_adyen_session_ts_1.applyStoredPaymentOptions)({ channel: "Web" }, null);
strict_1.default.equal(guest.shopperReference, undefined);
strict_1.default.equal(guest.storePaymentMethod, undefined);
strict_1.default.equal(guest.recurringProcessingModel, undefined);
const loggedIn = (0, shop_adyen_session_ts_1.applyStoredPaymentOptions)({ channel: "Web" }, {
    shopperReference: (0, shop_adyen_session_ts_1.shopAdyenShopperReference)("merchant-a", "customer-b"),
    shopperEmail: "Ada@Example.com",
    shopperName: { firstName: "Ada", lastName: "Lovelace" },
});
strict_1.default.equal(loggedIn.shopperReference, "shop_merchant-a_customer-b");
strict_1.default.equal(loggedIn.storePaymentMethod, undefined);
strict_1.default.equal(loggedIn.storePaymentMethodMode, "askForConsent");
strict_1.default.equal(loggedIn.recurringProcessingModel, undefined);
strict_1.default.equal(loggedIn.shopperEmail, "ada@example.com");
strict_1.default.deepEqual(loggedIn.shopperName, { firstName: "Ada", lastName: "Lovelace" });
const shopperOnly = (0, shop_adyen_session_ts_1.applyStoredPaymentOptions)({ channel: "Web" }, { shopperReference: "shop_m_c" }, "shopperOnly");
strict_1.default.equal(shopperOnly.shopperReference, "shop_m_c");
strict_1.default.equal(shopperOnly.storePaymentMethodMode, undefined);
strict_1.default.equal((0, shop_adyen_session_ts_1.isAdyenStoredCardType)("scheme"), true);
strict_1.default.equal((0, shop_adyen_session_ts_1.isAdyenStoredCardType)("twint"), false);
strict_1.default.deepEqual((0, shop_adyen_session_ts_1.filterStoredShopCards)([{ type: "scheme" }, { type: "twint" }]), [{ type: "scheme" }]);
strict_1.default.equal((0, shop_adyen_session_ts_1.normalizeAdyenEcommerceTender)("twint"), "twint");
strict_1.default.equal((0, shop_adyen_session_ts_1.normalizeAdyenEcommerceTender)({ type: "scheme" }), "card");
const storedAttempts = (0, shop_adyen_session_ts_1.buildShopCheckoutSessionAttempts)({ channel: "Web", store: "Store1" }, { shopperReference: "shop_m_c" });
strict_1.default.equal(storedAttempts[0].stored, true);
strict_1.default.equal(storedAttempts[0].payload.shopperReference, "shop_m_c");
strict_1.default.equal(storedAttempts[0].payload.storePaymentMethodMode, "askForConsent");
strict_1.default.equal(storedAttempts[1]?.stored, true);
strict_1.default.equal(storedAttempts[1]?.payload.storePaymentMethodMode, undefined);
strict_1.default.equal(storedAttempts.at(-1)?.stored, false);
console.log("shop-adyen-session tests passed");
//# sourceMappingURL=shop-adyen-session.node-test.js.map