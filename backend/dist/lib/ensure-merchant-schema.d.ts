export declare function ensureMerchantTables(): Promise<boolean>;
export declare function ensureInventoryAddonColumn(): Promise<void>;
/** Ensure is_demo columns exist on inventory tables (demo import/delete). */
export declare function ensureInventoryDemoColumns(): Promise<void>;
export declare function ensureSignageAddonColumn(): Promise<void>;
export declare function ensureKdsAddonColumn(): Promise<void>;
export declare function ensureOdsAddonColumn(): Promise<void>;
export declare function ensureJustEatAddonColumn(): Promise<void>;
export declare function ensureUberEatsAddonColumn(): Promise<void>;
export declare function ensureStorekeeperAddonColumn(): Promise<void>;
/** Apply all known optional merchant columns once at startup (non-blocking). */
export declare function ensureMerchantSchemaAtStartup(): void;
/** Retry a merchants query after applying missing-column/table patches. */
export declare function withMerchantSchemaRetry<T>(fn: () => Promise<T>): Promise<T>;
/**
 * On a missing-column error, apply the matching patch (if known) so the caller can retry.
 * Returns true when a patch was applied.
 */
export declare function patchMerchantSchemaFromError(error: unknown): Promise<boolean>;
//# sourceMappingURL=ensure-merchant-schema.d.ts.map