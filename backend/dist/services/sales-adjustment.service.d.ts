export type SalesAdjustmentPreview = {
    monthKey: string;
    targetPercent: number;
    currentCashTotal: number;
    targetCashTotal: number;
    reductionNeeded: number;
    eligibleOrderCount: number;
    adjustableItemCount: number;
};
export type SalesAdjustmentResult = {
    monthKey: string;
    targetPercent: number;
    beforeCashTotal: number;
    afterCashTotal: number;
    reductionApplied: number;
    ordersAdjusted: number;
    itemsAdjusted: number;
};
/** True when the order was paid entirely in cash (card/terminal/gift portions excluded). */
export declare function isCashOnlyOrder(order: {
    paymentMethod?: string | null;
    paymentBreakdown?: unknown;
    total: unknown;
    refundAmount?: unknown | null;
}): boolean;
export declare class SalesAdjustmentService {
    static allowedPercents(): readonly number[];
    static preview(merchantId: string, targetPercent: number, monthKey?: string): Promise<SalesAdjustmentPreview>;
    static apply(merchantId: string, targetPercent: number, monthKey?: string): Promise<SalesAdjustmentResult>;
    private static loadEligibleOrders;
}
//# sourceMappingURL=sales-adjustment.service.d.ts.map