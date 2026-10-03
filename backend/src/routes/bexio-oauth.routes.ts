import { Router, Request, Response } from "express";
import {
  exchangeBexioOAuthCode,
  merchantDashboardAccountingUrl,
  storeBexioOAuthTokens,
  verifyBexioOAuthState,
} from "@/lib/bexio-oauth";
import { readBexioAddonEnabled } from "@/lib/accounting-integration-addon";

const router = Router();

/**
 * GET /api/oauth/bexio/callback?code=&state=
 * Public OAuth redirect from Bexio.
 */
router.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";

  if (oauthError) {
    res.redirect(
      merchantDashboardAccountingUrl({ bexio: "error", reason: oauthError.slice(0, 80) })
    );
    return;
  }

  const parsed = verifyBexioOAuthState(state);
  if (!parsed || !code) {
    res.redirect(merchantDashboardAccountingUrl({ bexio: "error", reason: "invalid_state" }));
    return;
  }

  try {
    const licensed = await readBexioAddonEnabled(parsed.merchantId);
    if (!licensed) {
      res.redirect(merchantDashboardAccountingUrl({ bexio: "error", reason: "addon_off" }));
      return;
    }
    const tokenData = await exchangeBexioOAuthCode(code);
    await storeBexioOAuthTokens(parsed.merchantId, tokenData);
    res.redirect(merchantDashboardAccountingUrl({ bexio: "connected" }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    res.redirect(
      merchantDashboardAccountingUrl({ bexio: "error", reason: msg.slice(0, 80) })
    );
  }
});

export default router;
