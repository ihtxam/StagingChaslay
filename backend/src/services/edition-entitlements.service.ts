import type { EditionFeatureKey } from "@/lib/edition-features";
import { hasEditionFeature } from "@/lib/edition-features";
import { normalizeBusinessModule } from "@/lib/business-module";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { EditionService } from "@/services/edition.service";

const cache = new Map<string, { at: number; features: EditionFeatureKey[] | null }>();
const TTL_MS = 30_000;

export class EditionEntitlementsService {
  static invalidate(merchantId: string) {
    cache.delete(merchantId);
  }

  static async getFeatures(merchantId: string): Promise<EditionFeatureKey[] | null> {
    const hit = cache.get(merchantId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.features;
    const features = await EditionService.getMerchantFeatures(merchantId);
    const enriched = await this.enrichForMerchant(merchantId, features);
    cache.set(merchantId, { at: Date.now(), features: enriched });
    return enriched;
  }

  /** Retail merchants get pos_scale by default when their edition predates the feature. */
  static async enrichForMerchant(
    merchantId: string,
    features: EditionFeatureKey[] | null
  ): Promise<EditionFeatureKey[] | null> {
    if (features == null) return null;
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { businessCategory: true },
    });
    const module = normalizeBusinessModule(merchant?.businessCategory);
    let next = features;
    if (module === "retail" && !next.includes("pos_scale")) {
      next = [...next, "pos_scale"];
    }
    try {
      const { readGiftCardAddonEnabled } = await import("@/lib/gift-card-addon");
      const giftOn = await readGiftCardAddonEnabled(merchantId);
      if (giftOn) {
        if (!next.includes("gift_cards")) next = [...next, "gift_cards"];
        if (!next.includes("pos_gift_cards")) next = [...next, "pos_gift_cards"];
      }
    } catch {
      /* addon column optional on older schemas */
    }
    return next;
  }

  static async require(
    merchantId: string,
    feature: EditionFeatureKey
  ): Promise<EditionFeatureKey[] | null> {
    const features = await this.getFeatures(merchantId);
    if (!hasEditionFeature(features, feature)) {
      const err = new Error(`Edition does not include feature: ${feature}`);
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    return features;
  }
}
