"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopSpaShellMiddleware = shopSpaShellMiddleware;
const shop_spa_service_1 = require("@/services/shop-spa.service");
const shop_request_host_1 = require("@/lib/shop-request-host");
const SKIP_PREFIXES = ["/api", "/health", "/v1", "/downloads", "/receipt", "/receipts"];
/** Serve shop SPA index.html with server-side Open Graph tags for social crawlers. */
async function shopSpaShellMiddleware(req, res, next) {
    try {
        if (req.method !== "GET" && req.method !== "HEAD")
            return next();
        const path = String(req.path || "");
        if (SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
            return next();
        }
        if (!(0, shop_request_host_1.isShopRequestHost)(req.headers))
            return next();
        if (!(0, shop_request_host_1.requestLooksLikeSpaDocument)(path, String(req.headers.accept || "")))
            return next();
        const html = await shop_spa_service_1.ShopSpaService.renderShell(req);
        if (!html)
            return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        if (req.method === "HEAD")
            return res.status(200).end();
        return res.status(200).send(html);
    }
    catch (error) {
        console.error("shop-spa shell:", error);
        return next();
    }
}
//# sourceMappingURL=shop-spa.middleware.js.map