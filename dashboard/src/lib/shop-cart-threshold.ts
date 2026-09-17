export type CartThresholdKind = 'min' | 'free';

export type CartThresholdBar = {
  kind: CartThresholdKind;
  threshold: number;
};

/** Delivery cart: min-order bar until met, then free-delivery bar. Never both. */
export function pickCartThresholdBar(opts: {
  channel?: string | null;
  subtotal: number;
  minOrder?: number | string | null;
  freeDeliveryFrom?: number | string | null;
}): CartThresholdBar | null {
  if (opts.channel !== 'delivery') return null;
  const subtotal = Number(opts.subtotal) || 0;
  const minOrder = Number(opts.minOrder) || 0;
  const freeDeliveryFrom = Number(opts.freeDeliveryFrom) || 0;
  if (minOrder > 0 && subtotal + 0.001 < minOrder) {
    return { kind: 'min', threshold: minOrder };
  }
  if (freeDeliveryFrom > 0) {
    return { kind: 'free', threshold: freeDeliveryFrom };
  }
  return null;
}
