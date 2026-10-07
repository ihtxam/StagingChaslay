"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_SHOP_DB_MESSAGE = void 0;
exports.isSqlLeakMessage = isSqlLeakMessage;
exports.isShopCatalogSchemaError = isShopCatalogSchemaError;
exports.publicShopDbError = publicShopDbError;
const db_schema_errors_1 = require("./db-schema-errors");
exports.PUBLIC_SHOP_DB_MESSAGE = "We couldn't load this page just now. Please refresh and try again.";
/** True when a string contains Drizzle SQL, bind params, or a raw SELECT. */
function isSqlLeakMessage(raw) {
    return /failed query/i.test(raw) || /\bparams\s*:/i.test(raw) || /\bselect\s+["'`]/i.test(raw);
}
/**
 * Shop menu and loyalty both SELECT from products (and the menu also loads categories).
 * Drizzle surfaces that as "Failed query: select ..." even when the cause is a missing column.
 */
function isShopCatalogSchemaError(error) {
    const raw = (0, db_schema_errors_1.dbErrorChain)(error);
    const targetsCatalog = /from\s+"(products|categories)"/i.test(raw) ||
        /relation ["'](products|categories)["']/i.test(raw) ||
        /column "[^"]+" of relation "(products|categories)"/i.test(raw);
    if (!targetsCatalog)
        return false;
    return (0, db_schema_errors_1.isMissingSchemaError)(raw) || /failed query/i.test(raw);
}
/** Customer-facing shop error. Never returns SQL, column lists, or query params. */
function publicShopDbError(error, fallback = exports.PUBLIC_SHOP_DB_MESSAGE) {
    const safeFallback = !fallback.trim() || isSqlLeakMessage(fallback) || fallback.length > 240
        ? exports.PUBLIC_SHOP_DB_MESSAGE
        : fallback.trim();
    const raw = (0, db_schema_errors_1.dbErrorChain)(error);
    if ((0, db_schema_errors_1.isMissingSchemaError)(raw) || isSqlLeakMessage(raw) || isShopCatalogSchemaError(error)) {
        return safeFallback;
    }
    const msg = error instanceof Error ? error.message.trim() : "";
    if (!msg || isSqlLeakMessage(msg) || msg.length > 240)
        return safeFallback;
    return msg;
}
//# sourceMappingURL=public-shop-error.js.map