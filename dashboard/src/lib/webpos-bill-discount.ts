import { roundMoney2, roundingAdjustment, roundToStep } from '@/lib/money';
import type { BillDiscount } from '@/components/webpos/types';

export type TotalsWithDiscount = {
  subtotal: number;
  tax: number;
  rounding: number;
  total: number;
  gross?: number;
  net?: number;
  discount: number;
};

/** Merchandise base used for order-level % / fixed discount. */
export function merchandiseBase(
  totals: { subtotal: number; tax: number },
  vatIncludedInPrice: boolean
): number {
  return vatIncludedInPrice
    ? roundMoney2(totals.subtotal + totals.tax)
    : roundMoney2(totals.subtotal);
}

export function resolveBillDiscountAmount(
  totals: { subtotal: number; tax: number },
  billDiscount: BillDiscount | null | undefined,
  vatIncludedInPrice: boolean
): number {
  const merchandise = merchandiseBase(totals, vatIncludedInPrice);
  if (merchandise <= 0) return 0;
  const percent = Math.max(0, Number(billDiscount?.percent) || 0);
  const amount = Math.max(0, Number(billDiscount?.amount) || 0);
  if (percent > 0) {
    return roundMoney2((merchandise * Math.min(100, percent)) / 100);
  }
  if (amount > 0) {
    return roundMoney2(Math.min(amount, merchandise));
  }
  return 0;
}

/** Apply whole-bill discount to merchandise totals (CheckoutModal-compatible). */
export function applyBillDiscountToTotals(
  totals: {
    subtotal: number;
    tax: number;
    rounding: number;
    total: number;
    gross?: number;
    net?: number;
  },
  billDiscount: BillDiscount | null | undefined,
  vatIncludedInPrice: boolean,
  roundingStep: number,
  vatAfterDiscount = true
): TotalsWithDiscount {
  const disc = resolveBillDiscountAmount(totals, billDiscount, vatIncludedInPrice);
  if (disc <= 0) {
    return { ...totals, discount: 0 };
  }
  const merchandise = merchandiseBase(totals, vatIncludedInPrice);
  const afterDisc = roundMoney2(merchandise - disc);
  const taxShare =
    vatIncludedInPrice || vatAfterDiscount !== false
      ? merchandise > 0
        ? roundMoney2(totals.tax * (afterDisc / merchandise))
        : totals.tax
      : totals.tax;
  const preRound = vatIncludedInPrice ? afterDisc : roundMoney2(afterDisc + taxShare);
  const rounding = roundingAdjustment(preRound, roundingStep);
  const total = roundToStep(preRound + rounding, roundingStep);
  if (vatIncludedInPrice) {
    return {
      ...totals,
      subtotal: roundMoney2(afterDisc - taxShare),
      tax: taxShare,
      discount: disc,
      rounding,
      total,
      gross: afterDisc,
    };
  }
  return {
    ...totals,
    subtotal: afterDisc,
    tax: taxShare,
    discount: disc,
    rounding,
    total,
    gross: preRound,
  };
}
