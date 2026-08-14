import { roundMoney2 } from '@/lib/money';

/**
 * When prices are tax-exclusive and an order-level discount applies, adjust VAT:
 * - vatAfterDiscount true (default): tax scales with discounted net base — Swiss-compliant.
 * - vatAfterDiscount false: tax stays on pre-discount base; discount reduces total only.
 */
export function adjustTaxForOrderDiscount(
  taxAmount: number,
  taxableBase: number,
  discount: number,
  opts: { taxIncludedInPrice?: boolean; vatAfterDiscount?: boolean }
): number {
  const tax = roundMoney2(Number(taxAmount) || 0);
  if (opts.taxIncludedInPrice === true) return tax;
  if (opts.vatAfterDiscount === false) return tax;

  const base = roundMoney2(Number(taxableBase) || 0);
  const disc = roundMoney2(Math.max(0, Number(discount) || 0));
  if (tax <= 0 || base <= 0 || disc <= 0) return tax;

  const effectiveBase = roundMoney2(Math.max(0, base - Math.min(disc, base)));
  if (effectiveBase >= base) return tax;
  return roundMoney2(tax * (effectiveBase / base));
}
