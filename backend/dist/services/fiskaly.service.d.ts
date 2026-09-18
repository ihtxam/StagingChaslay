import { type FiskalySignature } from "@/lib/fiskaly-settings";
export { normalizeCountry } from "@/lib/fiskaly-settings";
export type FiskalyPosSalePayload = {
    total: number;
    subtotal?: number;
    taxAmount?: number;
    paymentMethod?: string | null;
    paymentBreakdown?: Array<{
        method: string;
        amount: number;
    }> | null;
    orderNumber?: string | null;
    items?: Array<{
        productName?: string;
        quantity?: number;
        unitPrice?: number;
        totalPrice?: number;
        taxAmount?: number;
        taxRate?: number;
    }>;
};
export type FiskalySignResponse = {
    qrCodeData?: string | null;
    signature?: string | null;
    txNumber?: string | number | null;
    txId?: string | null;
};
export declare class FiskalyService {
    static normalizeCountry(country?: string | null): "DE" | "FR" | null;
    static signPosSale(merchantId: string, orderId: string, sale: FiskalyPosSalePayload): Promise<FiskalySignature | null>;
    static signPosRefund(merchantId: string, orderId: string, _refundPayload: Record<string, unknown>): Promise<FiskalySignature | null>;
    static testConnection(merchantId: string, country: "DE" | "FR"): Promise<void>;
    static toPushResponse(sig: FiskalySignature | null): FiskalySignResponse | undefined;
}
//# sourceMappingURL=fiskaly.service.d.ts.map