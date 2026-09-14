export type ShopCommissionOrderRow = {
    id: string;
    orderNumber: string;
    createdAt: string;
    subtotal: number;
    total: number;
    commission: number;
};
export type ShopCommissionReport = {
    merchantId: string;
    merchantName: string;
    month: string;
    commissionPercent: number;
    orderCount: number;
    ordersSubtotal: number;
    totalCommission: number;
    orders: ShopCommissionOrderRow[];
};
export declare class ShopCommissionService {
    static currentMonthKey(): string;
    static getMonthlyReport(merchantId: string, month?: string): Promise<ShopCommissionReport>;
    static generatePdf(merchantId: string, month: string, reseller?: {
        name?: string | null;
        email?: string | null;
    }): Promise<Buffer>;
}
//# sourceMappingURL=shop-commission.service.d.ts.map