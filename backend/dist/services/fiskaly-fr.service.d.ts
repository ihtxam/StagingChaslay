import type { FiskalyFrSettings, FiskalyEnvironment } from "@/lib/fiskaly-settings";
export type FiskalyFrSaleItem = {
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    taxAmount?: number;
    taxRate?: number;
};
export type FiskalyFrSalePayload = {
    total: number;
    subtotal?: number;
    taxAmount?: number;
    items?: FiskalyFrSaleItem[];
    orderNumber?: string | null;
};
export type FiskalyFrSignResult = {
    signature: string | null;
    qrCodeData: string | null;
    txNumber: string | number | null;
    txId: string;
    intentionId: string;
    raw: Record<string, unknown>;
};
export declare class FiskalyFrService {
    static authenticate(apiKey: string, apiSecret: string, environment?: FiskalyEnvironment): Promise<string>;
    static testConnection(fr: FiskalyFrSettings, environment: FiskalyEnvironment): Promise<void>;
    static signTransaction(opts: {
        fr: FiskalyFrSettings;
        environment: FiskalyEnvironment;
        sale: FiskalyFrSalePayload;
    }): Promise<FiskalyFrSignResult>;
}
//# sourceMappingURL=fiskaly-fr.service.d.ts.map