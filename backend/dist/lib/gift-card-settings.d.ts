import { type MembershipPlan } from "@/lib/membership-plans";
export type GiftCardSettings = {
    enabled: boolean;
    presetDenominations: number[];
    minAmount: number;
    maxAmount: number;
    reloadEnabled: boolean;
    customAmountEnabled: boolean;
    /** Allow purchasing gift cards on the online shop */
    onlinePurchaseEnabled?: boolean;
    /** Digital voucher (email + QR/barcode redeemable at POS) */
    digitalVoucherEnabled?: boolean;
    /** Physical gift card shipped by post */
    physicalPostEnabled?: boolean;
    /** Flat CHF added when deliveryType is physical */
    physicalPostFee?: number;
    /** Optional flat service / handling fee on online gift purchases */
    serviceFeeFlat?: number;
    /** Optional % of (face + shipping) added as service fee */
    serviceFeePercent?: number;
    /** When true, add card processing fee % to customer total */
    passCardFeeToCustomer?: boolean;
    /** Card fee % of subtotal (face + shipping + service) when pass-through enabled */
    cardFeePercent?: number;
    /** Enable membership card sell / tier benefits */
    membershipEnabled?: boolean;
    /** Configurable membership tiers (discount %, stamp cards, etc.) */
    membershipPlans?: MembershipPlan[];
};
export declare const DEFAULT_GIFT_CARD_SETTINGS: GiftCardSettings;
export declare function normalizeGiftCardSettings(raw: unknown): GiftCardSettings;
export declare function validateGiftAmount(amount: number, settings: GiftCardSettings, opts?: {
    allowCustomOverMax?: boolean;
}): {
    ok: true;
    amount: number;
} | {
    ok: false;
    error: string;
};
//# sourceMappingURL=gift-card-settings.d.ts.map