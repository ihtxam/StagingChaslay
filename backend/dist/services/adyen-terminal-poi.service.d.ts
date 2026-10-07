import { type AdyenTerminalReceipt } from "@/lib/adyen-receipt";
export type TerminalPoiResult = {
    status: "approved" | "declined" | "cancelled" | "error";
    message?: string;
    reference?: string | null;
    poiTransactionTimestamp?: string | null;
    customerReceipt?: AdyenTerminalReceipt | null;
    cashierReceipt?: AdyenTerminalReceipt | null;
    /** Tip added on the payment terminal (AskGratuity flow). */
    tipAmount?: number | null;
    authorizedAmount?: number | null;
};
/** Parse Adyen AdditionalResponse query string into a friendly customer message. */
export declare function friendlyTerminalPaymentMessage(errorCondition?: string | null, additionalResponse?: string | null): string;
/** SaleToAcquirerData tender options for Terminal API payment requests. */
export declare function buildTerminalSaleToAcquirerData(options?: {
    askGratuity?: boolean;
}): string;
/** Parse tip / authorized amounts from an approved Terminal API PaymentResponse. */
export declare function parseTerminalTipFromPaymentResponse(paymentResponse: Record<string, unknown>, additionalResponse?: string | null): {
    tipAmount: number | null;
    authorizedAmount: number | null;
};
export declare class AdyenTerminalPoiService {
    static processTerminalPayment(merchantId: string, amount: number, opts?: {
        terminalId?: string;
        currency?: string;
        /** When true, send AskGratuity to the terminal (unless posTipAmount > 0). */
        askGratuity?: boolean;
        /** Tip already collected on the POS checkout UI ? skips terminal gratuity. */
        posTipAmount?: number;
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