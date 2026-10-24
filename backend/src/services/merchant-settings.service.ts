import { getDb, schema } from "@/db";
import type {
  VacationSettings,
  MerchantSmtpSettings,
  MerchantBrevoSettings,
  MarketingSettings,
} from "@/db/schema";
import { eq, and, or, ne } from "drizzle-orm";
import { normalizeCustomDomain } from "@/lib/domain";
import { CustomDomainService } from "@/services/custom-domain.service";
import { normalizeDeliveryMode } from "@/lib/delivery-match";
import { filterMerchantShopUrl } from "@/lib/shop-public-urls";
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
import { normalizePanelNavHidden } from "@/lib/panel-nav-hidden";
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
  getAccountingIntegrationPublic,
  mergeAccountingIntegrationSettings,
  normalizeAccountingIntegrationSettings,
  type AccountingIntegrationSettings,
} from "@/lib/accounting-integration-settings";
import { isBexioAddonEnabled, isOdooAddonEnabled } from "@/lib/accounting-integration-addon";
import { isInventoryAddonEnabled } from "@/lib/inventory-addon";
import { getFiskalyPublic, mergeFiskalySettings, type FiskalySettings } from "@/lib/fiskaly-settings";
import { getComoPublic, mergeComoSettings, type ComoSettings } from "@/lib/como-settings";
import {
  getPhoneOrderingPublic,
  mergePhoneOrderingSettings,
  type PhoneOrderingSettings,
} from "@/lib/phone-ordering-settings";
import { isStorekeeperAddonEnabled } from "@/lib/storekeeper-addon";
import { isSignageAddonEnabled } from "@/lib/signage-addon";
import { isKdsAddonEnabled } from "@/lib/kds-addon";
import { isOdsAddonEnabled } from "@/lib/ods-addon";
import { normalizeGiftCardSettings } from "@/lib/gift-card-settings";
import { isKioskAddonEnabled } from "@/lib/kiosk-addon";
import { isCateringAddonEnabled } from "@/lib/catering-addon";
import { isGrowthAnalyticsAddonEnabled } from "@/lib/growth-analytics-addon";
import { isGuestCrmAddonEnabled } from "@/lib/guest-crm-addon";
import { isPhoneOrderingAddonEnabled } from "@/lib/phone-ordering-addon";
import { isPhoneOrderingAddonEnabled } from "@/lib/phone-ordering-addon";
import { isMarketingAutomationAddonEnabled } from "@/lib/marketing-automation-addon";
import { isSmartSegmentsAddonEnabled } from "@/lib/smart-segments-addon";
import { isReservationCampaignsAddonEnabled } from "@/lib/reservation-campaigns-addon";
import { isAiCoachAddonEnabled } from "@/lib/ai-coach-addon";
import { isGoogleReputationAddonEnabled } from "@/lib/google-reputation-addon";
import { isAiWebSeoAddonEnabled } from "@/lib/ai-web-seo-addon";
import { normalizeShopSiteSettings, type ShopSiteSettings } from "@/lib/shop-site-settings";
import {
  normalizeCustomerDisplaySettings,
  type CustomerDisplaySettings,
} from "@/lib/customer-display-settings";
import { loadMerchantRowById } from "@/lib/ensure-merchant-schema";
import { APP_ORIGIN, resolveShopPublicHost } from "@/lib/brand";
import { resolveMerchantProductFlags } from "@/lib/merchant-product-flags";
import { isValidAdyenClientKey } from "@/lib/adyen-checkout-env";
import { incomingTaxRateOrPreserve, shouldWriteCredential } from "@/lib/merchant-settings-preserve";

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

export type FulfillmentChannel = "takeaway" | "dine_in" | "delivery" | "in_store";
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

function normalizeTaxRatePercent(value: number, field: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`${field} must be between 0 and 100`);
  }
  return n.toFixed(2);
}

export type MerchantSettingsScope = {
  /** When set, overlay branch payment + print settings for multi-location merchants. */
  branchLocationId?: string | null;
};

export class MerchantSettingsService {
  static async getMerchantSettings(merchantId: string, scope?: MerchantSettingsScope) {
    const base = await this.buildMerchantSettings(merchantId);
    const branchId = String(scope?.branchLocationId || "").trim();
    if (!branchId) return base;
    const { applyBranchPanelSettingsOverlay } = await import("@/lib/branch-panel-settings");
    return applyBranchPanelSettingsOverlay(merchantId, base as Record<string, unknown>, branchId);
  }

