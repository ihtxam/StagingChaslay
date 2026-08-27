import { and, eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb, schema } from "@/db";
import { PlatformSettingsService } from "@/services/platform-settings.service";
import { AuthService } from "@/services/auth.service";

export const PLATFORM_RESELLER_SETTINGS_KEY = "platform_reseller_id";
const PLATFORM_RESELLER_EMAIL = "platform-sales@rebornsense.com";

export class PlatformResellerService {
  /** Reseller id used for direct Reborn → merchant sales (superadmin acts as this agency). */
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

  static async ensure(): Promise<string> {
    const db = getDb();
    const byEmail = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, PLATFORM_RESELLER_EMAIL),
      columns: { id: true },
    });
    if (byEmail) {
      await PlatformSettingsService.set(PLATFORM_RESELLER_SETTINGS_KEY, byEmail.id);
      return byEmail.id;
    }

    const passwordHash = await AuthService.hashPassword(crypto.randomBytes(32).toString("hex"));
    const [row] = await db
      .insert(schema.resellers)
      .values({
        name: "Reborn Direct",
        email: PLATFORM_RESELLER_EMAIL,
        passwordHash,
        status: "active",
        licenseSeats: 9999,
        branding: { platformDirect: true },
      })
      .returning();

    const id = row!.id;
    await PlatformSettingsService.set(PLATFORM_RESELLER_SETTINGS_KEY, id);
    return id;
  }

  /** Selling reseller for a merchant: assigned agency or platform direct. */
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

  /** Migrate legacy platform-owned packages/add-ons to the platform reseller. */
  static async migrateCatalogOwnership() {
    const sellerId = await this.getId();
    const db = getDb();
    await db
      .update(schema.subscriptionPlans)
      .set({ ownerType: "reseller", ownerId: sellerId, updatedAt: new Date() })
      .where(
        and(
          eq(schema.subscriptionPlans.ownerType, "platform")
        )
      );
    await db
      .update(schema.subscriptionAddons)
      .set({ ownerType: "reseller", ownerId: sellerId, updatedAt: new Date() })
      .where(eq(schema.subscriptionAddons.ownerType, "platform"));
  }
}
