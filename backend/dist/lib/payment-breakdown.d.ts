export type PaymentTender = {
    method: string;
    amount: number;
};
/** Canonical report buckets. Mixed stays its own slice (not split into cash+card). */
export declare const CANONICAL_PAYMENT_METHODS: readonly ["cash", "card", "terminal", "mixed", "gift_card", "invoice", "pay_later", "bank_transfer"];
/** Fold case, diacritics, spaces, and known aliases into one report key. */
export declare function normalizePaymentMethod(method: string): string;
export declare function paymentMethodLabelEn(method: string): string;
/** Parse stored payment_breakdown JSON or legacy single paymentMethod. */
export declare function parsePaymentBreakdown(raw: unknown, paymentMethod?: string | null, orderTotal?: number): PaymentTender[];
export declare function paymentBreakdownTotals(tenders: PaymentTender[]): {
    giftCard: number;
    cash: number;
    terminal: number;
    other: number;
};
/** Gift-first cumulative allocation for refunds (partial + full). */
export declare function allocateRefundGiftFirst(cumulativeRefund: number, tenders: PaymentTender[]): {
    giftCard: number;
    cash: number;
    terminal: number;
    other: number;
};
export declare function refundDeltaGiftFirst(alreadyRefunded: number, newRefundAmount: number, tenders: PaymentTender[]): {
    giftCard: number;
    cash: number;
    terminal: number;
    other: number;
};
export declare function resolveSalePaymentMethod(tenders: PaymentTender[], fallback: string): string;
export declare function hasTerminalPortion(tenders: PaymentTender[]): boolean;
/** Cumulative refund amount allocated to each canonical payment bucket (gift-first). */
export declare function refundBucketsFromCumulative(refundAmount: number, rawBreakdown: unknown, paymentMethod?: string | null, orderTotal?: number): Map<string, number>;
/** Net collected per canonical bucket after cumulative refunds (Mixed stays one slice). */
export declare function netPaymentBucketsAfterRefund(orderTotal: number, refundAmount: number, rawBreakdown: unknown, paymentMethod?: string | null): Map<string, number>;
/** Taxable net sales for one paid ticket (excl. tips, after refunds). */
export declare function netTaxableSale(total: number, tipAmount: number, refundAmount: number): number;
//# sourceMappingURL=payment-breakdown.d.ts.map