import { roundMoney2 } from "./money";

export type CartGiftTier = {
  minCartTotal: number;
  productIds: string[];
  label?: string;
};

export type CartGiftTierRules = {
  cartGiftTiers?: CartGiftTier[];
};

export function normalizeCartGiftTiers(raw: unknown): CartGiftTier[] {
  if (!raw || typeof raw !== "object") return [];
  const tiers = (raw as CartGiftTierRules).cartGiftTiers;
  if (!Array.isArray(tiers)) return [];
  return tiers
    .map((t, idx) => {
      const minCartTotal = roundMoney2(Number(t?.minCartTotal) || 0);
      const productIds = Array.isArray(t?.productIds)
        ? [...new Set(t.productIds.map(String).filter(Boolean))]
        : [];
      const label = t?.label != null ? String(t.label).trim().slice(0, 120) : undefined;
      return { minCartTotal, productIds, label, _idx: idx };
    })
    .filter((t) => t.minCartTotal > 0 && t.productIds.length > 0)
    .sort((a, b) => a.minCartTotal - b.minCartTotal || a._idx - b._idx)
    .map(({ _idx, ...t }) => t);
}

export type CartLineForGiftSubtotal = {
  unitPrice: number;
  quantity: number;
  loyaltyReward?: boolean;
  cartFreeGiftOfferId?: string | null;
  cartFreeGiftTierIndex?: number | null;
};

/** Paid merchandise subtotal (excludes loyalty rewards and cart free-gift lines). */
export function cartPaidSubtotal(lines: CartLineForGiftSubtotal[]): number {
  return roundMoney2(
    lines
      .filter(
        (l) =>
          !l.loyaltyReward &&
          !(l.cartFreeGiftOfferId && l.cartFreeGiftTierIndex != null)
      )
      .reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0), 0)
  );
}

export type CartGiftTierStatus = {
  tierIndex: number;
  minCartTotal: number;
  productIds: string[];
  label?: string;
  unlocked: boolean;
  remaining: number;
  claimedProductId?: string | null;
};

export function evaluateCartGiftTiers(input: {
  tiers: CartGiftTier[];
  subtotal: number;
  claimedByTier: Map<number, string>;
}): CartGiftTierStatus[] {
  const { tiers, subtotal, claimedByTier } = input;
  return tiers.map((tier, tierIndex) => {
    const unlocked = subtotal + 0.001 >= tier.minCartTotal;
    const remaining = unlocked ? 0 : roundMoney2(Math.max(0, tier.minCartTotal - subtotal));
    return {
      tierIndex,
      minCartTotal: tier.minCartTotal,
      productIds: tier.productIds,
      label: tier.label,
      unlocked,
      remaining,
      claimedProductId: claimedByTier.get(tierIndex) ?? null,
    };
  });
}

export function validateCartFreeGiftLine(input: {
  offerId: string;
  tierIndex: number;
  productId: string;
  tiers: CartGiftTier[];
  paidSubtotal: number;
}): string | null {
  const tier = input.tiers[input.tierIndex];
  if (!tier) return "Invalid free gift tier";
  if (input.paidSubtotal + 0.001 < tier.minCartTotal) {
    return `Cart total must be at least CHF ${tier.minCartTotal.toFixed(2)} for this free gift`;
  }
  if (!tier.productIds.includes(input.productId)) {
    return "Product is not allowed for this free gift tier";
  }
  void input.offerId;
  return null;
}
