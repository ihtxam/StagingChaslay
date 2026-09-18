"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const customer_display_settings_1 = require("@/lib/customer-display-settings");
const cds_live_state_1 = require("@/lib/cds-live-state");
const display_short_code_1 = require("@/lib/display-short-code");
async function ensureCdsShortCode(merchantId, settings) {
    if (settings.shortCode)
        return settings;
    const db = (0, db_1.getDb)();
    const shortCode = await (0, display_short_code_1.allocateDisplayShortCode)(db);
    const next = { ...settings, shortCode };
    await db
        .update(db_1.schema.merchants)
        .set({ customerDisplaySettings: next, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
    return next;
}
async function loadMerchantByAccessKey(accessKey) {
    await (0, ensure_merchant_schema_1.ensureCustomerDisplaySettingsColumn)();
    const trimmed = String(accessKey || "").trim();
    if (!trimmed)
        throw new Error("Customer display not found");
    const rows = await (0, ensure_merchant_schema_1.queryRaw)(`SELECT id, name, slug, shop_logo_url, customer_display_settings
     FROM merchants
     WHERE customer_display_settings IS NOT NULL
       AND (
         customer_display_settings->>'accessToken' = $1
         OR customer_display_settings->>'shortCode' = $1
       )
     LIMIT 1`, [trimmed]);
    const merchant = rows[0];
    if (!merchant)
        throw new Error("Customer display not found");
    let settings = (0, customer_display_settings_1.normalizeCustomerDisplaySettings)(merchant.customer_display_settings);
    const matches = settings.accessToken === trimmed || settings.shortCode === trimmed;
    if (!matches)
        throw new Error("Customer display not found");
    if (!settings.enabled)
        throw new Error("Customer display is disabled");
    settings = await ensureCdsShortCode(merchant.id, settings);
    return { merchant, settings };
}
class CdsService {
    static async configForToken(accessKey) {
        const { merchant, settings } = await loadMerchantByAccessKey(accessKey);
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
            },
        };
    }
    static async getSettings(merchantId) {
        await (0, ensure_merchant_schema_1.ensureCustomerDisplaySettingsColumn)();
        const rows = await (0, ensure_merchant_schema_1.queryRaw)(`SELECT customer_display_settings FROM merchants WHERE id = $1 LIMIT 1`, [merchantId]);
        if (rows[0]?.customer_display_settings == null) {
            const defaults = (0, customer_display_settings_1.normalizeCustomerDisplaySettings)(null);
            const withCode = await ensureCdsShortCode(merchantId, defaults);
            const db = (0, db_1.getDb)();
            await db
                .update(db_1.schema.merchants)
                .set({ customerDisplaySettings: withCode, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            return withCode;
        }
        const settings = (0, customer_display_settings_1.normalizeCustomerDisplaySettings)(rows[0]?.customer_display_settings);
        return ensureCdsShortCode(merchantId, settings);
    }
    static async updateSettings(merchantId, raw) {
        await (0, ensure_merchant_schema_1.ensureCustomerDisplaySettingsColumn)();
        const existing = await this.getSettings(merchantId);
        const incoming = (0, customer_display_settings_1.normalizeCustomerDisplaySettings)({ ...existing, ...raw });
        incoming.accessToken = existing.accessToken || incoming.accessToken;
        incoming.shortCode = existing.shortCode || incoming.shortCode;
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ customerDisplaySettings: incoming, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return incoming;
    }
    static async rotateToken(merchantId) {
        const settings = await this.getSettings(merchantId);
        settings.accessToken = (0, customer_display_settings_1.normalizeCustomerDisplaySettings)({}).accessToken;
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ customerDisplaySettings: settings, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return settings;
    }
    static async pushLiveState(merchantId, raw) {
        const settings = await this.getSettings(merchantId);
        if (!settings.enabled)
            throw new Error("Customer display is disabled");
        const state = (0, cds_live_state_1.normalizeCdsLiveState)(raw);
        if (!state)
            throw new Error("Invalid customer display state");
        (0, cds_live_state_1.setCdsLiveState)(settings.accessToken, merchantId, state);
        return state;
    }
    static async liveStateForToken(accessKey) {
        (0, cds_live_state_1.sweepExpiredCdsLiveState)();
        const { settings } = await loadMerchantByAccessKey(accessKey);
        return (0, cds_live_state_1.getCdsLiveState)(settings.accessToken);
    }
}
exports.CdsService = CdsService;
//# sourceMappingURL=cds.service.js.map