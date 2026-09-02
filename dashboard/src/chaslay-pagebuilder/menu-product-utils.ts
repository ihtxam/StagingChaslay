// @ts-nocheck
import type { ChaslayMenuProduct } from './menu-types';

/** Resolve catalog unit price from pagebuilder menu product shapes. */
export function menuProductPrice(product: ChaslayMenuProduct | null | undefined): number {
  if (!product) return 0;
  const direct = Number(product.price);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const legacy = Number(product.details?.[0]?.price);
  if (Number.isFinite(legacy) && legacy > 0) return legacy;
  return Number.isFinite(direct) ? direct : 0;
}

export function formatMenuProductPrice(
  product: ChaslayMenuProduct | null | undefined,
  currency = 'CHF'
): string {
  return `${currency} ${menuProductPrice(product).toFixed(2)}`;
}
