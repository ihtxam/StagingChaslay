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
  /**
   * Auto-qualify when the customer has at least this many loyalty points
   * and no plan is assigned by hand.
   */
  minPoints?: number;
  active: boolean;
};

export const DEFAULT_MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "student-10",
    label: "Student",
    type: "discount",
    discountPercent: 10,
    active: true,
  },
  {
    id: "vip-20",
    label: "VIP",
    type: "discount",
    discountPercent: 20,
    active: true,
  },
  {
    id: "family-5",
    label: "Family",
    type: "discount",
    discountPercent: 5,
    active: true,
  },
  {
    id: "special-guest",
    label: "Special guest",
    type: "discount",
    discountPercent: 0,
    active: true,
  },
  {
    id: "coffee-club",
    label: "Coffee Club",
    type: "stamp_card",
    stampsRequired: 6,
    active: true,
  },
];

function slugId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `plan-${Date.now()}`;
}

export function normalizeMembershipPlan(raw: unknown, index: number): MembershipPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const type: MembershipPlanType =
    src.type === "stamp_card" ? "stamp_card" : "discount";
  const label = String(src.label || "").trim();
  if (!label) return null;
  const id = String(src.id || slugId(label)).trim() || slugId(`${label}-${index}`);
  const discountPercent =
    type === "discount" ? Math.min(100, Math.max(0, Number(src.discountPercent) || 0)) : undefined;
  const stampsRequired =
    type === "stamp_card"
      ? Math.max(1, Math.floor(Number(src.stampsRequired) || 6))
      : undefined;
  const sellPriceRaw = src.sellPrice != null ? Number(src.sellPrice) : undefined;
  const sellPrice =
    sellPriceRaw != null && Number.isFinite(sellPriceRaw) && sellPriceRaw >= 0
      ? Math.round(sellPriceRaw * 100) / 100
      : undefined;
  const minPointsRaw = src.minPoints != null ? Math.floor(Number(src.minPoints)) : 0;
  const minPoints = Number.isFinite(minPointsRaw) && minPointsRaw > 0 ? minPointsRaw : undefined;
  return {
    id,
    label,
    type,
    discountPercent,
    stampsRequired,
    rewardProductId: src.rewardProductId ? String(src.rewardProductId) : null,
    sellPrice,
    minPoints,
    active: src.active !== false,
  };
}

export function normalizeMembershipPlans(raw: unknown): MembershipPlan[] {
  if (!Array.isArray(raw)) return [];
  const out: MembershipPlan[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const plan = normalizeMembershipPlan(raw[i], i);
    if (!plan || seen.has(plan.id)) continue;
    seen.add(plan.id);
    out.push(plan);
  }
  return out;
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
        p.type === "discount" &&
        (p.minPoints || 0) > 0 &&
        pts >= (p.minPoints || 0)
    )
    .sort((a, b) => (b.minPoints || 0) - (a.minPoints || 0));
  return auto[0] || null;
}

export function membershipDiscountPercentFromPlan(plan: MembershipPlan | null | undefined): number {
  if (!plan || plan.type !== "discount" || !plan.active) return 0;
  return Math.min(100, Math.max(0, Number(plan.discountPercent) || 0));
}

/** After a qualifying sale, compute new stamp count and whether reward is earned. */
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
