/** Paid digital signage (Chaslay Screens) addon — merchant-level, not edition-gated. */
export declare function isSignageAddonEnabled(value: unknown): boolean;
export declare function normalizeSignageScreenLimit(value: unknown): number;
export declare function readSignageAddon(merchantId: string): Promise<{
    enabled: boolean;
    screenLimit: number;
}>;
export declare function readSignageAddonEnabled(merchantId: string): Promise<boolean>;
export declare function writeSignageAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean>;
export declare function writeSignageScreenLimit(merchantId: string, limit: number): Promise<number>;
export declare function readSignageAddonMap(merchantIds: string[]): Promise<Map<string, {
    enabled: boolean;
    screenLimit: number;
}>>;
//# sourceMappingURL=signage-addon.d.ts.map