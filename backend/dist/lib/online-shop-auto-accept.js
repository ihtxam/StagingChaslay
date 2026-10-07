"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldAutoAcceptOnlineShopOrder = shouldAutoAcceptOnlineShopOrder;
const delivery_platform_settings_1 = require("@/lib/delivery-platform-settings");
const geo_1 = require("@/lib/geo");
function mapFulfillmentToHoursChannel(fulfillmentChannel) {
    const ch = String(fulfillmentChannel || "takeaway").toLowerCase();
    if (ch === "delivery")
        return "delivery";
    if (ch === "dine_in")
        return "dine_in";
    return "takeaway";
}
/** True when online shop auto-accept is enabled and the order falls within store hours. */
function shouldAutoAcceptOnlineShopOrder(merchant, order) {
    const settings = (0, delivery_platform_settings_1.normalizeDeliveryPlatformSettings)(merchant.deliveryPlatformSettings);
    if (settings.onlineShopAutoAccept !== true)
        return false;
    const channel = mapFulfillmentToHoursChannel(order.fulfillmentChannel);
    const hours = (merchant.storeHours || {});
    const scheduledFor = order.scheduledFor ? new Date(order.scheduledFor) : null;
    if (scheduledFor && !Number.isNaN(scheduledFor.getTime())) {
        return (0, geo_1.isWithinChannelHours)(hours, channel, scheduledFor);
    }
    return (0, geo_1.isChannelOpenNow)(hours, channel).open;
}
//# sourceMappingURL=online-shop-auto-accept.js.map