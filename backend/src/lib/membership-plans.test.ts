import { describe, expect, it } from "vitest";
import {
  applyStampProgress,
  countStampIncrementForSale,
  resolveEffectiveMembershipPlan,
  type MembershipPlan,
} from "./membership-plans";

describe("membership-plans", () => {
  it("applyStampProgress resets after reward", () => {
    const plan: MembershipPlan = {
      id: "coffee",
      label: "Coffee Club",
      type: "stamp_card",
      stampsRequired: 10,
      active: true,
    };
    const { stampCount, rewardEarned } = applyStampProgress(plan, 9, 1);
    expect(rewardEarned).toBe(true);
    expect(stampCount).toBe(0);
  });

  it("countStampIncrementForSale defaults to one stamp per merch sale", () => {
    const plan: MembershipPlan = {
      id: "coffee",
      label: "Coffee Club",
      type: "stamp_card",
      stampsRequired: 10,
      active: true,
    };
    expect(
      countStampIncrementForSale(plan, [{ productId: "abc", quantity: 2 }])
    ).toBe(1);
  });

  it("countStampIncrementForSale counts product units when stampProductId set", () => {
    const plan: MembershipPlan = {
      id: "coffee",
      label: "Coffee Club",
      type: "stamp_card",
      stampsRequired: 10,
      stampProductId: "latte-uuid",
      active: true,
    };
    expect(
      countStampIncrementForSale(plan, [
        { productId: "latte-uuid", quantity: 2 },
        { productId: "other", quantity: 1 },
      ])
    ).toBe(2);
    expect(countStampIncrementForSale(plan, [{ productId: "other", quantity: 1 }])).toBe(0);
  });

  it("resolveEffectiveMembershipPlan picks highest open tier from points", () => {
    const plans: MembershipPlan[] = [
      {
        id: "bronze",
        label: "Bronze",
        type: "discount",
        discountPercent: 5,
        minPoints: 250,
        active: true,
      },
      {
        id: "gold",
        label: "Gold",
        type: "discount",
        discountPercent: 15,
        minPoints: 1500,
        active: true,
      },
    ];
    expect(resolveEffectiveMembershipPlan(plans, null, 800)?.id).toBe("bronze");
    expect(resolveEffectiveMembershipPlan(plans, null, 2000)?.id).toBe("gold");
    expect(resolveEffectiveMembershipPlan(plans, "bronze", 2000)?.id).toBe("bronze");
  });
});
