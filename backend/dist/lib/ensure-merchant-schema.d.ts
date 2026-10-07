import { repairAllChaslayHomepages } from "@/lib/chaslay-homepage-heal";
/** Raw SELECT for paths that must work before drizzle-kit has added newer columns. */
export declare function queryRaw<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
/** Map a pg merchants row (snake_case) to camelCase keys expected by app code. */
export declare function mapMerchantRowKeys(raw: Record<string, unknown>): Record<string, unknown>;
/** Load one merchant row using only columns that exist in Postgres today. */
export declare function loadMerchantRowById(merchantId: string): Promise<Record<string, unknown> | null>;
/** Load one merchant row by email (auth / password reset). */
export declare function loadMerchantRowByEmail(email: string): Promise<Record<string, unknown> | null>;
export declare function ensureMerchantTables(): Promise<boolean>;
export declare function ensureInventoryAddonColumn(): Promise<void>;
/** Ensure is_demo columns exist on inventory tables (demo import/delete). */
export declare function ensureInventoryDemoColumns(): Promise<void>;
export declare function ensureSignageAddonColumn(): Promise<void>;
export declare function ensureKdsAddonColumn(): Promise<void>;
export declare function ensureGrowthAnalyticsAddonColumn(): Promise<void>;
export declare function ensureGuestCrmAddonColumn(): Promise<void>;
export declare function ensureMarketingAutomationAddonColumn(): Promise<void>;
export declare function ensureSmartSegmentsAddonColumn(): Promise<void>;
export declare function ensureReservationCampaignsAddonColumn(): Promise<void>;
export declare function ensureAiCoachAddonColumn(): Promise<void>;
export declare function ensureGoogleReputationAddonColumn(): Promise<void>;
export declare function ensureAiWebSeoAddonColumn(): Promise<void>;
export declare function ensureCustomerCrmTagsColumn(): Promise<void>;
/** Ensure optional customers columns (Guest CRM tags, etc.). */
export declare function ensureCustomersColumnsSchema(): Promise<void>;
export declare function ensureVouchersColumnsSchema(): Promise<void>;
export declare function ensureOdsAddonColumn(): Promise<void>;
export declare function ensureKioskAddonColumn(): Promise<void>;
export declare function ensureKioskSettingsColumn(): Promise<void>;
export declare function ensureCustomerDisplaySettingsColumn(): Promise<void>;
export declare function ensureJustEatAddonColumn(): Promise<void>;
export declare function ensureUberEatsAddonColumn(): Promise<void>;
export declare function ensureBexioAddonColumn(): Promise<void>;
export declare function ensureOdooAddonColumn(): Promise<void>;
export declare function ensureAccountingIntegrationSettingsColumn(): Promise<void>;
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
/** Idempotent products/categories columns used by the shop menu, loyalty rewards, and merchant catalog. */
export declare function ensureShopCatalogColumnsSchema(): Promise<void>;
/**
 * Run a shop catalog query, and on a missing products/categories column (or a Drizzle
 * "Failed query" against those tables) apply the heal and retry once.
 */
export declare function withShopCatalogSchemaRetry<T>(fn: () => Promise<T>): Promise<T>;
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
    chaslayHomepageRepair: Awaited<ReturnType<typeof repairAllChaslayHomepages>>;
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