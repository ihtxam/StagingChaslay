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
  /** Auto-qualify when the customer has at least this many points and no assigned plan. */
  minPoints?: number;
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

export function findMembershipPlan(
  plans: MembershipPlan[],
  planId: string | null | undefined
): MembershipPlan | null {
  if (!planId) return null;
  return plans.find((p) => p.id === planId && p.active) || null;
}

/** Assigned tier wins; otherwise the highest minPoints discount the customer qualifies for. */
export function resolveEffectiveMembershipPlan(
  plans: MembershipPlan[],
  assignedPlanId: string | null | undefined,
  points: number
): MembershipPlan | null {
  const assigned = findMembershipPlan(plans, assignedPlanId);
  if (assigned) return assigned;
  const pts = Math.max(0, Number(points) || 0);
  const auto = plans
    .filter(
      (p) =>
        p.active &&
        p.type === 'discount' &&
        (p.minPoints || 0) > 0 &&
        pts >= (p.minPoints || 0)
    )
    .sort((a, b) => (b.minPoints || 0) - (a.minPoints || 0));
  return auto[0] || null;
}

export function membershipDiscountPercentFromPlan(plan: MembershipPlan | null | undefined): number {
  if (!plan || plan.type !== 'discount' || !plan.active) return 0;
  return Math.min(100, Math.max(0, Number(plan.discountPercent) || 0));
}

/** Bill discount percent from an attached membership discount plan. */
export function membershipDiscountPercent(membership: {
  membershipEnabled?: boolean;
  membershipPlan?: MembershipPlan | null;
} | null | undefined): number {
  if (membership && membership.membershipEnabled === false) return 0;
  return membershipDiscountPercentFromPlan(membership?.membershipPlan);
}

export const DEFAULT_MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'student-10', label: 'Student', type: 'discount', discountPercent: 10, active: true },
  { id: 'vip-20', label: 'VIP', type: 'discount', discountPercent: 20, active: true },
  { id: 'family-5', label: 'Family', type: 'discount', discountPercent: 5, active: true },
  { id: 'special-guest', label: 'Special guest', type: 'discount', discountPercent: 0, active: true },
  { id: 'coffee-club', label: 'Coffee Club', type: 'stamp_card', stampsRequired: 6, active: true },
];
