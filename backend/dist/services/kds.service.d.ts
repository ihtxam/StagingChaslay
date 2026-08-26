export declare class KdsLicenseError extends Error {
    code: string;
    constructor();
}
export type KdsStationInput = {
    name: string;
    orderTypes?: string[];
    categoryIds?: string[];
    productIds?: string[];
    theme?: string;
    layoutMode?: string;
    gridColumns?: number;
    overdueMinutes?: number;
    isActive?: boolean;
};
export type KdsPushItem = {
    lineId: string;
    productId?: string | null;
    categoryId?: string | null;
    name: string;
    quantity: number;
    lineNote?: string | null;
    courseNumber?: number | null;
    selectedExtras?: unknown;
    comboSelections?: unknown;
};
export type KdsPushPayload = {
    ticketKey: string;
    orderNumber?: string | null;
    tableLabel?: string | null;
    tabNumber?: string | null;
    channel?: string | null;
    items: KdsPushItem[];
};
export declare class KdsService {
    static listStations(merchantId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
        theme: string;
        layoutMode: string;
        gridColumns: number;
        overdueMinutes: number;
    }[]>;
    static createStation(merchantId: string, input: KdsStationInput): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
        theme: string;
        layoutMode: string;
        gridColumns: number;
        overdueMinutes: number;
    }>;
    static updateStation(merchantId: string, id: string, input: Partial<KdsStationInput>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        shortCode: string | null;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
        theme: string;
        layoutMode: string;
        gridColumns: number;
        overdueMinutes: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deleteStation(merchantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    static rotateToken(merchantId: string, id: string): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        shortCode: string | null;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
        theme: string;
        layoutMode: string;
        gridColumns: number;
        overdueMinutes: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static stationByToken(accessKey: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        shortCode: string | null;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
        theme: string;
        layoutMode: string;
        gridColumns: number;
        overdueMinutes: number;
    } | null | undefined>;
    /**
     * Push a saved order (online shop / partner) onto the KDS board.
     * POS register tickets use pushKitchen directly from WebPOS "Send to kitchen".
     */
    static pushOrderToKitchen(merchantId: string, orderId: string): Promise<{
        ok: boolean;
        added: number;
        ticketId: string;
    } | {
        ok: boolean;
        added: number;
    }>;
    /** Upsert ticket + append new line items when kitchen receives an order. */
    static pushKitchen(merchantId: string, payload: KdsPushPayload): Promise<{
        ok: boolean;
        added: number;
        ticketId?: undefined;
    } | {
        ok: boolean;
        added: number;
        ticketId: string;
    }>;
    static listForToken(token: string, since?: string): Promise<{
        station: {
            id: string;
            name: string;
            theme: string;
            layoutMode: string;
            gridColumns: number;
            overdueMinutes: number;
        };
        serverTime: string;
        updated: boolean;
        tickets: ({
            id: string;
            ticketKey: string;
            orderNumber: string | null;
            tableLabel: string | null;
            tabNumber: string | null;
            channel: string | null;
            status: string;
            createdAt: Date;
            completedAt: Date | null;
            items: {
                id: string;
                lineId: string;
                name: string;
                quantity: number;
                lineNote: string | null;
                courseNumber: number | null;
                status: string;
                readyAt: Date | null;
                modifiersJson: Record<string, unknown> | null;
            }[];
        } | null)[];
    }>;
    /** POS sync: all open/recent KDS tickets with ready line ids and completion state. */
    static boardStatusForMerchant(merchantId: string): Promise<{
        ticketKey: string;
        status: string;
        completedAt: string | null;
        readyLineIds: string[];
        total: number;
        ready: number;
    }[]>;
    static markItemReady(token: string, itemId: string): Promise<{
        ok: boolean;
        lineId: string;
        ticketKey: string;
    }>;
    /** Recall one ready item from a completed (or ready) ticket back to preparation. */
    static recallItem(token: string, itemId: string): Promise<{
        ok: boolean;
        lineId: string;
        ticketKey: string;
    }>;
    static completeTicket(token: string, ticketId: string): Promise<{
        ok: boolean;
        ticketKey: string;
    }>;
    static recallTicket(token: string, ticketId: string): Promise<{
        ok: boolean;
    }>;
    /** Mark KDS tickets cancelled when POS voids/cancels a kitchen order. */
    static dismissTicketsByKey(merchantId: string, ticketKey: string): Promise<{
        dismissed: number;
    }>;
    static ticketStatusForPos(merchantId: string, ticketKey: string): Promise<{
        readyLineIds: string[];
        total: number;
        ready: number;
        sent: number;
        status?: undefined;
    } | {
        status: string;
        readyLineIds: string[];
        total: number;
        sent: number;
        ready: number;
    }>;
}
//# sourceMappingURL=kds.service.d.ts.map