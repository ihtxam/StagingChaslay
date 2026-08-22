import { type AdyenTerminalReceipt } from "@/lib/adyen-receipt";
export type TerminalPoiResult = {
    status: "approved" | "declined" | "cancelled" | "error";
    message?: string;
    reference?: string | null;
    poiTransactionTimestamp?: string | null;
    customerReceipt?: AdyenTerminalReceipt | null;
    cashierReceipt?: AdyenTerminalReceipt | null;
};
/** Parse Adyen AdditionalResponse query string into a friendly customer message. */
export declare function friendlyTerminalPaymentMessage(errorCondition?: string | null, additionalResponse?: string | null): string;
export declare class AdyenTerminalPoiService {
    static processTerminalPayment(merchantId: string, amount: number, opts?: {
        terminalId?: string;
        currency?: string;
    }): Promise<TerminalPoiResult>;
    /**
     * Referenced POI refund (ReversalRequest) � returns funds to the customer's bank card.
     * Supports partial and full refunds when original POI transaction id + timestamp are known.
     */
    static processTerminalRefund(merchantId: string, amount: number, opts: {
        terminalId?: string;
        currency?: string;
        originalPoiTransactionId: string;
        originalPoiTransactionTimestamp: string;
    }): Promise<TerminalPoiResult>;
    /**
     * Unreferenced POI refund (PaymentRequest PaymentType=Refund) � goodwill compensation
     * not linked to an original terminal transaction.
     */
    static processUnreferencedTerminalRefund(merchantId: string, amount: number, opts?: {
        terminalId?: string;
        currency?: string;
    }): Promise<TerminalPoiResult>;
}
//# sourceMappingURL=adyen-terminal-poi.service.d.ts.map