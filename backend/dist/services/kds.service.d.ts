export declare class KdsLicenseError extends Error {
    code: string;
    constructor();
}
export type KdsStationInput = {
    name: string;
    orderTypes?: string[];
    categoryIds?: string[];
    productIds?: string[];
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
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
    }[]>;
    static createStation(merchantId: string, input: KdsStationInput): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
    }>;
    static updateStation(merchantId: string, id: string, input: Partial<KdsStationInput>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
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
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static stationByToken(token: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        orderTypes: string[];
        categoryIds: string[];
        productIds: string[];
    } | undefined>;
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
    static ticketStatusForPos(merchantId: string, ticketKey: string): Promise<{
        readyLineIds: string[];
        total: number;
        ready: number;
        status?: undefined;
    } | {
        status: string;
        readyLineIds: string[];
        total: number;
        ready: number;
    }>;
}
//# sourceMappingURL=kds.service.d.ts.map