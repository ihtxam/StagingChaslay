import { type AdyenCheckoutEnvironment } from "@/lib/adyen-checkout-env";
import { type ShopAdyenShopper } from "@/lib/shop-adyen-session";
import { type OnlinePaymentOrderLike } from "@/lib/online-payment-refund";
export declare class AdyenService {
    static environmentFromClientKey(clientKey?: string | null): AdyenCheckoutEnvironment;
    static checkoutApiBase(clientKey?: string | null, liveUrlPrefix?: string | null): string;
    static formatSessionError(error: unknown): string;
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
     * Logged-in shop account → Adyen shopperReference for CardOnFile.
     * JWT-authenticated customers are tokenized even if passwordHash is missing.
     * Guest CRM rows (no password, not authenticated) are not tokenized.
     */
    static resolveShopAccountShopper(merchantId: string, customerId?: string | null, opts?: {
        authenticated?: boolean;
    } | null): Promise<ShopAdyenShopper | null>;
    /**
     * Initialize Checkout /sessions for Drop-in (online shop + gift cards).
     * API base and Drop-in environment follow the merchant client key (test_ / live_),
     * not platform ADYEN_ENVIRONMENT. Do not send clientKey in the session body.
     * POS terminal payments use processTerminalPayment / Terminal API — not this path.
     */
    static initializePaymentSession(merchantId: string, orderId: string, amount: number, currency?: string, returnUrl?: string, origin?: string, options?: {
        shopper?: ShopAdyenShopper | null;
        customerId?: string | null;
        authenticated?: boolean;
    } | null): Promise<{
        id: {};
        sessionData: {};
        clientKey: string | undefined;
        environment: AdyenCheckoutEnvironment;
        storePaymentMethod: boolean;
    }>;
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
        terminalId: string | null;
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
    }>;
    /** Record payment when only POS clientId is known (order may not exist yet). */
    static recordPaymentTransactionByClientRef(merchantId: string, clientRef: string, amount: number, paymentMethod: string, adyenReference: string, status?: "pending" | "captured" | "completed" | "failed", opts?: {
        poiTransactionTimestamp?: string | null;
        currency?: string;
    }): Promise<{
        id: string;
        terminalId: string | null;
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
    } | null>;
    /**
     * Get payment status
     */
    static getPaymentStatus(merchantId: string, reference: string): Promise<any>;
    /**
     * Refund payment
     */
    static refundPayment(merchantId: string, transactionId: string, amount?: number): Promise<any>;
    static findEcommercePspReference(merchantId: string, order: OnlinePaymentOrderLike & {
        id?: string | null;
    }): Promise<string | null>;
    static refundEcommercePayment(merchantId: string, pspReference: string, amount: number, currency?: string): Promise<any>;
    static refundPaidOnlineOnCancel(merchantId: string, order: OnlinePaymentOrderLike & {
        id?: string | null;
    }): Promise<{
        attempted: boolean;
        refunded: boolean;
        amount: number;
        error?: string;
    }>;
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
        terminalId: string | null;
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