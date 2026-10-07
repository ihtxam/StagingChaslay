"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shop_adyen_session_1 = require("./shop-adyen-session");
(0, vitest_1.describe)("applyWebCheckoutSessionOptions", () => {
    (0, vitest_1.it)("sets ecommerce shopper interaction and blocks POS TWINT", () => {
        const out = (0, shop_adyen_session_1.applyWebCheckoutSessionOptions)({ channel: "Web" }, null);
        (0, vitest_1.expect)(out.shopperInteraction).toBe("Ecommerce");
        (0, vitest_1.expect)(out.store).toBeUndefined();
        (0, vitest_1.expect)(out.blockedPaymentMethods).toEqual([shop_adyen_session_1.TWINT_POS_PAYMENT_METHOD]);
    });
    (0, vitest_1.it)("filters payment methods to the merchant store when configured", () => {
        const out = (0, shop_adyen_session_1.applyWebCheckoutSessionOptions)({ channel: "Web" }, { adyenStoreReference: "PolaCafe_ECOM" });
        (0, vitest_1.expect)(out.store).toBe("PolaCafe_ECOM");
        (0, vitest_1.expect)(out.storeFiltrationMode).toBe("inclusive");
        (0, vitest_1.expect)(out.shopperInteraction).toBe("Ecommerce");
        (0, vitest_1.expect)(out.blockedPaymentMethods).toEqual(["twint_pos"]);
    });
    (0, vitest_1.it)("keeps existing blocked methods and still includes twint_pos", () => {
        const out = (0, shop_adyen_session_1.applyWebCheckoutSessionOptions)({ channel: "Web", blockedPaymentMethods: ["bcmc"] }, null);
        (0, vitest_1.expect)(out.blockedPaymentMethods).toEqual(["bcmc", "twint_pos"]);
    });
});
(0, vitest_1.describe)("applyStoredPaymentOptions", () => {
    (0, vitest_1.it)("does not force save for guests", () => {
        const out = (0, shop_adyen_session_1.applyStoredPaymentOptions)({ channel: "Web" }, null);
        (0, vitest_1.expect)(out.shopperReference).toBeUndefined();
        (0, vitest_1.expect)(out.storePaymentMethod).toBeUndefined();
        (0, vitest_1.expect)(out.recurringProcessingModel).toBeUndefined();
    });
    (0, vitest_1.it)("asks to save the card for a logged-in shopper without forcing Recurring", () => {
        const out = (0, shop_adyen_session_1.applyStoredPaymentOptions)({ channel: "Web" }, {
            shopperReference: (0, shop_adyen_session_1.shopAdyenShopperReference)("m1", "c1"),
            shopperEmail: "ada@example.com",
            shopperName: { firstName: "Ada", lastName: "Lovelace" },
        });
        (0, vitest_1.expect)(out.shopperReference).toBe("shop_m1_c1");
        (0, vitest_1.expect)(out.storePaymentMethod).toBeUndefined();
        (0, vitest_1.expect)(out.storePaymentMethodMode).toBe("askForConsent");
        (0, vitest_1.expect)(out.recurringProcessingModel).toBeUndefined();
        (0, vitest_1.expect)(out.shopperEmail).toBe("ada@example.com");
        (0, vitest_1.expect)(out.shopperName).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    });
    (0, vitest_1.it)("can attach shopperReference without storePaymentMethodMode", () => {
        const out = (0, shop_adyen_session_1.applyStoredPaymentOptions)({ channel: "Web" }, { shopperReference: "shop_m1_c1" }, "shopperOnly");
        (0, vitest_1.expect)(out.shopperReference).toBe("shop_m1_c1");
        (0, vitest_1.expect)(out.storePaymentMethodMode).toBeUndefined();
    });
});
(0, vitest_1.describe)("buildShopCheckoutSessionAttempts", () => {
    (0, vitest_1.it)("tries stored sessions before guest and keeps shopperReference until last stored variant", () => {
        const attempts = (0, shop_adyen_session_1.buildShopCheckoutSessionAttempts)({ channel: "Web", store: "Store1" }, { shopperReference: "shop_m_c" });
        (0, vitest_1.expect)(attempts[0]?.stored).toBe(true);
        (0, vitest_1.expect)(attempts[0]?.payload.shopperReference).toBe("shop_m_c");
        (0, vitest_1.expect)(attempts[0]?.payload.storePaymentMethodMode).toBe("askForConsent");
        (0, vitest_1.expect)(attempts[1]?.stored).toBe(true);
        (0, vitest_1.expect)(attempts[1]?.payload.shopperReference).toBe("shop_m_c");
        (0, vitest_1.expect)(attempts[1]?.payload.storePaymentMethodMode).toBeUndefined();
        (0, vitest_1.expect)(attempts.some((a) => !a.stored)).toBe(true);
        (0, vitest_1.expect)(attempts.at(-1)?.stored).toBe(false);
    });
});
(0, vitest_1.describe)("stored Adyen methods", () => {
    (0, vitest_1.it)("treats scheme cards as storable and TWINT as not", () => {
        (0, vitest_1.expect)((0, shop_adyen_session_1.isAdyenStoredCardType)("scheme")).toBe(true);
        (0, vitest_1.expect)((0, shop_adyen_session_1.isAdyenStoredCardType)({ type: "visa" })).toBe(true);
        (0, vitest_1.expect)((0, shop_adyen_session_1.isAdyenStoredCardType)("twint")).toBe(false);
        (0, vitest_1.expect)((0, shop_adyen_session_1.isAdyenStoredCardType)({ type: "twint" })).toBe(false);
        (0, vitest_1.expect)((0, shop_adyen_session_1.isAdyenStoredCardType)("twint_pos")).toBe(false);
    });
    (0, vitest_1.it)("filters stored payment methods to cards only", () => {
        const kept = (0, shop_adyen_session_1.filterStoredShopCards)([
            { type: "scheme", brand: "visa" },
            { type: "twint" },
            { type: "paypal" },
        ]);
        (0, vitest_1.expect)(kept).toEqual([{ type: "scheme", brand: "visa" }]);
    });
    (0, vitest_1.it)("maps Adyen ecommerce tenders for alerts", () => {
        (0, vitest_1.expect)((0, shop_adyen_session_1.normalizeAdyenEcommerceTender)("twint")).toBe("twint");
        (0, vitest_1.expect)((0, shop_adyen_session_1.normalizeAdyenEcommerceTender)({ type: "scheme" })).toBe("card");
        (0, vitest_1.expect)((0, shop_adyen_session_1.normalizeAdyenEcommerceTender)({ type: "visa" })).toBe("card");
    });
});
//# sourceMappingURL=shop-adyen-session.test.js.map