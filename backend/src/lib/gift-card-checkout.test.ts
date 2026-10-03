import { computeGiftCardCheckout } from "./gift-card-checkout";
import { DEFAULT_GIFT_CARD_SETTINGS } from "./gift-card-settings";

const settings = {
  ...DEFAULT_GIFT_CARD_SETTINGS,
  physicalPostFee: 5,
  serviceFeeFlat: 2,
  passCardFeeToCustomer: true,
  cardFeePercent: 2.5,
};

const digital = computeGiftCardCheckout(50, "digital", settings);
if (digital.faceAmount !== 50 || digital.shippingFee !== 0 || digital.serviceFee !== 2) {
  throw new Error("digital breakdown failed");
}

const physical = computeGiftCardCheckout(50, "physical", settings);
if (physical.shippingFee !== 5 || physical.totalCharged <= 50) {
  throw new Error("physical breakdown failed");
}

console.log("gift-card-checkout.test.ts OK");
