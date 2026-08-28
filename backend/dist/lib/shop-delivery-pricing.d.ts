export type CategoryDeliveryPricingRow = {
    id: string;
    deliveryPricingEnabled?: boolean | null;
    extraDeliveryPrice?: string | number | null;
};
export type ShopDeliveryPricingConfig = {
    categoryPricingEnabled?: boolean | null;
    deliveryMenuMarkup?: string | number | null;
};
export declare function parseCategoryExtraDeliveryPrice(value: string | number | null | undefined): number;
export declare function buildCategoryDeliveryPricingMap(categories: CategoryDeliveryPricingRow[]): Map<string, {
    deliveryPricingEnabled: boolean;
    extraDeliveryPrice: number;
}>;
/** Per-item delivery markup/surcharge for shop catalog lines. */
export declare function resolveShopItemDeliveryMarkup(config: ShopDeliveryPricingConfig, channel: string, categoryId: string | null | undefined, categoryMap: Map<string, {
    deliveryPricingEnabled: boolean;
    extraDeliveryPrice: number;
}>): number;
//# sourceMappingURL=shop-delivery-pricing.d.ts.map