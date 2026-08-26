export type DriverPayMode = "hourly" | "per_order" | "both";
export declare class DeliveryDriverPayService {
    static ensureSchema(): Promise<void>;
    static resolvePayMode(raw: string | null | undefined): DriverPayMode;
    static getPayConfig(merchantId: string, staffId: string): Promise<{
        payMode: DriverPayMode;
        hourlyRate: number;
        perOrderFee: number;
    }>;
    /** Open shift when driver starts GPS tracking (one open shift per staff). */
    static startShift(merchantId: string, staffId: string): Promise<{
        id: string;
        createdAt: Date;
        merchantId: string;
        staffId: string;
        startedAt: Date;
        endedAt: Date | null;
    }>;
    static endShift(merchantId: string, staffId: string): Promise<{
        endedAt: Date;
        id: string;
        createdAt: Date;
        merchantId: string;
        staffId: string;
        startedAt: Date;
    } | null>;
    static getDailySummary(merchantId: string, staffId: string, dateYmd?: string): Promise<{
        date: string;
        payMode: DriverPayMode;
        hourlyRate: number;
        perOrderFee: number;
        hoursWorked: number;
        deliveryCount: number;
        hourlyPay: number;
        orderPay: number;
        totalPay: number;
        completedOrders: {
            id: string;
            orderNumber: string;
            total: number;
            completedAt: string | null;
            customerName: string | null;
            shippingAddress: string | null;
        }[];
    }>;
}
//# sourceMappingURL=delivery-driver-pay.service.d.ts.map