import { and, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";

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
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { subscriptionPlan: true },
    });
    const planSlug = merchant?.subscriptionPlan || "free";
    const plan = (await SubscriptionPlansService.getBySlug(planSlug)) || null;
    const currentCount = await this.countProducts(merchantId);
    const maxRaw = plan?.maxProducts;
    const maxProducts =
      maxRaw === null || maxRaw === undefined ? null : Math.max(0, Number(maxRaw) || 0);

    return {
      maxProducts,
      currentCount,
      planSlug: plan?.slug || planSlug,
      planName: plan?.name || null,
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
