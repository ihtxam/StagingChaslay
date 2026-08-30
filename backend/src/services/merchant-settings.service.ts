import { getDb, schema } from "@/db";
import type {
  VacationSettings,
  MerchantSmtpSettings,
  MerchantBrevoSettings,
  MarketingSettings,
} from "@/db/schema";
import { eq, and, or, ne } from "drizzle-orm";
import { normalizeCustomDomain } from "@/lib/domain";
import { normalizeVacationSettings } from "@/lib/vacation";
import { MarketingService } from "@/services/marketing.service";
import {
  normalizePosPrintSettings,
  type PosPrintSettings,
} from "@/lib/pos-print-settings";
import {
  normalizePosCheckoutSettings,
  type PosCheckoutSettings,
} from "@/lib/pos-checkout-settings";
import { normalizeBusinessModule, posModeForModule } from "@/lib/business-module";
import {
  normalizeTableQrSettings,
  type TableQrSettings,
} from "@/lib/table-qr-settings";
import {
  getDeliveryPlatformPublic,
  mergeDeliveryPlatformSettings,
  applyProductionCredentialDefaults,
  normalizeDeliveryPlatformSettings,
  type DeliveryPlatformSettings,
} from "@/lib/delivery-platform-settings";
import {
  readJustEatAddonEnabled,
  readUberEatsAddonEnabled,
} from "@/lib/delivery-platform-addon";
import { withMerchantSchemaRetry } from "@/lib/ensure-merchant-schema";
import { isInventoryAddonEnabled, readInventoryAddonEnabled } from "@/lib/inventory-addon";
import { readStorekeeperAddonEnabled } from "@/lib/storekeeper-addon";
import { isSignageAddonEnabled, readSignageAddon } from "@/lib/signage-addon";
import { isKdsAddonEnabled, readKdsAddonEnabled } from "@/lib/kds-addon";
import { isOdsAddonEnabled, readOdsAddonEnabled } from "@/lib/ods-addon";
import { isKioskAddonEnabled, readKioskAddonEnabled } from "@/lib/kiosk-addon";

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function normalizeSubdomain(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!cleaned || cleaned.length < 2) return null;
  return cleaned.slice(0, 63);
}

function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || `shop-${Date.now().toString(36)}`
  );
}

export type FulfillmentChannel = "takeaway" | "dine_in" | "delivery";
export type ChannelSelectMode = "checkout" | "popup_start" | "menu";
export type ShopCartLayout = "hidden_slide" | "sticky_right";

function normalizeChannelSelectMode(raw?: string | null): ChannelSelectMode {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "popup_start" || v === "menu" || v === "checkout") return v;
  return "checkout";
}

function normalizeCartLayout(raw?: string | null): ShopCartLayout {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "sticky_right") return "sticky_right";
  return "hidden_slide";
}

export class MerchantSettingsService {
  static async getMerchantSettings(merchantId: string) {
    return withMerchantSchemaRetry(() => this.buildMerchantSettings(merchantId));
  }

