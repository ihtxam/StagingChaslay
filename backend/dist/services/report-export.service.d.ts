import { type ReportExportLang } from "@/lib/report-export-labels";
import { type ReportPreset, type SalesScopeOpts } from "./pos-reports.service";
export type ReportExportOpts = {
    preset?: ReportPreset;
    from?: string;
    to?: string;
    language?: ReportExportLang | string;
} & SalesScopeOpts;
/**
 * Build OrderPin-inspired multi-sheet workbook (or CSV) from overview/EOD data.
 */
export declare class ReportExportService {
    static buildOverviewWorkbook(merchantId: string, opts: ReportExportOpts): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        filename: string;
        overview: {
            range: {
                preset: ReportPreset;
                from: string;
                to: string;
                label: string;
                start: string;
                end: string;
            };
            kpis: {
                totalSales: number;
                netSales: number;
                fundingAmount: number;
                orders: number;
                customers: number;
                tipsTotal: number;
                taxTotal: number;
                changes: {
                    totalSales: number;
                    netSales: number;
                    fundingAmount: number;
                    orders: number;
                    customers: number;
                };
                previousLabel: string;
            };
            salesBreakdown: {
                productAmount: number;
                tax: number;
                totalSales: number;
            };
            salesOverTime: {
                label: string;
                amount: number;
            }[];
            salesByHour: {
                label: string;
                amount: number;
            }[];
            paymentMethods: {
                method: string;
                label: string;
                total: number;
                count: number;
                percent: number;
            }[];
            orderTypes: {
                channel: string;
                label: string;
                total: number;
                count: number;
                percent: number;
            }[];
            products: {
                name: string;
                quantity: number;
                total: number;
            }[];
            staff: {
                name: string;
                salesCount: number;
                total: number;
            }[];
            shiftCash: {
                openingFloat: number;
                cashSales: number;
                cashIn: number;
                cashOut: number;
                cashRefunds: number;
                movements: {
                    type: "in" | "out";
                    amount: number;
                    reason: string | null;
                    staffName: string | null;
                    createdAt: string | null;
                }[];
                expectedCash: number;
                closingCashCounted: number | null;
                variance: number | null;
                staffName: string | null;
                openedAt: string;
                closedAt: string | null;
            }[];
            businessName: string;
            eod: {
                range: {
                    preset: ReportPreset;
                    from: string;
                    to: string;
                    label: string;
                    start: string;
                    end: string;
                };
                salesScope: {
                    mode: "own";
                    staffId: string;
                    staffName: string | null;
                } | {
                    mode: "all";
                    staffId: string | null;
                    staffName: string | null;
                };
                salesCount: number;
                cancelledCount: number;
                cancelledOrders: {
                    id: string;
                    orderNumber: string;
                    total: number;
                    cancelReason: string | null;
                    channel: string;
                    staffName: string | null;
                    cancelledAt: string;
                }[];
                refundCount: number;
                refundedOrders: {
                    id: string;
                    orderNumber: string;
                    total: number;
                    refundAmount: number;
                    refundReason: string | null;
                    channel: string;
                    staffName: string | null;
                    refundedAt: string | null;
                    status: string;
                }[];
                revenue: number;
                netSalesExclTips: number;
                subtotal: number;
                taxTotal: number;
                netTotal: number;
                brutTotal: number;
                discountTotal: number;
                tipsTotal: number;
                refundTotal: number;
                cancelledTotal: number;
                grandTotal: number;
                coversServed: number | null;
                vatRows: {
                    label: string;
                    channel: string;
                    rate: number;
                    net: number;
                    tva: number;
                    brut: number;
                }[];
                paymentRows: {
                    method: string;
                    count: number;
                    total: number;
                    percent: number;
                }[];
                refundRows: {
                    method: string;
                    total: number;
                }[];
                channelRows: {
                    channel: string;
                    count: number;
                    total: number;
                }[];
                orderTypeRows: {
                    channel: string;
                    label: string;
                    count: number;
                    percent: number;
                    total: number;
                }[];
                productsSold: {
                    name: string;
                    quantity: number;
                    total: number;
                }[];
                userPerformance: {
                    name: string;
                    salesCount: number;
                    total: number;
                }[];
                cashTotal: number;
                cardTotal: number;
                terminalTotal: number;
                shiftCash: {
                    openingFloat: number;
                    cashSales: number;
                    cashIn: number;
                    cashOut: number;
                    cashRefunds: number;
                    movements: {
                        type: "in" | "out";
                        amount: number;
                        reason: string | null;
                        staffName: string | null;
                        createdAt: string | null;
                    }[];
                    expectedCash: number;
                    closingCashCounted: number | null;
                    variance: number | null;
                    staffName: string | null;
                    openedAt: string;
                    closedAt: string | null;
                }[];
                businessName: string;
            };
            previous: {
                range: {
                    preset: ReportPreset;
                    from: string;
                    to: string;
                    label: string;
                    start: string;
                    end: string;
                };
                totalSales: number;
                netSales: number;
                orders: number;
            };
        };
        mime: string;
    }>;
    static buildOverviewCsv(merchantId: string, opts: ReportExportOpts): Promise<{
        buffer: Buffer<ArrayBuffer>;
        filename: string;
        overview: {
            range: {
                preset: ReportPreset;
                from: string;
                to: string;
                label: string;
                start: string;
                end: string;
            };
            kpis: {
                totalSales: number;
                netSales: number;
                fundingAmount: number;
                orders: number;
                customers: number;
                tipsTotal: number;
                taxTotal: number;
                changes: {
                    totalSales: number;
                    netSales: number;
                    fundingAmount: number;
                    orders: number;
                    customers: number;
                };
                previousLabel: string;
            };
            salesBreakdown: {
                productAmount: number;
                tax: number;
                totalSales: number;
            };
            salesOverTime: {
                label: string;
                amount: number;
            }[];
            salesByHour: {
                label: string;
                amount: number;
            }[];
            paymentMethods: {
                method: string;
                label: string;
                total: number;
                count: number;
                percent: number;
            }[];
            orderTypes: {
                channel: string;
                label: string;
                total: number;
                count: number;
                percent: number;
            }[];
            products: {
                name: string;
                quantity: number;
                total: number;
            }[];
            staff: {
                name: string;
                salesCount: number;
                total: number;
            }[];
            shiftCash: {
                openingFloat: number;
                cashSales: number;
                cashIn: number;
                cashOut: number;
                cashRefunds: number;
                movements: {
                    type: "in" | "out";
                    amount: number;
                    reason: string | null;
                    staffName: string | null;
                    createdAt: string | null;
                }[];
                expectedCash: number;
                closingCashCounted: number | null;
                variance: number | null;
                staffName: string | null;
                openedAt: string;
                closedAt: string | null;
            }[];
            businessName: string;
            eod: {
                range: {
                    preset: ReportPreset;
                    from: string;
                    to: string;
                    label: string;
                    start: string;
                    end: string;
                };
                salesScope: {
                    mode: "own";
                    staffId: string;
                    staffName: string | null;
                } | {
                    mode: "all";
                    staffId: string | null;
                    staffName: string | null;
                };
                salesCount: number;
                cancelledCount: number;
                cancelledOrders: {
                    id: string;
                    orderNumber: string;
                    total: number;
                    cancelReason: string | null;
                    channel: string;
                    staffName: string | null;
                    cancelledAt: string;
                }[];
                refundCount: number;
                refundedOrders: {
                    id: string;
                    orderNumber: string;
                    total: number;
                    refundAmount: number;
                    refundReason: string | null;
                    channel: string;
                    staffName: string | null;
                    refundedAt: string | null;
                    status: string;
                }[];
                revenue: number;
                netSalesExclTips: number;
                subtotal: number;
                taxTotal: number;
                netTotal: number;
                brutTotal: number;
                discountTotal: number;
                tipsTotal: number;
                refundTotal: number;
                cancelledTotal: number;
                grandTotal: number;
                coversServed: number | null;
                vatRows: {
                    label: string;
                    channel: string;
                    rate: number;
                    net: number;
                    tva: number;
                    brut: number;
                }[];
                paymentRows: {
                    method: string;
                    count: number;
                    total: number;
                    percent: number;
                }[];
                refundRows: {
                    method: string;
                    total: number;
                }[];
                channelRows: {
                    channel: string;
                    count: number;
                    total: number;
                }[];
                orderTypeRows: {
                    channel: string;
                    label: string;
                    count: number;
                    percent: number;
                    total: number;
                }[];
                productsSold: {
                    name: string;
                    quantity: number;
                    total: number;
                }[];
                userPerformance: {
                    name: string;
                    salesCount: number;
                    total: number;
                }[];
                cashTotal: number;
                cardTotal: number;
                terminalTotal: number;
                shiftCash: {
                    openingFloat: number;
                    cashSales: number;
                    cashIn: number;
                    cashOut: number;
                    cashRefunds: number;
                    movements: {
                        type: "in" | "out";
                        amount: number;
                        reason: string | null;
                        staffName: string | null;
                        createdAt: string | null;
                    }[];
                    expectedCash: number;
                    closingCashCounted: number | null;
                    variance: number | null;
                    staffName: string | null;
                    openedAt: string;
                    closedAt: string | null;
                }[];
                businessName: string;
            };
            previous: {
                range: {
                    preset: ReportPreset;
                    from: string;
                    to: string;
                    label: string;
                    start: string;
                    end: string;
                };
                totalSales: number;
                netSales: number;
                orders: number;
            };
        };
        mime: string;
    }>;
}
//# sourceMappingURL=report-export.service.d.ts.map