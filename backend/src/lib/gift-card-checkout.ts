import { roundMoney2 } from "@/lib/money";
import type { GiftCardSettings } from "@/lib/gift-card-settings";

export type GiftDeliveryType = "digital" | "physical";

export type GiftCardCheckoutBreakdown = {
  faceAmount: number;
  shippingFee: number;
  serviceFee: number;
  paymentFee: number;
  totalCharged: number;
};

export function computeGiftCardCheckout(
  faceAmount: number,
  deliveryType: GiftDeliveryType,
  settings: GiftCardSettings
): GiftCardCheckoutBreakdown {
  const face = roundMoney2(faceAmount);
  const shippingFee =
    deliveryType === "physical"
      ? roundMoney2(Math.max(0, Number(settings.physicalPostFee) || 0))
      : 0;

  let serviceFee = roundMoney2(Math.max(0, Number(settings.serviceFeeFlat) || 0));
  const servicePct = Math.max(0, Number(settings.serviceFeePercent) || 0);
  if (servicePct > 0) {
    serviceFee = roundMoney2(serviceFee + (face + shippingFee) * (servicePct / 100));
  }

  const subtotal = roundMoney2(face + shippingFee + serviceFee);
  let paymentFee = 0;
  if (settings.passCardFeeToCustomer === true) {
    const pct = Math.max(0, Number(settings.cardFeePercent) || 0);
    if (pct > 0) {
      paymentFee = roundMoney2(subtotal * (pct / 100));
    }
  }

  const totalCharged = roundMoney2(subtotal + paymentFee);
  return { faceAmount: face, shippingFee, serviceFee, paymentFee, totalCharged };
}
