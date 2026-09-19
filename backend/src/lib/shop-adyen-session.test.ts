import { describe, expect, it } from "vitest";
import { applyWebCheckoutSessionOptions } from "./shop-adyen-session";

describe("applyWebCheckoutSessionOptions", () => {
  it("sets ecommerce shopper interaction", () => {
    const out = applyWebCheckoutSessionOptions({ channel: "Web" }, null);
    expect(out.shopperInteraction).toBe("Ecommerce");
    expect(out.store).toBeUndefined();
  });

  it("filters payment methods to the merchant store when configured", () => {
    const out = applyWebCheckoutSessionOptions(
      { channel: "Web" },
      { adyenStoreReference: "PolaCafe_ECOM" }
    );
    expect(out.store).toBe("PolaCafe_ECOM");
    expect(out.storeFiltrationMode).toBe("exclusive");
    expect(out.shopperInteraction).toBe("Ecommerce");
  });
});
