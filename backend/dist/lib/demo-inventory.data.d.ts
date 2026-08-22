/**
 * Sample inventory for merchants exploring stock control, recipes and movements.
 * All rows are flagged isDemo=true on import.
 */
export type DemoInvCategoryDef = {
    key: string;
    name: string;
};
export type DemoInvUnitDef = {
    code: string;
    name: string;
};
export type DemoInvUnitRatioDef = {
    fromCode: string;
    toCode: string;
    factor: number;
};
export type DemoInvSupplierDef = {
    key: string;
    name: string;
    email: string;
    phone: string;
    contactPerson: string;
};
export type DemoInvItemDef = {
    key: string;
    name: string;
    unit: string;
    cost: number;
    onHand: number;
    minStock: number;
    reorderQty: number;
    categoryKey: string;
    supplierKey: string;
    perishable?: boolean;
    autoReorderEnabled?: boolean;
};
export type DemoInvMovementDef = {
    itemKey: string;
    type: "in" | "sale" | "waste";
    qty: number;
    daysAgo: number;
    note: string;
    supplierName?: string;
};
export type DemoInvRecipeDef = {
    /** Matches demo catalog product key (demo-prod-{key}) */
    productKey: string;
    recipeYield: number;
    /** Short label shown on the inventory dashboard as an example case */
    exampleLabel: string;
    lines: Array<{
        itemKey: string;
        qty: number;
        unit?: string;
    }>;
};
export declare const DEMO_INV_CATEGORIES: DemoInvCategoryDef[];
export declare const DEMO_INV_UNITS: DemoInvUnitDef[];
export declare const DEMO_INV_UNIT_RATIOS: DemoInvUnitRatioDef[];
export declare const DEMO_INV_SUPPLIERS: DemoInvSupplierDef[];
export declare const DEMO_INV_ITEMS: DemoInvItemDef[];
/** Backdated movements for history, consumption report and dashboard charts. */
export declare const DEMO_INV_MOVEMENTS: DemoInvMovementDef[];
export declare const DEMO_INV_RECIPES: DemoInvRecipeDef[];
//# sourceMappingURL=demo-inventory.data.d.ts.map