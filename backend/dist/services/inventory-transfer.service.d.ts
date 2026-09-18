export declare class InventoryTransferService {
    static ensureLocationStock(merchantId: string, locationId: string, itemId: string, qtyDelta: number): Promise<{
        id: string;
        updatedAt: Date;
        merchantId: string;
        locationId: string;
        onHand: string;
        itemId: string;
    }>;
    static backfillDefaultLocation(merchantId: string): Promise<{
        created: number;
        locationId: string;
    }>;
    static list(merchantId: string, status?: string): Promise<{
        item: {
            id: string;
            name: string;
            unit: string;
        } | null;
        id: string;
        createdAt: Date;
        status: string;
        note: string | null;
        merchantId: string;
        createdByStaffId: string | null;
        createdByName: string | null;
        itemId: string;
        fromLocationId: string;
        toLocationId: string;
        qty: string;
        confirmedAt: Date | null;
    }[]>;
    static create(merchantId: string, input: {
        fromLocationId: string;
        toLocationId: string;
        itemId: string;
        qty: number;
        note?: string;
        staffId?: string | null;
        staffName?: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        note: string | null;
        merchantId: string;
        createdByStaffId: string | null;
        createdByName: string | null;
        itemId: string;
        fromLocationId: string;
        toLocationId: string;
        qty: string;
        confirmedAt: Date | null;
    }>;
    static confirm(merchantId: string, transferId: string): Promise<{
        id: string;
        merchantId: string;
        fromLocationId: string;
        toLocationId: string;
        itemId: string;
        qty: string;
        status: string;
        note: string | null;
        createdByStaffId: string | null;
        createdByName: string | null;
        createdAt: Date;
        confirmedAt: Date | null;
    }>;
    static cancel(merchantId: string, transferId: string): Promise<{
        id: string;
        merchantId: string;
        fromLocationId: string;
        toLocationId: string;
        itemId: string;
        qty: string;
        status: string;
        note: string | null;
        createdByStaffId: string | null;
        createdByName: string | null;
        createdAt: Date;
        confirmedAt: Date | null;
    }>;
    static locationStockSummary(merchantId: string, locationId: string): Promise<{
        itemId: string;
        name: string;
        unit: string;
        onHand: number;
        merchantOnHand: number;
    }[]>;
}
//# sourceMappingURL=inventory-transfer.service.d.ts.map