  private static async buildMerchantSettings(merchantId: string) {
    // Schema patches run at API startup. Do not re-run CREATE/ALTER here —
    // concurrent Settings loads were locking Postgres and leaving the panel spinning.
    const merchantRaw = await loadMerchantRowById(merchantId);
    if (!merchantRaw) {
      throw new Error("Merchant not found");
    }
    const merchant = merchantRaw as typeof schema.merchants.$inferSelect;

    const inventoryOn = isInventoryAddonEnabled(merchant.inventoryAddonEnabled);
    const signage = {
      enabled: isSignageAddonEnabled(merchant.signageAddonEnabled),
      screenLimit: Math.max(1, Number(merchant.signageScreenLimit) || 2),
    };
    const kdsOn = isKdsAddonEnabled(merchant.kdsAddonEnabled);
    const odsOn = isOdsAddonEnabled(merchant.odsAddonEnabled);
    const justEatOn = merchant.justEatAddonEnabled === true;
    const uberEatsOn = merchant.uberEatsAddonEnabled === true;
    const bexioOn = isBexioAddonEnabled(
      (merchant as { bexioAddonEnabled?: boolean }).bexioAddonEnabled
    );
    const odooOn = isOdooAddonEnabled(
      (merchant as { odooAddonEnabled?: boolean }).odooAddonEnabled
    );
    const storekeeperOn = isStorekeeperAddonEnabled(merchant.storekeeperAddonEnabled);
    const kioskOn = isKioskAddonEnabled(merchant.kioskAddonEnabled);
    const cateringOn = isCateringAddonEnabled(
      (merchant as { cateringEnabled?: boolean }).cateringEnabled
    );
    const growthAnalyticsOn = isGrowthAnalyticsAddonEnabled(
      (merchant as { growthAnalyticsAddonEnabled?: boolean }).growthAnalyticsAddonEnabled
    );
    const guestCrmOn = isGuestCrmAddonEnabled(
      (merchant as { guestCrmAddonEnabled?: boolean }).guestCrmAddonEnabled
    );
    const phoneOrderingOn = isPhoneOrderingAddonEnabled(
      (merchant as { phoneOrderingAddonEnabled?: boolean }).phoneOrderingAddonEnabled
    );
    const marketingAutomationOn = isMarketingAutomationAddonEnabled(
      (merchant as { marketingAutomationAddonEnabled?: boolean }).marketingAutomationAddonEnabled
    );
    const smartSegmentsOn = isSmartSegmentsAddonEnabled(
      (merchant as { smartSegmentsAddonEnabled?: boolean }).smartSegmentsAddonEnabled
    );
    const reservationCampaignsOn = isReservationCampaignsAddonEnabled(
      (merchant as { reservationCampaignsAddonEnabled?: boolean }).reservationCampaignsAddonEnabled
    );
    const aiCoachOn = isAiCoachAddonEnabled(
      (merchant as { aiCoachAddonEnabled?: boolean }).aiCoachAddonEnabled
    );
    const googleReputationOn = isGoogleReputationAddonEnabled(
      (merchant as { googleReputationAddonEnabled?: boolean }).googleReputationAddonEnabled
    );
    const aiWebSeoOn = isAiWebSeoAddonEnabled(
      (merchant as { aiWebSeoAddonEnabled?: boolean }).aiWebSeoAddonEnabled
    );

    const shopHost = resolveShopPublicHost();
    const apex = shopHost.replace(/^shop\./, "").replace(/^app\./, "");

    const shopRootUrl = filterMerchantShopUrl(
      merchant.slug ? `https://${shopHost}/${merchant.slug}` : null
    );
    const shopPanelPathUrl = filterMerchantShopUrl(
      merchant.slug ? `${APP_ORIGIN}/shop/${encodeURIComponent(merchant.slug)}` : null
    );

    const maxPosPosts = Math.max(0, Number((merchant as { maxPosPosts?: number }).maxPosPosts ?? 0));
    let editionFeatures: Awaited<
      ReturnType<(typeof import("./edition-entitlements.service"))["EditionEntitlementsService"]["getFeatures"]>
    > = null;
    try {
      const { EditionEntitlementsService } = await import("./edition-entitlements.service");
      const feats = await EditionEntitlementsService.getFeatures(merchantId);
      if (feats != null) {
        const withoutPaid = feats.filter((k) => k !== "inventory" && k !== "digital_signage");
        const extra: typeof feats = [];
        if (inventoryOn) extra.push("inventory");
        if (signage.enabled) extra.push("digital_signage");
        if ((merchant as { giftCardAddonEnabled?: boolean }).giftCardAddonEnabled) {
          extra.push("gift_cards");
          extra.push("pos_gift_cards");
        }
        editionFeatures = [...withoutPaid, ...extra];
      }
    } catch {
      editionFeatures = null;
    }

    const orderCenterEnabled = true;
    const productFlags = resolveMerchantProductFlags({
      shopEnabled: merchant.shopEnabled,
      editionFeatures,
      maxPosPosts,
      orderCenterEnabled,
      deliveryEnabled: merchant.deliveryEnabled,
    });

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
      customDomainPending: merchant.customDomainPending || null,
      customDomainDnsStatus: merchant.customDomainDnsStatus || "none",
      customDomainSslStatus: merchant.customDomainSslStatus || "none",
      customDomainVerifiedAt: merchant.customDomainVerifiedAt
        ? new Date(merchant.customDomainVerifiedAt).toISOString()
        : null,
      cmsHomepageEnabled: !!merchant.cmsHomepageEnabled,
      shopEnabled: merchant.shopEnabled,
      acceptingOrders: merchant.acceptingOrders !== false,
      acceptingReservations: merchant.acceptingReservations !== false,
      reservationsEnabled: !!merchant.reservationsEnabled,
      pickupEnabled: merchant.pickupEnabled,
      dineInEnabled: merchant.dineInEnabled,
      deliveryEnabled: merchant.deliveryEnabled,
      deliveryMode: normalizeDeliveryMode(merchant.deliveryMode),
      channelSelectMode: normalizeChannelSelectMode(merchant.channelSelectMode),
      menuShowProductImages: merchant.menuShowProductImages !== false,
      menuShowUpsells: (merchant as { menuShowUpsells?: boolean }).menuShowUpsells !== false,
      menuShowCategoryBanners: merchant.menuShowCategoryBanners !== false,
      cartLayout: normalizeCartLayout(merchant.cartLayout),
      scheduledOrdersEnabled: merchant.scheduledOrdersEnabled !== false,
      floorPlanEnabled: merchant.floorPlanEnabled,
      paxOrderingEnabled: merchant.paxOrderingEnabled,
      coursesEnabled: !!merchant.coursesEnabled,
      shiftsEnabled: !!merchant.shiftsEnabled,
      maxPosPosts,
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
      bexioAddonEnabled: bexioOn,
      odooAddonEnabled: odooOn,
      accountingAddonEnabled: bexioOn || odooOn,
      storekeeperAddonEnabled: storekeeperOn,
      kioskAddonEnabled: kioskOn,
      kioskEnabled: kioskOn,
      cateringEnabled: cateringOn,
      cateringAddonEnabled: cateringOn,
      growthAnalyticsAddonEnabled: growthAnalyticsOn,
      guestCrmAddonEnabled: guestCrmOn,
      phoneOrderingAddonEnabled: phoneOrderingOn,
      marketingAutomationAddonEnabled: marketingAutomationOn,
      smartSegmentsAddonEnabled: smartSegmentsOn,
      reservationCampaignsAddonEnabled: reservationCampaignsOn,
      aiCoachAddonEnabled: aiCoachOn,
      googleReputationAddonEnabled: googleReputationOn,
      aiWebSeoAddonEnabled: aiWebSeoOn,
      inventoryWasteFactor: Number(merchant.inventoryWasteFactor ?? 0.2) || 0.2,
      inventoryAutoReorderEmailEnabled: merchant.inventoryAutoReorderEmailEnabled === true,
      inventoryExpiryAlertDays: Math.max(1, Math.min(365, Number(merchant.inventoryExpiryAlertDays ?? 30) || 30)),
      posColorTheme: (merchant.posColorTheme as string) || "teal",
      storeHours: merchant.storeHours || {},
      shopLogoUrl: merchant.shopLogoUrl,
      shopBannerUrl: merchant.shopBannerUrl,
      shopSiteSettings: normalizeShopSiteSettings(
        (merchant as { shopSiteSettings?: unknown }).shopSiteSettings
      ),
      latitude: merchant.latitude,
      longitude: merchant.longitude,
      pickupEtaMinutes: merchant.pickupEtaMinutes,
      deliveryEtaMinutes: merchant.deliveryEtaMinutes,
      minPreOrderDelayMinutes: merchant.minPreOrderDelayMinutes ?? 30,
      deliveryMenuMarkup: merchant.deliveryMenuMarkup ?? "0",
      categoryPricingEnabled: merchant.categoryPricingEnabled === true,
      catalogScopeMode:
        String((merchant as { catalogScopeMode?: string }).catalogScopeMode || "per_location")
          .toLowerCase() === "shared"
          ? "shared"
          : "per_location",
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
      shopPathUrl: shopRootUrl,
      shopMenuUrl: shopRootUrl ? filterMerchantShopUrl(`${shopRootUrl}/menu`) : null,
      shopPanelPathUrl,
      shopSubdomainUrl: filterMerchantShopUrl(
        merchant.subdomain ? `https://${merchant.subdomain}.${apex}` : null
      ),
      shopCustomDomainUrl: filterMerchantShopUrl(
        merchant.customDomain ? `https://${merchant.customDomain}` : null
      ),
      adyenMerchantAccount: merchant.adyenMerchantAccount,
      adyenApiKeyMasked: maskSecret(merchant.adyenApiKey),
      adyenApiKeySet: !!merchant.adyenApiKey,
      adyenClientId: merchant.adyenClientId,
      adyenStoreReference: (merchant as { adyenStoreReference?: string | null }).adyenStoreReference || "",
      adyenHmacKeyMasked: maskSecret(merchant.adyenHmacKey),
      adyenHmacKeySet: !!merchant.adyenHmacKey,
      tapToPayEnabled: merchant.tapToPayEnabled === true,
      adyenLiveEnvironment: !!merchant.adyenLiveEnvironment,
      adyenLiveUrlPrefix: (merchant as { adyenLiveUrlPrefix?: string | null }).adyenLiveUrlPrefix || "",
      adyenLiveRegion: merchant.adyenLiveRegion || "EU",
      adyenUseLegacyEndpoint: !!merchant.adyenUseLegacyEndpoint,
      giftCardAddonEnabled: !!(merchant as { giftCardAddonEnabled?: boolean }).giftCardAddonEnabled,
      fiskalySettings: getFiskalyPublic(
        (merchant as { fiskalySettings?: FiskalySettings | null }).fiskalySettings
      ),
      comoSettings: getComoPublic(
        (merchant as { comoSettings?: ComoSettings | null }).comoSettings
      ),
      phoneOrderingSettings: phoneOrderingOn
        ? getPhoneOrderingPublic(
            (merchant as { phoneOrderingSettings?: PhoneOrderingSettings | null }).phoneOrderingSettings
          )
        : {
            enabled: false,
            phoneNumber: null,
            hours: null,
            webhookSecretMasked: null,
            webhookSecretSet: false,
            configured: false,
          },
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
      posCheckoutSettings: (() => {
        let checkout = normalizePosCheckoutSettings(merchant.posCheckoutSettings);
        const locked = normalizeBusinessModule(
          (merchant as { businessCategory?: string | null }).businessCategory
        );
        if (locked) {
          checkout = { ...checkout, posMode: posModeForModule(locked) };
        }
        return checkout;
      })(),
      customerDisplaySettings: await (async () => {
        try {
          const { CdsService } = await import("@/services/cds.service");
          return await CdsService.getSettings(merchantId);
        } catch {
          return normalizeCustomerDisplaySettings(
            (merchant as { customerDisplaySettings?: unknown }).customerDisplaySettings
          );
        }
      })(),
      deliveryPlatformSettings: getDeliveryPlatformPublic(merchant.deliveryPlatformSettings),
      accountingIntegrationSettings: getAccountingIntegrationPublic(
        (merchant as { accountingIntegrationSettings?: unknown }).accountingIntegrationSettings
      ),
      status: merchant.status,
      subscriptionPlan: merchant.subscriptionPlan,
      editionId: (merchant as { editionId?: string | null }).editionId || null,
      businessCategory: normalizeBusinessModule(
        (merchant as { businessCategory?: string | null }).businessCategory
      ),
      resellerId: (merchant as { resellerId?: string | null }).resellerId || null,
      panelNavHidden: normalizePanelNavHidden(
        (merchant as { panelNavHidden?: unknown }).panelNavHidden
      ),
      shopCommissionPercent: Number(
        (merchant as { shopCommissionPercent?: string | number | null }).shopCommissionPercent ?? 0
      ) || 0,
      /**
       * null = legacy full access for edition routes.
       * Inventory is a paid merchant addon — never grant it via edition JSON.
       * Inject only when the merchant column is true (for any leftover edition checks).
       */
      editionFeatures,
      orderCenterEnabled,
      ...productFlags,
      latestSoftwareRelease: await (async () => {
        try {
          const { SoftwareReleaseService } = await import("@/services/software-release.service");
          return await SoftwareReleaseService.latestPublished();
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
      deliveryMode?: string;
      channelSelectMode?: ChannelSelectMode | string;
      menuShowProductImages?: boolean;
      menuShowUpsells?: boolean;
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
      shopSiteSettings?: ShopSiteSettings | Partial<ShopSiteSettings> | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
      pickupEtaMinutes?: number;
      deliveryEtaMinutes?: number;
      minPreOrderDelayMinutes?: number;
      deliveryMenuMarkup?: number;
      categoryPricingEnabled?: boolean;
      catalogScopeMode?: "per_location" | "shared" | string;
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
      adyenStoreReference?: string;
      adyenHmacKey?: string;
      tapToPayEnabled?: boolean;
      adyenLiveEnvironment?: boolean;
      adyenLiveUrlPrefix?: string;
      adyenLiveRegion?: string;
      adyenUseLegacyEndpoint?: boolean;
      fiskalySettings?: FiskalySettings | Record<string, unknown> | null;
      comoSettings?: ComoSettings | Record<string, unknown> | null;
      phoneOrderingSettings?: PhoneOrderingSettings | Record<string, unknown> | null;
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
      customerDisplaySettings?: CustomerDisplaySettings | Partial<CustomerDisplaySettings> | null;
      deliveryPlatformSettings?: DeliveryPlatformSettings | Record<string, unknown> | null;
      accountingIntegrationSettings?:
        | AccountingIntegrationSettings
        | Record<string, unknown>
        | null;
      inventoryWasteFactor?: number;
      inventoryAutoReorderEmailEnabled?: boolean;
      inventoryExpiryAlertDays?: number;
    },
    scope?: MerchantSettingsScope
  ) {
    const db = getDb();

    let scopedUpdates = updates as Record<string, unknown>;
    const branchId = String(scope?.branchLocationId || "").trim();
    if (branchId) {
      const { splitAndPersistBranchPanelSettings } = await import("@/lib/branch-panel-settings");
      scopedUpdates = await splitAndPersistBranchPanelSettings(merchantId, branchId, scopedUpdates);
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const effective = scopedUpdates as typeof updates;

    if (effective.name !== undefined) {
      const name = String(effective.name || "").trim().slice(0, 255);
      if (!name) throw new Error("Business name is required");
      patch.name = name;
    }
    if (effective.email !== undefined) {
      const email = String(effective.email || "").trim().toLowerCase().slice(0, 255);
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
    if (effective.phone !== undefined) patch.phone = effective.phone;
    if (effective.address !== undefined) patch.address = effective.address;
    if (effective.city !== undefined) patch.city = effective.city;
    if (effective.country !== undefined) patch.country = effective.country;
    if (effective.businessLicense !== undefined) patch.businessLicense = effective.businessLicense;
    if (effective.vatNumber !== undefined) patch.vatNumber = effective.vatNumber;
    if (effective.vatRate !== undefined) {
      const vatRate = incomingTaxRateOrPreserve(effective.vatRate, "vatRate");
      if (vatRate !== undefined) patch.vatRate = vatRate;
    }
    if (effective.taxTakeawayRate !== undefined) {
      const rate = incomingTaxRateOrPreserve(effective.taxTakeawayRate, "taxTakeawayRate");
      if (rate !== undefined) patch.taxTakeawayRate = rate;
    }
    if (effective.taxDineInRate !== undefined) {
      const rate = incomingTaxRateOrPreserve(effective.taxDineInRate, "taxDineInRate");
      if (rate !== undefined) patch.taxDineInRate = rate;
    }
    if (effective.taxDeliveryRate !== undefined) {
      const rate = incomingTaxRateOrPreserve(effective.taxDeliveryRate, "taxDeliveryRate");
      if (rate !== undefined) patch.taxDeliveryRate = rate;
    }
    if (effective.taxIncludedInPrice !== undefined) patch.taxIncludedInPrice = !!effective.taxIncludedInPrice;
    if (effective.vatAfterDiscount !== undefined) patch.vatAfterDiscount = !!effective.vatAfterDiscount;
    if (effective.shopEnabled !== undefined) patch.shopEnabled = !!effective.shopEnabled;
    if (effective.acceptingOrders !== undefined) patch.acceptingOrders = !!effective.acceptingOrders;
    if (effective.acceptingReservations !== undefined) {
      patch.acceptingReservations = !!effective.acceptingReservations;
    }
    if (effective.pickupEnabled !== undefined) patch.pickupEnabled = !!effective.pickupEnabled;
    if (effective.dineInEnabled !== undefined) patch.dineInEnabled = !!effective.dineInEnabled;
    if (effective.deliveryEnabled !== undefined) patch.deliveryEnabled = !!effective.deliveryEnabled;
    if (effective.deliveryMode !== undefined) {
      patch.deliveryMode = normalizeDeliveryMode(effective.deliveryMode);
    }
    if (effective.channelSelectMode !== undefined) {
      patch.channelSelectMode = normalizeChannelSelectMode(effective.channelSelectMode);
    }
    if (effective.menuShowProductImages !== undefined) {
      patch.menuShowProductImages = !!effective.menuShowProductImages;
    }
    if (effective.menuShowUpsells !== undefined) {
      patch.menuShowUpsells = !!effective.menuShowUpsells;
    }
    if (effective.menuShowCategoryBanners !== undefined) {
      patch.menuShowCategoryBanners = !!effective.menuShowCategoryBanners;
    }
    if (effective.cartLayout !== undefined) {
      patch.cartLayout = normalizeCartLayout(effective.cartLayout);
    }
    if (effective.scheduledOrdersEnabled !== undefined) {
      patch.scheduledOrdersEnabled = !!effective.scheduledOrdersEnabled;
    }
    if (effective.floorPlanEnabled !== undefined) patch.floorPlanEnabled = !!effective.floorPlanEnabled;
    if (effective.paxOrderingEnabled !== undefined) patch.paxOrderingEnabled = !!effective.paxOrderingEnabled;
    if (effective.coursesEnabled !== undefined) patch.coursesEnabled = !!effective.coursesEnabled;
    if (effective.shiftsEnabled !== undefined) patch.shiftsEnabled = !!effective.shiftsEnabled;
    if (effective.posColorTheme !== undefined) {
      const theme = String(effective.posColorTheme || "teal").toLowerCase();
      patch.posColorTheme = ["teal", "green", "blue", "violet", "mono"].includes(theme)
        ? theme
        : "teal";
    }
    if (effective.storeHours !== undefined) patch.storeHours = effective.storeHours;
    if (effective.shopLogoUrl !== undefined) patch.shopLogoUrl = effective.shopLogoUrl;
    if (effective.shopBannerUrl !== undefined) patch.shopBannerUrl = effective.shopBannerUrl;
    if (effective.shopSiteSettings !== undefined) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { shopSiteSettings: true },
      });
      const existing = normalizeShopSiteSettings(current?.shopSiteSettings);
      const incoming = effective.shopSiteSettings && typeof effective.shopSiteSettings === "object"
        ? effective.shopSiteSettings
        : {};
      const incomingObj = incoming as Partial<ShopSiteSettings>;
      patch.shopSiteSettings = normalizeShopSiteSettings({
        ...existing,
        ...incoming,
        metaTitle:
          incomingObj.metaTitle !== undefined ? incomingObj.metaTitle : existing.metaTitle,
        metaDescription:
          incomingObj.metaDescription !== undefined
            ? incomingObj.metaDescription
            : existing.metaDescription,
      });
    }
    if (effective.latitude !== undefined) {
      patch.latitude = effective.latitude === null || effective.latitude === "" ? null : String(effective.latitude);
    }
    if (effective.longitude !== undefined) {
      patch.longitude = effective.longitude === null || effective.longitude === "" ? null : String(effective.longitude);
    }
    if (effective.pickupEtaMinutes !== undefined) patch.pickupEtaMinutes = effective.pickupEtaMinutes;
    if (effective.deliveryEtaMinutes !== undefined) patch.deliveryEtaMinutes = effective.deliveryEtaMinutes;
    if (effective.minPreOrderDelayMinutes !== undefined) {
      patch.minPreOrderDelayMinutes = Math.max(0, Math.min(240, Number(effective.minPreOrderDelayMinutes) || 0));
    }
    if (effective.deliveryMenuMarkup !== undefined) {
      const n = Number(effective.deliveryMenuMarkup);
      if (!Number.isFinite(n) || n < 0) throw new Error("deliveryMenuMarkup must be >= 0");
      patch.deliveryMenuMarkup = n.toFixed(2);
    }
    if (effective.categoryPricingEnabled !== undefined) {
      patch.categoryPricingEnabled = !!effective.categoryPricingEnabled;
    }
    if (effective.catalogScopeMode !== undefined) {
      const { normalizeCatalogScopeMode } = await import("@/lib/catalog-scope");
      patch.catalogScopeMode = normalizeCatalogScopeMode(effective.catalogScopeMode);
    }
    if (effective.deliveryDriverPayMode !== undefined) {
      const mode = String(effective.deliveryDriverPayMode);
      if (!["hourly", "per_order", "both"].includes(mode)) {
        throw new Error("deliveryDriverPayMode must be hourly, per_order, or both");
      }
      patch.deliveryDriverPayMode = mode;
    }
    if (effective.deliveryDriverHourlyRate !== undefined) {
      const n = Number(effective.deliveryDriverHourlyRate);
      if (!Number.isFinite(n) || n < 0) throw new Error("deliveryDriverHourlyRate must be >= 0");
      patch.deliveryDriverHourlyRate = n.toFixed(2);
    }
    if (effective.deliveryPerOrderFee !== undefined) {
      const n = Number(effective.deliveryPerOrderFee);
      if (!Number.isFinite(n) || n < 0) throw new Error("deliveryPerOrderFee must be >= 0");
      patch.deliveryPerOrderFee = n.toFixed(2);
    }
    if (shouldWriteCredential(effective.adyenMerchantAccount)) {
      patch.adyenMerchantAccount = String(effective.adyenMerchantAccount).trim();
    }
    if (effective.adyenStoreReference !== undefined) {
      const storeRef = String(effective.adyenStoreReference || "")
        .trim()
        .slice(0, 255);
      if (storeRef) patch.adyenStoreReference = storeRef;
    }
    if (shouldWriteCredential(effective.adyenClientId)) {
      const clientKey = String(effective.adyenClientId).trim();
      if (!isValidAdyenClientKey(clientKey)) {
        throw new Error(
          "Client key must start with test_ or live_. Use the Client Key from Adyen Customer Area → Developers → Client settings — not the API key (AQE…)."
        );
      }
      patch.adyenClientId = clientKey;
    }
    if (effective.tapToPayEnabled !== undefined) patch.tapToPayEnabled = !!effective.tapToPayEnabled;
    if (effective.adyenLiveEnvironment !== undefined) patch.adyenLiveEnvironment = !!effective.adyenLiveEnvironment;
    if (effective.adyenLiveUrlPrefix !== undefined) {
      const prefix = String(effective.adyenLiveUrlPrefix || "")
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/-checkout-live.*$/i, "")
        .replace(/\/.*$/, "")
        .replace(/:+$/, "")
        .slice(0, 255);
      if (prefix) patch.adyenLiveUrlPrefix = prefix;
    }
    if (effective.adyenLiveRegion !== undefined) {
      const region = String(effective.adyenLiveRegion || "EU").toUpperCase();
      patch.adyenLiveRegion = ["EU", "US", "AU", "APSE"].includes(region) ? region : "EU";
    }
    if (effective.adyenUseLegacyEndpoint !== undefined) {
      patch.adyenUseLegacyEndpoint = !!effective.adyenUseLegacyEndpoint;
    }
    if (effective.fiskalySettings !== undefined) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      patch.fiskalySettings = mergeFiskalySettings(
        (current as { fiskalySettings?: FiskalySettings | null } | undefined)?.fiskalySettings,
        effective.fiskalySettings
      );
    }
    if (effective.comoSettings !== undefined) {
      const { ensureComoSchema } = await import("@/lib/ensure-merchant-schema");
      await ensureComoSchema();
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      patch.comoSettings = mergeComoSettings(
        (current as { comoSettings?: ComoSettings | null } | undefined)?.comoSettings,
        effective.comoSettings
      );
    }
    if (effective.phoneOrderingSettings !== undefined) {
      const { ensurePhoneOrderingSchema } = await import("@/lib/ensure-merchant-schema");
      await ensurePhoneOrderingSchema();
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      if (
        !isPhoneOrderingAddonEnabled(
          (current as { phoneOrderingAddonEnabled?: boolean } | undefined)?.phoneOrderingAddonEnabled
        )
      ) {
        throw new Error("Phone ordering add-on is not enabled for this merchant");
      }
      const nextPhone = mergePhoneOrderingSettings(
        (current as { phoneOrderingSettings?: PhoneOrderingSettings | null } | undefined)
          ?.phoneOrderingSettings,
        effective.phoneOrderingSettings
      );
      patch.phoneOrderingSettings = nextPhone;
      if (nextPhone.phoneNumber && !current?.phone) {
        patch.phone = nextPhone.phoneNumber;
      }
    }
    if (effective.webposExpressEnabled !== undefined) patch.webposExpressEnabled = !!effective.webposExpressEnabled;
    if (effective.webposCashEnabled !== undefined) patch.webposCashEnabled = !!effective.webposCashEnabled;
    if (effective.webposCardEnabled !== undefined) patch.webposCardEnabled = !!effective.webposCardEnabled;
    if (effective.webposTerminalEnabled !== undefined) patch.webposTerminalEnabled = !!effective.webposTerminalEnabled;
    if (effective.webposGiftCardEnabled !== undefined) {
      patch.webposGiftCardEnabled = !!effective.webposGiftCardEnabled;
      if (effective.webposGiftCardEnabled) {
        const currentMerchant = await db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
          columns: { giftCardSettings: true },
        });
        const gc = normalizeGiftCardSettings(currentMerchant?.giftCardSettings);
        if (!gc.enabled) {
          patch.giftCardSettings = { ...gc, enabled: true };
        }
      }
    }
    if (effective.webposInvoiceEnabled !== undefined) patch.webposInvoiceEnabled = !!effective.webposInvoiceEnabled;
    if (effective.bankIban !== undefined) {
      patch.bankIban = effective.bankIban ? String(effective.bankIban).replace(/\s+/g, "").toUpperCase().slice(0, 34) : null;
    }
    if (effective.bankQrIban !== undefined) {
      patch.bankQrIban = effective.bankQrIban
        ? String(effective.bankQrIban).replace(/\s+/g, "").toUpperCase().slice(0, 34)
        : null;
    }
    if (effective.bankName !== undefined) {
      patch.bankName = effective.bankName ? String(effective.bankName).trim().slice(0, 255) : null;
    }
    if (effective.bankAccountHolder !== undefined) {
      patch.bankAccountHolder = effective.bankAccountHolder
        ? String(effective.bankAccountHolder).trim().slice(0, 255)
        : null;
    }
    if (effective.onlineCardFeeFixed !== undefined) {
      const n = Number(effective.onlineCardFeeFixed);
      if (!Number.isFinite(n) || n < 0) throw new Error("onlineCardFeeFixed must be >= 0");
      patch.onlineCardFeeFixed = n.toFixed(2);
    }
    if (effective.onlineCardFeePercent !== undefined) {
      const n = Number(effective.onlineCardFeePercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error("onlineCardFeePercent must be between 0 and 100");
      }
      patch.onlineCardFeePercent = n.toFixed(3);
    }
    if (effective.panelLanguage !== undefined) {
      const lang = effective.panelLanguage.toLowerCase();
      if (!["en", "fr", "de"].includes(lang)) {
        throw new Error("panelLanguage must be en, fr, or de");
      }
      patch.panelLanguage = lang;
    }
    if (effective.shopLanguage !== undefined) {
      const lang = effective.shopLanguage.toLowerCase();
      if (!["en", "fr", "de"].includes(lang)) {
        throw new Error("shopLanguage must be en, fr, or de");
      }
      patch.shopLanguage = lang;
    }
    if (shouldWriteCredential(effective.adyenApiKey)) {
      patch.adyenApiKey = String(effective.adyenApiKey).trim();
    }
    if (shouldWriteCredential(effective.adyenHmacKey)) {
      patch.adyenHmacKey = String(effective.adyenHmacKey).trim();
    }

    if (effective.slug !== undefined) {
      patch.slug = normalizeSubdomain(effective.slug) || null;
    }
    if (effective.subdomain !== undefined) {
      patch.subdomain = normalizeSubdomain(effective.subdomain);
    }
    if (effective.customDomain !== undefined) {
      if (CustomDomainService.isWizardEnabled()) {
        // Custom domain is managed by /merchant/custom-domain when the wizard is enabled.
      } else {
        const domainNorm = normalizeCustomDomain(effective.customDomain);
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
    }
    if (effective.cmsHomepageEnabled !== undefined) {
      patch.cmsHomepageEnabled = !!effective.cmsHomepageEnabled;
    }
    if (effective.vacationSettings !== undefined) {
      patch.vacationSettings = normalizeVacationSettings(effective.vacationSettings);
    }
    if (effective.emailSmtpSettings !== undefined) {
      const next = MarketingService.normalizeSmtp(effective.emailSmtpSettings);
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
    if (effective.emailBrevoSettings !== undefined) {
      const next = MarketingService.normalizeBrevo(effective.emailBrevoSettings);
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
    if (effective.emailDeliveryMode !== undefined) {
      const mode = String(effective.emailDeliveryMode || "platform").toLowerCase();
      patch.emailDeliveryMode = mode === "own" ? "own" : "platform";
    }
    if (effective.marketingSettings !== undefined) {
      patch.marketingSettings = MarketingService.normalizeMarketing(effective.marketingSettings);
    }
    if (effective.inventoryWasteFactor !== undefined) {
      const n = Number(effective.inventoryWasteFactor);
      if (!Number.isFinite(n) || n < 0 || n > 0.5) {
        throw new Error("inventoryWasteFactor must be between 0 and 0.50");
      }
      patch.inventoryWasteFactor = n.toFixed(4);
    }
    if (effective.inventoryAutoReorderEmailEnabled !== undefined) {
      patch.inventoryAutoReorderEmailEnabled = !!effective.inventoryAutoReorderEmailEnabled;
    }
    if (effective.inventoryExpiryAlertDays !== undefined) {
      const n = Math.round(Number(effective.inventoryExpiryAlertDays));
      if (!Number.isFinite(n) || n < 1 || n > 365) {
        throw new Error("inventoryExpiryAlertDays must be between 1 and 365");
      }
      patch.inventoryExpiryAlertDays = n;
    }
    if (effective.posPrintSettings !== undefined) {
      patch.posPrintSettings = normalizePosPrintSettings(effective.posPrintSettings);
    }
    if (effective.tableQrSettings !== undefined) {
      patch.tableQrSettings = normalizeTableQrSettings(effective.tableQrSettings);
    }
    if (effective.posCheckoutSettings !== undefined) {
      const currentMerchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { businessCategory: true },
      });
      const locked = normalizeBusinessModule(currentMerchant?.businessCategory);
      let checkout = normalizePosCheckoutSettings(effective.posCheckoutSettings);
      if (locked) {
        checkout = { ...checkout, posMode: posModeForModule(locked) };
      }
      patch.posCheckoutSettings = checkout;
      // Keep legacy webpos_express_enabled in sync with the single express-checkout toggle.
      if (effective.webposExpressEnabled === undefined) {
        patch.webposExpressEnabled = checkout.expressCheckoutEnabled;
      }
    }
    if (effective.customerDisplaySettings !== undefined) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { customerDisplaySettings: true },
      });
      const existing = normalizeCustomerDisplaySettings(current?.customerDisplaySettings);
      const incoming = normalizeCustomerDisplaySettings({
        ...existing,
        ...(effective.customerDisplaySettings as object),
      });
      incoming.accessToken = existing.accessToken || incoming.accessToken;
      incoming.shortCode = existing.shortCode || incoming.shortCode;
      patch.customerDisplaySettings = incoming;
    }
    if (effective.deliveryPlatformSettings !== undefined) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { deliveryPlatformSettings: true },
      });
      const merged = mergeDeliveryPlatformSettings(
        current?.deliveryPlatformSettings,
        effective.deliveryPlatformSettings
      );
      const before = normalizeDeliveryPlatformSettings(current?.deliveryPlatformSettings);
      const after = normalizeDeliveryPlatformSettings(merged);
      if (after.justEat?.enabled && !before.justEat?.enabled) {
        const licensed = current?.justEatAddonEnabled === true;
        if (!licensed) {
          throw new Error("Just Eat integration requires the Just Eat add-on");
        }
      }
      if (after.uberEats?.enabled && !before.uberEats?.enabled) {
        const licensed = current?.uberEatsAddonEnabled === true;
        if (!licensed) {
          throw new Error("Uber Eats integration requires the Uber Eats add-on");
        }
      }
      patch.deliveryPlatformSettings = applyProductionCredentialDefaults(merged);
    }

    if (effective.accountingIntegrationSettings !== undefined) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: {
          accountingIntegrationSettings: true,
          bexioAddonEnabled: true,
          odooAddonEnabled: true,
        },
      });
      const merged = mergeAccountingIntegrationSettings(
        current?.accountingIntegrationSettings,
        effective.accountingIntegrationSettings
      );
      const before = normalizeAccountingIntegrationSettings(
        current?.accountingIntegrationSettings
      );
      const after = normalizeAccountingIntegrationSettings(merged);
      if (after.bexio?.enabled && !before.bexio?.enabled) {
        if (!isBexioAddonEnabled(current?.bexioAddonEnabled)) {
          throw new Error("Bexio integration requires the Bexio add-on");
        }
      }
      if (after.odoo?.enabled && !before.odoo?.enabled) {
        if (!isOdooAddonEnabled(current?.odooAddonEnabled)) {
          throw new Error("Odoo integration requires the Odoo add-on");
        }
      }
      patch.accountingIntegrationSettings = merged;
    }

    // Auto-create slug when enabling shop without one
    if (effective.shopEnabled && !effective.slug) {
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

    const adyenKeys = [
      "adyenMerchantAccount",
      "adyenStoreReference",
      "adyenClientId",
      "adyenApiKey",
      "adyenHmacKey",
      "adyenLiveEnvironment",
      "adyenLiveUrlPrefix",
      "adyenLiveRegion",
      "adyenUseLegacyEndpoint",
    ] as const;
    if (!branchId && adyenKeys.some((key) => key in patch)) {
      const { PaymentProfilesService } = await import("@/services/payment-profiles.service");
      await PaymentProfilesService.syncAdyenFromMerchant(merchantId);
    }

    return this.getMerchantSettings(merchantId, scope);
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
    if (channel === "in_store") return fallback > 0 ? fallback : 8.1;
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

  static async updatePanelNavHidden(merchantId: string, hidden: unknown) {
    const db = getDb();
    const panelNavHidden = normalizePanelNavHidden(hidden);
    await db
      .update(schema.merchants)
      .set({ panelNavHidden, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    const row = await loadMerchantRowById(merchantId);
    if (!row) throw new Error("Merchant not found");
    return this.getMerchantSettings(merchantId);
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

    const { findMerchantByCustomDomainHost } = await import("@/lib/custom-domain-lookup");
    const byCustom = await findMerchantByCustomDomainHost(host);
    if (byCustom) return byCustom;

    return db.query.merchants.findFirst({
      where: or(eq(schema.merchants.subdomain, key), eq(schema.merchants.slug, key)),
    });
  }
}
