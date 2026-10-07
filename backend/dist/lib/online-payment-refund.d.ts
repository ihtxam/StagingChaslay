/**
 * Detect Adyen Checkout (shop / e-commerce) payments vs cash / POS terminal.
 * Paid-online card/TWINT must be refunded through Checkout, not Terminal API.
 */
export type OnlinePaymentOrderLike = {
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    orderType?: string | null;
    orderSource?: string | null;
    adyenReference?: string | null;
    adyenPoiTransactionTs?: Date | string | null;
    refundAmount?: string | number | null;
    total?: string | number | null;
};
/** True when the order was collected via Adyen Checkout (card/TWINT/etc.), not cash or POS terminal. */
export declare function isPaidOnlineEcommerce(order: OnlinePaymentOrderLike | null | undefined): boolean;
export declare function remainingRefundableAmount(order: OnlinePaymentOrderLike): number;
export declare function isUsableAdyenPspReference(raw: unknown): boolean;
export declare function onlineCancelPaymentPatch(refund: {
    refunded: boolean;
    amount: number;
}): Record<string, unknown>;
//# sourceMappingURL=online-payment-refund.d.ts.map