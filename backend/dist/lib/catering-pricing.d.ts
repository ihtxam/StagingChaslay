import { type CateringConfig, type ModifierPriceScope } from "./catering-config";
export type ComboPickForCateringPricing = {
    slotId: string;
    extraPrice: number;
    qty?: number;
    selectedExtras?: Array<{
        price: number;
    }>;
};
/** Split combo picks into tier per-person rate (one slot) vs flat surcharges on other slots. */
export declare function resolveCateringComboPricing(input: {
    cateringConfig: unknown;
    guestCount: number;
    comboPicks: ComboPickForCateringPricing[];
}): {
    guestCount: number;
    tierPerPersonRate: number | null;
    comboSurchargeFlat: number;
};
export declare function computeCateringBaseUnit(listPrice: number, configRaw: unknown, guestCount: number, tierPerPersonRate?: number | null): {
    guestCount: number;
    baseUnit: number;
    config: CateringConfig;
};
/** Apply catering multiplier to a modifier/catalog extra price. */
export declare function scaleModifierPrice(unitPrice: number, priceScope: ModifierPriceScope | unknown, guestCount: number, cateringEnabled: boolean): number;
export declare function computeCateringLineUnitPrice(input: {
    listPrice: number;
    cateringConfig: unknown;
    guestCount: number;
    comboSurcharge: number;
    extrasTotal: number;
    deliveryMarkup: number;
    tierPerPersonRate?: number | null;
}): {
    unitPrice: number;
    guestCount: number;
};
//# sourceMappingURL=catering-pricing.d.ts.map