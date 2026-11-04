/** Membership tier types — mirrors backend membership-plans.ts */

export type MembershipPlanType = 'discount' | 'stamp_card';

export type MembershipPlan = {
  id: string;
  label: string;
  type: MembershipPlanType;
  discountPercent?: number;
  stampsRequired?: number;
  /** When set, only this product earns stamps (quantity = stamps per sale). */
  stampProductId?: string | null;
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

export function countStampIncrementForSale(
  plan: MembershipPlan,
  lines: { productId?: string | null; quantity?: number; giftCard?: boolean }[]
): number {
  if (plan.type !== 'stamp_card') return 0;
  const merchLines = lines.filter(
    (l) =>
      !l.giftCard &&
      l.productId &&
      !String(l.productId).startsWith('__gift_card_')
  );
  if (!merchLines.length) return 0;
  const stampProductId = plan.stampProductId?.trim();
  if (!stampProductId) return 1;
  let count = 0;
  for (const line of merchLines) {
    if (String(line.productId) === stampProductId) {
      count += Math.max(1, Math.floor(Number(line.quantity) || 1));
    }
  }
  return count;
}

export const DEFAULT_MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'coffee-club',
    label: 'Coffee Club',
    type: 'stamp_card',
    stampsRequired: 10,
    active: true,
    sellPrice: 0,
  },
  { id: 'regular', label: 'Regular', type: 'discount', discountPercent: 0, active: true },
  { id: 'member-5', label: 'Member 5%', type: 'discount', discountPercent: 5, active: true },
  {
    id: 'rewards-bronze',
    label: 'Bronze (points)',
    type: 'discount',
    discountPercent: 5,
    minPoints: 250,
    active: true,
  },
  {
    id: 'rewards-silver',
    label: 'Silver (points)',
    type: 'discount',
    discountPercent: 10,
    minPoints: 750,
    active: true,
  },
  {
    id: 'rewards-gold',
    label: 'Gold (points)',
    type: 'discount',
    discountPercent: 15,
    minPoints: 1500,
    active: true,
  },
];
