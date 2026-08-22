import { type GiftCardSettings } from "@/lib/gift-card-settings";
export declare class ShopGiftCardService {
    static settingsFromMerchant(merchant: {
        giftCardSettings?: unknown;
    }): GiftCardSettings;
    static isOnlineEnabled(settings: GiftCardSettings): boolean;
    /** Public shop settings — no auth required */
    static publicSettings(settings: GiftCardSettings): {
        enabled: boolean;
        presetDenominations: number[];
        minAmount: number;
        maxAmount: number;
        customAmountEnabled: boolean;
    };
    /** Public balance lookup — returns balance + masked holder email */
    static lookupPublicBalance(merchantId: string, code: string): Promise<{
        balance: number;
        code: any;
        holderName: any;
        holderEmailMasked: string | null;
        redeemUrl: string;
        mediaType: any;
    }>;
    static createOnlinePurchase(merchant: {
        id: string;
        slug?: string | null;
        name: string;
        adyenMerchantAccount?: string | null;
        adyenApiKey?: string | null;
        adyenClientId?: string | null;
        giftCardSettings?: unknown;
    }, slug: string, input: {
        amount: number;
        recipientEmail: string;
        recipientName?: string;
        senderName?: string;
        senderEmail?: string;
        message?: string;
        paymentMethod?: "card";
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
            cardId: string | null;
            recipientEmail: string;
            recipientName: string | null;
            senderName: string | null;
            senderEmail: string | null;
            message: string | null;
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
        cardId: string | null;
        recipientEmail: string;
        recipientName: string | null;
        senderName: string | null;
        senderEmail: string | null;
        message: string | null;
        fulfilledAt: Date | null;
    }>;
    /** Fulfill after Adyen payment — issue e-card and email recipient */
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
    /** Redeem gift card at shop checkout — returns discount amount applied */
    static redeemForOrder(merchantId: string, code: string, orderTotal: number, orderId: string): Promise<{
        amountRedeemed: number;
        remainingBalance: number;
        cardId: string;
    }>;
}
//# sourceMappingURL=shop-gift-card.service.d.ts.map