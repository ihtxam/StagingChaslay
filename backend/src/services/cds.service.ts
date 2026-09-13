import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  ensureCustomerDisplaySettingsColumn,
  queryRaw,
} from "@/lib/ensure-merchant-schema";
import {
  normalizeCustomerDisplaySettings,
  type CustomerDisplaySettings,
} from "@/lib/customer-display-settings";

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  shop_logo_url?: string | null;
  shopLogoUrl?: string | null;
  customer_display_settings?: unknown;
  customerDisplaySettings?: unknown;
};

async function loadMerchantByToken(token: string): Promise<{
  merchant: MerchantRow;
  settings: CustomerDisplaySettings;
}> {
  await ensureCustomerDisplaySettingsColumn();
  const rows = await queryRaw<MerchantRow>(
    `SELECT id, name, slug, shop_logo_url, customer_display_settings
     FROM merchants
     WHERE customer_display_settings IS NOT NULL
       AND customer_display_settings->>'accessToken' = $1
     LIMIT 1`,
    [token]
  );
  const merchant = rows[0];
  if (!merchant) throw new Error("Customer display not found");
  const settings = normalizeCustomerDisplaySettings(merchant.customer_display_settings);
  if (settings.accessToken !== token) throw new Error("Customer display not found");
  if (!settings.enabled) throw new Error("Customer display is disabled");
  return { merchant, settings };
}

export class CdsService {
  static async configForToken(token: string) {
    const { merchant, settings } = await loadMerchantByToken(token);
    const logoUrl = merchant.shop_logo_url ?? merchant.shopLogoUrl ?? null;
    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        logoUrl,
      },
      settings: {
        promoSlides: settings.promoSlides || [],
        slideIntervalSec: settings.slideIntervalSec ?? 8,
        theme: settings.theme === "dark" ? "dark" : "light",
      },
    };
  }

  static async getSettings(merchantId: string): Promise<CustomerDisplaySettings> {
    await ensureCustomerDisplaySettingsColumn();
    const rows = await queryRaw<{ customer_display_settings: unknown }>(
      `SELECT customer_display_settings FROM merchants WHERE id = $1 LIMIT 1`,
      [merchantId]
    );
    if (rows[0]?.customer_display_settings == null) {
      const defaults = normalizeCustomerDisplaySettings(null);
      const db = getDb();
      await db
        .update(schema.merchants)
        .set({ customerDisplaySettings: defaults, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
      return defaults;
    }
    return normalizeCustomerDisplaySettings(rows[0]?.customer_display_settings);
  }

  static async updateSettings(
    merchantId: string,
    raw: unknown
  ): Promise<CustomerDisplaySettings> {
    await ensureCustomerDisplaySettingsColumn();
    const existing = await this.getSettings(merchantId);
    const incoming = normalizeCustomerDisplaySettings({ ...existing, ...(raw as object) });
    incoming.accessToken = existing.accessToken || incoming.accessToken;
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ customerDisplaySettings: incoming, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return incoming;
  }

  static async rotateToken(merchantId: string): Promise<CustomerDisplaySettings> {
    const settings = await this.getSettings(merchantId);
    settings.accessToken = normalizeCustomerDisplaySettings({}).accessToken;
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ customerDisplaySettings: settings, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return settings;
  }
}
