import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { APP_ORIGIN } from "@/lib/brand";
import {
  ensureCustomerDisplaySettingsColumn,
  queryRaw,
} from "@/lib/ensure-merchant-schema";
import {
  buildCdsPublicUrl,
  generateCdsToken,
  normalizeCustomerDisplaySettings,
  type CustomerDisplaySettings,
} from "@/lib/customer-display-settings";
import { allocateDisplayShortCode } from "@/lib/display-short-code";
import {
  getCdsLiveState,
  normalizeCdsLiveState,
  setCdsLiveState,
  sweepExpiredCdsLiveState,
  type CdsLiveState,
} from "@/lib/cds-live-state";

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  shop_logo_url?: string | null;
  shopLogoUrl?: string | null;
  customer_display_settings?: unknown;
  customerDisplaySettings?: unknown;
};

async function ensureCdsShortCode(
  merchantId: string,
  settings: CustomerDisplaySettings
): Promise<CustomerDisplaySettings> {
  if (settings.shortCode) return settings;
  const db = getDb();
  const shortCode = await allocateDisplayShortCode(db);
  const next = { ...settings, shortCode };
  await db
    .update(schema.merchants)
    .set({ customerDisplaySettings: next, updatedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
  return next;
}

async function ensureCdsAccessToken(
  merchantId: string,
  settings: CustomerDisplaySettings
): Promise<CustomerDisplaySettings> {
  if (String(settings.accessToken || "").trim()) return settings;
  const next = { ...settings, accessToken: generateCdsToken() };
  const db = getDb();
  await db
    .update(schema.merchants)
    .set({ customerDisplaySettings: next, updatedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
  return next;
}

async function loadMerchantByAccessKey(accessKey: string): Promise<{
  merchant: MerchantRow;
  settings: CustomerDisplaySettings;
}> {
  await ensureCustomerDisplaySettingsColumn();
  const trimmed = String(accessKey || "").trim();
  if (!trimmed) throw new Error("Customer display not found");

  const rows = await queryRaw<MerchantRow>(
    `SELECT id, name, slug, shop_logo_url, customer_display_settings
     FROM merchants
     WHERE customer_display_settings IS NOT NULL
       AND (
         customer_display_settings->>'accessToken' = $1
         OR customer_display_settings->>'shortCode' = $1
       )
     LIMIT 1`,
    [trimmed]
  );
  const merchant = rows[0];
  if (!merchant) throw new Error("Customer display not found");
  let settings = normalizeCustomerDisplaySettings(merchant.customer_display_settings);
  const matches =
    settings.accessToken === trimmed || settings.shortCode === trimmed;
  if (!matches) throw new Error("Customer display not found");
  if (!settings.enabled) throw new Error("Customer display is disabled");
  settings = await ensureCdsAccessToken(merchant.id, settings);
  settings = await ensureCdsShortCode(merchant.id, settings);
  return { merchant, settings };
}

async function loadMerchantBySlug(slug: string): Promise<{
  merchant: MerchantRow;
  settings: CustomerDisplaySettings;
}> {
  await ensureCustomerDisplaySettingsColumn();
  const trimmed = String(slug || "").trim();
  if (!trimmed) throw new Error("Customer display not found");

  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.slug, trimmed),
    columns: {
      id: true,
      name: true,
      slug: true,
      shopLogoUrl: true,
      customerDisplaySettings: true,
    },
  });
  if (!merchant) throw new Error("Customer display not found");

  let settings = normalizeCustomerDisplaySettings(merchant.customerDisplaySettings);
  if (!settings.enabled) throw new Error("Customer display is disabled");
  settings = await ensureCdsAccessToken(merchant.id, settings);
  settings = await ensureCdsShortCode(merchant.id, settings);
  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug || trimmed,
      shopLogoUrl: merchant.shopLogoUrl,
      customer_display_settings: merchant.customerDisplaySettings,
    },
    settings,
  };
}

export class CdsService {
  static buildPublicUrl(merchantSlug?: string | null, settings?: CustomerDisplaySettings | null) {
    return buildCdsPublicUrl(merchantSlug, settings?.shortCode, APP_ORIGIN);
  }

  static async configForToken(accessKey: string) {
    const { merchant, settings } = await loadMerchantByAccessKey(accessKey);
    return this.formatConfigResponse(merchant, settings);
  }

  static async configForSlug(slug: string) {
    const { merchant, settings } = await loadMerchantBySlug(slug);
    return this.formatConfigResponse(merchant, settings);
  }

  private static formatConfigResponse(
    merchant: MerchantRow,
    settings: CustomerDisplaySettings
  ) {
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
        shortCode: settings.shortCode || null,
        syncToken: settings.accessToken,
        displayUrl: buildCdsPublicUrl(merchant.slug, settings.shortCode, APP_ORIGIN),
      },
    };
  }

  static async getSettings(merchantId: string): Promise<CustomerDisplaySettings> {
    await ensureCustomerDisplaySettingsColumn();
    const rows = await queryRaw<{ customer_display_settings: unknown; slug: string | null }>(
      `SELECT customer_display_settings, slug FROM merchants WHERE id = $1 LIMIT 1`,
      [merchantId]
    );
    if (rows[0]?.customer_display_settings == null) {
      const defaults = normalizeCustomerDisplaySettings(null);
      let withToken = await ensureCdsAccessToken(merchantId, defaults);
      withToken = await ensureCdsShortCode(merchantId, withToken);
      return withToken;
    }
    let settings = normalizeCustomerDisplaySettings(rows[0]?.customer_display_settings);
    settings = await ensureCdsAccessToken(merchantId, settings);
    return ensureCdsShortCode(merchantId, settings);
  }

  static async getSettingsMeta(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { slug: true },
    });
    const settings = await this.getSettings(merchantId);
    return {
      settings,
      merchantSlug: merchant?.slug || null,
      displayUrl: buildCdsPublicUrl(merchant?.slug, settings.shortCode, APP_ORIGIN),
    };
  }

  static async updateSettings(
    merchantId: string,
    raw: unknown
  ): Promise<CustomerDisplaySettings> {
    await ensureCustomerDisplaySettingsColumn();
    const existing = await this.getSettings(merchantId);
    const incoming = normalizeCustomerDisplaySettings({ ...existing, ...(raw as object) });
    incoming.accessToken = existing.accessToken || incoming.accessToken;
    incoming.shortCode = existing.shortCode || incoming.shortCode;
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ customerDisplaySettings: incoming, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return incoming;
  }

  static async rotateToken(merchantId: string): Promise<CustomerDisplaySettings> {
    const settings = await this.getSettings(merchantId);
    settings.accessToken = generateCdsToken();
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ customerDisplaySettings: settings, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return settings;
  }

  static async pushLiveState(merchantId: string, raw: unknown): Promise<CdsLiveState> {
    const settings = await this.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Customer display is disabled");
    const state = normalizeCdsLiveState(raw);
    if (!state) throw new Error("Invalid customer display state");
    setCdsLiveState(settings.accessToken!, merchantId, state);
    return state;
  }

  static async liveStateForToken(accessKey: string): Promise<CdsLiveState | null> {
    sweepExpiredCdsLiveState();
    const { settings } = await loadMerchantByAccessKey(accessKey);
    return getCdsLiveState(settings.accessToken!);
  }

  static async liveStateForSlug(slug: string): Promise<CdsLiveState | null> {
    sweepExpiredCdsLiveState();
    const { settings } = await loadMerchantBySlug(slug);
    return getCdsLiveState(settings.accessToken!);
  }
}
