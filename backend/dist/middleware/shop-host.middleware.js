"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopHostMiddleware = shopHostMiddleware;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const PLATFORM_HOST_SUFFIXES = [
    "rebornsense.com",
    "chaslay.com",
    "webprintmedia.swiss",
    "localhost",
];
function isPlatformHost(host) {
    const lower = host.toLowerCase();
    if (PLATFORM_HOST_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(`.${suffix}`))) {
        return true;
    }
    return false;
}
/**
 * Non-blocking parallel routing helper: attach verified custom-domain merchant when Host matches.
 * Always calls next(); slug/path routing remains the fallback everywhere else.
 */
async function shopHostMiddleware(req, _res, next) {
    try {
        const raw = String(req.headers["x-forwarded-host"] || req.headers.host || "")
            .split(",")[0]
            ?.trim()
            .toLowerCase();
        const host = raw?.split(":")[0];
        if (!host || isPlatformHost(host)) {
            req.shopMerchantFromHost = null;
            return next();
        }
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.customDomain, host),
        });
        if (merchant &&
            merchant.customDomainDnsStatus !== "pending" &&
            merchant.customDomainDnsStatus !== "failed" &&
            merchant.shopEnabled &&
            merchant.status !== "suspended" &&
            merchant.status !== "expired") {
            req.shopMerchantFromHost = merchant;
        }
        else {
            req.shopMerchantFromHost = null;
        }
    }
    catch {
        req.shopMerchantFromHost = null;
    }
    next();
}
//# sourceMappingURL=shop-host.middleware.js.map