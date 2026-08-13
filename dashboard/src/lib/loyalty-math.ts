/** Mirrors Android `LoyaltyMath` and `AttachedMembership`. */

export type AttachedMembership = {
  cardId: string;
  cardNumber: string;
  customerName: string | null;
  customerId: string | null;
  pointsBalance: number;
  giftBalance: number;
  membershipEnabled: boolean;
};

export const REDEEM_THRESHOLD_POINTS = 100;
export const DEFAULT_EARN_POINTS_PER_CHF = 1;
export const DEFAULT_REDEEM_POINTS_PER_CHF = 100;

export function normalizeRfidUid(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[\s:_\-]+/g, '')
    .toUpperCase();
}

export function computeEarnPoints(
  paidSubtotalChf: number,
  earnRate = DEFAULT_EARN_POINTS_PER_CHF
): number {
  return Math.floor(Math.max(0, paidSubtotalChf) * earnRate);
}

export function computeCashDiscount(
  points: number,
  redeemRate = DEFAULT_REDEEM_POINTS_PER_CHF
): number {
  const rate = Math.max(1, redeemRate);
  return Math.max(0, Math.floor(points / rate));
}

export function maxRedeemablePoints(
  payableChf: number,
  balance: number,
  redeemRate = DEFAULT_REDEEM_POINTS_PER_CHF
): number {
  const rate = Math.max(1, redeemRate);
  const maxByTotal = Math.floor(Math.max(0, payableChf) * rate);
  return Math.min(Math.max(0, balance), maxByTotal);
}
