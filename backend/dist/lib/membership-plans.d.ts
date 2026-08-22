/** Membership tier / plan definitions stored in merchant gift_card_settings.membershipPlans */
export type MembershipPlanType = "discount" | "stamp_card";
export type MembershipPlan = {
    id: string;
    label: string;
    type: MembershipPlanType;
    /** Percent off merchandise (discount plans) */
    discountPercent?: number;
    /** Stamps required before reward (stamp_card plans) */
    stampsRequired?: number;
    /** Optional product id for free reward item */
    rewardProductId?: string | null;
    /** Optional one-time sell price in CHF */
    sellPrice?: number;
    active: boolean;
};
export declare const DEFAULT_MEMBERSHIP_PLANS: MembershipPlan[];
export declare function normalizeMembershipPlan(raw: unknown, index: number): MembershipPlan | null;
export declare function normalizeMembershipPlans(raw: unknown): MembershipPlan[];
export declare function findMembershipPlan(plans: MembershipPlan[], planId: string | null | undefined): MembershipPlan | null;
/** After a qualifying sale, compute new stamp count and whether reward is earned. */
export declare function applyStampProgress(plan: MembershipPlan, currentStamps: number, increment?: number): {
    stampCount: number;
    rewardEarned: boolean;
};
//# sourceMappingURL=membership-plans.d.ts.map