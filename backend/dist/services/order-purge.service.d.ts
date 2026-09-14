export type OrderPurgeResult = {
    deletedCount: number;
    deletedIds: string[];
    skippedIds: string[];
};
export declare class OrderPurgeService {
    /** Completed, fully paid, 100% cash POS tickets only — permanent removal from reports. */
    static isPurgeEligible(order: {
        status?: string | null;
        paymentStatus?: string | null;
        invoiceNumber?: string | null;
        paymentMethod?: string | null;
        paymentBreakdown?: unknown;
        total: unknown;
        refundAmount?: unknown | null;
    }): boolean;
    static purgeOrders(merchantId: string, orderIds: string[]): Promise<OrderPurgeResult>;
}
//# sourceMappingURL=order-purge.service.d.ts.map