  private static async buildMerchantSettings(merchantId: string) {
    // Schema patches run at API startup. Do not re-run CREATE/ALTER here —
    // concurrent Settings loads were locking Postgres and leaving the panel spinning.
    const db = getDb();

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const inventoryOn = await readInventoryAddonEnabled(merchantId).catch(() =>
      isInventoryAddonEnabled(merchant.inventoryAddonEnabled)
    );
    const signage = await readSignageAddon(merchantId).catch(() => ({
      enabled: isSignageAddonEnabled(merchant.signageAddonEnabled),
      screenLimit: Math.max(1, Number(merchant.signageScreenLimit) || 2),
    }));
    const kdsOn = await readKdsAddonEnabled(merchantId).catch(() =>
      isKdsAddonEnabled(merchant.kdsAddonEnabled)
    );
    const odsOn = await readOdsAddonEnabled(merchantId).catch(() =>
      isOdsAddonEnabled(merchant.odsAddonEnabled)
    );
    const justEatOn = await readJustEatAddonEnabled(merchantId).catch(() =>
      merchant.justEatAddonEnabled === true
    );
    const uberEatsOn = await readUberEatsAddonEnabled(merchantId).catch(() =>
      merchant.uberEatsAddonEnabled === true
    );
    const storekeeperOn = await readStorekeeperAddonEnabled(merchantId).catch(() => false);
    const kioskOn = await readKioskAddonEnabled(merchantId).catch(() =>
      isKioskAddonEnabled(merchant.kioskAddonEnabled)
    );

    const domain = process.env.DOMAIN || process.env.PUBLIC_APP_URL?.replace(/^https?:\/\//, "") || "localhost";
    const shopHost =
      process.env.SHOP_PUBLIC_HOST ||
      (domain.includes("rebornsense.com") ? "shop.rebornsense.com" : domain.startsWith("shop.") ? domain : `shop.${domain}`);
    const apex = domain.replace(/^shop\./, "");

    return {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      phone: merchant.phone,
      businessLicense: merchant.businessLicense,
      address: merchant.address,
      city: merchant.city,
      country: merchant.country,
      vatNumber: merchant.vatNumber,
      vatRate: merchant.vatRate,
      taxTakeawayRate: merchant.taxTakeawayRate,
      taxDineInRate: merchant.taxDineInRate,
      taxDeliveryRate: merchant.taxDeliveryRate,
      taxIncludedInPrice: merchant.taxIncludedInPrice === true,
      vatAfterDiscount: merchant.vatAfterDiscount !== false,
      slug: merchant.slug,
      subdomain: merchant.subdomain,
      customDomain: merchant.customDomain,
      cmsHomepageEnabled: !!merchant.cmsHomepageEnabled,
      shopEnabled: merchant.shopEnabled,
      acceptingOrders: merchant.acceptingOrders !== false,
      acceptingReservations: merchant.acceptingReservations !== false,
      reservationsEnabled: !!merchant.reservationsEnabled,
      pickupEnabled: merchant.pickupEnabled,
      dineInEnabled: merchant.dineInEnabled,
      deliveryEnabled: merchant.deliveryEnabled,
      channelSelectMode: normalizeChannelSelectMode(merchant.channelSelectMode),
      menuShowProductImages: merchant.menuShowProductImages !== false,
      menuShowCategoryBanners: merchant.menuShowCategoryBanners !== false,
      cartLayout: normalizeCartLayout(merchant.cartLayout),
      scheduledOrdersEnabled: merchant.scheduledOrdersEnabled !== false,
      floorPlanEnabled: merchant.floorPlanEnabled,
      paxOrderingEnabled: merchant.paxOrderingEnabled,
      coursesEnabled: !!merchant.coursesEnabled,
      shiftsEnabled: !!merchant.shiftsEnabled,
      maxPosPosts: Math.max(0, Number((merchant as { maxPosPosts?: number }).maxPosPosts ?? 0)),
      maxWaiterPosts: Math.max(
        0,
        Number((merchant as { maxWaiterPosts?: number }).maxWaiterPosts ?? 0)
      ),
      maxLocations: Math.max(0, Number((merchant as { maxLocations?: number }).maxLocations ?? 1)),
      inventoryAddonEnabled: inventoryOn,
      inventoryEnabled: inventoryOn,
      signageAddonEnabled: signage.enabled,
      signageEnabled: signage.enabled,
      signageScreenLimit: signage.screenLimit,
      kdsAddonEnabled: kdsOn,
      kdsEnabled: kdsOn,
      odsAddonEnabled: odsOn,
      odsEnabled: odsOn,
      justEatAddonEnabled: justEatOn,
      uberEatsAddonEnabled: uberEatsOn,
      deliveryPlatformsAddonEnabled: justEatOn || uberEatsOn,
      storekeeperAddonEnabled: storekeeperOn,
      kioskAddonEnabled: kioskOn,
      kioskEnabled: kioskOn,
      inventoryWasteFactor: Number(merchant.inventoryWasteFactor ?? 0.2) || 0.2,
      inventoryAutoReorderEmailEnabled: merchant.inventoryAutoReorderEmailEnabled === true,
      inventoryExpiryAlertDays: Math.max(1, Math.min(365, Number(merchant.inventoryExpiryAlertDays ?? 30) || 30)),
      posColorTheme: (merchant.posColorTheme as string) || "teal",
      storeHours: merchant.storeHours || {},
      shopLogoUrl: merchant.shopLogoUrl,
      shopBannerUrl: merchant.shopBannerUrl,
      latitude: merchant.latitude,
      longitude: merchant.longitude,
      pickupEtaMinutes: merchant.pickupEtaMinutes,
      deliveryEtaMinutes: merchant.deliveryEtaMinutes,
      minPreOrderDelayMinutes: merchant.minPreOrderDelayMinutes ?? 30,
      deliveryMenuMarkup: merchant.deliveryMenuMarkup ?? "0",
      categoryPricingEnabled: merchant.categoryPricingEnabled === true,
      deliveryDriverPayMode: merchant.deliveryDriverPayMode || "both",
      deliveryDriverHourlyRate: merchant.deliveryDriverHourlyRate ?? "0",
      deliveryPerOrderFee: merchant.deliveryPerOrderFee ?? "0",
      vacationSettings: normalizeVacationSettings(merchant.vacationSettings),
      emailSmtpSettings: MarketingService.getSmtpPublic(merchant.emailSmtpSettings),
      emailBrevoSettings: MarketingService.getBrevoPublic(merchant.emailBrevoSettings),
      emailDeliveryMode:
        String((merchant as { emailDeliveryMode?: string }).emailDeliveryMode || "platform")
          .toLowerCase() === "own"
          ? "own"
          : "platform",
      marketingSettings: MarketingService.normalizeMarketing(merchant.marketingSettings),
      shopPathUrl: merchant.slug ? `https://${shopHost}/${merchant.slug}` : null,
      shopSubdomainUrl: merchant.subdomain ? `https://${merchant.subdomain}.${apex}` : null,
      shopCustomDomainUrl: merchant.customDomain ? `https://${merchant.customDomain}` : null,
      adyenMerchantAccount: merchant.adyenMerchantAccount,
      adyenApiKeyMasked: maskSecret(merchant.adyenApiKey),
      adyenApiKeySet: !!merchant.adyenApiKey,
      adyenClientId: merchant.adyenClientId,
      adyenHmacKeyMasked: maskSecret(merchant.adyenHmacKey),
      adyenHmacKeySet: !!merchant.adyenHmacKey,
      tapToPayEnabled: merchant.tapToPayEnabled === true,
      adyenLiveEnvironment: !!merchant.adyenLiveEnvironment,
      adyenLiveRegion: merchant.adyenLiveRegion || "EU",
      adyenUseLegacyEndpoint: !!merchant.adyenUseLegacyEndpoint,
      webposExpressEnabled: merchant.webposExpressEnabled !== false,
      webposCashEnabled: merchant.webposCashEnabled !== false,
      webposCardEnabled: merchant.webposCardEnabled !== false,
      webposTerminalEnabled: merchant.webposTerminalEnabled !== false,
      webposGiftCardEnabled: merchant.webposGiftCardEnabled === true,
      webposInvoiceEnabled: (merchant as { webposInvoiceEnabled?: boolean }).webposInvoiceEnabled !== false,
      bankIban: (merchant as { bankIban?: string | null }).bankIban || null,
      bankQrIban: (merchant as { bankQrIban?: string | null }).bankQrIban || null,
      bankName: (merchant as { bankName?: string | null }).bankName || null,
      bankAccountHolder: (merchant as { bankAccountHolder?: string | null }).bankAccountHolder || null,
      onlineCardFeeFixed: merchant.onlineCardFeeFixed ?? "0",
      onlineCardFeePercent: merchant.onlineCardFeePercent ?? "0",
      panelLanguage: merchant.panelLanguage || "en",
      shopLanguage: merchant.shopLanguage || merchant.panelLanguage || "en",
      posPrintSettings: normalizePosPrintSettings(merchant.posPrintSettings),
      tableQrSettings: normalizeTableQrSettings(merchant.tableQrSettings),
      posCheckoutSettings: normalizePosCheckoutSettings(merchant.posCheckoutSettings),
      deliveryPlatformSettings: getDeliveryPlatformPublic(merchant.deliveryPlatformSettings),
      status: merchant.status,
      subscriptionPlan: merchant.subscriptionPlan,
      editionId: (merchant as { editionId?: string | null }).editionId || null,
      businessCategory: normalizeBusinessModule(
        (merchant as { businessCategory?: string | null }).businessCategory
      ),
      resellerId: (merchant as { resellerId?: string | null }).resellerId || null,
      /**
       * null = legacy full access for edition routes.
       * Inventory is a paid merchant addon — never grant it via edition JSON.
       * Inject only when the merchant column is true (for any leftover edition checks).
       */
      editionFeatures: await (async () => {
        try {
          const { EditionEntitlementsService } = await import("./edition-entitlements.service");
          const feats = await EditionEntitlementsService.getFeatures(merchantId);
          if (feats == null) return null;
          const withoutPaid = feats.filter((k) => k !== "inventory" && k !== "digital_signage");
          const extra: typeof feats = [];
          if (inventoryOn) extra.push("inventory");
          if (signage.enabled) extra.push("digital_signage");
          return [...withoutPaid, ...extra];
        } catch {
          return null;
        }
      })(),
    };
  }

  static async updateMerchantSettings(
    merchantId: string,
    updates: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      businessLicense?: string;
      vatNumber?: string;
      vatRate?: number;
      taxTakeawayRate?: number;
      taxDineInRate?: number;
      taxDeliveryRate?: number;
      taxIncludedInPrice?: boolean;
      vatAfterDiscount?: boolean;
      slug?: string;
      subdomain?: string;
      customDomain?: string | null;
      cmsHomepageEnabled?: boolean;
      shopEnabled?: boolean;
      acceptingOrders?: boolean;
      acceptingReservations?: boolean;
      pickupEnabled?: boolean;
      dineInEnabled?: boolean;
      deliveryEnabled?: boolean;
      channelSelectMode?: ChannelSelectMode | string;
      menuShowProductImages?: boolean;
      menuShowCategoryBanners?: boolean;
      cartLayout?: ShopCartLayout | string;
      scheduledOrdersEnabled?: boolean;
      floorPlanEnabled?: boolean;
      paxOrderingEnabled?: boolean;
      coursesEnabled?: boolean;
      shiftsEnabled?: boolean;
      posColorTheme?: string;
      storeHours?: Record<string, unknown>;
      shopLogoUrl?: string | null;
      shopBannerUrl?: string | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
      pickupEtaMinutes?: number;
      deliveryEtaMinutes?: number;
      minPreOrderDelayMinutes?: number;
      deliveryMenuMarkup?: number;
      categoryPricingEnabled?: boolean;
      deliveryDriverPayMode?: string;
      deliveryDriverHourlyRate?: number;
      deliveryPerOrderFee?: number;
      vacationSettings?: VacationSettings | null;
      emailSmtpSettings?: MerchantSmtpSettings | null;
      emailBrevoSettings?: MerchantBrevoSettings | null;
      emailDeliveryMode?: "platform" | "own" | string;
      marketingSettings?: MarketingSettings | null;
      adyenMerchantAccount?: string;
      adyenApiKey?: string;
      adyenClientId?: string;
      adyenHmacKey?: string;
      tapToPayEnabled?: boolean;
      adyenLiveEnvironment?: boolean;
      adyenLiveRegion?: string;
      adyenUseLegacyEndpoint?: boolean;
      webposExpressEnabled?: boolean;
      webposCashEnabled?: boolean;
      webposCardEnabled?: boolean;
      webposTerminalEnabled?: boolean;
      webposGiftCardEnabled?: boolean;
      webposInvoiceEnabled?: boolean;
      bankIban?: string | null;
      bankQrIban?: string | null;
      bankName?: string | null;
      bankAccountHolder?: string | null;
      onlineCardFeeFixed?: number;
      onlineCardFeePercent?: number;
      panelLanguage?: string;
      shopLanguage?: string;
      posPrintSettings?: PosPrintSettings | null;
      tableQrSettings?: TableQrSettings | null;
      posCheckoutSettings?: PosCheckoutSettings | Partial<PosCheckoutSettings> | null;
      deliveryPlatformSettings?: DeliveryPlatformSettings | Record<string, unknown> | null;
      inventoryWasteFactor?: number;
      inventoryAutoReorderEmailEnabled?: boolean;
      inventoryExpiryAlertDays?: number;
    }
  ) {
    const db = getDb();

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.name !== undefined) {
      const name = String(updates.name || "").trim().slice(0, 255);
      if (!name) throw new Error("Business name is required");
      patch.name = name;
    }
    if (updates.email !== undefined) {
      const email = String(updates.email || "").trim().toLowerCase().slice(0, 255);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Valid email is required");
      }
      const dup = await db.query.merchants.findFirst({
        where: and(eq(schema.merchants.email, email), ne(schema.merchants.id, merchantId)),
        columns: { id: true },
      });
      if (dup) throw new Error("This email is already used by another account");
      patch.email = email;
    }
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.address !== undefined) patch.address = updates.address;
    if (updates.city !== undefined) patch.city = updates.city;
    if (updates.country !== undefined) patch.country = updates.country;
    if (updates.businessLicense !== undefined) patch.businessLicense = updates.businessLicense;
    if (updates.vatNumber !== undefined) patch.vatNumber = updates.vatNumber;
    if (updates.vatRate !== undefined) patch.vatRate = updates.vatRate.toString();
    if (updates.taxTakeawayRate !== undefined) patch.taxTakeawayRate = updates.taxTakeawayRate.toString();
    if (updates.taxDineInRate !== undefined) patch.taxDineInRate = updates.taxDineInRate.toString();
    if (updates.taxDeliveryRate !== undefined) patch.taxDeliveryRate = updates.taxDeliveryRate.toString();
    if (updates.taxIncludedInPrice !== undefined) patch.taxIncludedInPrice = !!updates.taxIncludedInPrice;
    if (updates.vatAfterDiscount !== undefined) patch.vatAfterDiscount = !!updates.vatAfterDiscount;
    if (updates.shopEnabled !== undefined) patch.shopEnabled = !!updates.shopEnabled;
    if (updates.acceptingOrders !== undefined) patch.acceptingOrders = !!updates.acceptingOrders;
    if (updates.acceptingReservations !== undefined) {
      patch.acceptingReservations = !!updates.acceptingReservations;
    }
    if (updates.pickupEnabled !== undefined) patch.pickupEnabled = !!updates.pickupEnabled;
    if (updates.dineInEnabled !== undefined) patch.dineInEnabled = !!updates.dineInEnabled;
    if (updates.deliveryEnabled !== undefined) patch.deliveryEnabled = !!updates.deliveryEnabled;
    if (updates.channelSelectMode !== undefined) {
      patch.channelSelectMode = normalizeChannelSelectMode(updates.channelSelectMode);
    }
    if (updates.menuShowProductImages !== undefined) {
      patch.menuShowProductImages = !!updates.menuShowProductImages;
    }
    if (updates.menuShowCategoryBanners !== undefined) {
      patch.menuShowCategoryBanners = !!updates.menuShowCategoryBanners;
    }
    if (updates.cartLayout !== undefined) {
      patch.cartLayout = normalizeCartLayout(updates.cartLayout);
    }
    if (updates.scheduledOrdersEnabled !== undefined) {
      patch.scheduledOrdersEnabled = !!updates.scheduledOrdersEnabled;
    }
    if (updates.floorPlanEnabled !== undefined) patch.floorPlanEnabled = !!updates.floorPlanEnabled;
    if (updates.paxOrderingEnabled !== undefined) patch.paxOrderingEnabled = !!updates.paxOrderingEnabled;
    if (updates.coursesEnabled !== undefined) patch.coursesEnabled = !!updates.coursesEnabled;
    if (updates.shiftsEnabled !== undefined) patch.shiftsEnabled = !!updates.shiftsEnabled;
    if (updates.posColorTheme !== undefined) {
      const theme = String(updates.posColorTheme || "teal").toLowerCase();
      patch.posColorTheme = ["teal", "green", "blue", "violet", "mono"].includes(theme)
        ? theme
        : "teal";
    }
    if (updates.storeHours !== undefined) patch.storeHours = updates.storeHours;
    if (updates.shopLogoUrl !== undefined) patch.shopLogoUrl = updates.shopLogoUrl;
    if (updates.shopBannerUrl !== undefined) patch.shopBannerUrl = updates.shopBannerUrl;
    if (updates.latitude !== undefined) {
      patch.latitude = updates.latitude === null || updates.latitude === "" ? null : String(updates.latitude);
    }
    if (updates.longitude !== undefined) {
      patch.longitude = updates.longitude === null || updates.longitude === "" ? null : String(updates.longitude);
    }
    if (updates.pickupEtaMinutes !== undefined) patch.pickupEtaMinutes = updates.pickupEtaMinutes;
    if (updates.deliveryEtaMinutes !== undefined) patch.deliveryEtaMinutes = updates.deliveryEtaMinutes;
    if (updates.minPreOrderDelayMinutes !== undefined) {
      patch.minPreOrderDelayMinutes = Math.max(0, Math.min(240, Number(updates.minPreOrderDelayMinutes) || 0));
    }
    if (updates.deliveryMenuMarkup !== undefined) {
      const n = Number(updates.deliveryMenuMarkup);
      if (!Number.isFinite(n) || n < 0) throw new Error("deliveryMenuMarkup must be >= 0");
      patch.deliveryMenuMarkup = n.toFixed(2);
    }
    if (updates.categoryPricingEnabled !== undefined) {
      patch.categoryPricingEnabled = !!updates.categoryPricingEnabled;
    }
    if (updates.deliveryDriverPayMode !== undefined) {
      const mode = String(updates.deliveryDriverPayMode);
      if (!["hourly", "per_order", "both"].includes(mode)) {
        throw new Error("deliveryDriverPayMode must be hourly, per_order, or both");
      }
      patch.deliveryDriverPayMode = mode;
    }
    if (updates.deliveryDriverHourlyRate !== undefined) {
      const n = Number(updates.deliveryDriverHourlyRate);
      if (!Number.isFinite(n) || n < 0) throw new Error("deliveryDriverHourlyRate must be >= 0");
      patch.deliveryDriverHourlyRate = n.toFixed(2);
    }
    if (updates.deliveryPerOrderFee !== undefined) {
      const n = Number(updates.deliveryPerOrderFee);
      if (!Number.isFinite(n) || n < 0) throw new Error("deliveryPerOrderFee must be >= 0");
      patch.deliveryPerOrderFee = n.toFixed(2);
    }
    if (updates.adyenMerchantAccount !== undefined) patch.adyenMerchantAccount = updates.adyenMerchantAccount;
    if (updates.adyenClientId !== undefined) patch.adyenClientId = updates.adyenClientId;
    if (updates.tapToPayEnabled !== undefined) patch.tapToPayEnabled = !!updates.tapToPayEnabled;
    if (updates.adyenLiveEnvironment !== undefined) patch.adyenLiveEnvironment = !!updates.adyenLiveEnvironment;
    if (updates.adyenLiveRegion !== undefined) {
      const region = String(updates.adyenLiveRegion || "EU").toUpperCase();
      patch.adyenLiveRegion = ["EU", "US", "AU", "APSE"].includes(region) ? region : "EU";
    }
    if (updates.adyenUseLegacyEndpoint !== undefined) {
      patch.adyenUseLegacyEndpoint = !!updates.adyenUseLegacyEndpoint;
    }
    if (updates.webposExpressEnabled !== undefined) patch.webposExpressEnabled = !!updates.webposExpressEnabled;
    if (updates.webposCashEnabled !== undefined) patch.webposCashEnabled = !!updates.webposCashEnabled;
    if (updates.webposCardEnabled !== undefined) patch.webposCardEnabled = !!updates.webposCardEnabled;
    if (updates.webposTerminalEnabled !== undefined) patch.webposTerminalEnabled = !!updates.webposTerminalEnabled;
    if (updates.webposGiftCardEnabled !== undefined) patch.webposGiftCardEnabled = !!updates.webposGiftCardEnabled;
    if (updates.webposInvoiceEnabled !== undefined) patch.webposInvoiceEnabled = !!updates.webposInvoiceEnabled;
    if (updates.bankIban !== undefined) {
      patch.bankIban = updates.bankIban ? String(updates.bankIban).replace(/\s+/g, "").toUpperCase().slice(0, 34) : null;
    }
    if (updates.bankQrIban !== undefined) {
      patch.bankQrIban = updates.bankQrIban
        ? String(updates.bankQrIban).replace(/\s+/g, "").toUpperCase().slice(0, 34)
        : null;
    }
    if (updates.bankName !== undefined) {
      patch.bankName = updates.bankName ? String(updates.bankName).trim().slice(0, 255) : null;
    }
    if (updates.bankAccountHolder !== undefined) {
      patch.bankAccountHolder = updates.bankAccountHolder
        ? String(updates.bankAccountHolder).trim().slice(0, 255)
        : null;
    }
    if (updates.onlineCardFeeFixed !== undefined) {
      const n = Number(updates.onlineCardFeeFixed);
      if (!Number.isFinite(n) || n < 0) throw new Error("onlineCardFeeFixed must be >= 0");
      patch.onlineCardFeeFixed = n.toFixed(2);
    }
    if (updates.onlineCardFeePercent !== undefined) {
      const n = Number(updates.onlineCardFeePercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error("onlineCardFeePercent must be between 0 and 100");
      }
      patch.onlineCardFeePercent = n.toFixed(3);
    }
    if (updates.panelLanguage !== undefined) {
      const lang = updates.panelLanguage.toLowerCase();
      if (!["en", "fr", "de"].includes(lang)) {
        throw new Error("panelLanguage must be en, fr, or de");
      }
      patch.panelLanguage = lang;
    }
    if (updates.shopLanguage !== undefined) {
      const lang = updates.shopLanguage.toLowerCase();
      if (!["en", "fr", "de"].includes(lang)) {
        throw new Error("shopLanguage must be en, fr, or de");
      }
      patch.shopLanguage = lang;
    }
    // Only overwrite API key when a non-empty new value is provided (not the masked placeholder)
    if (updates.adyenApiKey && !updates.adyenApiKey.includes("••••")) {
      patch.adyenApiKey = updates.adyenApiKey;
    }
    if (updates.adyenHmacKey && !updates.adyenHmacKey.includes("••••")) {
      patch.adyenHmacKey = updates.adyenHmacKey.trim();
    }

    if (updates.slug !== undefined) {
      patch.slug = normalizeSubdomain(updates.slug) || null;
    }
    if (updates.subdomain !== undefined) {
      patch.subdomain = normalizeSubdomain(updates.subdomain);
    }
    if (updates.customDomain !== undefined) {
      const domainNorm = normalizeCustomDomain(updates.customDomain);
      if (domainNorm) {
        const taken = await db.query.merchants.findFirst({
          where: eq(schema.merchants.customDomain, domainNorm),
        });
        if (taken && taken.id !== merchantId) {
          throw new Error("Custom domain already in use");
        }
      }
      patch.customDomain = domainNorm;
    }
    if (updates.cmsHomepageEnabled !== undefined) {
      patch.cmsHomepageEnabled = !!updates.cmsHomepageEnabled;
    }
    if (updates.vacationSettings !== undefined) {
      patch.vacationSettings = normalizeVacationSettings(updates.vacationSettings);
    }
    if (updates.emailSmtpSettings !== undefined) {
      const next = MarketingService.normalizeSmtp(updates.emailSmtpSettings);
      if (!next.password) {
        const current = await db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
          columns: { emailSmtpSettings: true },
        });
        const prev = MarketingService.normalizeSmtp(current?.emailSmtpSettings || null);
        if (prev.password) next.password = prev.password;
      }
      patch.emailSmtpSettings = next;
    }
    if (updates.emailBrevoSettings !== undefined) {
      const next = MarketingService.normalizeBrevo(updates.emailBrevoSettings);
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { emailBrevoSettings: true },
      });
      const prev = MarketingService.normalizeBrevo(current?.emailBrevoSettings || null);
      // Keep API key when the form omits it (blank password-style field).
      if (!next.apiKey && prev.apiKey) next.apiKey = prev.apiKey;
      // Preserve usage counters from DB (UI does not edit them).
      next.dailySent = prev.dailySent;
      next.dailyPeriod = prev.dailyPeriod;
      next.monthlySent = prev.monthlySent;
      next.monthlyPeriod = prev.monthlyPeriod;
      patch.emailBrevoSettings = next;
    }
    if (updates.emailDeliveryMode !== undefined) {
      const mode = String(updates.emailDeliveryMode || "platform").toLowerCase();
      patch.emailDeliveryMode = mode === "own" ? "own" : "platform";
    }
    if (updates.marketingSettings !== undefined) {
      patch.marketingSettings = MarketingService.normalizeMarketing(updates.marketingSettings);
    }
    if (updates.inventoryWasteFactor !== undefined) {
      const n = Number(updates.inventoryWasteFactor);
      if (!Number.isFinite(n) || n < 0 || n > 0.5) {
        throw new Error("inventoryWasteFactor must be between 0 and 0.50");
      }
      patch.inventoryWasteFactor = n.toFixed(4);
    }
    if (updates.inventoryAutoReorderEmailEnabled !== undefined) {
      patch.inventoryAutoReorderEmailEnabled = !!updates.inventoryAutoReorderEmailEnabled;
    }
    if (updates.inventoryExpiryAlertDays !== undefined) {
      const n = Math.round(Number(updates.inventoryExpiryAlertDays));
      if (!Number.isFinite(n) || n < 1 || n > 365) {
        throw new Error("inventoryExpiryAlertDays must be between 1 and 365");
      }
      patch.inventoryExpiryAlertDays = n;
    }
    if (updates.posPrintSettings !== undefined) {
      patch.posPrintSettings = normalizePosPrintSettings(updates.posPrintSettings);
    }
    if (updates.tableQrSettings !== undefined) {
      patch.tableQrSettings = normalizeTableQrSettings(updates.tableQrSettings);
    }
    if (updates.posCheckoutSettings !== undefined) {
      const currentMerchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { businessCategory: true },
      });
      const locked = normalizeBusinessModule(currentMerchant?.businessCategory);
      let checkout = normalizePosCheckoutSettings(updates.posCheckoutSettings);
      if (locked) {
        checkout = { ...checkout, posMode: posModeForModule(locked) };
      }
      patch.posCheckoutSettings = checkout;
      // Keep legacy webpos_express_enabled in sync with the single express-checkout toggle.
      if (updates.webposExpressEnabled === undefined) {
        patch.webposExpressEnabled = checkout.expressCheckoutEnabled;
      }
    }
    if (updates.deliveryPlatformSettings !== undefined) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { deliveryPlatformSettings: true },
      });
      const merged = mergeDeliveryPlatformSettings(
        current?.deliveryPlatformSettings,
        updates.deliveryPlatformSettings
      );
      const before = normalizeDeliveryPlatformSettings(current?.deliveryPlatformSettings);
      const after = normalizeDeliveryPlatformSettings(merged);
      if (after.justEat?.enabled && !before.justEat?.enabled) {
        const licensed = await readJustEatAddonEnabled(merchantId).catch(() => false);
        if (!licensed) {
          throw new Error("Just Eat integration requires the Just Eat add-on");
        }
      }
      if (after.uberEats?.enabled && !before.uberEats?.enabled) {
        const licensed = await readUberEatsAddonEnabled(merchantId).catch(() => false);
        if (!licensed) {
          throw new Error("Uber Eats integration requires the Uber Eats add-on");
        }
      }
      patch.deliveryPlatformSettings = applyProductionCredentialDefaults(merged);
    }

    // Auto-create slug when enabling shop without one
    if (updates.shopEnabled && !updates.slug) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      if (current && !current.slug) {
        patch.slug = slugFromName(current.name);
      }
    }

    const merchant = await db
      .update(schema.merchants)
      .set(patch)
      .where(eq(schema.merchants.id, merchantId))
      .returning();

    if (merchant.length === 0) {
      throw new Error("Merchant not found");
    }

    return this.getMerchantSettings(merchantId);
  }

  static channelTaxRate(
    merchant: {
      vatRate?: string | number | null;
      taxTakeawayRate?: string | number | null;
      taxDineInRate?: string | number | null;
      taxDeliveryRate?: string | number | null;
    },
    channel: FulfillmentChannel = "takeaway"
  ): number {
    const fallback = merchant.vatRate != null ? parseFloat(String(merchant.vatRate)) : 0;
    const pick = (v?: string | number | null) => {
      if (v === undefined || v === null || v === "") return null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    if (channel === "dine_in") return pick(merchant.taxDineInRate) ?? fallback;
    if (channel === "delivery") return pick(merchant.taxDeliveryRate) ?? fallback;
    return pick(merchant.taxTakeawayRate) ?? fallback;
  }

  static async getVATSettings(merchantId: string) {
    const db = getDb();
    return db.query.vatSettings.findMany({
      where: eq(schema.vatSettings.merchantId, merchantId),
    });
  }

  static async createVATSetting(
    merchantId: string,
    country: string,
    vatRate: number,
    taxId?: string,
    isDefault: boolean = false
  ) {
    const db = getDb();

    if (isDefault) {
      await db
        .update(schema.vatSettings)
        .set({ isDefault: false })
        .where(eq(schema.vatSettings.merchantId, merchantId));
    }

    const vatSetting = await db
      .insert(schema.vatSettings)
      .values({
        merchantId,
        country,
        vatRate: vatRate.toString(),
        taxId,
        isDefault,
      })
      .returning();

    return vatSetting[0];
  }

  static async updateVATSetting(
    merchantId: string,
    vatSettingId: string,
    updates: {
      vatRate?: number;
      taxId?: string;
      isDefault?: boolean;
    }
  ) {
    const db = getDb();

    if (updates.isDefault) {
      await db
        .update(schema.vatSettings)
        .set({ isDefault: false })
        .where(eq(schema.vatSettings.merchantId, merchantId));
    }

    const patch: Record<string, unknown> = {};
    if (updates.vatRate !== undefined) patch.vatRate = updates.vatRate.toString();
    if (updates.taxId !== undefined) patch.taxId = updates.taxId;
    if (updates.isDefault !== undefined) patch.isDefault = updates.isDefault;

    const vatSetting = await db
      .update(schema.vatSettings)
      .set(patch)
      .where(
        and(eq(schema.vatSettings.id, vatSettingId), eq(schema.vatSettings.merchantId, merchantId))
      )
      .returning();

    if (vatSetting.length === 0) {
      throw new Error("VAT setting not found");
    }

    return vatSetting[0];
  }

  static async deleteVATSetting(merchantId: string, vatSettingId: string) {
    const db = getDb();

    const result = await db
      .delete(schema.vatSettings)
      .where(
        and(eq(schema.vatSettings.id, vatSettingId), eq(schema.vatSettings.merchantId, merchantId))
      )
      .returning();

    if (result.length === 0) {
      throw new Error("VAT setting not found");
    }

    return { success: true };
  }

  static async getDefaultVATRate(merchantId: string) {
    const db = getDb();

    const defaultVAT = await db.query.vatSettings.findFirst({
      where: and(eq(schema.vatSettings.merchantId, merchantId), eq(schema.vatSettings.isDefault, true)),
    });

    if (defaultVAT) {
      return parseFloat(defaultVAT.vatRate.toString());
    }

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    return merchant ? parseFloat(merchant.vatRate?.toString() || "0") : 0;
  }

  static async getVATRateByCountry(merchantId: string, country: string) {
    const db = getDb();

    const vatSetting = await db.query.vatSettings.findFirst({
      where: and(eq(schema.vatSettings.merchantId, merchantId), eq(schema.vatSettings.country, country)),
    });

    if (vatSetting) {
      return parseFloat(vatSetting.vatRate.toString());
    }

    return this.getDefaultVATRate(merchantId);
  }

  static async getBusinessInfo(merchantId: string) {
    return this.getMerchantSettings(merchantId);
  }

  static async updateBusinessInfo(
    merchantId: string,
    businessInfo: {
      phone?: string;
      businessLicense?: string;
      address?: string;
      city?: string;
      country?: string;
      vatNumber?: string;
      vatRate?: number;
    }
  ) {
    return this.updateMerchantSettings(merchantId, businessInfo);
  }

  static async resolveByShopHost(hostOrSlug: string) {
    const db = getDb();
    const raw = hostOrSlug.toLowerCase().trim();
    const domain = (process.env.DOMAIN || "").toLowerCase();
    // strip port
    const host = raw.split(":")[0];
    let key = host;
    if (domain && host.endsWith(`.${domain}`)) {
      key = host.slice(0, -(domain.length + 1));
    }

    // Custom apex / branded domain first
    const byCustom = await db.query.merchants.findFirst({
      where: eq(schema.merchants.customDomain, host),
    });
    if (byCustom) return byCustom;

    return db.query.merchants.findFirst({
      where: or(eq(schema.merchants.subdomain, key), eq(schema.merchants.slug, key)),
    });
  }
}
