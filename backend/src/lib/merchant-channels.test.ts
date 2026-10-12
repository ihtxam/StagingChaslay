import { describe, expect, it } from "vitest";
import {
  isFulfillmentChannelAllowedForSource,
  isMerchantFulfillmentChannelEnabled,
} from "./merchant-channels";

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

  it("does not block POS/register sales when shop channels are disabled", () => {
    const merchant = {
      pickupEnabled: false,
      deliveryEnabled: false,
      dineInEnabled: false,
    };
    expect(isFulfillmentChannelAllowedForSource(merchant, "takeaway", "pos")).toBe(true);
    expect(isFulfillmentChannelAllowedForSource(merchant, "dine_in", "pos")).toBe(true);
    expect(isFulfillmentChannelAllowedForSource(merchant, "delivery", "pos")).toBe(true);
  });

  it("still blocks shop orders when the channel is disabled", () => {
    const merchant = {
      pickupEnabled: false,
      deliveryEnabled: false,
      dineInEnabled: true,
    };
    expect(isFulfillmentChannelAllowedForSource(merchant, "takeaway", "shop")).toBe(false);
    expect(isFulfillmentChannelAllowedForSource(merchant, "delivery", "shop")).toBe(false);
    expect(isFulfillmentChannelAllowedForSource(merchant, "dine_in", "shop")).toBe(true);
  });
});
