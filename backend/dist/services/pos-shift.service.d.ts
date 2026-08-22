export declare class PosShiftService {
    static getOpenShift(merchantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        staffName: string | null;
        staffId: string | null;
        notes: string | null;
        openedAt: Date;
        closedAt: Date | null;
        openingCash: string;
        closingCashCounted: string | null;
        expectedCash: string | null;
        cashSales: string | null;
        cardSales: string | null;
        terminalSales: string | null;
        otherSales: string | null;
        orderCount: number | null;
        variance: string | null;
    } | undefined>;
    /**
     * Close open shifts whose opening day is before today (merchant TZ).
     * Used by the hourly job and on next open / current-shift fetch.
     * Counted cash = expected (variance 0); notes mark auto-close.
     */
    static autoCloseStaleShifts(merchantId?: string): Promise<number>;
    static getCurrent(merchantId: string): Promise<{
        shift: null;
        live: null;
    } | {
        shift: {
            id: string;
            merchantId: string;
            staffId: string | null;
            staffName: string | null;
            status: string;
            openedAt: string;
            closedAt: string | Date | null;
            openingCash: number;
            closingCashCounted: number | null;
            expectedCash: number | null;
            cashSales: number;
            cardSales: number;
            terminalSales: number;
            otherSales: number;
            orderCount: number;
            variance: number | null;
            notes: string | null;
        };
        live: {
            cashIn: number;
            cashOut: number;
            cashRefunds: number;
            expectedCash: number;
            cashSales: number;
            cardSales: number;
            terminalSales: number;
            otherSales: number;
            orderCount: number;
            totalSales: number;
        };
    }>;
    static startShift(merchantId: string, input: {
        openingCash?: number | null;
        staffId?: string | null;
        staffName?: string | null;
    }): Promise<{
        id: string;
        merchantId: string;
        staffId: string | null;
        staffName: string | null;
        status: string;
        openedAt: string;
        closedAt: string | Date | null;
        openingCash: number;
        closingCashCounted: number | null;
        expectedCash: number | null;
        cashSales: number;
        cardSales: number;
        terminalSales: number;
        otherSales: number;
        orderCount: number;
        variance: number | null;
        notes: string | null;
    }>;
    static closeShift(merchantId: string, input: {
        closingCashCounted: number;
        notes?: string | null;
    }): Promise<{
        shift: {
            id: string;
            merchantId: string;
            staffId: string | null;
            staffName: string | null;
            status: string;
            openedAt: string;
            closedAt: string | Date | null;
            openingCash: number;
            closingCashCounted: number | null;
            expectedCash: number | null;
            cashSales: number;
            cardSales: number;
            terminalSales: number;
            otherSales: number;
            orderCount: number;
            variance: number | null;
            notes: string | null;
        };
        balanced: boolean;
        reportPeriod: {
            from: string;
            to: string;
        };
        cashIn: number;
        cashOut: number;
        cashRefunds: number;
        movements: {
            id: string;
            shiftId: string;
            type: string;
            amount: number;
            reason: string | null;
            staffId: string | null;
            staffName: string | null;
            createdAt: string;
        }[];
    }>;
    /** Sum completed POS orders in [openedAt, until). */
    private static sumCashMovements;
    static recordCashMovement(merchantId: string, input: {
        type: "in" | "out";
        amount: number;
        reason?: string | null;
        staffId?: string | null;
        staffName?: string | null;
    }): Promise<{
        movement: {
            id: string;
            shiftId: string;
            type: string;
            amount: number;
            reason: string | null;
            staffId: string | null;
            staffName: string | null;
            createdAt: string;
        };
        live: {
            cashIn: number;
            cashOut: number;
            cashRefunds: number;
            expectedCash: number;
            cashSales: number;
            cardSales: number;
            terminalSales: number;
            otherSales: number;
            orderCount: number;
            totalSales: number;
        };
    }>;
    static listCashMovements(merchantId: string, shiftId: string): Promise<{
        id: string;
        shiftId: string;
        type: string;
        amount: number;
        reason: string | null;
        staffId: string | null;
        staffName: string | null;
        createdAt: string;
    }[]>;
    /** Sum completed POS orders in [openedAt, until). */
    private static computeLiveTotals;
    private static serialize;
}
//# sourceMappingURL=pos-shift.service.d.ts.map