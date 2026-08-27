"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductEntitlementsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const merchant_entitlements_service_1 = require("@/services/merchant-entitlements.service");
class ProductEntitlementsService {
    static async countProducts(merchantId) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .select({ total: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.products)
            .where((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId));
        return Number(row?.total) || 0;
    }
    static async getLimitInfo(merchantId) {
        const limits = await merchant_entitlements_service_1.MerchantEntitlementsService.getLimits(merchantId);
        const currentCount = await this.countProducts(merchantId);
        return {
            maxProducts: limits.maxProducts,
            currentCount,
            planSlug: limits.planSlug,
            planName: limits.planName,
        };
    }
    static async assertCanAddProducts(merchantId, addCount = 1) {
        const info = await this.getLimitInfo(merchantId);
        if (info.maxProducts == null)
            return info;
        const next = info.currentCount + Math.max(1, addCount);
        if (next > info.maxProducts) {
            const err = new Error(`Product limit reached (${info.maxProducts} on ${info.planName || info.planSlug || "your plan"}). Upgrade your subscription to add more products.`);
            err.statusCode = 403;
            err.code = "PRODUCT_LIMIT_REACHED";
            err.limit = info;
            throw err;
        }
        return info;
    }
}
exports.ProductEntitlementsService = ProductEntitlementsService;
//# sourceMappingURL=product-entitlements.service.js.map