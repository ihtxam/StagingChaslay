/** Raw SELECT for paths that must work before drizzle-kit has added newer columns. */
export declare function queryRaw<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
export declare function ensureMerchantTables(): Promise<boolean>;
export declare function ensureInventoryAddonColumn(): Promise<void>;
/** Ensure is_demo columns exist on inventory tables (demo import/delete). */
export declare function ensureInventoryDemoColumns(): Promise<void>;
export declare function ensureSignageAddonColumn(): Promise<void>;
export declare function ensureKdsAddonColumn(): Promise<void>;
export declare function ensureOdsAddonColumn(): Promise<void>;
export declare function ensureKioskAddonColumn(): Promise<void>;
export declare function ensureKioskSettingsColumn(): Promise<void>;
export declare function ensureCustomerDisplaySettingsColumn(): Promise<void>;
export declare function ensureJustEatAddonColumn(): Promise<void>;
export declare function ensureUberEatsAddonColumn(): Promise<void>;
export declare function ensureStorekeeperAddonColumn(): Promise<void>;
export declare function ensureGiftCardAddonColumn(): Promise<void>;
/** Ensure optional merchants columns exist (multi-location, addons, tax, etc.). */
export declare function ensureMerchantColumnsSchema(): Promise<void>;
/** Ensure optional orders columns exist (online shop, QR table, multi-location). */
export declare function ensureOrdersColumnsSchema(): Promise<void>;
/** Ensure optional order_items columns exist. */
export declare function ensureOrderItemsColumnsSchema(): Promise<void>;
/** Ensure editions + subscription_plans columns exist (plan lookup / POS entitlements). */
export declare function ensureSubscriptionPlansSchema(): Promise<void>;
/** Ensure multi-location tables/columns exist and backfill default location per merchant. */
export declare function ensureLocationsSchema(): Promise<void>;
/** Add columns that drizzle-kit often skips on pos_sessions (OOM / old CREATE TABLE). */
export declare function ensurePosSessionsSchema(): Promise<void>;
export declare function backfillDefaultLocations(): Promise<void>;
export declare function listMissingTableColumns(table: string, required: string[]): Promise<string[]>;
export declare function listMissingMerchantColumns(): Promise<string[]>;
/** Add kiosk to catalog visibility for rows created before the kiosk channel existed. */
export declare function backfillKioskCatalogVisibility(): Promise<void>;
/** Apply all idempotent schema patches (safe to run on every boot). */
export declare function ensureAllMerchantSchema(): Promise<{
    missingBefore: string[];
    missingAfter: string[];
    ordersMissing: string[];
    orderItemsMissing: string[];
    productsMissing: string[];
    editionsMissing: string[];
    subscriptionPlansMissing: string[];
    posSessionsMissing: string[];
}>;
/** Run schema patches at startup — await before accepting traffic. */
export declare function ensureMerchantSchemaAtStartup(): Promise<void>;
/** Retry a merchants query after applying missing-column/table patches. */
export declare function withMerchantSchemaRetry<T>(fn: () => Promise<T>): Promise<T>;
/**
 * On a missing-column error, apply the matching patch (if known) so the caller can retry.
 * Returns true when a patch was applied.
 */
export declare function patchMerchantSchemaFromError(error: unknown): Promise<boolean>;
//# sourceMappingURL=ensure-merchant-schema.d.ts.map