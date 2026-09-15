type RequestLike = {
    protocol?: string;
    get(name: string): string | undefined;
};
export declare class AdyenMerchantWebhookService {
    static webhookUrl(merchantId: string): string;
    /** Prefer the host the merchant is using (chaslay vs rebornSense) for copy-paste URLs. */
    static webhookUrlFromRequest(merchantId: string, req: RequestLike): string;
    static processWebhook(merchantId: string, body: unknown): Promise<void>;
    private static handleNotificationItem;
    private static findOrderByReference;
    private static recordAuthorisedPayment;
    private static markTransactionCaptured;
    private static recordRefund;
    private static markOrderPaymentFailed;
}
export {};
//# sourceMappingURL=adyen-merchant-webhook.service.d.ts.map