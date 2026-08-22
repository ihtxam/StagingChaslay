/**
 * Café/bistro demo catalog — Ashley's-style sample menu for new merchants.
 * Keys are stable references for linking modifiers and combo slots.
 */
export type DemoCategoryDef = {
    key: string;
    name: string;
    description: string;
    color: string;
};
export type DemoModifierGroupDef = {
    key: string;
    title: string;
    pricingType: "free" | "fixed";
    selectionType: "optional" | "required";
    minSelectable?: number;
    maxSelectable?: number;
    options: Array<{
        name: string;
        price?: number;
        isDefault?: boolean;
    }>;
};
export type DemoProductDef = {
    key: string;
    name: string;
    description: string;
    price: number;
    categoryKey: string;
    sku?: string;
    stock?: number;
    modifierGroupKeys?: string[];
};
export type DemoComboDef = {
    key: string;
    name: string;
    description: string;
    price: number;
    categoryKey: string;
    sku?: string;
    slots: Array<{
        name: string;
        minPick: number;
        maxPick: number;
        productKeys: string[];
        extraPrices?: number[];
    }>;
};
export declare const DEMO_CATEGORIES: DemoCategoryDef[];
export declare const DEMO_MODIFIER_GROUPS: DemoModifierGroupDef[];
export declare const DEMO_PRODUCTS: DemoProductDef[];
export declare const DEMO_COMBOS: DemoComboDef[];
//# sourceMappingURL=demo-catalog.data.d.ts.map