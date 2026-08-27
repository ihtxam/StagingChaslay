import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { MerchantEntitlementsService } from "@/services/merchant-entitlements.service";

export type ProductLimitInfo = {
  /** null = unlimited */
  maxProducts: number | null;
  currentCount: number;
  planSlug: string | null;
  planName: string | null;
};

export class ProductEntitlementsService {
  static async countProducts(merchantId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ total: count() })
      .from(schema.products)
      .where(eq(schema.products.merchantId, merchantId));
    return Number(row?.total) || 0;
  }

  static async getLimitInfo(merchantId: string): Promise<ProductLimitInfo> {
    const limits = await MerchantEntitlementsService.getLimits(merchantId);
    const currentCount = await this.countProducts(merchantId);
    return {
      maxProducts: limits.maxProducts,
      currentCount,
      planSlug: limits.planSlug,
      planName: limits.planName,
    };
  }

  static async assertCanAddProducts(merchantId: string, addCount = 1): Promise<ProductLimitInfo> {
    const info = await this.getLimitInfo(merchantId);
    if (info.maxProducts == null) return info;
    const next = info.currentCount + Math.max(1, addCount);
    if (next > info.maxProducts) {
      const err = new Error(
        `Product limit reached (${info.maxProducts} on ${info.planName || info.planSlug || "your plan"}). Upgrade your subscription to add more products.`
      ) as Error & { statusCode?: number; code?: string; limit?: ProductLimitInfo };
      err.statusCode = 403;
      err.code = "PRODUCT_LIMIT_REACHED";
      err.limit = info;
      throw err;
    }
    return info;
  }
}
