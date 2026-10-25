/** Platform default: CHF 0.15 per SMS segment (15 Rappen). */
export const DEFAULT_SMS_UNIT_PRICE_CENTS = 15;

export const MIN_SMS_UNIT_PRICE_CENTS = 1;
export const MAX_SMS_UNIT_PRICE_CENTS = 500;

export function normalizeSmsUnitPriceCents(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN_SMS_UNIT_PRICE_CENTS) return DEFAULT_SMS_UNIT_PRICE_CENTS;
  return Math.min(MAX_SMS_UNIT_PRICE_CENTS, n);
}

export function smsBillableCents(segments: number, unitPriceCents: number): number {
  const segs = Math.max(1, Math.floor(Number(segments) || 1));
  const unit = normalizeSmsUnitPriceCents(unitPriceCents);
  return segs * unit;
}

export function formatSmsUnitPriceChf(unitPriceCents: number): string {
  return (normalizeSmsUnitPriceCents(unitPriceCents) / 100).toFixed(2);
}

export function formatSmsBillChf(billableCents: number): string {
  return (Math.max(0, Math.floor(Number(billableCents) || 0)) / 100).toFixed(2);
}
