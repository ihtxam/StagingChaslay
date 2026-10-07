export type CartGiftTier = {
    minCartTotal: number;
    productIds: string[];
    label?: string;
};
export type CartGiftTierRules = {
    cartGiftTiers?: CartGiftTier[];
};
export declare function normalizeCartGiftTiers(raw: unknown): CartGiftTier[];
export type CartLineForGiftSubtotal = {
    unitPrice: number;
    quantity: number;
    loyaltyReward?: boolean;
    cartFreeGiftOfferId?: string | null;
    cartFreeGiftTierIndex?: number | null;
};
/** Paid merchandise subtotal (excludes loyalty rewards and cart free-gift lines). */
export declare function cartPaidSubtotal(lines: CartLineForGiftSubtotal[]): number;
export type CartGiftTierStatus = {
    tierIndex: number;
    minCartTotal: number;
    productIds: string[];
    label?: string;
    unlocked: boolean;
    remaining: number;
    claimedProductId?: string | null;
};
export declare function evaluateCartGiftTiers(input: {
    tiers: CartGiftTier[];
    subtotal: number;
    claimedByTier: Map<number, string>;
}): CartGiftTierStatus[];
export declare function validateCartFreeGiftLine(input: {
    offerId: string;
    tierIndex: number;
    productId: string;
    tiers: CartGiftTier[];
    paidSubtotal: number;
    currency?: string;
}): string | null;
//# sourceMappingURL=cart-free-gift.d.ts.map