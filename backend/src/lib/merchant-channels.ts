import type { FulfillmentChannel } from "@/services/merchant-settings.service";

export type MerchantChannelFlags = {
  pickupEnabled?: boolean | null;
  deliveryEnabled?: boolean | null;
  dineInEnabled?: boolean | null;
};

/** Merchant-level order channel toggles (pickup = takeaway / à emporter). */
export function isMerchantFulfillmentChannelEnabled(
  merchant: MerchantChannelFlags,
  channel: FulfillmentChannel
): boolean {
  if (channel === "delivery") return merchant.deliveryEnabled !== false;
  if (channel === "dine_in") return merchant.dineInEnabled !== false;
  return merchant.pickupEnabled !== false;
}
