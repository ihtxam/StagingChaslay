"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerShopError = customerShopError;
const SQL_LEAK = /failed query|\bparams\s*:|\bselect\s+["'`]|column ["']?[a-z0-9_]+["']? of relation/i;
/** Hide raw database errors on the public shop. Server logs keep the real message. */
function customerShopError(raw, fallback) {
    const msg = typeof raw === "string" ? raw.trim() : "";
    if (!msg || SQL_LEAK.test(msg) || msg.length > 240)
        return fallback;
    return msg;
}
//# sourceMappingURL=shop-public-error.js.map