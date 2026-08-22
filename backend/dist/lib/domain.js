"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCustomDomain = normalizeCustomDomain;
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
//# sourceMappingURL=domain.js.map