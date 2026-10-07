"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gift_card_checkout_1 = require("./gift-card-checkout");
const gift_card_settings_1 = require("./gift-card-settings");
const settings = {
    ...gift_card_settings_1.DEFAULT_GIFT_CARD_SETTINGS,
    physicalPostFee: 5,
    serviceFeeFlat: 2,
    passCardFeeToCustomer: true,
    cardFeePercent: 2.5,
};
const digital = (0, gift_card_checkout_1.computeGiftCardCheckout)(50, "digital", settings);
if (digital.faceAmount !== 50 || digital.shippingFee !== 0 || digital.serviceFee !== 2) {
    throw new Error("digital breakdown failed");
}
const physical = (0, gift_card_checkout_1.computeGiftCardCheckout)(50, "physical", settings);
if (physical.shippingFee !== 5 || physical.totalCharged <= 50) {
    throw new Error("physical breakdown failed");
}
console.log("gift-card-checkout.test.ts OK");
//# sourceMappingURL=gift-card-checkout.test.js.map