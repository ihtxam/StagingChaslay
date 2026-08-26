import { Request, Response, NextFunction } from "express";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  type BusinessModule,
  normalizeBusinessModule,
} from "@/lib/business-module";

const moduleCache = new Map<string, { module: BusinessModule | null; at: number }>();
const CACHE_MS = 60_000;

export async function getMerchantBusinessModule(
  merchantId: string
): Promise<BusinessModule | null> {
  const hit = moduleCache.get(merchantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.module;

  const db = getDb();
  const row = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { businessCategory: true },
  });
  const module = normalizeBusinessModule(row?.businessCategory);
  moduleCache.set(merchantId, { module, at: Date.now() });
  return module;
}

/** null module = legacy merchant — allow all vertical features. */
export function requireBusinessModule(...modules: BusinessModule[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchantId = req.merchantId || req.user?.merchantId;
      if (!merchantId) {
        return res.status(400).json({ error: "Merchant ID is required" });
      }
      const module = await getMerchantBusinessModule(merchantId);
      if (!module) return next();
      if (modules.includes(module)) return next();
      return res.status(403).json({
        error: "This feature is not available for your business type",
        businessModule: module,
        requiredModules: modules,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Business module check failed",
      });
    }
  };
}

export const requireRestaurantModule = requireBusinessModule("restaurant");
export const requireRetailModule = requireBusinessModule("retail");
