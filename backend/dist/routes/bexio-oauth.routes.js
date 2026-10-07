"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bexio_oauth_1 = require("@/lib/bexio-oauth");
const accounting_integration_addon_1 = require("@/lib/accounting-integration-addon");
const router = (0, express_1.Router)();
/**
 * GET /api/oauth/bexio/callback?code=&state=
 * Public OAuth redirect from Bexio.
 */
router.get("/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const oauthError = typeof req.query.error === "string" ? req.query.error : "";
    if (oauthError) {
        res.redirect((0, bexio_oauth_1.merchantDashboardAccountingUrl)({ bexio: "error", reason: oauthError.slice(0, 80) }));
        return;
    }
    const parsed = (0, bexio_oauth_1.verifyBexioOAuthState)(state);
    if (!parsed || !code) {
        res.redirect((0, bexio_oauth_1.merchantDashboardAccountingUrl)({ bexio: "error", reason: "invalid_state" }));
        return;
    }
    try {
        const licensed = await (0, accounting_integration_addon_1.readBexioAddonEnabled)(parsed.merchantId);
        if (!licensed) {
            res.redirect((0, bexio_oauth_1.merchantDashboardAccountingUrl)({ bexio: "error", reason: "addon_off" }));
            return;
        }
        const tokenData = await (0, bexio_oauth_1.exchangeBexioOAuthCode)(code);
        await (0, bexio_oauth_1.storeBexioOAuthTokens)(parsed.merchantId, tokenData);
        res.redirect((0, bexio_oauth_1.merchantDashboardAccountingUrl)({ bexio: "connected" }));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "oauth_failed";
        res.redirect((0, bexio_oauth_1.merchantDashboardAccountingUrl)({ bexio: "error", reason: msg.slice(0, 80) }));
    }
});
exports.default = router;
//# sourceMappingURL=bexio-oauth.routes.js.map