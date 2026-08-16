/** Membership tier types — mirrors backend membership-plans.ts */

export type MembershipPlanType = 'discount' | 'stamp_card';

export type MembershipPlan = {
  id: string;
  label: string;
  type: MembershipPlanType;
  discountPercent?: number;
  stampsRequired?: number;
  rewardProductId?: string | null;
  sellPrice?: number;
  active: boolean;
};

export function applyStampProgress(
  plan: MembershipPlan,
  currentStamps: number,
  increment = 1
): { stampCount: number; rewardEarned: boolean } {
  const required = Math.max(1, plan.stampsRequired || 6);
  let next = Math.max(0, currentStamps) + Math.max(1, increment);
  let rewardEarned = false;
  if (next >= required) {
    rewardEarned = true;
    next = 0;
  }
  return { stampCount: next, rewardEarned };
}

/** Bill discount percent from an attached membership discount plan. */
export function membershipDiscountPercent(membership: {
  membershipEnabled: boolean;
  membershipPlan?: MembershipPlan | null;
} | null | undefined): number {
  if (!membership?.membershipEnabled) return 0;
  const plan = membership.membershipPlan;
  if (!plan || plan.type !== 'discount' || !plan.active) return 0;
  return Math.min(100, Math.max(0, Number(plan.discountPercent) || 0));
}

export const DEFAULT_MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'student-10', label: 'Student', type: 'discount', discountPercent: 10, active: true },
  { id: 'vip-20', label: 'VIP', type: 'discount', discountPercent: 20, active: true },
  { id: 'coffee-club', label: 'Coffee Club', type: 'stamp_card', stampsRequired: 6, active: true },
];
