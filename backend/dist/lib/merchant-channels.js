"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMerchantFulfillmentChannelEnabled = isMerchantFulfillmentChannelEnabled;
/** Merchant-level order channel toggles (pickup = takeaway / à emporter). */
function isMerchantFulfillmentChannelEnabled(merchant, channel) {
    if (channel === "delivery")
        return merchant.deliveryEnabled !== false;
    if (channel === "dine_in")
        return merchant.dineInEnabled !== false;
    return merchant.pickupEnabled !== false;
}
//# sourceMappingURL=merchant-channels.js.map