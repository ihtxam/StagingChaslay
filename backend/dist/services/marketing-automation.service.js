"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutomationService = void 0;
exports.normalizeMarketingAutomation = normalizeMarketingAutomation;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
const email_service_1 = require("@/services/email.service");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const marketing_automation_addon_1 = require("@/lib/marketing-automation-addon");
const brand_1 = require("@/lib/brand");
const DEFAULT_ORDER_SUBJECT = "Thanks for your order at {{businessName}}";
const DEFAULT_ORDER_BODY = `<p>Hi {{name}},</p><p>Thank you for your order. We appreciate your business!</p><p><a href="{{shopUrl}}">Order again</a></p>`;
const DEFAULT_RES_SUBJECT = "Your table is booked at {{businessName}}";
const DEFAULT_RES_BODY = `<p>Hi {{name}},</p><p>We look forward to welcoming you. See you soon!</p>`;
function shopUrlForMerchant(merchant) {
    const shopHost = (0, brand_1.resolveShopPublicHost)();
    const apex = shopHost.replace(/^shop\./, "").replace(/^app\./, "");
    if (merchant.customDomain)
        return `https://${merchant.customDomain.replace(/^https?:\/\//, "")}`;
    if (merchant.subdomain)
        return `https://${merchant.subdomain}.${apex}`;
    if (merchant.slug)
        return `https://${shopHost}/${merchant.slug}`;
    return `https://${shopHost}`;
}
function applyPlaceholders(template, vars) {
    return template
        .replace(/\{\{\s*name\s*\}\}/gi, vars.name)
        .replace(/\{\{\s*shopUrl\s*\}\}/gi, vars.shopUrl)
        .replace(/\{\{\s*businessName\s*\}\}/gi, vars.businessName);
}
function htmlWrap(body) {
    const looksHtml = /<[a-z][\s\S]*>/i.test(body);
    const content = looksHtml ? body : body.replace(/\n/g, "<br/>");
    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1c1917;max-width:560px;margin:0 auto;padding:24px">${content}</body></html>`;
}
function normalizeMarketingAutomation(raw) {
    const journeys = Array.isArray(raw?.journeys) ? raw.journeys : [];
    const out = journeys
        .map((j) => {
        const trigger = j?.trigger;
        if (trigger !== "order_paid" && trigger !== "reservation_confirmed")
            return null;
        return {
            id: String(j.id || (0, crypto_1.randomUUID)()).slice(0, 64),
            trigger,
            enabled: j.enabled !== false,
            subject: String(j.subject || "").slice(0, 300) || DEFAULT_ORDER_SUBJECT,
            bodyHtml: String(j.bodyHtml || "").slice(0, 20000) || DEFAULT_ORDER_BODY,
        };
    })
        .filter(Boolean);
    if (!out.some((j) => j.trigger === "order_paid")) {
        out.push({
            id: "order_paid",
            trigger: "order_paid",
            enabled: false,
            subject: DEFAULT_ORDER_SUBJECT,
            bodyHtml: DEFAULT_ORDER_BODY,
        });
    }
    if (!out.some((j) => j.trigger === "reservation_confirmed")) {
        out.push({
            id: "reservation_confirmed",
            trigger: "reservation_confirmed",
            enabled: false,
            subject: DEFAULT_RES_SUBJECT,
            bodyHtml: DEFAULT_RES_BODY,
        });
    }
    return { journeys: out };
}
class MarketingAutomationService {
    static async getSettings(merchantId) {
        await (0, ensure_merchant_schema_1.ensureMarketingAutomationAddonColumn)();
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { marketingAutomationSettings: true },
        });
        return normalizeMarketingAutomation(merchant?.marketingAutomationSettings);
    }
    static async updateSettings(merchantId, raw) {
        await (0, ensure_merchant_schema_1.ensureMarketingAutomationAddonColumn)();
        const next = normalizeMarketingAutomation(raw);
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ marketingAutomationSettings: next, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return next;
    }
    static async trigger(merchantId, trigger, ctx) {
        if (!(await (0, marketing_automation_addon_1.merchantHasMarketingAutomationLicense)(merchantId)))
            return;
        const email = String(ctx.email || "")
            .trim()
            .toLowerCase();
        if (!email.includes("@"))
            return;
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            return;
        const settings = normalizeMarketingAutomation(merchant.marketingAutomationSettings);
        const journey = settings.journeys.find((j) => j.trigger === trigger && j.enabled);
        if (!journey)
            return;
        const businessName = merchant.name || "Our restaurant";
        const shopUrl = shopUrlForMerchant(merchant);
        const name = String(ctx.name || "there").trim() || "there";
        const subject = applyPlaceholders(journey.subject, { name, shopUrl, businessName });
        const body = applyPlaceholders(journey.bodyHtml, { name, shopUrl, businessName });
        try {
            await email_service_1.EmailService.send({
                merchantId,
                to: email,
                subject,
                html: htmlWrap(body),
                emailType: trigger === "order_paid" ? "marketing_automation_order" : "marketing_automation_reservation",
            });
        }
        catch (err) {
            console.warn("Marketing automation send failed:", err);
        }
    }
}
exports.MarketingAutomationService = MarketingAutomationService;
//# sourceMappingURL=marketing-automation.service.js.map