import { type ReportPreset } from "@/services/pos-reports.service";
type MixRow = {
    id: string;
    label: string;
    quantity: number;
    revenue: number;
    revenueSharePct: number;
    quantitySharePct: number;
    previousRevenue?: number;
    revenueChangePct?: number | null;
};
export declare class SalesMixService {
    static getSalesMixReport(merchantId: string, opts: {
        preset?: ReportPreset;
        from?: string;
        to?: string;
        staffId?: string | null;
        locationId?: string | null;
    }): Promise<{
        range: {
            preset: ReportPreset;
            from: string;
            to: string;
            label: string;
            start: string;
            end: string;
        };
        previousRange: {
            from: string;
            to: string;
            label: string;
        };
        summary: {
            orderCount: number;
            revenue: number;
            itemQuantity: number;
            averageOrderValue: number;
            previousOrderCount: number;
            previousRevenue: number;
            revenueChangePct: number | null;
            orderCountChangePct: number | null;
        };
        categoryMix: MixRow[];
        productMix: MixRow[];
        channelMix: MixRow[];
        orderSourceMix: MixRow[];
        paymentMix: MixRow[];
        daypartMix: MixRow[];
    }>;
}
export {};
//# sourceMappingURL=sales-mix.service.d.ts.map