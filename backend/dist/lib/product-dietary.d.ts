/** Dietary / packaging labels for shop menu filtering (ezCater-style). */
export type DietaryTagId = "individual_packaging" | "gluten_free" | "vegan" | "vegetarian";
export type DietaryTagDef = {
    id: DietaryTagId;
    /** Short badge on product cards (GF, VG, V, IP) */
    badge: string;
    /** i18n key for full label in product detail */
    labelKey: string;
    /** Circle badge color */
    color: string;
};
export declare const DIETARY_TAGS: DietaryTagDef[];
export declare function normalizeDietaryTags(raw: unknown): DietaryTagId[];
export declare function productMatchesDietaryFilters(productTags: DietaryTagId[] | unknown, activeFilters: DietaryTagId[]): boolean;
export declare function dietaryTagDef(id: DietaryTagId): DietaryTagDef | undefined;
//# sourceMappingURL=product-dietary.d.ts.map