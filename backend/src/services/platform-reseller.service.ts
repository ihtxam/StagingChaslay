import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PlatformSettingsService } from "@/services/platform-settings.service";

export const PLATFORM_RESELLER_SETTINGS_KEY = "platform_reseller_id";

/** Legacy platform-direct seller emails — catalog migrates to Chaslay agency. */
const LEGACY_PLATFORM_SELLER_EMAILS = [
  "platform-sales@rebornsense.com",
  "agency@rebornsense.com",
];

export class PlatformResellerService {
  /** Reseller id used when a merchant has no assigned agency (defaults to Chaslay). */
  static async getId(): Promise<string> {
    const stored = await PlatformSettingsService.get(PLATFORM_RESELLER_SETTINGS_KEY);
    if (stored?.trim()) {
      const db = getDb();
      const row = await db.query.resellers.findFirst({
        where: eq(schema.resellers.id, stored.trim()),
        columns: { id: true },
      });
      if (row) return row.id;
    }
    return this.ensure();
  }

  /** Ensure Chaslay agency exists and is the platform default seller (no direct Reborn sales). */
  static async ensure(): Promise<string> {
    const { ResellerService } = await import("@/services/reseller.service");
    const chaslay = await ResellerService.ensureChaslayAgency();
    await PlatformSettingsService.set(PLATFORM_RESELLER_SETTINGS_KEY, chaslay.id);
    await this.migrateLegacyDirectSalesCatalog(chaslay.id);
    return chaslay.id;
  }

  /** Selling reseller for a merchant: assigned agency or Chaslay default. */
  static async resolveForMerchant(merchantId: string): Promise<string> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { resellerId: true },
    });
    if (!merchant) throw new Error("Merchant not found");
    if (merchant.resellerId) return merchant.resellerId;
    return this.getId();
  }

  /** Move legacy Reborn Direct catalog and merchants to Chaslay agency. */
  static async migrateLegacyDirectSalesCatalog(chaslayId: string) {
    const db = getDb();
    for (const email of LEGACY_PLATFORM_SELLER_EMAILS) {
      const legacy = await db.query.resellers.findFirst({
        where: eq(schema.resellers.email, email),
        columns: { id: true },
      });
      if (!legacy || legacy.id === chaslayId) continue;

      await db
        .update(schema.subscriptionPlans)
        .set({ ownerType: "reseller", ownerId: chaslayId, updatedAt: new Date() })
        .where(eq(schema.subscriptionPlans.ownerId, legacy.id));

      await db
        .update(schema.subscriptionAddons)
        .set({ ownerType: "reseller", ownerId: chaslayId, updatedAt: new Date() })
        .where(eq(schema.subscriptionAddons.ownerId, legacy.id));

      await db
        .update(schema.merchants)
        .set({ resellerId: chaslayId, updatedAt: new Date() })
        .where(eq(schema.merchants.resellerId, legacy.id));
    }
  }

  /** Migrate legacy platform-owned packages/add-ons to the Chaslay reseller. */
  static async migrateCatalogOwnership() {
    const sellerId = await this.getId();
    const db = getDb();
    await db
      .update(schema.subscriptionPlans)
      .set({ ownerType: "reseller", ownerId: sellerId, updatedAt: new Date() })
      .where(and(eq(schema.subscriptionPlans.ownerType, "platform")));
    await db
      .update(schema.subscriptionAddons)
      .set({ ownerType: "reseller", ownerId: sellerId, updatedAt: new Date() })
      .where(eq(schema.subscriptionAddons.ownerType, "platform"));
    await this.migrateLegacyDirectSalesCatalog(sellerId);
  }
}
