/** Fields Adyen signs for Standard notification webhooks (NotificationRequestItem). */
export interface AdyenNotificationRequestItem {
    pspReference?: string;
    originalReference?: string | null;
    merchantAccountCode?: string;
    merchantReference?: string;
    amount?: {
        value?: number | string;
        currency?: string;
    };
    eventCode?: string;
    success?: string | boolean;
    additionalData?: Record<string, string | undefined> | null;
}
/** Build the colon-separated payload Adyen signs for payment notifications. */
export declare function getAdyenNotificationDataToSign(item: AdyenNotificationRequestItem): string;
/** Compute expected HMAC (base64) for a Standard notification item. Key is hex from Customer Area. */
export declare function calculateAdyenNotificationHmac(item: AdyenNotificationRequestItem, hmacKeyHex: string): string;
/** Whether Adyen sent an HMAC signature on this notification item. */
export declare function adyenNotificationHasHmacSignature(item: AdyenNotificationRequestItem): boolean;
/**
 * Verify HMAC when configured. Matches swisspayoutpartner behaviour:
 * - unsigned + no merchant key → accept
 * - signed + no merchant key → reject
 * - invalid hex key → reject
 */
export declare function verifyAdyenNotificationHmac(item: AdyenNotificationRequestItem, hmacKeyHex: string | null | undefined): boolean;
//# sourceMappingURL=adyen-webhook-hmac.d.ts.map