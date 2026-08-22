import { type MembershipPlan } from "@/lib/membership-plans";
export type GiftCardSettings = {
    enabled: boolean;
    presetDenominations: number[];
    minAmount: number;
    maxAmount: number;
    reloadEnabled: boolean;
    customAmountEnabled: boolean;
    /** Allow purchasing e-gift cards on the online shop */
    onlinePurchaseEnabled?: boolean;
    /** Enable membership card sell / tier benefits */
    membershipEnabled?: boolean;
    /** Configurable membership tiers (discount %, stamp cards, etc.) */
    membershipPlans?: MembershipPlan[];
};
export declare const DEFAULT_GIFT_CARD_SETTINGS: GiftCardSettings;
export declare function normalizeGiftCardSettings(raw: unknown): GiftCardSettings;
export declare function validateGiftAmount(amount: number, settings: GiftCardSettings): {
    ok: true;
    amount: number;
} | {
    ok: false;
    error: string;
};
//# sourceMappingURL=gift-card-settings.d.ts.map