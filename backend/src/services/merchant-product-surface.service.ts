import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  isMerchantProductSurface,
  isProductSurfacePackagingEditionName,
  PRODUCT_SURFACE_PRESETS,
  type MerchantProductSurface,
} from "@/lib/merchant-product-surface";
import { EditionService } from "@/services/edition.service";
import { MerchantService } from "@/services/merchant.service";

export class MerchantProductSurfaceService {
  static async apply(
    merchantId: string,
    surface: MerchantProductSurface,
    opts?: { posEditionId?: string | null }
  ) {
    if (!isMerchantProductSurface(surface)) {
      throw new Error("Invalid product surface");
    }
    const preset = PRODUCT_SURFACE_PRESETS[surface];
    await EditionService.ensureProductSurfaceEditions();

    let editionId: string;
    let editionName: string;

    if (surface === "full_pos" && opts?.posEditionId) {
      const posEditionId = String(opts.posEditionId).trim();
      if (!posEditionId) throw new Error("POS version is required");
      const posEdition = await EditionService.getById(posEditionId);
      if (!posEdition || !posEdition.isActive) {
        throw new Error("POS version not found or inactive");
      }
      if (isProductSurfacePackagingEditionName(posEdition.name)) {
        throw new Error("Choose a POS version (Restaurant Pro, Retail Basic, etc.), not a shop-only package edition");
      }
      editionId = posEdition.id;
      editionName = posEdition.name;
    } else {
      const edition = await EditionService.getPlatformEditionByName(preset.editionName);
      if (!edition) {
        throw new Error(`Edition not found: ${preset.editionName}`);
      }
      editionId = edition.id;
      editionName = edition.name;
    }

    const db = getDb();
    const [merchant] = await db
      .update(schema.merchants)
      .set({
        shopEnabled: preset.shopEnabled,
        cmsHomepageEnabled: preset.cmsHomepageEnabled,
        editionId,
        maxPosPosts: preset.maxPosPosts,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId))
      .returning();

    if (!merchant) throw new Error("Merchant not found");

    await EditionService.applyEditionDefaultsToMerchant(merchantId, editionId);
    const { PackageProvisioningService } = await import("./package-provisioning.service");
    const appliedEdition = await EditionService.getById(editionId);
    await PackageProvisioningService.applyEditionFeatureAddons(
      merchantId,
      (appliedEdition?.features as import("@/lib/edition-features").EditionFeatureKey[] | null) ??
        null
    );

    return {
      surface,
      merchantId,
      editionId,
      editionName,
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
