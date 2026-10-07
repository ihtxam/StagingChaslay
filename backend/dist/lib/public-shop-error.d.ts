export declare const PUBLIC_SHOP_DB_MESSAGE = "We couldn't load this page just now. Please refresh and try again.";
/** True when a string contains Drizzle SQL, bind params, or a raw SELECT. */
export declare function isSqlLeakMessage(raw: string): boolean;
/**
 * Shop menu and loyalty both SELECT from products (and the menu also loads categories).
 * Drizzle surfaces that as "Failed query: select ..." even when the cause is a missing column.
 */
export declare function isShopCatalogSchemaError(error: unknown): boolean;
/** Customer-facing shop error. Never returns SQL, column lists, or query params. */
export declare function publicShopDbError(error: unknown, fallback?: string): string;
//# sourceMappingURL=public-shop-error.d.ts.map