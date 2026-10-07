"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    /**
     * POS / shop menu for one location: overrides, optional HQ location links, channel visibility, HQ time menus.
     */
    static async buildLocationChannelCatalog(merchantId, locationId, channel) {
        const db = (0, db_1.getDb)();
        const locId = String(locationId || "").trim();
        if (!locId) {
            return { categories: [], products: [], locationId: locId };
        }
        const [categories, products, links] = await Promise.all([
            db.query.categories.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder)],
            }),
            db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.isActive, true)),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.products.name)],
            }),
            db.query.locationCatalogLinks.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locationCatalogLinks.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locationCatalogLinks.locationId, locId)),
            }),
        ]);
        let productPool = products;
        if (links.length) {
            const allowed = new Set(links.map((l) => l.localProductId).filter((id) => !!id));
            productPool = products.filter((p) => allowed.has(p.id));
        }
        const withOverrides = await this.applyLocationOverrides(merchantId, locId, productPool);
        const filtered = (0, catalog_visibility_1.filterCatalogForChannel)(withOverrides, categories, channel);
        const location = await db.query.locations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.locations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.locations.id, locId)),
            columns: { timezone: true },
        });
        const timezone = location?.timezone || "Europe/Zurich";
        const { HqMenuService } = await Promise.resolve().then(() => __importStar(require("@/services/hq-menu.service")));
        const activeMenu = await HqMenuService.resolveActiveMenu(merchantId, locId, channel, new Date(), timezone);
        const visibleProducts = this.filterByHqMenuProductIds(filtered.products, activeMenu.productIds);
        const categoryIdsWithProducts = new Set(visibleProducts.map((p) => p.categoryId).filter(Boolean));
        const visibleCategories = filtered.categories.filter((c) => categoryIdsWithProducts.has(c.id) ||
            !!c.isOffersCategory);
        const pricedProducts = HqMenuService.applyMenuPrices(visibleProducts, activeMenu.productPrices);
        return {
            categories: visibleCategories,
            products: pricedProducts,
            locationId: locId,
        };
    }
}
exports.CatalogLocationService = CatalogLocationService;
//# sourceMappingURL=catalog-location.service.js.map