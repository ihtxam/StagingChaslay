import { schema } from "@/db";
import { type GiftCardSettings } from "@/lib/gift-card-settings";
export type GiftDeliveryType = "digital" | "physical";
export declare class ShopGiftCardService {
    static settingsFromMerchant(merchant: {
        giftCardSettings?: unknown;
    }): GiftCardSettings;
    static isOnlineEnabled(settings: GiftCardSettings): boolean;
    /** Public shop settings — no auth required */
    static publicSettings(settings: GiftCardSettings): {
        enabled: boolean;
        digitalVoucherEnabled: boolean;
        physicalPostEnabled: boolean;
        presetDenominations: number[];
        minAmount: number;
        maxAmount: number;
        customAmountEnabled: boolean;
    };
    /** Public balance lookup — returns balance + masked holder email */
    static lookupPublicBalance(merchantId: string, code: string): Promise<{
        holderName: any;
        holderEmailMasked: string | null;
        mediaType: any;
        code: string;
        qrPayload: string;
        barcodePayload: string;
        redeemUrl: string;
        balance: number;
    }>;
    static validateDeliveryType(deliveryType: GiftDeliveryType, settings: GiftCardSettings): void;
    static createOnlinePurchase(merchant: {
        id: string;
        slug?: string | null;
        subdomain?: string | null;
        customDomain?: string | null;
        name: string;
        adyenMerchantAccount?: string | null;
        adyenApiKey?: string | null;
        adyenClientId?: string | null;
        giftCardSettings?: unknown;
    }, slug: string, input: {
        amount: number;
        deliveryType?: GiftDeliveryType;
        recipientEmail: string;
        recipientName?: string;
        senderName?: string;
        senderEmail?: string;
        message?: string;
        shippingAddress?: string;
        shippingZip?: string;
        shippingCity?: string;
        shippingCountry?: string;
        paymentMethod?: "card";
        origin?: string;
        shopPath?: string;
    }): Promise<{
        purchase: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            amount: string;
            paymentStatus: string;
            paymentMethod: string;
            adyenReference: string | null;
            shippingAddress: string | null;
            cardId: string | null;
            recipientEmail: string;
            recipientName: string | null;
            senderName: string | null;
            senderEmail: string | null;
            message: string | null;
            deliveryType: string;
            shippingZip: string | null;
            shippingCity: string | null;
            shippingCountry: string | null;
            fulfillmentStatus: string | null;
            shippedAt: Date | null;
            fulfilledAt: Date | null;
        };
        paymentSession: Record<string, unknown>;
        amount: number;
    }>;
    static getPurchase(merchantId: string, purchaseId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        amount: string;
        paymentStatus: string;
        paymentMethod: string;
        adyenReference: string | null;
        shippingAddress: string | null;
        cardId: string | null;
        recipientEmail: string;
        recipientName: string | null;
        senderName: string | null;
        senderEmail: string | null;
        message: string | null;
        deliveryType: string;
        shippingZip: string | null;
        shippingCity: string | null;
        shippingCountry: string | null;
        fulfillmentStatus: string | null;
        shippedAt: Date | null;
        fulfilledAt: Date | null;
    }>;
    static purchasePublicView(purchase: typeof schema.giftCardPurchases.$inferSelect, card: {
        ecardCode?: string | null;
        balance?: string | null;
    } | null): {
        id: string;
        amount: string;
        deliveryType: string;
        recipientEmail: string;
        recipientName: string | null;
        senderName: string | null;
        message: string | null;
        paymentStatus: string;
        fulfillmentStatus: string | null;
        shippingAddress: string | null;
        shippingZip: string | null;
        shippingCity: string | null;
        shippingCountry: string | null;
        shippedAt: Date | null;
        fulfilledAt: Date | null;
        cardCode: string | null;
        cardBalance: string | null;
        qrPayload: string | null;
        barcodePayload: string | null;
        redeemUrl: string | null;
    };
    /** Fulfill after Adyen payment — issue e-card and email recipient or queue physical shipment */
    static confirmPurchasePayment(merchantId: string, purchaseId: string, pspReference?: string): Promise<{
        purchase: {
            id: string;
            merchantId: string;
            amount: string;
            recipientEmail: string;
            recipientName: string | null;
            senderName: string | null;
            senderEmail: string | null;
            message: string | null;
            paymentMethod: string;
            paymentStatus: string;
            deliveryType: string;
            shippingAddress: string | null;
            shippingZip: string | null;
            shippingCity: string | null;
            shippingCountry: string | null;
            fulfillmentStatus: string | null;
            shippedAt: Date | null;
            adyenReference: string | null;
            cardId: string | null;
            fulfilledAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        card: {
            id: string;
            merchantId: string;
            cardNumber: string;
            cardMediaType: string;
            balance: string;
            status: string;
            suspendedReason: string | null;
            customerId: string | null;
            membershipEnabled: boolean;
            membershipPlanId: string | null;
            stampCount: number;
            pointsBalance: number;
            holderName: string | null;
            holderEmail: string | null;
            holderPhone: string | null;
            ecardEmail: string | null;
            ecardCode: string | null;
            issuedAt: Date;
            expiresAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        alreadyFulfilled: boolean;
    }>;
    /** Merchant: list online purchases awaiting physical shipment */
    static listPendingShipments(merchantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        amount: string;
        paymentStatus: string;
        paymentMethod: string;
        adyenReference: string | null;
        shippingAddress: string | null;
        cardId: string | null;
        recipientEmail: string;
        recipientName: string | null;
        senderName: string | null;
        senderEmail: string | null;
        message: string | null;
        deliveryType: string;
        shippingZip: string | null;
        shippingCity: string | null;
        shippingCountry: string | null;
        fulfillmentStatus: string | null;
        shippedAt: Date | null;
        fulfilledAt: Date | null;
    }[]>;
    /** Merchant: mark physical gift card as shipped */
    static markPurchaseShipped(merchantId: string, purchaseId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        amount: string;
        paymentStatus: string;
        paymentMethod: string;
        adyenReference: string | null;
        shippingAddress: string | null;
        cardId: string | null;
        recipientEmail: string;
        recipientName: string | null;
        senderName: string | null;
        senderEmail: string | null;
        message: string | null;
        deliveryType: string;
        shippingZip: string | null;
        shippingCity: string | null;
        shippingCountry: string | null;
        fulfillmentStatus: string | null;
        shippedAt: Date | null;
        fulfilledAt: Date | null;
    }>;
    /** Redeem gift card at shop checkout — returns discount amount applied */
    static redeemForOrder(merchantId: string, code: string, orderTotal: number, orderId: string): Promise<{
        amountRedeemed: number;
        remainingBalance: number;
        cardId: string;
    }>;
}
//# sourceMappingURL=shop-gift-card.service.d.ts.map