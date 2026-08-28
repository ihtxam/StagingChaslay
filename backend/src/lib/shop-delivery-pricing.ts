import { roundMoney2 } from "@/lib/money";

export type CategoryDeliveryPricingRow = {
  id: string;
  deliveryPricingEnabled?: boolean | null;
  extraDeliveryPrice?: string | number | null;
};

export type ShopDeliveryPricingConfig = {
  categoryPricingEnabled?: boolean | null;
  deliveryMenuMarkup?: string | number | null;
};

export function parseCategoryExtraDeliveryPrice(
  value: string | number | null | undefined
): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundMoney2(n);
}

export function buildCategoryDeliveryPricingMap(
  categories: CategoryDeliveryPricingRow[]
): Map<string, { deliveryPricingEnabled: boolean; extraDeliveryPrice: number }> {
  const map = new Map<string, { deliveryPricingEnabled: boolean; extraDeliveryPrice: number }>();
  for (const cat of categories) {
    map.set(cat.id, {
      deliveryPricingEnabled: cat.deliveryPricingEnabled === true,
      extraDeliveryPrice: parseCategoryExtraDeliveryPrice(cat.extraDeliveryPrice),
    });
  }
  return map;
}

/** Per-item delivery markup/surcharge for shop catalog lines. */
export function resolveShopItemDeliveryMarkup(
  config: ShopDeliveryPricingConfig,
  channel: string,
  categoryId: string | null | undefined,
  categoryMap: Map<string, { deliveryPricingEnabled: boolean; extraDeliveryPrice: number }>
): number {
  if (channel !== "delivery") return 0;

  if (config.categoryPricingEnabled === true) {
    if (!categoryId) return 0;
    const cat = categoryMap.get(categoryId);
    if (!cat?.deliveryPricingEnabled) return 0;
    return cat.extraDeliveryPrice > 0 ? cat.extraDeliveryPrice : 0;
  }

  const global = Number(config.deliveryMenuMarkup ?? 0);
  return Number.isFinite(global) && global > 0 ? roundMoney2(global) : 0;
}
