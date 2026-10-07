import { type ReportPreset, type SalesScopeOpts } from "./pos-reports.service";
export type AccountingExportTarget = "bexio" | "odoo" | "standard";
export type AccountingExportOpts = {
    preset?: ReportPreset;
    from?: string;
    to?: string;
    target?: AccountingExportTarget;
    language?: string;
} & SalesScopeOpts;
type JournalLine = {
    date: string;
    reference: string;
    label: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    taxAmount?: number;
    taxCode?: string;
};
export type AccountingJournalLine = JournalLine;
export declare class AccountingExportService {
    static buildJournal(merchantId: string, opts: AccountingExportOpts): Promise<{
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
                    percent: number;
                    method: string;
                    count: number;
                    total: number;
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
            byLocation: {
                locationId: string;
                name: string;
                revenue: number;
                orders: number;
            }[];
        };
        lines: JournalLine[];
        reference: string;
        businessName: string;
        settings: import("@/lib/accounting-integration-settings").AccountingIntegrationSettings;
        target: AccountingExportTarget;
    }>;
    static buildExport(merchantId: string, opts: AccountingExportOpts): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        filename: string;
        mime: string;
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
                    percent: number;
                    method: string;
                    count: number;
                    total: number;
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
            byLocation: {
                locationId: string;
                name: string;
                revenue: number;
                orders: number;
            }[];
        };
        reference: string;
        lineCount: number;
    }>;
}
export {};
//# sourceMappingURL=accounting-export.service.d.ts.map