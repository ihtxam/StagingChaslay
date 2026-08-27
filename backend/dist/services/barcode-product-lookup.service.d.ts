/**
 * Online barcode product lookup for Storekeeper intake.
 * 1. Merchant inventory (handled by caller)
 * 2. Optional custom API (BARCODE_LOOKUP_URL with {barcode} placeholder)
 * 3. Open Food Facts, then Open Products Facts (Open*Facts family)
 */
export type BarcodeLookupSource = "openfoodfacts" | "openproductsfacts" | "custom";
export type BarcodeLookupSuggestion = {
    barcode: string;
    name: string;
    brand?: string | null;
    categoryHint?: string | null;
    /** Parsed package size label, e.g. "430 g" or "1 L". */
    packageSize?: string | null;
    /** Suggested inventory unit code: g, kg, ml, l, piece. */
    unit?: string | null;
    weightGrams?: number | null;
    imageUrl?: string | null;
    source: BarcodeLookupSource;
};
export declare class BarcodeProductLookupService {
    /** External product databases — local inventory is checked separately. */
    static lookupExternal(barcode: string): Promise<BarcodeLookupSuggestion | null>;
}
export declare function matchInventoryCategoryId(categories: Array<{
    id: string;
    name: string;
}>, hint?: string | null): string | null;
//# sourceMappingURL=barcode-product-lookup.service.d.ts.map