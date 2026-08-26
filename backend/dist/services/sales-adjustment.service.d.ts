export type SalesAdjustmentPeriodPreset = "today" | "last_week" | "this_month" | "last_month" | "custom";
export type SalesAdjustmentPreview = {
    periodLabel: string;
    from: string;
    to: string;
    targetPercent: number;
    /** Cash the reports show for this period (all payment buckets). */
    reportCashTotal: number;
    /** Cash on orders this tool can adjust (100% cash, no card/terminal/gift). */
    currentCashTotal: number;
    targetCashTotal: number;
    reductionNeeded: number;
    eligibleOrderCount: number;
    adjustableItemCount: number;
    /** @deprecated use periodLabel */
    monthKey?: string;
};
export type SalesAdjustmentResult = {
    periodLabel: string;
    from: string;
    to: string;
    targetPercent: number;
    beforeCashTotal: number;
    afterCashTotal: number;
    reductionApplied: number;
    ordersAdjusted: number;
    itemsAdjusted: number;
    /** @deprecated use periodLabel */
    monthKey?: string;
};
export declare function resolveSalesAdjustmentRange(opts: {
    preset?: string;
    from?: string;
    to?: string;
    month?: string;
}): {
    start: Date;
    end: Date;
    from: string;
    to: string;
    label: string;
};
/** Net cash collected on this order (matches report payment buckets). */
export declare function orderCashNet(order: {
    paymentMethod?: string | null;
    paymentBreakdown?: unknown;
    total: unknown;
    refundAmount?: unknown | null;
}): number;
/** Completed POS sale paid in full — excludes open tickets, pay later, and invoices. */
export declare function isCompletedPaidCashAdjustmentOrder(order: {
    status?: string | null;
    paymentStatus?: string | null;
    paymentMethod?: string | null;
    paymentBreakdown?: unknown;
    invoiceNumber?: string | null;
    total: unknown;
}): boolean;
/** True when the order was paid entirely in cash (card/terminal/gift portions excluded). */
export declare function isCashOnlyOrder(order: {
    paymentMethod?: string | null;
    paymentBreakdown?: unknown;
    total: unknown;
    refundAmount?: unknown | null;
}): boolean;
export declare class SalesAdjustmentService {
    static allowedPercents(): readonly number[];
    static preview(merchantId: string, targetPercent: number, rangeOpts?: {
        preset?: string;
        from?: string;
        to?: string;
        month?: string;
    }): Promise<SalesAdjustmentPreview>;
    static apply(merchantId: string, targetPercent: number, rangeOpts?: {
        preset?: string;
        from?: string;
        to?: string;
        month?: string;
    }): Promise<SalesAdjustmentResult>;
    private static loadEligibleOrders;
}
//# sourceMappingURL=sales-adjustment.service.d.ts.map