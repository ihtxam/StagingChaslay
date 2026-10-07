"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGiftCardCheckout = computeGiftCardCheckout;
const money_1 = require("@/lib/money");
function computeGiftCardCheckout(faceAmount, deliveryType, settings) {
    const face = (0, money_1.roundMoney2)(faceAmount);
    const shippingFee = deliveryType === "physical"
        ? (0, money_1.roundMoney2)(Math.max(0, Number(settings.physicalPostFee) || 0))
        : 0;
    let serviceFee = (0, money_1.roundMoney2)(Math.max(0, Number(settings.serviceFeeFlat) || 0));
    const servicePct = Math.max(0, Number(settings.serviceFeePercent) || 0);
    if (servicePct > 0) {
        serviceFee = (0, money_1.roundMoney2)(serviceFee + (face + shippingFee) * (servicePct / 100));
    }
    const subtotal = (0, money_1.roundMoney2)(face + shippingFee + serviceFee);
    let paymentFee = 0;
    if (settings.passCardFeeToCustomer === true) {
        const pct = Math.max(0, Number(settings.cardFeePercent) || 0);
        if (pct > 0) {
            paymentFee = (0, money_1.roundMoney2)(subtotal * (pct / 100));
        }
    }
    const totalCharged = (0, money_1.roundMoney2)(subtotal + paymentFee);
    return { faceAmount: face, shippingFee, serviceFee, paymentFee, totalCharged };
}
//# sourceMappingURL=gift-card-checkout.js.map