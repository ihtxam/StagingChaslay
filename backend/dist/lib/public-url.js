"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePublicAssetUrl = resolvePublicAssetUrl;
/** Turn a stored upload path into an absolute URL for the current shop host. */
function resolvePublicAssetUrl(req, path) {
    const raw = String(path || "").trim();
    if (!raw)
        return null;
    if (/^https?:\/\//i.test(raw))
        return raw;
    const rel = raw.startsWith("/") ? raw : `/${raw}`;
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
        .split(",")[0]
        ?.trim();
    const proto = String(req.headers["x-forwarded-proto"] || "https")
        .split(",")[0]
        ?.trim() || "https";
    if (!host)
        return rel;
    return `${proto}://${host}${rel}`;
}
//# sourceMappingURL=public-url.js.map