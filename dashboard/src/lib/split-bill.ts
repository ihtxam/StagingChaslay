import { roundMoney2 } from '@/lib/money';
import type { SplitPart } from '@/components/WebPosSplitBillModal';
import type { CartLine } from '@/components/webpos/types';

/** Remove lines/qty already paid in a by-item split so the held cart matches what's left. */
export function removePaidSplitLines(cart: CartLine[], part: SplitPart): CartLine[] {
  if (part.lineQtys && Object.keys(part.lineQtys).length > 0) {
    return cart.flatMap((l) => {
      const paidQty = part.lineQtys![l.lineId] ?? 0;
      if (paidQty <= 0) return [l];
      if (paidQty >= l.quantity) return [];
      const unit = l.quantity > 0 ? l.lineTotal / l.quantity : l.unitPrice;
      const newQty = l.quantity - paidQty;
      return [
        {
          ...l,
          quantity: newQty,
          lineTotal: roundMoney2(unit * newQty),
        },
      ];
    });
  }
  if (part.lineIds.length > 0) {
    return cart.filter((l) => !part.lineIds.includes(l.lineId));
  }
  return cart;
}
