export declare const ODS_THEMES: readonly ["light", "teal", "dark"];
export type OdsTheme = (typeof ODS_THEMES)[number];
export declare class OdsLicenseError extends Error {
    code: string;
    constructor();
}
export type OdsDisplayInput = {
    name: string;
    theme?: OdsTheme;
    isActive?: boolean;
};
export type OdsPushPayload = {
    orderNumber: string;
    status: "preparing" | "ready";
};
export type OrderForOds = {
    orderNumber?: string | null;
    notes?: string | null;
    status?: string | null;
};
export declare function resolveOdsDisplayNumber(order: OrderForOds): string;
/** All normalized forms used when matching dismissals (e.g. #6457 and 6457). */
export declare function orderNumberAliases(value: unknown): string[];
export declare class OdsService {
    static listDisplays(merchantId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        theme: string;
    }[]>;
    static createDisplay(merchantId: string, input: OdsDisplayInput): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        theme: string;
    }>;
    static updateDisplay(merchantId: string, id: string, input: Partial<OdsDisplayInput>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        shortCode: string | null;
        theme: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deleteDisplay(merchantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    static rotateToken(merchantId: string, id: string): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        shortCode: string | null;
        theme: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static displayByToken(accessKey: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        theme: string;
    } | null | undefined>;
    /** Push or update an order on the customer board (POS / KDS integration). */
    static pushOrder(merchantId: string, payload: OdsPushPayload): Promise<{
        ok: boolean;
        skipped: boolean;
        reason: string;
        dismissed?: undefined;
        orderNumber?: undefined;
        status?: undefined;
        unchanged?: undefined;
    } | {
        ok: boolean;
        skipped: boolean;
        reason?: undefined;
        dismissed?: undefined;
        orderNumber?: undefined;
        status?: undefined;
        unchanged?: undefined;
    } | {
        ok: boolean;
        skipped: boolean;
        dismissed: boolean;
        reason?: undefined;
        orderNumber?: undefined;
        status?: undefined;
        unchanged?: undefined;
    } | {
        ok: boolean;
        orderNumber: string;
        status: string;
        unchanged: boolean;
        skipped?: undefined;
        reason?: undefined;
        dismissed?: undefined;
    } | {
        ok: boolean;
        orderNumber: string;
        status: string;
        skipped?: undefined;
        reason?: undefined;
        dismissed?: undefined;
        unchanged?: undefined;
    }>;
    static dismissOrder(merchantId: string, orderNumber: string): Promise<{
        ok: boolean;
        skipped: boolean;
    } | {
        ok: boolean;
        skipped?: undefined;
    }>;
    /** Remove from board without throwing when addon is off (internal sync). */
    static dismissOrderSoft(merchantId: string, orderNumber: string): Promise<{
        ok: boolean;
        skipped: boolean;
    } | {
        ok: boolean;
        skipped?: undefined;
    }>;
    /**
     * Keep ODS in sync with main order lifecycle (Order Center, online shop, POS pay-later).
     * Also used after POS kitchen send via shadow-table push — idempotent upsert/dismiss.
     */
    static syncFromOrder(merchantId: string, order: OrderForOds): Promise<{
        ok: boolean;
        skipped: boolean;
    } | {
        ok: boolean;
        skipped?: undefined;
    }>;
    /** Collect every pickup number currently visible (shadow + live + open KDS). */
    static snapshotVisibleNumbers(merchantId: string): Promise<string[]>;
    /** Close open Order Center rows that were showing on the pickup board. */
    static closeLiveOrdersForNumbers(merchantId: string, numbers: Set<string>): Promise<number>;
    /** Complete open KDS tickets whose numbers were cleared from the pickup board. */
    static completeKdsTicketsForNumbers(merchantId: string, numbers: Set<string>): Promise<number>;
    /** Snapshot current board numbers, dismiss them, and clear shadow rows. */
    static clearAllOrders(merchantId: string): Promise<{
        ok: boolean;
        removed: number;
        dismissed: number;
        closedLive: number;
        closedKds: number;
    }>;
    /** Live orders from the main orders table (online shop + POS pay-later / open fulfillment). */
    static boardFromLiveOrders(merchantId: string, opts?: {
        includeDismissed?: boolean;
    }): Promise<{
        preparing: string[];
        ready: string[];
    }>;
    static boardForToken(token: string): Promise<{
        display: {
            id: string;
            name: string;
            theme: OdsTheme;
        };
        serverTime: string;
        preparing: string[];
        ready: string[];
    }>;
}
//# sourceMappingURL=ods.service.d.ts.map