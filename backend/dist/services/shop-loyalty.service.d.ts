/**
 * Shop fidelity formula (defaults):
 * - Earn: floor(paidFoodSubtotalCHF × earnPointsPerChf) — default 1 pt / CHF
 * - Cash redeem: floor(points / redeemPointsPerChf) CHF — default 100 pts = CHF 1
 * - Free product: product.loyaltyRewardPoints = N → spend N pts, line price 0
 * - Expiry: each earn lot expires in loyaltyPointsExpiryDays (default 30), FIFO burn
 *
 * Tip & delivery do not earn. Points discount / free rewards reduce earnable base.
 */
export type LoyaltyProgramSettings = {
    enabled: boolean;
    earnPointsPerChf: number;
    redeemPointsPerChf: number;
    expiryDays: number;
};
export type LoyaltyRewardProduct = {
    id: string;
    name: string;
    image?: string | null;
    price: number;
    loyaltyRewardPoints: number;
    unlocked: boolean;
};
export declare class ShopLoyaltyService {
    static programFromMerchant(merchant: {
        loyaltyEnabled?: boolean | null;
        loyaltyEarnPointsPerChf?: string | number | null;
        loyaltyRedeemPointsPerChf?: number | null;
        loyaltyPointsExpiryDays?: number | null;
    }): LoyaltyProgramSettings;
    static getProgram(merchantId: string): Promise<LoyaltyProgramSettings>;
    static updateProgram(merchantId: string, updates: {
        enabled?: boolean;
        earnPointsPerChf?: number;
        redeemPointsPerChf?: number;
        expiryDays?: number;
    }): Promise<LoyaltyProgramSettings>;
    /** Expire lots past expiresAt and sync customers.loyaltyPoints cache. */
    static expireAndSync(merchantId: string, customerId: string): Promise<number>;
    static syncBalanceCache(merchantId: string, customerId: string): Promise<number>;
    static getBalance(merchantId: string, customerId: string): Promise<number>;
    static computeEarnPoints(paidFoodSubtotalChf: number, earnPointsPerChf: number): number;
    static computeCashDiscount(points: number, redeemPointsPerChf: number): {
        discountChf: number;
        pointsUsed: number;
    };
    /** Max points redeemable as cash against a payable CHF base (food, fees, tax — not tip). */
    static maxRedeemablePoints(payableChf: number, balance: number, redeemPointsPerChf: number): number;
    static earnPoints(opts: {
        merchantId: string;
        customerId: string;
        orderId?: string;
        points: number;
        expiryDays: number;
        source?: string;
    }): Promise<{
        balance: number;
        points: number;
        expiresAt?: undefined;
    } | {
        balance: number;
        points: number;
        expiresAt: Date;
    }>;
    /** Burn points FIFO from oldest lots. */
    static redeemPoints(opts: {
        merchantId: string;
        customerId: string;
        points: number;
        orderId?: string;
        productId?: string;
        eventType: "redeem_cash" | "redeem_product";
        meta?: Record<string, unknown>;
    }): Promise<{
        balance: number;
        points?: undefined;
    } | {
        balance: number;
        points: number;
    }>;
    static listRewardProducts(merchantId: string, balance: number): Promise<LoyaltyRewardProduct[]>;
    static getCustomerLoyaltySummary(merchantId: string, customerId: string): Promise<{
        program: LoyaltyProgramSettings;
        balance: number;
        rewards: LoyaltyRewardProduct[];
        unlockedRewards: LoyaltyRewardProduct[];
        nextReward: LoyaltyRewardProduct | null;
        progress: number;
        progressPercent: number;
        expiringSoon: {
            points: number;
            expiresAt: Date;
        } | null;
        formula: {
            earn: string;
            redeem: string;
            expiry: string;
        };
    }>;
    /** Public program + rewards (no customer) for menu bar when logged out. */
    static getPublicLoyalty(merchantId: string): Promise<{
        program: LoyaltyProgramSettings;
        rewards: LoyaltyRewardProduct[];
    }>;
}
//# sourceMappingURL=shop-loyalty.service.d.ts.map