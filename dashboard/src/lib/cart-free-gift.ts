import { roundMoney2 } from '@/lib/money';

export type CartGiftTier = {
  minCartTotal: number;
  productIds: string[];
  label?: string;
};

export type LiveCartFreeGiftOffer = {
  id: string;
  name: string;
  description?: string | null;
  badgeLabel?: string | null;
  offerType?: string;
  rules?: { cartGiftTiers?: CartGiftTier[] } | null;
  channels?: string[];
};

export function activeCartFreeGiftOffers(
  offers: LiveCartFreeGiftOffer[],
  channel?: string
): LiveCartFreeGiftOffer[] {
  return offers.filter((o) => {
    if (o.offerType !== 'cart_free_gift') return false;
    const channels = o.channels || [];
    if (channel && channels.length && !channels.includes(channel)) return false;
    return normalizeCartGiftTiers(o.rules).length > 0;
  });
}

export function normalizeCartGiftTiers(raw: unknown): CartGiftTier[] {
  if (!raw || typeof raw !== 'object') return [];
  const tiers = (raw as { cartGiftTiers?: CartGiftTier[] }).cartGiftTiers;
  if (!Array.isArray(tiers)) return [];
  return tiers
    .map((t, idx) => ({
      minCartTotal: roundMoney2(Number(t?.minCartTotal) || 0),
      productIds: Array.isArray(t?.productIds)
        ? [...new Set(t.productIds.map(String).filter(Boolean))]
        : [],
      label: t?.label?.trim() || undefined,
      _idx: idx,
    }))
    .filter((t) => t.minCartTotal > 0 && t.productIds.length > 0)
    .sort((a, b) => a.minCartTotal - b.minCartTotal || a._idx - b._idx)
    .map(({ _idx, ...t }) => t);
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

export function cartPaidSubtotal(
  items: Array<{
    price: number;
    quantity: number;
    loyaltyReward?: boolean;
    cartFreeGiftOfferId?: string;
    cartFreeGiftTierIndex?: number;
  }>
): number {
  return roundMoney2(
    items
      .filter(
        (i) =>
          !i.loyaltyReward &&
          !(i.cartFreeGiftOfferId && i.cartFreeGiftTierIndex != null)
      )
      .reduce((s, i) => s + i.price * i.quantity, 0)
  );
}

export type CartFreeGiftCampaign = {
  offer: LiveCartFreeGiftOffer;
  tiers: CartGiftTierStatus[];
};

export function computeCartFreeGiftCampaigns(input: {
  offers: LiveCartFreeGiftOffer[];
  channel?: string;
  cartItems: Array<{
    id: string;
    cartFreeGiftOfferId?: string;
    cartFreeGiftTierIndex?: number;
    price: number;
    quantity: number;
    loyaltyReward?: boolean;
  }>;
}): CartFreeGiftCampaign[] {
  const active = activeCartFreeGiftOffers(input.offers, input.channel);
  const subtotal = cartPaidSubtotal(input.cartItems);
  return active.map((offer) => {
    const tiers = normalizeCartGiftTiers(offer.rules);
    const claimed = new Map<number, string>();
    for (const item of input.cartItems) {
      if (
        item.cartFreeGiftOfferId === offer.id &&
        item.cartFreeGiftTierIndex != null
      ) {
        claimed.set(item.cartFreeGiftTierIndex, item.id);
      }
    }
    return {
      offer,
      tiers: evaluateCartGiftTiers({ tiers, subtotal, claimedByTier: claimed }),
    };
  });
}

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
