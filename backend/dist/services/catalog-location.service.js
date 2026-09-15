"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogLocationService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const catalog_visibility_1 = require("@/lib/catalog-visibility");
class CatalogLocationService {
    /** Merge per-location price, visibility, and availability overrides onto products. */
    static async applyLocationOverrides(merchantId, locationId, products) {
        const locId = String(locationId || "").trim();
        if (!locId || !products.length)
            return products;
        const db = (0, db_1.getDb)();
        const overrides = await db.query.locationProductOverrides.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locationProductOverrides.locationId, locId), (0, drizzle_orm_1.inArray)(db_1.schema.locationProductOverrides.productId, products.map((p) => p.id))),
        });
        if (!overrides.length)
            return products;
        const byProduct = new Map(overrides.map((o) => [o.productId, o]));
        return products.map((p) => {
            const o = byProduct.get(p.id);
            if (!o)
                return p;
            const next = { ...p };
            if (o.priceOverride != null) {
                next.price = String(o.priceOverride);
            }
            if (o.visibility != null) {
                next.visibility = o.visibility;
            }
            if (o.isAvailable === false) {
                next.isActive = false;
            }
            return next;
        });
    }
    /** Filter products to an active HQ time-based menu when one matches. */
    static filterByHqMenuProductIds(products, allowedIds) {
        if (!allowedIds || allowedIds.size === 0)
            return products;
        return products.filter((p) => allowedIds.has(p.id));
    }
    static productVisibleAfterOverrides(product, channel) {
        if (product.isActive === false)
            return false;
        return (0, catalog_visibility_1.isVisibleOnChannel)(product.visibility, channel);
    }
}
exports.CatalogLocationService = CatalogLocationService;
//# sourceMappingURL=catalog-location.service.js.map