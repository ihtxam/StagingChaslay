/** Paid gift cards addon — merchant-level. */
export declare function isGiftCardAddonEnabled(value: unknown): boolean;
export declare function editionIncludesGiftCards(features: string[] | null | undefined): boolean;
/** License = paid addon column, edition feature, or legacy (null features). */
export declare function isGiftCardsLicensed(input: {
    giftCardAddonEnabled?: unknown;
    features?: string[] | null;
} | null | undefined): boolean;
export declare function readGiftCardAddonEnabled(merchantId: string): Promise<boolean>;
export declare function writeGiftCardAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean>;
export declare function readGiftCardAddonEnabledMap(merchantIds: string[]): Promise<Map<string, boolean>>;
export declare function merchantHasGiftCardsLicense(merchantId: string): Promise<boolean>;
//# sourceMappingURL=gift-card-addon.d.ts.map