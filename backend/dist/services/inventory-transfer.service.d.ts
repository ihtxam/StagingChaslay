export declare class InventoryTransferService {
    static ensureLocationStock(merchantId: string, locationId: string, itemId: string, qtyDelta: number): Promise<any>;
    static backfillDefaultLocation(merchantId: string): Promise<{
        created: number;
        locationId: string;
    }>;
    static list(merchantId: string, status?: string): Promise<any>;
    static create(merchantId: string, input: {
        fromLocationId: string;
        toLocationId: string;
        itemId: string;
        qty: number;
        note?: string;
        staffId?: string | null;
        staffName?: string | null;
    }): Promise<any>;
    static confirm(merchantId: string, transferId: string): Promise<any>;
    static cancel(merchantId: string, transferId: string): Promise<any>;
    static locationStockSummary(merchantId: string, locationId: string): Promise<any>;
}
//# sourceMappingURL=inventory-transfer.service.d.ts.map