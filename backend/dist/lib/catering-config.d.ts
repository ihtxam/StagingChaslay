/** Flexible catering / prepackaged menu settings on combo products. */
export type CateringPricingMode = "package" | "per_person" | "mixed";
export type CateringConfig = {
    /** Enable guest-count pricing and per-guest add-ons for this combo. */
    enabled?: boolean;
    /** package = flat menu price; per_person = rate × guests; mixed = package + rate × guests */
    pricingMode?: CateringPricingMode;
    /** Flat package portion (defaults to product list price when omitted). */
    packagePrice?: number | null;
    /** Per-guest portion (CHF × guest count). */
    perPersonPrice?: number | null;
    minGuests?: number;
    maxGuests?: number;
    defaultGuests?: number;
    /** Combo slot id whose selected option extraPrice is the per-guest rate (× guest count). */
    tierSlotId?: string | null;
    /** Marketing copy: “Serves N people” (independent of min guests). */
    servesCount?: number;
    /** Minimum line quantity when ordering this catering package (ezCater-style). */
    minOrderQty?: number;
    /** Hours before event / pickup; shown as order-by guidance on shop. */
    leadTimeHours?: number;
};
export type ModifierPriceScope = "fixed" | "per_guest";
export declare function normalizeCateringConfig(raw: unknown): CateringConfig;
export declare function isCateringProduct(productType: string | null | undefined, config: CateringConfig | unknown): boolean;
export declare function clampGuestCount(config: CateringConfig, requested: number): number;
export declare function normalizeModifierPriceScope(raw: unknown): ModifierPriceScope;
//# sourceMappingURL=catering-config.d.ts.map