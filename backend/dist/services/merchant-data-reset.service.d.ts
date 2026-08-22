export type PurgeSalesDataOptions = {
    /** Also remove customer profiles (default: keep customers, reset stats only) */
    deleteCustomers?: boolean;
    /** Remove table reservations (default: true) */
    deleteReservations?: boolean;
};
export type PurgeSalesDataResult = {
    merchantId: string;
    merchantName: string;
    deleted: {
        orders: number;
        heldOrders: number;
        paymentTransactions: number;
        dailyReports: number;
        posShifts: number;
        floorTableOrders: number;
        floorPrintJobs: number;
        loyaltyTransactions: number;
        loyaltyPointLots: number;
        loyaltyPointEvents: number;
        giftCardTransactions: number;
        reservations: number;
        customers?: number;
    };
    reset: {
        diningTables: number;
        loyaltyCards: number;
        giftCards: number;
        customers: number;
    };
};
/**
 * Remove all transactional / sales data for a merchant so they can start fresh after testing.
 * Keeps menu, staff, settings, licenses, devices, and floor plan layout.
 */
export declare class MerchantDataResetService {
    static purgeSalesData(merchantId: string, opts?: PurgeSalesDataOptions): Promise<PurgeSalesDataResult>;
}
//# sourceMappingURL=merchant-data-reset.service.d.ts.map