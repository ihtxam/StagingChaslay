export type PosOfferStatus = 'active' | 'scheduled';

export type PosOffer = {
  id: string;
  name: string;
  description?: string | null;
  offerType: string;
  rules?: Record<string, unknown> | null;
  channels?: string[];
  categoryIds?: string[];
  productIds?: string[];
  staffIds?: string[];
  scheduleMode?: string;
  daysOfWeek?: string[];
  timeStart?: string | null;
  timeEnd?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  badgeLabel?: string | null;
  posStatus?: PosOfferStatus;
};

export function formatOfferDiscount(offer: PosOffer): string {
  const rules = offer.rules || {};
  const type = offer.offerType;
  if (offer.badgeLabel?.trim()) return offer.badgeLabel.trim();
  if (type === 'percent_order' || type === 'percent_category' || type === 'nth_item_percent') {
    const pct = Number(rules.percentOff) || 0;
    if (type === 'nth_item_percent') {
      const nth = Number(rules.nthItem) || 2;
      return `${pct}% off item #${nth}`;
    }
    return pct ? `${pct}% off` : '';
  }
  if (type === 'fixed_off') {
    const amt = Number(rules.fixedOff) || 0;
    return amt ? `CHF ${amt.toFixed(2)} off` : '';
  }
  if (type === 'bogo') {
    const buy = Number(rules.buyQty) || 1;
    const get = Number(rules.getQty) || 1;
    return `Buy ${buy} get ${get}`;
  }
  if (type === 'pay_n_get_m') {
    const pay = Number(rules.payQty) || 3;
    const recv = Number(rules.receiveQty) || 4;
    return `Pay ${pay} get ${recv}`;
  }
  if (type === 'package_deal') {
    const price = Number(rules.packagePrice) || 0;
    return price ? `Package CHF ${price.toFixed(2)}` : 'Package deal';
  }
  return offer.name;
}

export function offerMinOrder(offer: PosOffer): number {
  return Number(offer.rules?.minOrderAmount) || 0;
}
