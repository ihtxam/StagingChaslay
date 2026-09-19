import { describe, expect, it } from "vitest";
import {
  applyStoredPaymentOptions,
  applyWebCheckoutSessionOptions,
  buildShopCheckoutSessionAttempts,
  filterStoredShopCards,
  isAdyenStoredCardType,
  normalizeAdyenEcommerceTender,
  shopAdyenShopperReference,
  TWINT_POS_PAYMENT_METHOD,
} from "./shop-adyen-session";

describe("applyWebCheckoutSessionOptions", () => {
  it("sets ecommerce shopper interaction and blocks POS TWINT", () => {
    const out = applyWebCheckoutSessionOptions({ channel: "Web" }, null);
    expect(out.shopperInteraction).toBe("Ecommerce");
    expect(out.store).toBeUndefined();
    expect(out.blockedPaymentMethods).toEqual([TWINT_POS_PAYMENT_METHOD]);
  });

  it("filters payment methods to the merchant store when configured", () => {
    const out = applyWebCheckoutSessionOptions(
      { channel: "Web" },
      { adyenStoreReference: "PolaCafe_ECOM" }
    );
    expect(out.store).toBe("PolaCafe_ECOM");
    expect(out.storeFiltrationMode).toBe("inclusive");
    expect(out.shopperInteraction).toBe("Ecommerce");
    expect(out.blockedPaymentMethods).toEqual(["twint_pos"]);
  });

  it("keeps existing blocked methods and still includes twint_pos", () => {
    const out = applyWebCheckoutSessionOptions(
      { channel: "Web", blockedPaymentMethods: ["bcmc"] },
      null
    );
    expect(out.blockedPaymentMethods).toEqual(["bcmc", "twint_pos"]);
  });
});

describe("applyStoredPaymentOptions", () => {
  it("does not force save for guests", () => {
    const out = applyStoredPaymentOptions({ channel: "Web" }, null);
    expect(out.shopperReference).toBeUndefined();
    expect(out.storePaymentMethod).toBeUndefined();
    expect(out.recurringProcessingModel).toBeUndefined();
  });

  it("asks to save the card for a logged-in shopper without forcing Recurring", () => {
    const out = applyStoredPaymentOptions(
      { channel: "Web" },
      {
        shopperReference: shopAdyenShopperReference("m1", "c1"),
        shopperEmail: "ada@example.com",
        shopperName: { firstName: "Ada", lastName: "Lovelace" },
      }
    );
    expect(out.shopperReference).toBe("shop_m1_c1");
    expect(out.storePaymentMethod).toBeUndefined();
    expect(out.storePaymentMethodMode).toBe("askForConsent");
    expect(out.recurringProcessingModel).toBeUndefined();
    expect(out.shopperEmail).toBe("ada@example.com");
    expect(out.shopperName).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });

  it("can attach shopperReference without storePaymentMethodMode", () => {
    const out = applyStoredPaymentOptions(
      { channel: "Web" },
      { shopperReference: "shop_m1_c1" },
      "shopperOnly"
    );
    expect(out.shopperReference).toBe("shop_m1_c1");
    expect(out.storePaymentMethodMode).toBeUndefined();
  });
});

describe("buildShopCheckoutSessionAttempts", () => {
  it("tries stored sessions before guest and keeps shopperReference until last stored variant", () => {
    const attempts = buildShopCheckoutSessionAttempts(
      { channel: "Web", store: "Store1" },
      { shopperReference: "shop_m_c" }
    );
    expect(attempts[0]?.stored).toBe(true);
    expect(attempts[0]?.payload.shopperReference).toBe("shop_m_c");
    expect(attempts[0]?.payload.storePaymentMethodMode).toBe("askForConsent");
    expect(attempts[1]?.stored).toBe(true);
    expect(attempts[1]?.payload.shopperReference).toBe("shop_m_c");
    expect(attempts[1]?.payload.storePaymentMethodMode).toBeUndefined();
    expect(attempts.some((a) => !a.stored)).toBe(true);
    expect(attempts.at(-1)?.stored).toBe(false);
  });
});

describe("stored Adyen methods", () => {
  it("treats scheme cards as storable and TWINT as not", () => {
    expect(isAdyenStoredCardType("scheme")).toBe(true);
    expect(isAdyenStoredCardType({ type: "visa" })).toBe(true);
    expect(isAdyenStoredCardType("twint")).toBe(false);
    expect(isAdyenStoredCardType({ type: "twint" })).toBe(false);
    expect(isAdyenStoredCardType("twint_pos")).toBe(false);
  });

  it("filters stored payment methods to cards only", () => {
    const kept = filterStoredShopCards([
      { type: "scheme", brand: "visa" },
      { type: "twint" },
      { type: "paypal" },
    ]);
    expect(kept).toEqual([{ type: "scheme", brand: "visa" }]);
  });

  it("maps Adyen ecommerce tenders for alerts", () => {
    expect(normalizeAdyenEcommerceTender("twint")).toBe("twint");
    expect(normalizeAdyenEcommerceTender({ type: "scheme" })).toBe("card");
    expect(normalizeAdyenEcommerceTender({ type: "visa" })).toBe("card");
  });
});
