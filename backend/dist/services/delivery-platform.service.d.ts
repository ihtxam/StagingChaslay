import { type DeliveryPlatformSettings, type OrderSource } from "@/lib/delivery-platform-settings";
export type ExternalOrderLine = {
    productId?: string | null;
    sku?: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    selectedExtras?: Array<{
        id: string;
        name: string;
        price: number;
    }>;
    comboSelections?: Array<{
        slotName: string;
        productName: string;
        selectedExtras?: Array<{
            id: string;
            name: string;
            price: number;
        }>;
    }>;
};
export type ExternalOrderPayload = {
    externalOrderId: string;
    fulfillmentChannel?: "takeaway" | "dine_in" | "delivery";
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    shippingAddress?: string | null;
    notes?: string | null;
    items: ExternalOrderLine[];
    subtotal?: number;
    taxAmount?: number;
    deliveryFee?: number;
    tipAmount?: number;
    total?: number;
    scheduledFor?: string | null;
};
export declare class DeliveryPlatformService {
    static getPublicSettings(raw: unknown): DeliveryPlatformSettings & {
        justEat?: import("@/lib/delivery-platform-settings").DeliveryPlatformCredentials & {
            apiKeySet?: boolean;
            apiKeyMasked?: string | null;
            apiSecretSet?: boolean;
            apiSecretMasked?: string | null;
            webhookSecretSet?: boolean;
            webhookSecretMasked?: string | null;
        };
        uberEats?: import("@/lib/delivery-platform-settings").DeliveryPlatformCredentials & {
            clientId?: string | null;
            clientSecretSet?: boolean;
            clientSecretMasked?: string | null;
            webhookSecretSet?: boolean;
            webhookSecretMasked?: string | null;
        };
    };
    static updateSettings(merchantId: string, updates: DeliveryPlatformSettings): Promise<DeliveryPlatformSettings>;
    static getPlatformConfig(merchantId: string, platform: string): Promise<{
        merchant: {
            name: string;
            deliveryPlatformSettings: Record<string, unknown> | null;
        };
        source: "justeat" | "ubereats";
        key: import("@/lib/delivery-platform-settings").DeliveryPlatformKey;
        cfg: import("@/lib/delivery-platform-settings").DeliveryPlatformCredentials;
    }>;
    static verifyWebhook(opts: {
        platform: string;
        merchantId: string;
        headers: Record<string, string | string[] | undefined>;
        rawBody: string;
    }): Promise<{
        source: OrderSource;
        cfg: DeliveryPlatformSettings["justEat"];
    }>;
    static jetConnectApiBase(testMode: boolean): string;
    /** JET Connect async webhooks expect a callback POST after processing. */
    static sendJetConnectAsyncCallback(callbackUrl: string, success: boolean, message: string): Promise<void>;
    /** Resolve Uber notification-only webhooks via Eats API when credentials are configured. */
    static enrichUberWebhookBody(merchantId: string, mapped: unknown): Promise<unknown>;
    static fetchUberAccessToken(clientId: string, clientSecret: string): Promise<string>;
    /** Notify partner that Chaslay accepted the order (best-effort skeleton). */
    static notifyPartnerOrderAccepted(merchantId: string, order: {
        id: string;
        orderSource?: string | null;
        externalOrderId?: string | null;
    }): Promise<void>;
    static normalizeWebhookPayload(body: unknown): ExternalOrderPayload;
    static ingestOrder(merchantId: string, source: OrderSource, payload: ExternalOrderPayload): Promise<{
        order: {
            id: string;
            createdAt: Date;
            status: string;
            merchantId: string;
            deviceId: string | null;
            paymentStatus: string | null;
            paymentMethod: string | null;
            invoiceNumber: string | null;
            clientId: string | null;
            customerId: string | null;
            orderNumber: string;
            orderType: string;
            orderSource: string | null;
            externalOrderId: string | null;
            fulfillmentChannel: string | null;
            subtotal: string;
            taxAmount: string;
            discountAmount: string | null;
            deliveryFee: string | null;
            tipAmount: string | null;
            roundingAmount: string | null;
            amountTendered: string | null;
            changeDue: string | null;
            staffName: string | null;
            staffId: string | null;
            cardFee: string | null;
            pointsDiscount: string | null;
            pointsEarned: number | null;
            pointsRedeemed: number | null;
            total: string;
            invoiceIssuedAt: Date | null;
            invoiceDueAt: Date | null;
            adyenReference: string | null;
            adyenPoiTransactionTs: Date | null;
            adyenCustomerReceiptJson: string | null;
            adyenCashierReceiptJson: string | null;
            notes: string | null;
            shippingAddress: string | null;
            deliveryZoneId: string | null;
            scheduledFor: Date | null;
            customerName: string | null;
            customerPhone: string | null;
            customerEmail: string | null;
            tableId: string | null;
            tableLabel: string | null;
            guestCount: number | null;
            billSplits: {
                id: string;
                label: string;
                seatNumber?: number | null;
                amount: number;
                paymentMethod?: string;
                paymentStatus: string;
                paidAt?: string | null;
            }[] | null;
            masterOrderId: string | null;
            splitCheckNumber: number | null;
            syncedAt: Date | null;
            completedAt: Date | null;
            estimatedReadyAt: Date | null;
            printCount: number | null;
            cancelReason: string | null;
            cancelledAt: Date | null;
            refundAmount: string | null;
            refundedAt: Date | null;
            refundReason: string | null;
            goodwillAmount: string | null;
            paymentBreakdown: {
                method: string;
                amount: number;
            }[] | null;
        };
        created: boolean;
    }>;
    static enqueueAutoPrint(merchantId: string, orderId: string, orderSource: OrderSource, opts?: {
        printKitchen?: boolean;
        printReceipt?: boolean;
        printNotification?: boolean;
    }): Promise<void>;
    static webhookUrl(platform: string, merchantId: string): string;
}
//# sourceMappingURL=delivery-platform.service.d.ts.map