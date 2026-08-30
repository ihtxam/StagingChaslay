import type { ShopChannel } from '@/lib/shop-hours';

/** Minutes added to base ETA for pickup range display (e.g. 20 → 20-30 min). */
export const SHOP_ETA_RANGE_BUFFER = 10;

export const PREP_TIME_PRESETS = [20, 30, 40, 50, 60] as const;

/** Minutes added on top of customer requested time when merchant accepts an order. */
export const ORDER_ACCEPT_ETA_PRESETS = [20, 30, 40, 60] as const;

export function shopEtaRange(etaMinutes: number): { min: number; max: number } {
  const min = Math.max(0, Math.round(Number(etaMinutes)) || 30);
  return { min, max: min + SHOP_ETA_RANGE_BUFFER };
}

/** Pickup / takeaway / dine-in: "20-30 min" */
export function formatShopEtaRange(etaMinutes: number, unitLabel: string): string {
  const { min, max } = shopEtaRange(etaMinutes);
  return `${min}-${max} ${unitLabel}`;
}

/** Delivery: "~45 min" */
export function formatShopEtaApprox(etaMinutes: number, unitLabel: string): string {
  const min = Math.max(0, Math.round(Number(etaMinutes)) || 30);
  return `~${min} ${unitLabel}`;
}

export function formatShopChannelEta(
  etaMinutes: number,
  channel: ShopChannel | string | undefined,
  unitLabel: string
): string {
  if (channel === 'delivery') {
    return formatShopEtaApprox(etaMinutes, unitLabel);
  }
  return formatShopEtaRange(etaMinutes, unitLabel);
}
