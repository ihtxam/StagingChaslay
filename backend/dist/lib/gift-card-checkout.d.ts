import type { GiftCardSettings } from "@/lib/gift-card-settings";
export type GiftDeliveryType = "digital" | "physical";
export type GiftCardCheckoutBreakdown = {
    faceAmount: number;
    shippingFee: number;
    serviceFee: number;
    paymentFee: number;
    totalCharged: number;
};
export declare function computeGiftCardCheckout(faceAmount: number, deliveryType: GiftDeliveryType, settings: GiftCardSettings): GiftCardCheckoutBreakdown;
//# sourceMappingURL=gift-card-checkout.d.ts.map