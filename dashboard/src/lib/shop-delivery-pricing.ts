import { roundMoney2 } from '@/lib/money';

export type CategoryDeliveryPricing = {
  deliveryPricingEnabled?: boolean;
  extraDeliveryPrice?: number | string | null;
};

export type ShopCategoryDeliveryMeta = {
  id: string;
  deliveryPricingEnabled?: boolean;
  extraDeliveryPrice?: number | string | null;
};

export function parseCategoryExtraDeliveryPrice(
  value: number | string | null | undefined
): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundMoney2(n);
}

export function buildCategoryDeliveryPricingMap(
  categories: ShopCategoryDeliveryMeta[]
): Map<string, CategoryDeliveryPricing> {
  const map = new Map<string, CategoryDeliveryPricing>();
  for (const cat of categories) {
    map.set(cat.id, {
      deliveryPricingEnabled: cat.deliveryPricingEnabled === true,
      extraDeliveryPrice: parseCategoryExtraDeliveryPrice(cat.extraDeliveryPrice),
    });
  }
  return map;
}

export function resolveShopItemDeliveryMarkup(
  categoryPricingEnabled: boolean,
  channel: string,
  categoryId: string | null | undefined,
  globalDeliveryMenuMarkup: number,
  categoryMap: Map<string, CategoryDeliveryPricing>
): number {
  if (channel !== 'delivery') return 0;

  if (categoryPricingEnabled) {
    if (!categoryId) return 0;
    const cat = categoryMap.get(categoryId);
    if (!cat?.deliveryPricingEnabled) return 0;
    const extra = parseCategoryExtraDeliveryPrice(cat.extraDeliveryPrice);
    return extra > 0 ? extra : 0;
  }

  const global = Number(globalDeliveryMenuMarkup ?? 0);
  return Number.isFinite(global) && global > 0 ? roundMoney2(global) : 0;
}
