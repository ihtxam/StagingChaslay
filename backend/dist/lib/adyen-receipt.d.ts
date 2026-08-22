/** Parse Adyen Terminal API PaymentReceipt OutputText into plain thermal lines. */
export type AdyenReceiptLine = {
    text: string;
    bold?: boolean;
    centered?: boolean;
    endOfLine?: boolean;
};
export type AdyenTerminalReceipt = {
    documentQualifier: string;
    lines: AdyenReceiptLine[];
};
export declare function parsePaymentReceipts(paymentResponse: Record<string, unknown>): {
    customer: AdyenTerminalReceipt | null;
    cashier: AdyenTerminalReceipt | null;
};
export declare function adyenReceiptToPlainText(receipt: AdyenTerminalReceipt, lineWidth?: number): string;
export declare function appendAdyenReceiptBlock(receiptText: string, receipt: AdyenTerminalReceipt | null | undefined, lineWidth?: number): string;
export declare function parseAdyenReceiptJson(json?: string | null): AdyenTerminalReceipt | null;
//# sourceMappingURL=adyen-receipt.d.ts.map