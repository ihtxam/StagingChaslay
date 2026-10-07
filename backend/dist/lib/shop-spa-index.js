"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearShopSpaIndexCache = clearShopSpaIndexCache;
exports.loadShopSpaIndexHtml = loadShopSpaIndexHtml;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let dashCache = null;
let fileCache = null;
const DEFAULT_TTL_MS = 5000;
function clearShopSpaIndexCache() {
    dashCache = null;
    fileCache = null;
}
function defaultFilePath() {
    return (process.env.SHOP_SPA_INDEX_PATH || path_1.default.join(process.cwd(), "shop-spa", "index.html"));
}
function defaultDashboardOrigin() {
    return String(process.env.SHOP_SPA_DASHBOARD_ORIGIN || "http://dashboard").replace(/\/$/, "");
}
function looksLikeHtml(html) {
    return /<html[\s>]/i.test(html) && /<script[\s>]/i.test(html);
}
function loadFromFile(deps) {
    const filePath = deps.filePath || defaultFilePath();
    const statSync = deps.statSync || fs_1.default.statSync;
    const readFileSync = deps.readFileSync || fs_1.default.readFileSync;
    try {
        const st = statSync(filePath);
        const mtimeMs = Number(st.mtimeMs || st.mtime?.getTime?.() || 0);
        if (fileCache && fileCache.path === filePath && fileCache.mtimeMs === mtimeMs) {
            return fileCache.html;
        }
        const html = readFileSync(filePath, "utf8");
        if (!html)
            return null;
        fileCache = { html, mtimeMs, path: filePath };
        return html;
    }
    catch {
        return fileCache?.path === filePath ? fileCache.html : null;
    }
}
/** Live dashboard index.html (hashed asset names). Falls back to bind-mounted file. */
async function loadShopSpaIndexHtml(deps = {}) {
    const now = deps.now ? deps.now() : Date.now();
    const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
    const origin = (deps.dashboardOrigin ?? defaultDashboardOrigin()).replace(/\/$/, "");
    const fetchImpl = deps.fetchImpl || (typeof fetch === "function" ? fetch : null);
    if (origin && fetchImpl) {
        if (dashCache && now - dashCache.fetchedAt < ttlMs)
            return dashCache.html;
        try {
            const headers = { Accept: "text/html" };
            if (dashCache?.etag)
                headers["If-None-Match"] = dashCache.etag;
            const res = await fetchImpl(`${origin}/index.html`, {
                headers,
                cache: "no-store",
            });
            if (res.status === 304 && dashCache) {
                dashCache = { ...dashCache, fetchedAt: now };
                return dashCache.html;
            }
            if (res.ok) {
                const html = await res.text();
                if (looksLikeHtml(html)) {
                    dashCache = {
                        html,
                        etag: res.headers?.get?.("etag") || null,
                        fetchedAt: now,
                    };
                    return html;
                }
            }
        }
        catch {
            /* dashboard may not be up yet */
        }
    }
    return loadFromFile(deps);
}
//# sourceMappingURL=shop-spa-index.js.map