import type { FulfillmentChannel } from "@/services/merchant-settings.service";

export type MerchantChannelFlags = {
  pickupEnabled?: boolean | null;
  deliveryEnabled?: boolean | null;
  dineInEnabled?: boolean | null;
};

/** Where a sale originated — shop flags apply only to customer-facing shop orders. */
export type FulfillmentChannelSource = "pos" | "shop";

/** Merchant-level order channel toggles (pickup = takeaway / à emporter). */
export function isMerchantFulfillmentChannelEnabled(
  merchant: MerchantChannelFlags,
  channel: FulfillmentChannel
): boolean {
  if (channel === "delivery") return merchant.deliveryEnabled !== false;
  if (channel === "dine_in") return merchant.dineInEnabled !== false;
  return merchant.pickupEnabled !== false;
}

/**
 * Shop pickup / delivery / dine-in toggles apply to online shop, kiosk, and QR
 * orders. POS and register sales must still complete when those shop channels
 * are turned off (restaurants often sell takeaway/dine-in on the till while
 * the website channels are disabled).
 */
export function isFulfillmentChannelAllowedForSource(
  merchant: MerchantChannelFlags,
  channel: FulfillmentChannel,
  source: FulfillmentChannelSource
): boolean {
  if (source === "pos") return true;
  return isMerchantFulfillmentChannelEnabled(merchant, channel);
}
