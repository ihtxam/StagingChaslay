import type { FiskalyDeSettings, FiskalyEnvironment } from "@/lib/fiskaly-settings";
export type FiskalyDeVatRate = "NORMAL" | "REDUCED_1" | "REDUCED_2" | "SPECIAL_RATE_1" | "SPECIAL_RATE_2" | "NULL";
export type FiskalyDePaymentType = "CASH" | "CARD" | "NON_CASH";
export type FiskalyDeSaleItem = {
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    taxAmount?: number;
    taxRate?: number;
};
export type FiskalyDeSalePayload = {
    total: number;
    subtotal?: number;
    taxAmount?: number;
    paymentMethod?: string | null;
    paymentBreakdown?: Array<{
        method: string;
        amount: number;
    }> | null;
    items?: FiskalyDeSaleItem[];
    orderNumber?: string | null;
};
export type FiskalyDeSignResult = {
    signature: string | null;
    qrCodeData: string | null;
    txNumber: string | number | null;
    txId: string;
    tssSerial: string | null;
    raw: Record<string, unknown>;
};
/** Map tax rate % to Fiskaly SIGN DE vat_rate enum. */
export declare function mapVatRateToFiskalyDe(ratePercent: number): FiskalyDeVatRate;
/** Map POS payment method to Fiskaly payment_type. */
export declare function mapPaymentMethodToFiskalyDe(method: string): FiskalyDePaymentType;
export declare class FiskalyDeService {
    static authenticate(apiKey: string, apiSecret: string, environment?: FiskalyEnvironment): Promise<string>;
    static testConnection(de: FiskalyDeSettings, environment: FiskalyEnvironment): Promise<void>;
    static signTransaction(opts: {
        de: FiskalyDeSettings;
        environment: FiskalyEnvironment;
        sale: FiskalyDeSalePayload;
    }): Promise<FiskalyDeSignResult>;
}
//# sourceMappingURL=fiskaly-de.service.d.ts.map