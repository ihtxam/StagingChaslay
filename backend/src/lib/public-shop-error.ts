import { dbErrorChain, isMissingSchemaError } from "./db-schema-errors";

export const PUBLIC_SHOP_DB_MESSAGE =
  "We couldn't load this page just now. Please refresh and try again.";

/** True when a string contains Drizzle SQL, bind params, or a raw SELECT. */
export function isSqlLeakMessage(raw: string): boolean {
  return /failed query/i.test(raw) || /\bparams\s*:/i.test(raw) || /\bselect\s+["'`]/i.test(raw);
}

/**
 * Shop menu and loyalty both SELECT from products (and the menu also loads categories).
 * Drizzle surfaces that as "Failed query: select ..." even when the cause is a missing column.
 */
export function isShopCatalogSchemaError(error: unknown): boolean {
  const raw = dbErrorChain(error);
  const targetsCatalog =
    /from\s+"(products|categories)"/i.test(raw) ||
    /relation ["'](products|categories)["']/i.test(raw) ||
    /column "[^"]+" of relation "(products|categories)"/i.test(raw);
  if (!targetsCatalog) return false;
  return isMissingSchemaError(raw) || /failed query/i.test(raw);
}

/** Customer-facing shop error. Never returns SQL, column lists, or query params. */
export function publicShopDbError(error: unknown, fallback = PUBLIC_SHOP_DB_MESSAGE): string {
  const safeFallback =
    !fallback.trim() || isSqlLeakMessage(fallback) || fallback.length > 240
      ? PUBLIC_SHOP_DB_MESSAGE
      : fallback.trim();
  const raw = dbErrorChain(error);
  if (isMissingSchemaError(raw) || isSqlLeakMessage(raw) || isShopCatalogSchemaError(error)) {
    return safeFallback;
  }
  const msg = error instanceof Error ? error.message.trim() : "";
  if (!msg || isSqlLeakMessage(msg) || msg.length > 240) return safeFallback;
  return msg;
}
