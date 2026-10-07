"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiWebSeoService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const ai_web_seo_addon_1 = require("@/lib/ai-web-seo-addon");
const brand_1 = require("@/lib/brand");
function normalizeSettings(raw) {
    const suggestions = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
    const keywords = Array.isArray(raw?.targetKeywords)
        ? raw.targetKeywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 20)
        : [];
    return {
        autopilotEnabled: raw?.autopilotEnabled === true,
        targetKeywords: keywords,
        metaTitle: raw?.metaTitle ? String(raw.metaTitle).slice(0, 120) : null,
        metaDescription: raw?.metaDescription ? String(raw.metaDescription).slice(0, 320) : null,
        lastScanAt: raw?.lastScanAt ? String(raw.lastScanAt) : null,
        suggestions: suggestions
            .map((s) => ({
            id: String(s.id || (0, crypto_1.randomUUID)()).slice(0, 64),
            title: String(s.title || "").slice(0, 200),
            detail: String(s.detail || "").slice(0, 2000),
            priority: s.priority === "high" || s.priority === "low" ? s.priority : "medium",
        }))
            .filter((s) => s.title && s.detail),
    };
}
class AiWebSeoService {
    static async getSettings(merchantId) {
        if (!(await (0, ai_web_seo_addon_1.merchantHasAiWebSeoLicense)(merchantId))) {
            throw new Error("AI website & SEO requires the AI Web SEO add-on");
        }
        await (0, ensure_merchant_schema_1.ensureAiWebSeoAddonColumn)();
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { aiWebSeoSettings: true, name: true, slug: true, shopSiteSettings: true },
        });
        return normalizeSettings(merchant?.aiWebSeoSettings);
    }
    static async updateSettings(merchantId, input) {
        const current = await this.getSettings(merchantId);
        const next = normalizeSettings({
            ...current,
            ...input,
            suggestions: input.suggestions ?? current.suggestions,
        });
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ aiWebSeoSettings: next, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return next;
    }
    static async runScan(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                name: true,
                slug: true,
                shopSiteSettings: true,
                cmsHomepageEnabled: true,
                aiWebSeoSettings: true,
            },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        if (!(await (0, ai_web_seo_addon_1.merchantHasAiWebSeoLicense)(merchantId))) {
            throw new Error("AI website & SEO requires the AI Web SEO add-on");
        }
        const shopHost = (0, brand_1.resolveShopPublicHost)();
        const shopUrl = merchant.slug ? `https://${shopHost}/${merchant.slug}` : null;
        const suggestions = [];
        if (!merchant.cmsHomepageEnabled) {
            suggestions.push({
                id: "cms-homepage",
                title: "Enable website builder homepage",
                detail: "Turn on the Chaslay homepage so search engines have a dedicated landing page beyond the menu.",
                priority: "high",
            });
        }
        const meta = (merchant.shopSiteSettings || {});
        if (!meta.metaTitle || String(meta.metaTitle).trim().length < 12) {
            suggestions.push({
                id: "meta-title",
                title: "Add a descriptive meta title",
                detail: `Use your business name and city in the title (e.g. "${merchant.name} — order online").`,
                priority: "high",
            });
        }
        if (!meta.metaDescription || String(meta.metaDescription).trim().length < 40) {
            suggestions.push({
                id: "meta-description",
                title: "Expand the meta description",
                detail: "Write 1–2 sentences with cuisine, location, and a call to action for pickup or delivery.",
                priority: "medium",
            });
        }
        if (shopUrl) {
            suggestions.push({
                id: "local-keywords",
                title: "Target local keywords",
                detail: `Link your Google Business profile to ${shopUrl} and use consistent NAP (name, address, phone) on the site footer.`,
                priority: "medium",
            });
        }
        if (!suggestions.length) {
            suggestions.push({
                id: "maintain",
                title: "SEO baseline looks good",
                detail: "Re-run this scan after menu or branding changes to refresh recommendations.",
                priority: "low",
            });
        }
        const settings = normalizeSettings(merchant.aiWebSeoSettings);
        const next = {
            ...settings,
            suggestions,
            lastScanAt: new Date().toISOString(),
            metaTitle: settings.metaTitle || meta.metaTitle || `${merchant.name} — order online`,
            metaDescription: settings.metaDescription ||
                meta.metaDescription ||
                `Order from ${merchant.name}. Fresh food, easy pickup and delivery.`,
        };
        await db
            .update(db_1.schema.merchants)
            .set({ aiWebSeoSettings: next, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return next;
    }
}
exports.AiWebSeoService = AiWebSeoService;
//# sourceMappingURL=ai-web-seo.service.js.map