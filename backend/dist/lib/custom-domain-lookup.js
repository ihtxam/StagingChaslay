"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMerchantByCustomDomainHost = findMerchantByCustomDomainHost;
exports.findMerchantForTlsAsk = findMerchantForTlsAsk;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const domain_1 = require("@/lib/domain");
function customDomainDnsAllowsShop(dnsStatus) {
    const dns = String(dnsStatus || "none").toLowerCase();
    return dns === "none" || dns === "verified";
}
/** Resolve merchant by custom domain Host, matching apex and www interchangeably. */
async function findMerchantByCustomDomainHost(hostOrSlug) {
    const variants = (0, domain_1.customDomainHostVariants)(hostOrSlug);
    if (!variants.length)
        return null;
    const db = (0, db_1.getDb)();
    const rows = await db.query.merchants.findMany({
        where: (0, drizzle_orm_1.inArray)(db_1.schema.merchants.customDomain, variants),
    });
    for (const merchant of rows) {
        if (!(0, domain_1.customDomainMatches)(merchant.customDomain, hostOrSlug))
            continue;
        if (!customDomainDnsAllowsShop(merchant.customDomainDnsStatus))
            continue;
        return merchant;
    }
    return null;
}
/** Same as findMerchantByCustomDomainHost but for TLS ask (verified/pending rules). */
async function findMerchantForTlsAsk(host) {
    const variants = (0, domain_1.customDomainHostVariants)(host);
    if (!variants.length)
        return null;
    const db = (0, db_1.getDb)();
    const rows = await db.query.merchants.findMany({
        where: (0, drizzle_orm_1.inArray)(db_1.schema.merchants.customDomain, variants),
    });
    for (const merchant of rows) {
        if (!(0, domain_1.customDomainMatches)(merchant.customDomain, host))
            continue;
        const dns = String(merchant.customDomainDnsStatus || "none").toLowerCase();
        if (dns !== "none" && dns !== "verified")
            continue;
        return merchant;
    }
    return null;
}
//# sourceMappingURL=custom-domain-lookup.js.map