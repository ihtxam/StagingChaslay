import { NextFunction, Request, Response } from "express";
import { ShopSpaService } from "@/services/shop-spa.service";
import { isShopRequestHost, requestLooksLikeSpaDocument } from "@/lib/shop-request-host";

const SKIP_PREFIXES = ["/api", "/health", "/v1", "/downloads", "/receipt", "/receipts"];

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

    const html = await ShopSpaService.renderShell(req);
    if (!html) return next();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error("shop-spa shell:", error);
    return next();
  }
}
