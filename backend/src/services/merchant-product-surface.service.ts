import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  isMerchantProductSurface,
  PRODUCT_SURFACE_PRESETS,
  type MerchantProductSurface,
} from "@/lib/merchant-product-surface";
import { EditionService } from "@/services/edition.service";
import { MerchantService } from "@/services/merchant.service";

export class MerchantProductSurfaceService {
  static async apply(merchantId: string, surface: MerchantProductSurface) {
    if (!isMerchantProductSurface(surface)) {
      throw new Error("Invalid product surface");
    }
    const preset = PRODUCT_SURFACE_PRESETS[surface];
    await EditionService.ensureProductSurfaceEditions();
    const edition = await EditionService.getPlatformEditionByName(preset.editionName);
    if (!edition) {
      throw new Error(`Edition not found: ${preset.editionName}`);
    }

    const db = getDb();
    const [merchant] = await db
      .update(schema.merchants)
      .set({
        shopEnabled: preset.shopEnabled,
        cmsHomepageEnabled: preset.cmsHomepageEnabled,
        editionId: edition.id,
        maxPosPosts: preset.maxPosPosts,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId))
      .returning();

    if (!merchant) throw new Error("Merchant not found");

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

  static async setPosEnabled(merchantId: string, enabled: boolean) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    if (enabled) {
      await EditionService.ensureProductSurfaceEditions();
      const edition = await EditionService.getPlatformEditionByName(
        PRODUCT_SURFACE_PRESETS.full_pos.editionName
      );
      if (!edition) throw new Error("Full POS edition missing");
      const maxPos = Math.max(1, Number(merchant.maxPosPosts) || 0);
      await MerchantService.updateMerchant(merchantId, {
        editionId: edition.id,
        maxPosPosts: maxPos,
        shopEnabled: true,
      });
      return { posEnabled: true, maxPosPosts: maxPos };
    }

    await EditionService.ensureProductSurfaceEditions();
    const edition = await EditionService.getPlatformEditionByName(
      PRODUCT_SURFACE_PRESETS.shop_website.editionName
    );
    if (!edition) throw new Error("Shop edition missing");
    await MerchantService.updateMerchant(merchantId, {
      editionId: edition.id,
      maxPosPosts: 0,
    });
    return { posEnabled: false, maxPosPosts: 0 };
  }
}
