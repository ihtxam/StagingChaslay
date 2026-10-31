import { NextFunction, Request, Response } from "express";
import { ShopSpaService } from "@/services/shop-spa.service";
import { loadShopSpaIndexHtml } from "@/lib/shop-spa-index";
import { isShopRequestHost, requestLooksLikeSpaDocument } from "@/lib/shop-request-host";

const MINIMAL_SHOP_SHELL_HTML =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop</title></head><body><div id="root"></div></body></html>';

async function shopShellHtml(req: Request): Promise<string> {
  return (await ShopSpaService.renderShell(req)) || (await loadShopSpaIndexHtml()) || MINIMAL_SHOP_SHELL_HTML;
}

function sendShopShell(req: Request, res: Response, html: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).send(html);
}

const SKIP_PREFIXES = [
  "/api",
  "/health",
  "/v1",
  "/downloads",
  "/receipt",
  "/receipts",
  "/assets",
  "/payment-logos",
  "/icons",
  "/brand",
  "/embed",
  "/openpage",
];

/** Serve shop SPA index.html with server-side Open Graph tags for social crawlers. */
export async function shopSpaShellMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const path = String(req.path || "");
    if (SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return next();
    }
    if (!isShopRequestHost(req.headers)) return next();
    if (!requestLooksLikeSpaDocument(path, String(req.headers.accept || ""))) return next();

    const html = await shopShellHtml(req);
    return sendShopShell(req, res, html);
  } catch (error) {
    console.error("shop-spa shell:", error);
    try {
      const html = (await loadShopSpaIndexHtml()) || MINIMAL_SHOP_SHELL_HTML;
      return sendShopShell(req, res, html);
    } catch (fallbackErr) {
      console.error("shop-spa shell fallback:", fallbackErr);
      return next();
    }
  }
}
