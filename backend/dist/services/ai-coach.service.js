"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCoachService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const ai_coach_addon_1 = require("@/lib/ai-coach-addon");
const sales_mix_service_1 = require("@/services/sales-mix.service");
function normalizeCache(raw) {
    const insights = Array.isArray(raw?.insights) ? raw.insights : [];
    return {
        generatedAt: raw?.generatedAt ? String(raw.generatedAt) : null,
        periodLabel: raw?.periodLabel ? String(raw.periodLabel) : null,
        insights: insights
            .map((i) => ({
            id: String(i.id || (0, crypto_1.randomUUID)()).slice(0, 64),
            title: String(i.title || "").slice(0, 200),
            detail: String(i.detail || "").slice(0, 2000),
            priority: i.priority === "high" || i.priority === "low" ? i.priority : "medium",
        }))
            .filter((i) => i.title && i.detail),
    };
}
class AiCoachService {
    static async getBrief(merchantId, opts) {
        if (!(await (0, ai_coach_addon_1.merchantHasAiCoachLicense)(merchantId))) {
            throw new Error("AI insights coach requires the AI Coach add-on");
        }
        await (0, ensure_merchant_schema_1.ensureAiCoachAddonColumn)();
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { aiCoachCache: true, name: true },
        });
        const cache = normalizeCache(merchant?.aiCoachCache);
        const stale = !cache.generatedAt ||
            Date.now() - new Date(cache.generatedAt).getTime() > 6 * 3600000;
        if (!opts?.refresh && cache.insights.length && !stale) {
            return cache;
        }
        return this.regenerate(merchantId);
    }
    static async regenerate(merchantId) {
        if (!(await (0, ai_coach_addon_1.merchantHasAiCoachLicense)(merchantId))) {
            throw new Error("AI insights coach requires the AI Coach add-on");
        }
        const report = await sales_mix_service_1.SalesMixService.getSalesMixReport(merchantId, {
            preset: "last_week",
        });
        const insights = [];
        const topCat = report.categoryMix?.[0];
        if (topCat && topCat.revenueSharePct >= 35) {
            insights.push({
                id: "mix-category",
                title: "Category concentration",
                detail: `${topCat.label} drives ${topCat.revenueSharePct}% of revenue. Consider promoting weaker categories or bundling to balance the menu.`,
                priority: "medium",
            });
        }
        const topProduct = report.productMix?.[0];
        if (topProduct) {
            insights.push({
                id: "hero-product",
                title: "Hero product",
                detail: `${topProduct.label} is your top seller (${topProduct.quantitySharePct}% of items). Feature it in automations and reservation perks.`,
                priority: "high",
            });
        }
        const dayparts = report.daypartMix || [];
        const peak = [...dayparts].sort((a, b) => b.revenue - a.revenue)[0];
        const quiet = [...dayparts].sort((a, b) => a.revenue - b.revenue)[0];
        if (peak && quiet && peak.id !== quiet.id && quiet.revenue > 0) {
            insights.push({
                id: "daypart-gap",
                title: "Fill quiet dayparts",
                detail: `${quiet.label} is softer than ${peak.label}. Try time-boxed offers or reservation slot discounts during ${quiet.label.toLowerCase()}.`,
                priority: "medium",
            });
        }
        const channels = report.channelMix || [];
        const delivery = channels.find((c) => /delivery/i.test(c.label) || c.id === "delivery");
        const pickup = channels.find((c) => /takeaway|pickup/i.test(c.label) || c.id !== "delivery");
        if (delivery && pickup && delivery.revenueSharePct + pickup.revenueSharePct < 15) {
            insights.push({
                id: "channels",
                title: "Off-premise mix",
                detail: "Delivery and pickup are a small share of sales. Review shop hours, fees, and menu photos to grow online orders.",
                priority: "low",
            });
        }
        if (!insights.length) {
            insights.push({
                id: "baseline",
                title: "Keep collecting data",
                detail: "Run sales for a few more days, then refresh for sharper mix and daypart recommendations.",
                priority: "low",
            });
        }
        const cache = {
            generatedAt: new Date().toISOString(),
            periodLabel: report.range?.label || "Last 7 days",
            insights: insights.slice(0, 8),
        };
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ aiCoachCache: cache, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return cache;
    }
}
exports.AiCoachService = AiCoachService;
//# sourceMappingURL=ai-coach.service.js.map