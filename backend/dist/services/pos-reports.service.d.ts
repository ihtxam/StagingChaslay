export type ReportPreset = "today" | "yesterday" | "last_week" | "this_month" | "last_month" | "last_3_months" | "custom";
export declare function resolveReportRange(preset: ReportPreset, from?: string, to?: string): {
    start: Date;
    end: Date;
    label: string;
    from: string;
    to: string;
};
export type SalesScopeOpts = {
    /** When set, only include this staff member's sales (own-sales EOD). */
    staffId?: string | null;
    /** Fallback match for legacy orders without staffId. */
    staffName?: string | null;
};
export declare class PosReportsService {
    /** Shift-scoped sales report (exact openedAt–closedAt window, not full calendar day). */
    static getShiftReport(merchantId: string, opts: {
        from: string;
        to: string;
    } & SalesScopeOpts): Promise<{
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
        /** Taxable revenue / net sales (tips excluded — tips are not taxable) */
        revenue: number;
        /** Alias of revenue for clients that want an explicit “excl. tips” field */
        netSalesExclTips: number;
        subtotal: number;
        taxTotal: number;
        /** Net of VAT (also excl. tips) */
        netTotal: number;
        brutTotal: number;
        discountTotal: number;
        tipsTotal: number;
        refundTotal: number;
        cancelledTotal: number;
        /** Net sales + tips (money collected) */
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
        /** Opening float (fond de base) + drawer reconciliation per closed shift */
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
    }>;
    static getEndOfDayReport(merchantId: string, opts: {
        preset?: ReportPreset;
        from?: string;
        to?: string;
        channel?: string;
        /** Exact ISO timestamps — shift-scoped report (overrides preset day bounds). */
        startAt?: string;
        endAt?: string;
    } & SalesScopeOpts): Promise<{
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
        /** Taxable revenue / net sales (tips excluded — tips are not taxable) */
        revenue: number;
        /** Alias of revenue for clients that want an explicit “excl. tips” field */
        netSalesExclTips: number;
        subtotal: number;
        taxTotal: number;
        /** Net of VAT (also excl. tips) */
        netTotal: number;
        brutTotal: number;
        discountTotal: number;
        tipsTotal: number;
        refundTotal: number;
        cancelledTotal: number;
        /** Net sales + tips (money collected) */
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
        /** Opening float (fond de base) + drawer reconciliation per closed shift */
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
    }>;
    /**
     * Merchant Overview dashboard: EOD metrics + sales-over-time + period comparison.
     */
    static getOverviewDashboard(merchantId: string, opts: {
        preset?: ReportPreset;
        from?: string;
        to?: string;
    } & SalesScopeOpts): Promise<{
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
        /** Full EOD payload for export / email */
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
            /** Taxable revenue / net sales (tips excluded — tips are not taxable) */
            revenue: number;
            /** Alias of revenue for clients that want an explicit “excl. tips” field */
            netSalesExclTips: number;
            subtotal: number;
            taxTotal: number;
            /** Net of VAT (also excl. tips) */
            netTotal: number;
            brutTotal: number;
            discountTotal: number;
            tipsTotal: number;
            refundTotal: number;
            cancelledTotal: number;
            /** Net sales + tips (money collected) */
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
            /** Opening float (fond de base) + drawer reconciliation per closed shift */
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
    }>;
    /** Top product ids by quantity sold over the last N days (for POS "Most Sold" category). */
    static getBestsellerProductIds(merchantId: string, opts?: {
        limit?: number;
        days?: number;
    }): Promise<string[]>;
}
//# sourceMappingURL=pos-reports.service.d.ts.map