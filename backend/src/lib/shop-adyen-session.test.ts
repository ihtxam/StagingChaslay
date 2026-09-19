import { describe, expect, it } from "vitest";
import {
  applyStoredPaymentOptions,
  applyWebCheckoutSessionOptions,
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
    expect(out.storeFiltrationMode).toBe("exclusive");
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

  it("stores CardOnFile for a logged-in shopper", () => {
    const out = applyStoredPaymentOptions(
      { channel: "Web" },
      {
        shopperReference: shopAdyenShopperReference("m1", "c1"),
        shopperEmail: "ada@example.com",
        shopperName: { firstName: "Ada", lastName: "Lovelace" },
      }
    );
    expect(out.shopperReference).toBe("shop_m1_c1");
    expect(out.storePaymentMethod).toBe(true);
    expect(out.storePaymentMethodMode).toBe("enabled");
    expect(out.recurringProcessingModel).toBe("CardOnFile");
    expect(out.shopperEmail).toBe("ada@example.com");
    expect(out.shopperName).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });
});
