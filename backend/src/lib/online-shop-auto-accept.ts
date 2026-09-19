import { normalizeDeliveryPlatformSettings } from "@/lib/delivery-platform-settings";
import {
  isChannelOpenNow,
  isWithinChannelHours,
  type StoreHours,
  type StoreHoursChannel,
} from "@/lib/geo";

function mapFulfillmentToHoursChannel(
  fulfillmentChannel: string | null | undefined
): StoreHoursChannel {
  const ch = String(fulfillmentChannel || "takeaway").toLowerCase();
  if (ch === "delivery") return "delivery";
  if (ch === "dine_in") return "dine_in";
  return "takeaway";
}

/** True when online shop auto-accept is enabled and the order falls within store hours. */
export function shouldAutoAcceptOnlineShopOrder(
  merchant: { storeHours?: unknown; deliveryPlatformSettings?: unknown },
  order: { fulfillmentChannel?: string | null; scheduledFor?: Date | string | null }
): boolean {
  const settings = normalizeDeliveryPlatformSettings(merchant.deliveryPlatformSettings);
  if (settings.onlineShopAutoAccept !== true) return false;

  const channel = mapFulfillmentToHoursChannel(order.fulfillmentChannel);
  const hours = (merchant.storeHours || {}) as StoreHours;
  const scheduledFor = order.scheduledFor ? new Date(order.scheduledFor) : null;

  if (scheduledFor && !Number.isNaN(scheduledFor.getTime())) {
    return isWithinChannelHours(hours, channel, scheduledFor);
  }
  return isChannelOpenNow(hours, channel).open;
}
