"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantProductSurfaceService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const merchant_product_surface_1 = require("@/lib/merchant-product-surface");
const edition_service_1 = require("@/services/edition.service");
const merchant_service_1 = require("@/services/merchant.service");
class MerchantProductSurfaceService {
    static async apply(merchantId, surface) {
        if (!(0, merchant_product_surface_1.isMerchantProductSurface)(surface)) {
            throw new Error("Invalid product surface");
        }
        const preset = merchant_product_surface_1.PRODUCT_SURFACE_PRESETS[surface];
        await edition_service_1.EditionService.ensureProductSurfaceEditions();
        const edition = await edition_service_1.EditionService.getPlatformEditionByName(preset.editionName);
        if (!edition) {
            throw new Error(`Edition not found: ${preset.editionName}`);
        }
        const db = (0, db_1.getDb)();
        const [merchant] = await db
            .update(db_1.schema.merchants)
            .set({
            shopEnabled: preset.shopEnabled,
            cmsHomepageEnabled: preset.cmsHomepageEnabled,
            editionId: edition.id,
            maxPosPosts: preset.maxPosPosts,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
            .returning();
        if (!merchant)
            throw new Error("Merchant not found");
        return {
            surface,
            merchantId,
            editionId: edition.id,
            editionName: edition.name,
            shopEnabled: preset.shopEnabled,
            cmsHomepageEnabled: preset.cmsHomepageEnabled,
            maxPosPosts: preset.maxPosPosts,
            hasPos: preset.maxPosPosts > 0,
            showOrderCenter: preset.maxPosPosts === 0 && preset.shopEnabled,
        };
    }
    static async setPosEnabled(merchantId, enabled) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        if (enabled) {
            await edition_service_1.EditionService.ensureProductSurfaceEditions();
            const edition = await edition_service_1.EditionService.getPlatformEditionByName(merchant_product_surface_1.PRODUCT_SURFACE_PRESETS.full_pos.editionName);
            if (!edition)
                throw new Error("Full POS edition missing");
            const maxPos = Math.max(1, Number(merchant.maxPosPosts) || 0);
            await merchant_service_1.MerchantService.updateMerchant(merchantId, {
                editionId: edition.id,
                maxPosPosts: maxPos,
                shopEnabled: true,
            });
            return { posEnabled: true, maxPosPosts: maxPos };
        }
        await edition_service_1.EditionService.ensureProductSurfaceEditions();
        const edition = await edition_service_1.EditionService.getPlatformEditionByName(merchant_product_surface_1.PRODUCT_SURFACE_PRESETS.shop_website.editionName);
        if (!edition)
            throw new Error("Shop edition missing");
        await merchant_service_1.MerchantService.updateMerchant(merchantId, {
            editionId: edition.id,
            maxPosPosts: 0,
        });
        return { posEnabled: false, maxPosPosts: 0 };
    }
}
exports.MerchantProductSurfaceService = MerchantProductSurfaceService;
//# sourceMappingURL=merchant-product-surface.service.js.map