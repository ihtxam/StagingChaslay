"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCustomDomainDns = verifyCustomDomainDns;
const promises_1 = __importDefault(require("node:dns/promises"));
const brand_1 = require("@/lib/brand");
const ACCEPTED_CNAME_SUFFIXES = ["rebornsense.com", "chaslay.com", "webprintmedia.swiss"];
function normalizeDnsName(value) {
    return value.replace(/\.$/, "").toLowerCase();
}
function isAcceptedCnameTarget(target, shopHost) {
    const norm = normalizeDnsName(target);
    if (norm === shopHost)
        return true;
    if (norm.endsWith(`.${shopHost}`))
        return true;
    return ACCEPTED_CNAME_SUFFIXES.some((suffix) => norm === suffix || norm.endsWith(`.${suffix}`));
}
async function resolveCname(host) {
    try {
        return await promises_1.default.resolveCname(host);
    }
    catch {
        return [];
    }
}
async function resolveIpv4(host) {
    try {
        return await promises_1.default.resolve4(host);
    }
    catch {
        return [];
    }
}
/**
 * Verify that a hostname points at the platform shop hub (CNAME or flattened A record).
 */
async function verifyCustomDomainDns(hostname) {
    const host = hostname.toLowerCase().split(":")[0];
    const shopHost = (0, brand_1.resolveShopPublicHost)().toLowerCase();
    const cnames = await resolveCname(host);
    for (const raw of cnames) {
        const target = normalizeDnsName(raw);
        if (isAcceptedCnameTarget(target, shopHost)) {
            return { ok: true, method: "cname", value: target, expected: shopHost };
        }
    }
    const [hostIps, shopIps] = await Promise.all([resolveIpv4(host), resolveIpv4(shopHost)]);
    const shared = hostIps.find((ip) => shopIps.includes(ip));
    if (shared) {
        return { ok: true, method: "a", value: shared, expected: shopHost };
    }
    return {
        ok: false,
        reason: cnames.length ? "cname_target_mismatch" : "no_matching_dns",
        expected: shopHost,
    };
}
//# sourceMappingURL=custom-domain-dns.js.map