export declare class AdyenService {
    /**
     * Resolve Adyen credentials: merchant settings (shared for shop + terminals) → env.
     * Legacy per-terminal credential overrides are still honored if present.
     */
    static resolveCredentials(merchantId: string, terminalId?: string): Promise<{
        apiKey: string;
        merchantAccount: string;
        clientId: string | undefined;
        terminalId: string | undefined;
    }>;
    /**
     * Initialize payment session
     */
    static initializePaymentSession(merchantId: string, orderId: string, amount: number, currency?: string, returnUrl?: string): Promise<any>;
    /**
     * Process payment with card details
     */
    static processCardPayment(merchantId: string, orderId: string, amount: number, paymentMethod: {
        type: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        cvc: string;
        holderName: string;
    }, currency?: string): Promise<any>;
    /**
     * Process terminal payment
     */
    static processTerminalPayment(merchantId: string, orderId: string, amount: number, terminalId: string, currency?: string): Promise<any>;
    /**
     * Record payment transaction
     */
    static recordPaymentTransaction(merchantId: string, orderId: string, amount: number, paymentMethod: string, adyenReference: string, status: "pending" | "captured" | "completed" | "failed", opts?: {
        poiTransactionTimestamp?: string | null;
        currency?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        currency: string;
        amount: string;
        paymentMethod: string;
        adyenReference: string | null;
        adyenPoiTransactionTs: Date | null;
        completedAt: Date | null;
        orderId: string;
        terminalId: string | null;
    }>;
    /** Record payment when only POS clientId is known (order may not exist yet). */
    static recordPaymentTransactionByClientRef(merchantId: string, clientRef: string, amount: number, paymentMethod: string, adyenReference: string, status?: "pending" | "captured" | "completed" | "failed", opts?: {
        poiTransactionTimestamp?: string | null;
        currency?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        currency: string;
        amount: string;
        paymentMethod: string;
        adyenReference: string | null;
        adyenPoiTransactionTs: Date | null;
        completedAt: Date | null;
        orderId: string;
        terminalId: string | null;
    } | null>;
    /**
     * Get payment status
     */
    static getPaymentStatus(merchantId: string, reference: string): Promise<any>;
    /**
     * Refund payment
     */
    static refundPayment(merchantId: string, transactionId: string, amount?: number): Promise<any>;
    /**
     * Get merchant payment methods
     */
    static getMerchantPaymentMethods(merchantId: string): Promise<{
        type: string;
        name: string;
        enabled: boolean;
    }[]>;
    /**
     * Get transaction history
     */
    static getTransactionHistory(merchantId: string, page?: number, limit?: number, status?: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        currency: string;
        amount: string;
        paymentMethod: string;
        adyenReference: string | null;
        adyenPoiTransactionTs: Date | null;
        completedAt: Date | null;
        orderId: string;
        terminalId: string | null;
    }[]>;
    /**
     * Get payment summary
     */
    static getPaymentSummary(merchantId: string, startDate?: Date, endDate?: Date): Promise<{
        totalAmount: number;
        transactionCount: number;
        byStatus: Record<string, number>;
        byMethod: Record<string, number>;
    }>;
}
//# sourceMappingURL=adyen.service.d.ts.map