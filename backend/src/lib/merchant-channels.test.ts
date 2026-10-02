import { describe, expect, it } from "vitest";
import { isMerchantFulfillmentChannelEnabled } from "./merchant-channels";

describe("merchant-channels", () => {
  it("defaults channels to enabled", () => {
    expect(isMerchantFulfillmentChannelEnabled({}, "takeaway")).toBe(true);
    expect(isMerchantFulfillmentChannelEnabled({}, "delivery")).toBe(true);
    expect(isMerchantFulfillmentChannelEnabled({}, "dine_in")).toBe(true);
  });

  it("respects disabled flags", () => {
    expect(
      isMerchantFulfillmentChannelEnabled(
        { pickupEnabled: false, deliveryEnabled: true },
        "takeaway"
      )
    ).toBe(false);
    expect(
      isMerchantFulfillmentChannelEnabled(
        { pickupEnabled: true, deliveryEnabled: false },
        "delivery"
      )
    ).toBe(false);
  });
});
