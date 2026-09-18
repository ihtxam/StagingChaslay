export declare class PrintJobExpandService {
    static enqueueReservationPrint(merchantId: string, reservationId: string): Promise<void>;
    static enqueueOrderPrint(merchantId: string, orderId: string, opts: {
        printKitchen?: boolean;
        printNotification?: boolean;
        printDeliveryReceipt?: boolean;
        orderSource?: string;
        /** Online/reservation arrival — ignore master auto-print receipt/kitchen toggles */
        independentOfMasterAutoPrint?: boolean;
    }): Promise<void>;
    /** Turn a claimed recipe job into printable ESC/POS (Print Agent + browser). */
    static materializeRecipePayload(merchantId: string, payload: Record<string, unknown> | null | undefined): Promise<Record<string, unknown> | null | undefined>;
}
//# sourceMappingURL=print-job-expand.service.d.ts.map