import { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { schema } from "@/db/schema";

declare global {
  namespace Express {
    interface Request {
      /** Set when Host matches a verified merchant custom domain (routing only). */
      shopMerchantFromHost?: typeof schema.merchants.$inferSelect | null;
    }
  }
}

const PLATFORM_HOST_SUFFIXES = [
  "rebornsense.com",
  "chaslay.com",
  "webprintmedia.swiss",
  "localhost",
];

function isPlatformHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (PLATFORM_HOST_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(`.${suffix}`))) {
    return true;
  }
  return false;
}

/**
 * Non-blocking parallel routing helper: attach verified custom-domain merchant when Host matches.
 * Always calls next(); slug/path routing remains the fallback everywhere else.
 */
export async function shopHostMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const raw = String(req.headers["x-forwarded-host"] || req.headers.host || "")
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    const host = raw?.split(":")[0];
    if (!host || isPlatformHost(host)) {
      req.shopMerchantFromHost = null;
      return next();
    }

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.customDomain, host),
    });

    if (
      merchant &&
      merchant.customDomainDnsStatus !== "pending" &&
      merchant.customDomainDnsStatus !== "failed" &&
      merchant.shopEnabled &&
      merchant.status !== "suspended" &&
      merchant.status !== "expired"
    ) {
      req.shopMerchantFromHost = merchant;
    } else {
      req.shopMerchantFromHost = null;
    }
  } catch {
    req.shopMerchantFromHost = null;
  }
  next();
}
