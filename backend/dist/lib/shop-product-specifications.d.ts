export type ProductSpecRow = {
    id?: string;
    name?: string;
    price?: number | string;
    saleStatus?: string;
    isDefault?: boolean;
    sortOrder?: number;
};
/** Matches client synthetic size group id in shop-modifier-utils. */
export declare const SHOP_SIZE_MODIFIER_GROUP_ID = "__sizes__";
export declare function inStockProductSpecifications(specifications: unknown): Array<{
    id: string;
    name: string;
    price: number;
    isDefault: boolean;
}>;
export declare function specificationOptionPriceDelta(basePrice: number, specPrice: number): number;
//# sourceMappingURL=shop-product-specifications.d.ts.map