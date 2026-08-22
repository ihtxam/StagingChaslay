"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const email_service_1 = require("@/services/email.service");
const DEFAULT_REORDER_DAYS = 5;
const DEFAULT_REORDER_SUBJECT = "We miss you — order again from {{businessName}}";
const DEFAULT_REORDER_BODY = `<p>Hi {{name}},</p>
<p>It's been a few days since your last order. We'd love to see you again!</p>
<p><a href="{{shopUrl}}">Order now</a></p>
<p>— {{businessName}}</p>`;
function normalizeSmtp(raw) {
    if (!raw || typeof raw !== "object") {
        return { enabled: false, host: "", port: 587, secure: false, user: "", password: "", fromEmail: "", fromName: "" };
    }
    return {
        enabled: !!raw.enabled,
        host: String(raw.host || "").trim(),
        port: Number(raw.port) || 587,
        secure: !!raw.secure,
        user: String(raw.user || "").trim(),
        password: raw.password != null ? String(raw.password) : "",
        fromEmail: String(raw.fromEmail || "").trim(),
        fromName: String(raw.fromName || "").trim(),
    };
}
function clampLimit(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0)
        return null;
    return Math.min(Math.round(v), 10000000);
}
function normalizeBrevo(raw) {
    if (!raw || typeof raw !== "object") {
        return {
            enabled: false,
            apiKey: "",
            fromEmail: "",
            fromName: "",
            dailyLimit: null,
            monthlyLimit: null,
            dailySent: 0,
            dailyPeriod: null,
            monthlySent: 0,
            monthlyPeriod: null,
        };
    }
    return {
        enabled: !!raw.enabled,
        apiKey: raw.apiKey != null ? String(raw.apiKey) : "",
        fromEmail: String(raw.fromEmail || "").trim(),
        fromName: String(raw.fromName || "").trim(),
        dailyLimit: clampLimit(raw.dailyLimit),
        monthlyLimit: clampLimit(raw.monthlyLimit),
        dailySent: Math.max(0, Math.round(Number(raw.dailySent) || 0)),
        dailyPeriod: raw.dailyPeriod ? String(raw.dailyPeriod).slice(0, 10) : null,
        monthlySent: Math.max(0, Math.round(Number(raw.monthlySent) || 0)),
        monthlyPeriod: raw.monthlyPeriod ? String(raw.monthlyPeriod).slice(0, 7) : null,
    };
}
function normalizeMarketing(raw) {
    if (!raw || typeof raw !== "object") {
        return {
            reorderReminderEnabled: false,
            reorderReminderDays: DEFAULT_REORDER_DAYS,
            reorderReminderSubject: DEFAULT_REORDER_SUBJECT,
            reorderReminderBody: DEFAULT_REORDER_BODY,
        };
    }
    const days = Number(raw.reorderReminderDays);
    return {
        reorderReminderEnabled: !!raw.reorderReminderEnabled,
        reorderReminderDays: Number.isFinite(days) && days >= 1 && days <= 90 ? Math.round(days) : DEFAULT_REORDER_DAYS,
        reorderReminderSubject: String(raw.reorderReminderSubject || DEFAULT_REORDER_SUBJECT),
        reorderReminderBody: String(raw.reorderReminderBody || DEFAULT_REORDER_BODY),
    };
}
function applyPlaceholders(template, vars) {
    return template
        .replace(/\{\{\s*name\s*\}\}/gi, vars.name)
        .replace(/\{\{\s*shopUrl\s*\}\}/gi, vars.shopUrl)
        .replace(/\{\{\s*businessName\s*\}\}/gi, vars.businessName);
}
function shopUrlForMerchant(merchant) {
    const domain = process.env.DOMAIN || process.env.PUBLIC_APP_URL || "https://chaslay.com";
    const base = domain.replace(/\/$/, "").startsWith("http")
        ? domain.replace(/\/$/, "")
        : `https://${domain.replace(/\/$/, "")}`;
    if (merchant.customDomain)
        return `https://${merchant.customDomain.replace(/^https?:\/\//, "")}`;
    if (merchant.subdomain) {
        try {
            const host = new URL(base).host;
            const apex = host.replace(/^www\./, "").replace(/^shop\./, "").replace(/^app\./, "");
            return `https://${merchant.subdomain}.${apex}`;
        }
        catch {
            /* fall through */
        }
    }
    if (merchant.slug)
        return `${base}/${merchant.slug}`;
    return base;
}
function htmlWrap(body) {
    const looksHtml = /<[a-z][\s\S]*>/i.test(body);
    const content = looksHtml ? body : body.replace(/\n/g, "<br/>");
    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1c1917;max-width:560px;margin:0 auto;padding:24px">${content}</body></html>`;
}
class MarketingService {
    static getSmtpPublic(raw) {
        const s = normalizeSmtp(raw);
        return {
            enabled: s.enabled,
            host: s.host,
            port: s.port,
            secure: s.secure,
            user: s.user,
            passwordSet: !!s.password,
            fromEmail: s.fromEmail,
            fromName: s.fromName,
        };
    }
    static getBrevoPublic(raw) {
        const s = normalizeBrevo(raw);
        const key = (s.apiKey || "").trim();
        const masked = key.length >= 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : key ? "••••••••" : "";
        return {
            enabled: s.enabled,
            apiKeySet: !!key,
            apiKeyMasked: masked,
            fromEmail: s.fromEmail,
            fromName: s.fromName,
            dailyLimit: s.dailyLimit,
            monthlyLimit: s.monthlyLimit,
            dailySent: s.dailySent || 0,
            dailyPeriod: s.dailyPeriod,
            monthlySent: s.monthlySent || 0,
            monthlyPeriod: s.monthlyPeriod,
        };
    }
    static async listAudience(merchantId) {
        const db = (0, db_1.getDb)();
        const rows = await db
            .select({
            id: db_1.schema.customers.id,
            email: db_1.schema.customers.email,
            firstName: db_1.schema.customers.firstName,
            lastName: db_1.schema.customers.lastName,
            phone: db_1.schema.customers.phone,
            marketingOptIn: db_1.schema.customers.marketingOptIn,
            lastOrderAt: db_1.schema.customers.lastOrderAt,
            totalSpent: db_1.schema.customers.totalSpent,
        })
            .from(db_1.schema.customers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.isNotNull)(db_1.schema.customers.email), (0, drizzle_orm_1.ne)(db_1.schema.customers.email, "")))
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.customers.lastOrderAt), (0, drizzle_orm_1.desc)(db_1.schema.customers.updatedAt));
        // Also include distinct guest emails from orders not linked to a customer
        const guestEmails = await db
            .selectDistinct({ email: db_1.schema.orders.customerEmail, name: db_1.schema.orders.customerName })
            .from(db_1.schema.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.isNotNull)(db_1.schema.orders.customerEmail), (0, drizzle_orm_1.ne)(db_1.schema.orders.customerEmail, "")));
        const byEmail = new Map();
        for (const c of rows) {
            const email = String(c.email || "")
                .trim()
                .toLowerCase();
            if (!email || !email.includes("@"))
                continue;
            if (c.marketingOptIn === false)
                continue;
            byEmail.set(email, {
                id: c.id,
                email,
                name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || email,
                phone: c.phone || null,
                marketingOptIn: c.marketingOptIn !== false,
                lastOrderAt: c.lastOrderAt || null,
                totalSpent: c.totalSpent != null ? String(c.totalSpent) : null,
            });
        }
        for (const g of guestEmails) {
            const email = String(g.email || "")
                .trim()
                .toLowerCase();
            if (!email || !email.includes("@") || byEmail.has(email))
                continue;
            byEmail.set(email, {
                id: null,
                email,
                name: String(g.name || "").trim() || email,
                phone: null,
                marketingOptIn: true,
                lastOrderAt: null,
                totalSpent: null,
            });
        }
        return Array.from(byEmail.values()).sort((a, b) => a.email.localeCompare(b.email));
    }
    static async listCampaigns(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.newsletterCampaigns.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.newsletterCampaigns.createdAt)],
            limit: 50,
        });
    }
    static async saveCampaign(merchantId, input) {
        const db = (0, db_1.getDb)();
        const subject = String(input.subject || "").trim();
        const bodyHtml = String(input.bodyHtml || "").trim();
        if (!subject)
            throw new Error("Subject is required");
        if (!bodyHtml)
            throw new Error("Newsletter body is required");
        const audience = input.audience === "selected" ? "selected" : "all";
        const selectedEmails = audience === "selected"
            ? Array.from(new Set((input.selectedEmails || [])
                .map((e) => String(e || "").trim().toLowerCase())
                .filter((e) => e.includes("@"))))
            : null;
        const designJson = input.designJson && typeof input.designJson === "object"
            ? input.designJson
            : null;
        if (input.id) {
            const existing = await db.query.newsletterCampaigns.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.id, input.id), (0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.merchantId, merchantId)),
            });
            if (!existing)
                throw new Error("Campaign not found");
            if (existing.status === "sending")
                throw new Error("Campaign is currently sending");
            const [updated] = await db
                .update(db_1.schema.newsletterCampaigns)
                .set({
                title: String(input.title || existing.title || "Newsletter").slice(0, 200),
                subject: subject.slice(0, 300),
                bodyHtml,
                designJson: designJson ?? existing.designJson ?? null,
                audience,
                selectedEmails,
                status: existing.status === "sent" ? "draft" : existing.status,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.id, existing.id))
                .returning();
            return updated;
        }
        const [created] = await db
            .insert(db_1.schema.newsletterCampaigns)
            .values({
            merchantId,
            title: String(input.title || "Newsletter").slice(0, 200),
            subject: subject.slice(0, 300),
            bodyHtml,
            designJson,
            audience,
            selectedEmails,
            status: "draft",
        })
            .returning();
        return created;
    }
    static async sendCampaign(merchantId, campaignId) {
        const db = (0, db_1.getDb)();
        const campaign = await db.query.newsletterCampaigns.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.id, campaignId), (0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.merchantId, merchantId)),
        });
        if (!campaign)
            throw new Error("Campaign not found");
        if (campaign.status === "sending")
            throw new Error("Already sending");
        const configured = await email_service_1.EmailService.isConfigured(merchantId);
        if (!configured) {
            throw new Error("Configure SMTP or Brevo API in Settings -> Email before sending");
        }
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const audience = await this.listAudience(merchantId);
        let recipients = [];
        if (campaign.audience === "selected") {
            const selected = Array.from(new Set((campaign.selectedEmails || [])
                .map((e) => String(e || "").trim().toLowerCase())
                .filter((e) => e.includes("@"))));
            const audienceByEmail = new Map(audience.map((a) => [a.email.toLowerCase(), a]));
            recipients = selected.map((email) => {
                const hit = audienceByEmail.get(email);
                if (hit)
                    return hit;
                return {
                    id: null,
                    email,
                    name: email,
                    phone: null,
                    marketingOptIn: true,
                    lastOrderAt: null,
                    totalSpent: null,
                };
            });
        }
        else {
            recipients = audience;
        }
        if (!recipients.length)
            throw new Error("No recipients selected");
        await db
            .update(db_1.schema.newsletterCampaigns)
            .set({
            status: "sending",
            recipientCount: recipients.length,
            sentCount: 0,
            failedCount: 0,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.id, campaignId));
        const shopUrl = shopUrlForMerchant(merchant);
        let sent = 0;
        let failed = 0;
        for (const r of recipients) {
            try {
                const html = applyPlaceholders(campaign.bodyHtml, {
                    name: r.name || "there",
                    shopUrl,
                    businessName: merchant.name || "us",
                });
                await email_service_1.EmailService.send({
                    merchantId,
                    to: r.email,
                    subject: applyPlaceholders(campaign.subject, {
                        name: r.name || "there",
                        shopUrl,
                        businessName: merchant.name || "us",
                    }),
                    html: htmlWrap(html),
                });
                sent += 1;
                await db.insert(db_1.schema.marketingEmailLog).values({
                    merchantId,
                    campaignId,
                    email: r.email,
                    customerId: r.id,
                    type: "newsletter",
                    status: "sent",
                });
            }
            catch (error) {
                failed += 1;
                await db.insert(db_1.schema.marketingEmailLog).values({
                    merchantId,
                    campaignId,
                    email: r.email,
                    customerId: r.id,
                    type: "newsletter",
                    status: "failed",
                    error: error?.message || "Send failed",
                });
            }
        }
        const [updated] = await db
            .update(db_1.schema.newsletterCampaigns)
            .set({
            status: failed && !sent ? "failed" : "sent",
            sentCount: sent,
            failedCount: failed,
            sentAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.newsletterCampaigns.id, campaignId))
            .returning();
        return updated;
    }
    /** Refresh lastOrderAt from latest non-cancelled order (by customerId or email). */
    static async touchLastOrder(merchantId, opts) {
        const db = (0, db_1.getDb)();
        const at = opts.at || new Date();
        if (opts.customerId) {
            await db
                .update(db_1.schema.customers)
                .set({ lastOrderAt: at, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, opts.customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)));
            return;
        }
        const email = String(opts.email || "")
            .trim()
            .toLowerCase();
        if (!email)
            return;
        const existing = await db.query.customers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.customers.email, email)),
        });
        if (existing) {
            await db
                .update(db_1.schema.customers)
                .set({ lastOrderAt: at, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, existing.id));
        }
    }
    static async processReorderReminders() {
        const db = (0, db_1.getDb)();
        const merchants = await db.query.merchants.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.status, "active"),
            columns: {
                id: true,
                name: true,
                slug: true,
                subdomain: true,
                customDomain: true,
                marketingSettings: true,
                emailSmtpSettings: true,
                shopEnabled: true,
            },
        });
        let sent = 0;
        for (const merchant of merchants) {
            const marketing = normalizeMarketing(merchant.marketingSettings);
            if (!marketing.reorderReminderEnabled)
                continue;
            if (!(await email_service_1.EmailService.isConfigured(merchant.id)))
                continue;
            const days = marketing.reorderReminderDays || DEFAULT_REORDER_DAYS;
            const cutoff = new Date(Date.now() - days * 24 * 3600000);
            const minOrder = new Date(Date.now() - (days + 2) * 24 * 3600000); // window: ordered ~days ago, not older than days+2
            // Eligible: last order between (now-days-2) and (now-days), and no reminder since that order
            const candidates = await db
                .select()
                .from(db_1.schema.customers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchant.id), (0, drizzle_orm_1.eq)(db_1.schema.customers.marketingOptIn, true), (0, drizzle_orm_1.isNotNull)(db_1.schema.customers.email), (0, drizzle_orm_1.isNotNull)(db_1.schema.customers.lastOrderAt), (0, drizzle_orm_1.lt)(db_1.schema.customers.lastOrderAt, cutoff), (0, drizzle_orm_1.gte)(db_1.schema.customers.lastOrderAt, minOrder)))
                .limit(200);
            const shopUrl = shopUrlForMerchant(merchant);
            for (const c of candidates) {
                const email = String(c.email || "")
                    .trim()
                    .toLowerCase();
                if (!email.includes("@"))
                    continue;
                if (c.lastReorderReminderAt && c.lastOrderAt && c.lastReorderReminderAt >= c.lastOrderAt) {
                    continue; // already reminded after this order
                }
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || email.split("@")[0];
                const subject = applyPlaceholders(marketing.reorderReminderSubject || DEFAULT_REORDER_SUBJECT, {
                    name,
                    shopUrl,
                    businessName: merchant.name || "us",
                });
                const body = applyPlaceholders(marketing.reorderReminderBody || DEFAULT_REORDER_BODY, {
                    name,
                    shopUrl,
                    businessName: merchant.name || "us",
                });
                try {
                    await email_service_1.EmailService.send({
                        merchantId: merchant.id,
                        to: email,
                        subject,
                        html: htmlWrap(body),
                    });
                    await db
                        .update(db_1.schema.customers)
                        .set({ lastReorderReminderAt: new Date(), updatedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, c.id));
                    await db.insert(db_1.schema.marketingEmailLog).values({
                        merchantId: merchant.id,
                        email,
                        customerId: c.id,
                        type: "reorder_reminder",
                        status: "sent",
                    });
                    sent += 1;
                }
                catch (error) {
                    await db.insert(db_1.schema.marketingEmailLog).values({
                        merchantId: merchant.id,
                        email,
                        customerId: c.id,
                        type: "reorder_reminder",
                        status: "failed",
                        error: error?.message || "Send failed",
                    });
                }
            }
        }
        return { sent };
    }
}
exports.MarketingService = MarketingService;
MarketingService.normalizeSmtp = normalizeSmtp;
MarketingService.normalizeBrevo = normalizeBrevo;
MarketingService.normalizeMarketing = normalizeMarketing;
//# sourceMappingURL=marketing.service.js.map