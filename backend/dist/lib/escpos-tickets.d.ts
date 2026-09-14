/** Compact ESC/POS tickets for server-side print-job expansion (Print Agent drain). */
export declare function reservationTicketEscPos(opts: {
    code: string;
    guestName: string;
    guestPhone?: string | null;
    partySize: number;
    reservedAt: Date | string | number;
    status?: string | null;
    tableLabel?: string | null;
    notes?: string | null;
    businessName?: string | null;
    paperWidthMm?: 58 | 80;
}): Buffer;
export declare function kitchenTicketEscPos(opts: {
    orderNumber: string;
    orderSource?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    shippingAddress?: string | null;
    channel?: string | null;
    scheduledFor?: Date | string | null;
    notes?: string | null;
    items: Array<{
        name: string;
        quantity: number;
        extras?: string[];
    }>;
    paperWidthMm?: 58 | 80;
}): Buffer;
export declare function orderNotificationTicketEscPos(opts: {
    orderNumber: string;
    orderSource?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    shippingAddress?: string | null;
    channel?: string | null;
    total?: number;
    items: Array<{
        name: string;
        quantity: number;
    }>;
    paperWidthMm?: 58 | 80;
    businessName?: string | null;
}): Buffer;
export declare function deliverySlipEscPos(opts: {
    orderNumber: string;
    customerName?: string | null;
    customerPhone?: string | null;
    shippingAddress?: string | null;
    total?: number;
    items: Array<{
        name: string;
        quantity: number;
    }>;
    paperWidthMm?: 58 | 80;
    businessName?: string | null;
}): Buffer;
//# sourceMappingURL=escpos-tickets.d.ts.map