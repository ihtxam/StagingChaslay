"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCustomDomain = normalizeCustomDomain;
exports.normalizeCustomDomainHost = normalizeCustomDomainHost;
exports.isValidCustomDomainHost = isValidCustomDomainHost;
/** Normalize merchant custom domain (hostname only, lowercase, no scheme/path). */
function normalizeCustomDomain(raw) {
    if (raw == null)
        return null;
    let host = String(raw).trim().toLowerCase();
    if (!host)
        return null;
    host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    host = host.split(":")[0].replace(/^www\./, "");
    return host || null;
}
/** Preserve www (and other host labels) — used by the custom-domain wizard. */
function normalizeCustomDomainHost(raw) {
    if (raw == null)
        return null;
    let host = String(raw).trim().toLowerCase();
    if (!host)
        return null;
    host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    host = host.split(":")[0];
    return host || null;
}
const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
/** Basic hostname validation for merchant-entered domains. */
function isValidCustomDomainHost(host) {
    if (!host || host.length > 253)
        return false;
    if (host.includes("..") || host.startsWith(".") || host.endsWith("."))
        return false;
    return DOMAIN_LABEL.test(host);
}
//# sourceMappingURL=domain.js.map