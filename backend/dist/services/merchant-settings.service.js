"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantSettingsService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const domain_1 = require("@/lib/domain");
const vacation_1 = require("@/lib/vacation");
const marketing_service_1 = require("@/services/marketing.service");
const pos_print_settings_1 = require("@/lib/pos-print-settings");
const pos_checkout_settings_1 = require("@/lib/pos-checkout-settings");
const table_qr_settings_1 = require("@/lib/table-qr-settings");
const delivery_platform_settings_1 = require("@/lib/delivery-platform-settings");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const inventory_addon_1 = require("@/lib/inventory-addon");
const signage_addon_1 = require("@/lib/signage-addon");
function maskSecret(value) {
    if (!value)
        return null;
    if (value.length <= 8)
        return "••••••••";
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
function normalizeSubdomain(raw) {
    if (!raw)
        return null;
    const cleaned = raw
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    if (!cleaned || cleaned.length < 2)
        return null;
    return cleaned.slice(0, 63);
}
function slugFromName(name) {
    return (name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || `shop-${Date.now().toString(36)}`);
}
function normalizeChannelSelectMode(raw) {
    const v = String(raw || "")
        .trim()
        .toLowerCase();
    if (v === "popup_start" || v === "menu" || v === "checkout")
        return v;
    return "checkout";
}
function normalizeCartLayout(raw) {
    const v = String(raw || "")
        .trim()
        .toLowerCase();
    if (v === "sticky_right")
        return "sticky_right";
    return "hidden_slide";
}
class MerchantSettingsService {
    static async getMerchantSettings(merchantId) {
        try {
            return await this.buildMerchantSettings(merchantId);
        }
        catch (error) {
            const patched = await (0, ensure_merchant_schema_1.patchMerchantSchemaFromError)(error);
            if (patched) {
                return await this.buildMerchantSettings(merchantId);
            }
            throw error;
        }
    }
    static async buildMerchantSettings(merchantId) {
        await (0, ensure_merchant_schema_1.ensureInventoryAddonColumn)();
        await (0, ensure_merchant_schema_1.ensureSignageAddonColumn)();
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant) {
            throw new Error("Merchant not found");
        }
        const inventoryOn = await (0, inventory_addon_1.readInventoryAddonEnabled)(merchantId).catch(() => (0, inventory_addon_1.isInventoryAddonEnabled)(merchant.inventoryAddonEnabled));
        const signage = await (0, signage_addon_1.readSignageAddon)(merchantId).catch(() => ({
            enabled: (0, signage_addon_1.isSignageAddonEnabled)(merchant.signageAddonEnabled),
            screenLimit: Math.max(1, Number(merchant.signageScreenLimit) || 2),
        }));
        const domain = process.env.DOMAIN || process.env.PUBLIC_APP_URL?.replace(/^https?:\/\//, "") || "localhost";
        const shopHost = process.env.SHOP_PUBLIC_HOST ||
            (domain.includes("chaslay.com") ? "shop.chaslay.com" : domain.startsWith("shop.") ? domain : `shop.${domain}`);
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
            maxPosPosts: Math.max(0, Number(merchant.maxPosPosts ?? 0)),
            maxWaiterPosts: Math.max(0, Number(merchant.maxWaiterPosts ?? 0)),
            inventoryAddonEnabled: inventoryOn,
            inventoryEnabled: inventoryOn,
            signageAddonEnabled: signage.enabled,
            signageEnabled: signage.enabled,
            signageScreenLimit: signage.screenLimit,
            inventoryWasteFactor: Number(merchant.inventoryWasteFactor ?? 0.2) || 0.2,
            inventoryAutoReorderEmailEnabled: merchant.inventoryAutoReorderEmailEnabled === true,
            posColorTheme: merchant.posColorTheme || "teal",
            storeHours: merchant.storeHours || {},
            shopLogoUrl: merchant.shopLogoUrl,
            shopBannerUrl: merchant.shopBannerUrl,
            latitude: merchant.latitude,
            longitude: merchant.longitude,
            pickupEtaMinutes: merchant.pickupEtaMinutes,
            deliveryEtaMinutes: merchant.deliveryEtaMinutes,
            minPreOrderDelayMinutes: merchant.minPreOrderDelayMinutes ?? 30,
            deliveryMenuMarkup: merchant.deliveryMenuMarkup ?? "0",
            vacationSettings: (0, vacation_1.normalizeVacationSettings)(merchant.vacationSettings),
            emailSmtpSettings: marketing_service_1.MarketingService.getSmtpPublic(merchant.emailSmtpSettings),
            emailBrevoSettings: marketing_service_1.MarketingService.getBrevoPublic(merchant.emailBrevoSettings),
            marketingSettings: marketing_service_1.MarketingService.normalizeMarketing(merchant.marketingSettings),
            shopPathUrl: merchant.slug ? `https://${shopHost}/${merchant.slug}` : null,
            shopSubdomainUrl: merchant.subdomain ? `https://${merchant.subdomain}.${apex}` : null,
            shopCustomDomainUrl: merchant.customDomain ? `https://${merchant.customDomain}` : null,
            adyenMerchantAccount: merchant.adyenMerchantAccount,
            adyenApiKeyMasked: maskSecret(merchant.adyenApiKey),
            adyenApiKeySet: !!merchant.adyenApiKey,
            adyenClientId: merchant.adyenClientId,
            adyenLiveEnvironment: !!merchant.adyenLiveEnvironment,
            adyenLiveRegion: merchant.adyenLiveRegion || "EU",
            adyenUseLegacyEndpoint: !!merchant.adyenUseLegacyEndpoint,
            webposExpressEnabled: merchant.webposExpressEnabled !== false,
            webposCashEnabled: merchant.webposCashEnabled !== false,
            webposCardEnabled: merchant.webposCardEnabled !== false,
            webposTerminalEnabled: merchant.webposTerminalEnabled !== false,
            webposGiftCardEnabled: merchant.webposGiftCardEnabled === true,
            webposInvoiceEnabled: merchant.webposInvoiceEnabled !== false,
            bankIban: merchant.bankIban || null,
            bankQrIban: merchant.bankQrIban || null,
            bankName: merchant.bankName || null,
            bankAccountHolder: merchant.bankAccountHolder || null,
            onlineCardFeeFixed: merchant.onlineCardFeeFixed ?? "0",
            onlineCardFeePercent: merchant.onlineCardFeePercent ?? "0",
            panelLanguage: merchant.panelLanguage || "en",
            shopLanguage: merchant.shopLanguage || merchant.panelLanguage || "en",
            posPrintSettings: (0, pos_print_settings_1.normalizePosPrintSettings)(merchant.posPrintSettings),
            tableQrSettings: (0, table_qr_settings_1.normalizeTableQrSettings)(merchant.tableQrSettings),
            posCheckoutSettings: (0, pos_checkout_settings_1.normalizePosCheckoutSettings)(merchant.posCheckoutSettings),
            deliveryPlatformSettings: (0, delivery_platform_settings_1.getDeliveryPlatformPublic)(merchant.deliveryPlatformSettings),
            status: merchant.status,
            subscriptionPlan: merchant.subscriptionPlan,
            editionId: merchant.editionId || null,
            resellerId: merchant.resellerId || null,
            /**
             * null = legacy full access for edition routes.
             * Inventory is a paid merchant addon — never grant it via edition JSON.
             * Inject only when the merchant column is true (for any leftover edition checks).
             */
            editionFeatures: await (async () => {
                try {
                    const { EditionEntitlementsService } = await Promise.resolve().then(() => __importStar(require("./edition-entitlements.service")));
                    const feats = await EditionEntitlementsService.getFeatures(merchantId);
                    if (feats == null)
                        return null;
                    const withoutPaid = feats.filter((k) => k !== "inventory" && k !== "digital_signage");
                    const extra = [];
                    if (inventoryOn)
                        extra.push("inventory");
                    if (signage.enabled)
                        extra.push("digital_signage");
                    return [...withoutPaid, ...extra];
                }
                catch {
                    return null;
                }
            })(),
        };
    }
    static async updateMerchantSettings(merchantId, updates) {
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (updates.name !== undefined) {
            const name = String(updates.name || "").trim().slice(0, 255);
            if (!name)
                throw new Error("Business name is required");
            patch.name = name;
        }
        if (updates.email !== undefined) {
            const email = String(updates.email || "").trim().toLowerCase().slice(0, 255);
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error("Valid email is required");
            }
            const dup = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchants.email, email), (0, drizzle_orm_1.ne)(db_1.schema.merchants.id, merchantId)),
                columns: { id: true },
            });
            if (dup)
                throw new Error("This email is already used by another account");
            patch.email = email;
        }
        if (updates.phone !== undefined)
            patch.phone = updates.phone;
        if (updates.address !== undefined)
            patch.address = updates.address;
        if (updates.city !== undefined)
            patch.city = updates.city;
        if (updates.country !== undefined)
            patch.country = updates.country;
        if (updates.businessLicense !== undefined)
            patch.businessLicense = updates.businessLicense;
        if (updates.vatNumber !== undefined)
            patch.vatNumber = updates.vatNumber;
        if (updates.vatRate !== undefined)
            patch.vatRate = updates.vatRate.toString();
        if (updates.taxTakeawayRate !== undefined)
            patch.taxTakeawayRate = updates.taxTakeawayRate.toString();
        if (updates.taxDineInRate !== undefined)
            patch.taxDineInRate = updates.taxDineInRate.toString();
        if (updates.taxDeliveryRate !== undefined)
            patch.taxDeliveryRate = updates.taxDeliveryRate.toString();
        if (updates.taxIncludedInPrice !== undefined)
            patch.taxIncludedInPrice = !!updates.taxIncludedInPrice;
        if (updates.vatAfterDiscount !== undefined)
            patch.vatAfterDiscount = !!updates.vatAfterDiscount;
        if (updates.shopEnabled !== undefined)
            patch.shopEnabled = !!updates.shopEnabled;
        if (updates.acceptingOrders !== undefined)
            patch.acceptingOrders = !!updates.acceptingOrders;
        if (updates.acceptingReservations !== undefined) {
            patch.acceptingReservations = !!updates.acceptingReservations;
        }
        if (updates.pickupEnabled !== undefined)
            patch.pickupEnabled = !!updates.pickupEnabled;
        if (updates.dineInEnabled !== undefined)
            patch.dineInEnabled = !!updates.dineInEnabled;
        if (updates.deliveryEnabled !== undefined)
            patch.deliveryEnabled = !!updates.deliveryEnabled;
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
        if (updates.floorPlanEnabled !== undefined)
            patch.floorPlanEnabled = !!updates.floorPlanEnabled;
        if (updates.paxOrderingEnabled !== undefined)
            patch.paxOrderingEnabled = !!updates.paxOrderingEnabled;
        if (updates.coursesEnabled !== undefined)
            patch.coursesEnabled = !!updates.coursesEnabled;
        if (updates.shiftsEnabled !== undefined)
            patch.shiftsEnabled = !!updates.shiftsEnabled;
        if (updates.posColorTheme !== undefined) {
            const theme = String(updates.posColorTheme || "teal").toLowerCase();
            patch.posColorTheme = ["teal", "green", "blue", "violet", "mono"].includes(theme)
                ? theme
                : "teal";
        }
        if (updates.storeHours !== undefined)
            patch.storeHours = updates.storeHours;
        if (updates.shopLogoUrl !== undefined)
            patch.shopLogoUrl = updates.shopLogoUrl;
        if (updates.shopBannerUrl !== undefined)
            patch.shopBannerUrl = updates.shopBannerUrl;
        if (updates.latitude !== undefined) {
            patch.latitude = updates.latitude === null || updates.latitude === "" ? null : String(updates.latitude);
        }
        if (updates.longitude !== undefined) {
            patch.longitude = updates.longitude === null || updates.longitude === "" ? null : String(updates.longitude);
        }
        if (updates.pickupEtaMinutes !== undefined)
            patch.pickupEtaMinutes = updates.pickupEtaMinutes;
        if (updates.deliveryEtaMinutes !== undefined)
            patch.deliveryEtaMinutes = updates.deliveryEtaMinutes;
        if (updates.minPreOrderDelayMinutes !== undefined) {
            patch.minPreOrderDelayMinutes = Math.max(0, Math.min(240, Number(updates.minPreOrderDelayMinutes) || 0));
        }
        if (updates.deliveryMenuMarkup !== undefined) {
            const n = Number(updates.deliveryMenuMarkup);
            if (!Number.isFinite(n) || n < 0)
                throw new Error("deliveryMenuMarkup must be >= 0");
            patch.deliveryMenuMarkup = n.toFixed(2);
        }
        if (updates.adyenMerchantAccount !== undefined)
            patch.adyenMerchantAccount = updates.adyenMerchantAccount;
        if (updates.adyenClientId !== undefined)
            patch.adyenClientId = updates.adyenClientId;
        if (updates.adyenLiveEnvironment !== undefined)
            patch.adyenLiveEnvironment = !!updates.adyenLiveEnvironment;
        if (updates.adyenLiveRegion !== undefined) {
            const region = String(updates.adyenLiveRegion || "EU").toUpperCase();
            patch.adyenLiveRegion = ["EU", "US", "AU", "APSE"].includes(region) ? region : "EU";
        }
        if (updates.adyenUseLegacyEndpoint !== undefined) {
            patch.adyenUseLegacyEndpoint = !!updates.adyenUseLegacyEndpoint;
        }
        if (updates.webposExpressEnabled !== undefined)
            patch.webposExpressEnabled = !!updates.webposExpressEnabled;
        if (updates.webposCashEnabled !== undefined)
            patch.webposCashEnabled = !!updates.webposCashEnabled;
        if (updates.webposCardEnabled !== undefined)
            patch.webposCardEnabled = !!updates.webposCardEnabled;
        if (updates.webposTerminalEnabled !== undefined)
            patch.webposTerminalEnabled = !!updates.webposTerminalEnabled;
        if (updates.webposGiftCardEnabled !== undefined)
            patch.webposGiftCardEnabled = !!updates.webposGiftCardEnabled;
        if (updates.webposInvoiceEnabled !== undefined)
            patch.webposInvoiceEnabled = !!updates.webposInvoiceEnabled;
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
            if (!Number.isFinite(n) || n < 0)
                throw new Error("onlineCardFeeFixed must be >= 0");
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
        if (updates.slug !== undefined) {
            patch.slug = normalizeSubdomain(updates.slug) || null;
        }
        if (updates.subdomain !== undefined) {
            patch.subdomain = normalizeSubdomain(updates.subdomain);
        }
        if (updates.customDomain !== undefined) {
            const domainNorm = (0, domain_1.normalizeCustomDomain)(updates.customDomain);
            if (domainNorm) {
                const taken = await db.query.merchants.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.customDomain, domainNorm),
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
            patch.vacationSettings = (0, vacation_1.normalizeVacationSettings)(updates.vacationSettings);
        }
        if (updates.emailSmtpSettings !== undefined) {
            const next = marketing_service_1.MarketingService.normalizeSmtp(updates.emailSmtpSettings);
            if (!next.password) {
                const current = await db.query.merchants.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                    columns: { emailSmtpSettings: true },
                });
                const prev = marketing_service_1.MarketingService.normalizeSmtp(current?.emailSmtpSettings || null);
                if (prev.password)
                    next.password = prev.password;
            }
            patch.emailSmtpSettings = next;
        }
        if (updates.emailBrevoSettings !== undefined) {
            const next = marketing_service_1.MarketingService.normalizeBrevo(updates.emailBrevoSettings);
            const current = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                columns: { emailBrevoSettings: true },
            });
            const prev = marketing_service_1.MarketingService.normalizeBrevo(current?.emailBrevoSettings || null);
            // Keep API key when the form omits it (blank password-style field).
            if (!next.apiKey && prev.apiKey)
                next.apiKey = prev.apiKey;
            // Preserve usage counters from DB (UI does not edit them).
            next.dailySent = prev.dailySent;
            next.dailyPeriod = prev.dailyPeriod;
            next.monthlySent = prev.monthlySent;
            next.monthlyPeriod = prev.monthlyPeriod;
            patch.emailBrevoSettings = next;
        }
        if (updates.marketingSettings !== undefined) {
            patch.marketingSettings = marketing_service_1.MarketingService.normalizeMarketing(updates.marketingSettings);
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
        if (updates.posPrintSettings !== undefined) {
            patch.posPrintSettings = (0, pos_print_settings_1.normalizePosPrintSettings)(updates.posPrintSettings);
        }
        if (updates.tableQrSettings !== undefined) {
            patch.tableQrSettings = (0, table_qr_settings_1.normalizeTableQrSettings)(updates.tableQrSettings);
        }
        if (updates.posCheckoutSettings !== undefined) {
            patch.posCheckoutSettings = (0, pos_checkout_settings_1.normalizePosCheckoutSettings)(updates.posCheckoutSettings);
        }
        if (updates.deliveryPlatformSettings !== undefined) {
            const current = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                columns: { deliveryPlatformSettings: true },
            });
            patch.deliveryPlatformSettings = (0, delivery_platform_settings_1.applyProductionCredentialDefaults)((0, delivery_platform_settings_1.mergeDeliveryPlatformSettings)(current?.deliveryPlatformSettings, updates.deliveryPlatformSettings));
        }
        // Auto-create slug when enabling shop without one
        if (updates.shopEnabled && !updates.slug) {
            const current = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            if (current && !current.slug) {
                patch.slug = slugFromName(current.name);
            }
        }
        const merchant = await db
            .update(db_1.schema.merchants)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
            .returning();
        if (merchant.length === 0) {
            throw new Error("Merchant not found");
        }
        return this.getMerchantSettings(merchantId);
    }
    static channelTaxRate(merchant, channel = "takeaway") {
        const fallback = merchant.vatRate != null ? parseFloat(String(merchant.vatRate)) : 0;
        const pick = (v) => {
            if (v === undefined || v === null || v === "")
                return null;
            const n = parseFloat(String(v));
            return Number.isFinite(n) ? n : null;
        };
        if (channel === "dine_in")
            return pick(merchant.taxDineInRate) ?? fallback;
        if (channel === "delivery")
            return pick(merchant.taxDeliveryRate) ?? fallback;
        return pick(merchant.taxTakeawayRate) ?? fallback;
    }
    static async getVATSettings(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.vatSettings.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.vatSettings.merchantId, merchantId),
        });
    }
    static async createVATSetting(merchantId, country, vatRate, taxId, isDefault = false) {
        const db = (0, db_1.getDb)();
        if (isDefault) {
            await db
                .update(db_1.schema.vatSettings)
                .set({ isDefault: false })
                .where((0, drizzle_orm_1.eq)(db_1.schema.vatSettings.merchantId, merchantId));
        }
        const vatSetting = await db
            .insert(db_1.schema.vatSettings)
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
    static async updateVATSetting(merchantId, vatSettingId, updates) {
        const db = (0, db_1.getDb)();
        if (updates.isDefault) {
            await db
                .update(db_1.schema.vatSettings)
                .set({ isDefault: false })
                .where((0, drizzle_orm_1.eq)(db_1.schema.vatSettings.merchantId, merchantId));
        }
        const patch = {};
        if (updates.vatRate !== undefined)
            patch.vatRate = updates.vatRate.toString();
        if (updates.taxId !== undefined)
            patch.taxId = updates.taxId;
        if (updates.isDefault !== undefined)
            patch.isDefault = updates.isDefault;
        const vatSetting = await db
            .update(db_1.schema.vatSettings)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.vatSettings.id, vatSettingId), (0, drizzle_orm_1.eq)(db_1.schema.vatSettings.merchantId, merchantId)))
            .returning();
        if (vatSetting.length === 0) {
            throw new Error("VAT setting not found");
        }
        return vatSetting[0];
    }
    static async deleteVATSetting(merchantId, vatSettingId) {
        const db = (0, db_1.getDb)();
        const result = await db
            .delete(db_1.schema.vatSettings)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.vatSettings.id, vatSettingId), (0, drizzle_orm_1.eq)(db_1.schema.vatSettings.merchantId, merchantId)))
            .returning();
        if (result.length === 0) {
            throw new Error("VAT setting not found");
        }
        return { success: true };
    }
    static async getDefaultVATRate(merchantId) {
        const db = (0, db_1.getDb)();
        const defaultVAT = await db.query.vatSettings.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.vatSettings.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.vatSettings.isDefault, true)),
        });
        if (defaultVAT) {
            return parseFloat(defaultVAT.vatRate.toString());
        }
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        return merchant ? parseFloat(merchant.vatRate?.toString() || "0") : 0;
    }
    static async getVATRateByCountry(merchantId, country) {
        const db = (0, db_1.getDb)();
        const vatSetting = await db.query.vatSettings.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.vatSettings.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.vatSettings.country, country)),
        });
        if (vatSetting) {
            return parseFloat(vatSetting.vatRate.toString());
        }
        return this.getDefaultVATRate(merchantId);
    }
    static async getBusinessInfo(merchantId) {
        return this.getMerchantSettings(merchantId);
    }
    static async updateBusinessInfo(merchantId, businessInfo) {
        return this.updateMerchantSettings(merchantId, businessInfo);
    }
    static async resolveByShopHost(hostOrSlug) {
        const db = (0, db_1.getDb)();
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
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.customDomain, host),
        });
        if (byCustom)
            return byCustom;
        return db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.merchants.subdomain, key), (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, key)),
        });
    }
}
exports.MerchantSettingsService = MerchantSettingsService;
//# sourceMappingURL=merchant-settings.service.js.map