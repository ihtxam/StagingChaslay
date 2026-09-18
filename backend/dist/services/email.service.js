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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const axios_1 = __importDefault(require("axios"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const crypto_1 = require("crypto");
function zurichYmd(d = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}
function zurichYm(d = new Date()) {
    return zurichYmd(d).slice(0, 7);
}
/**
 * Prefer platform mailco (with Brevo fallback) when merchant emailDeliveryMode is platform;
 * otherwise merchant SMTP, then merchant Brevo, then platform mailco/Brevo, then SendGrid.
 */
class EmailService {
    static envBrevoApiKey() {
        return (process.env.BREVO_API_KEY ||
            process.env.SENDINBLUE_API_KEY ||
            process.env.SIB_API_KEY ||
            "").trim();
    }
    static envFromAddress() {
        return (process.env.BREVO_FROM_EMAIL ||
            process.env.BREVO_SENDER_EMAIL ||
            process.env.SENDINBLUE_FROM_EMAIL ||
            process.env.FROM_EMAIL ||
            process.env.MAIL_FROM ||
            process.env.SENDGRID_FROM_EMAIL ||
            "noreply@rebornsense.com").trim();
    }
    static envFromName() {
        return (process.env.BREVO_FROM_NAME ||
            process.env.SENDINBLUE_FROM_NAME ||
            process.env.MAIL_FROM_NAME ||
            process.env.EMAIL_FROM_NAME ||
            "Reborn").trim();
    }
    /** Merchant emails show the shop name as sender; Brevo/SMTP from address stays authenticated. */
    static merchantSenderName(merchantName) {
        const name = String(merchantName || "").trim();
        return name || "Shop";
    }
    /** Reply address for customer-facing mail — merchant inbox, not platform noreply. */
    static merchantReplyTo(merchantName, merchantEmail, smtpFromEmail) {
        const replyToEmail = String(smtpFromEmail || merchantEmail || "").trim() || null;
        return {
            replyToEmail,
            replyToName: this.merchantSenderName(merchantName),
        };
    }
    static async resolveConfig(merchantId) {
        let merchantName = null;
        let merchantEmail = null;
        let useOwnDelivery = false;
        let merchantSmtpFallback = null;
        if (merchantId) {
            try {
                const { getDb, schema } = await Promise.resolve().then(() => __importStar(require("@/db")));
                const { eq } = await Promise.resolve().then(() => __importStar(require("drizzle-orm")));
                const { MarketingService } = await Promise.resolve().then(() => __importStar(require("@/services/marketing.service")));
                const db = getDb();
                const merchant = await db.query.merchants.findFirst({
                    where: eq(schema.merchants.id, merchantId),
                    columns: {
                        email: true,
                        emailSmtpSettings: true,
                        emailBrevoSettings: true,
                        emailDeliveryMode: true,
                        name: true,
                    },
                });
                merchantName = merchant?.name || null;
                merchantEmail = merchant?.email || null;
                const mode = String(merchant?.emailDeliveryMode || "platform").toLowerCase();
                useOwnDelivery = mode === "own";
                const smtp = MarketingService.normalizeSmtp(merchant?.emailSmtpSettings || null);
                const smtpHasCreds = !!(String(smtp.host || "").trim() && String(smtp.fromEmail || "").trim());
                const smtpReady = smtp.enabled && smtpHasCreds;
                // Keep filled SMTP as fallback even if the merchant chose platform delivery.
                if (smtpHasCreds)
                    merchantSmtpFallback = smtp;
                if (useOwnDelivery && smtpReady) {
                    const reply = this.merchantReplyTo(merchant?.name, merchant?.email, smtp.fromEmail);
                    return {
                        provider: "smtp",
                        apiKey: "",
                        fromEmail: String(smtp.fromEmail).trim(),
                        fromName: this.merchantSenderName(merchant?.name),
                        replyToEmail: reply.replyToEmail,
                        replyToName: reply.replyToName,
                        source: "merchant_smtp",
                        smtp,
                        merchantId,
                    };
                }
                if (useOwnDelivery) {
                    const brevo = MarketingService.normalizeBrevo(merchant?.emailBrevoSettings || null);
                    if (brevo.enabled &&
                        brevo.apiKey &&
                        brevo.fromEmail &&
                        String(brevo.apiKey).trim() &&
                        String(brevo.fromEmail).trim()) {
                        const reply = this.merchantReplyTo(merchant?.name, merchant?.email, brevo.fromEmail);
                        return {
                            provider: "brevo",
                            apiKey: String(brevo.apiKey).trim(),
                            fromEmail: String(brevo.fromEmail).trim(),
                            fromName: this.merchantSenderName(merchant?.name),
                            replyToEmail: reply.replyToEmail,
                            replyToName: reply.replyToName,
                            source: "merchant_brevo",
                            merchantId,
                        };
                    }
                }
            }
            catch {
                /* continue to platform */
            }
        }
        const platformReply = merchantId && merchantEmail
            ? this.merchantReplyTo(merchantName, merchantEmail, null)
            : { replyToEmail: null, replyToName: "Shop" };
        let dbApiKey = "";
        let dbFromEmail = "";
        let dbFromName = "";
        let mailcoConfigured = false;
        let mailcoCreds = null;
        let brevoCreds = null;
        let emailPrimary = "mailco";
        let mailcoFromDb = false;
        let brevoFromDb = false;
        try {
            const { PlatformSettingsService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-settings.service")));
            emailPrimary = await PlatformSettingsService.getPlatformEmailPrimary();
            const mailcoSettings = await PlatformSettingsService.getMailcoSettings();
            mailcoFromDb = !!mailcoSettings.apiKey?.trim();
            try {
                mailcoCreds = await PlatformSettingsService.resolveMailcoCredentials();
                mailcoConfigured = true;
            }
            catch {
                mailcoConfigured = false;
            }
            const s = await PlatformSettingsService.getBrevoSettings();
            brevoFromDb = !!s.apiKey?.trim();
            dbApiKey = (s.apiKey || "").trim();
            dbFromEmail = (s.fromEmail || "").trim();
            dbFromName = (s.fromName || "").trim();
            try {
                brevoCreds = await PlatformSettingsService.resolveBrevoCredentials();
            }
            catch {
                brevoCreds = null;
            }
        }
        catch {
            /* platform settings table may be unavailable */
        }
        const envBrevoKey = this.envBrevoApiKey();
        const brevoConfigured = !!(brevoCreds ||
            (dbApiKey || envBrevoKey) && (dbFromEmail || this.envFromAddress()));
        const fromName = merchantId
            ? this.merchantSenderName(merchantName)
            : dbFromName || this.envFromName();
        const buildBrevoConfig = () => {
            const apiKey = brevoCreds?.apiKey || dbApiKey || envBrevoKey;
            const fromEmail = brevoCreds?.fromEmail || dbFromEmail || this.envFromAddress();
            const resolvedFromName = merchantId ? fromName : brevoCreds?.fromName || dbFromName || this.envFromName();
            if (!apiKey || !fromEmail)
                return null;
            const source = brevoFromDb || dbApiKey
                ? "database"
                : envBrevoKey || process.env.SENDGRID_API_KEY
                    ? "env"
                    : "none";
            return {
                provider: "brevo",
                apiKey,
                fromEmail,
                fromName: resolvedFromName,
                replyToEmail: merchantId ? platformReply.replyToEmail : null,
                replyToName: merchantId ? platformReply.replyToName : resolvedFromName,
                source,
                merchantId,
            };
        };
        const buildMailcoConfig = () => {
            if (!mailcoConfigured || !mailcoCreds)
                return null;
            const source = mailcoFromDb ? "database" : "env";
            const fallback = brevoConfigured ? buildBrevoConfig() : null;
            return {
                provider: "mailco",
                apiKey: mailcoCreds.apiKey,
                fromEmail: mailcoCreds.fromEmail,
                fromName: merchantId ? fromName : mailcoCreds.fromName,
                replyToEmail: merchantId ? platformReply.replyToEmail : null,
                replyToName: merchantId ? platformReply.replyToName : mailcoCreds.fromName,
                source,
                merchantId,
                mailco: {
                    apiBase: mailcoCreds.apiBase,
                    templateSlug: mailcoCreds.templateSlug,
                },
                fallbackBrevo: fallback
                    ? {
                        apiKey: fallback.apiKey,
                        fromEmail: fallback.fromEmail,
                        fromName: fallback.fromName,
                    }
                    : null,
            };
        };
        const preferMailco = emailPrimary !== "brevo";
        const mailcoCfg = buildMailcoConfig();
        const brevoCfg = buildBrevoConfig();
        const withSmtpFallback = (cfg) => merchantSmtpFallback ? { ...cfg, fallbackSmtp: merchantSmtpFallback } : cfg;
        const smtpFromMerchant = () => {
            if (!merchantSmtpFallback || !merchantId)
                return null;
            const reply = this.merchantReplyTo(merchantName, merchantEmail, merchantSmtpFallback.fromEmail);
            return {
                provider: "smtp",
                apiKey: "",
                fromEmail: String(merchantSmtpFallback.fromEmail).trim(),
                fromName: this.merchantSenderName(merchantName),
                replyToEmail: reply.replyToEmail,
                replyToName: reply.replyToName,
                source: "merchant_smtp",
                smtp: merchantSmtpFallback,
                merchantId,
            };
        };
        if (preferMailco && mailcoCfg) {
            return withSmtpFallback(mailcoCfg);
        }
        if (brevoCfg) {
            return withSmtpFallback(brevoCfg);
        }
        if (mailcoCfg) {
            return withSmtpFallback(mailcoCfg);
        }
        const smtpCfg = smtpFromMerchant();
        if (smtpCfg)
            return smtpCfg;
        if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
            return withSmtpFallback({
                provider: "sendgrid",
                apiKey: process.env.SENDGRID_API_KEY,
                fromEmail: process.env.SENDGRID_FROM_EMAIL,
                fromName: fromName || "Reborn",
                source: brevoFromDb || mailcoFromDb ? "database" : "env",
                merchantId,
            });
        }
        return withSmtpFallback({
            provider: null,
            apiKey: "",
            fromEmail: dbFromEmail || this.envFromAddress(),
            fromName,
            source: "none",
            merchantId,
        });
    }
    static async isConfigured(merchantId) {
        const cfg = await this.resolveConfig(merchantId);
        return cfg.provider !== null || !!cfg.fallbackSmtp;
    }
    /** Roll daily/monthly counters for the current Zurich calendar periods. */
    static rollBrevoCounters(raw) {
        // Inline normalize to avoid circular import with MarketingService.
        const s = {
            enabled: !!raw?.enabled,
            apiKey: raw?.apiKey != null ? String(raw.apiKey) : "",
            fromEmail: String(raw?.fromEmail || "").trim(),
            fromName: String(raw?.fromName || "").trim(),
            dailyLimit: raw?.dailyLimit != null && Number(raw.dailyLimit) > 0
                ? Math.min(Math.round(Number(raw.dailyLimit)), 10000000)
                : null,
            monthlyLimit: raw?.monthlyLimit != null && Number(raw.monthlyLimit) > 0
                ? Math.min(Math.round(Number(raw.monthlyLimit)), 10000000)
                : null,
            dailySent: Math.max(0, Math.round(Number(raw?.dailySent) || 0)),
            dailyPeriod: raw?.dailyPeriod ? String(raw.dailyPeriod).slice(0, 10) : null,
            monthlySent: Math.max(0, Math.round(Number(raw?.monthlySent) || 0)),
            monthlyPeriod: raw?.monthlyPeriod ? String(raw.monthlyPeriod).slice(0, 7) : null,
        };
        const day = zurichYmd();
        const month = zurichYm();
        if (s.dailyPeriod !== day) {
            s.dailyPeriod = day;
            s.dailySent = 0;
        }
        if (s.monthlyPeriod !== month) {
            s.monthlyPeriod = month;
            s.monthlySent = 0;
        }
        return s;
    }
    static async getMerchantBrevoUsage(merchantId) {
        const { getDb, schema } = await Promise.resolve().then(() => __importStar(require("@/db")));
        const { eq } = await Promise.resolve().then(() => __importStar(require("drizzle-orm")));
        const { MarketingService } = await Promise.resolve().then(() => __importStar(require("@/services/marketing.service")));
        const db = getDb();
        const merchant = await db.query.merchants.findFirst({
            where: eq(schema.merchants.id, merchantId),
            columns: { emailBrevoSettings: true },
        });
        const rolled = this.rollBrevoCounters(merchant?.emailBrevoSettings || null);
        // Persist roll if period changed so UI stays honest.
        const prev = MarketingService.normalizeBrevo(merchant?.emailBrevoSettings || null);
        if (prev.dailyPeriod !== rolled.dailyPeriod ||
            prev.monthlyPeriod !== rolled.monthlyPeriod) {
            await db
                .update(schema.merchants)
                .set({ emailBrevoSettings: rolled, updatedAt: new Date() })
                .where(eq(schema.merchants.id, merchantId));
        }
        let account = null;
        const key = (rolled.apiKey || "").trim();
        if (key) {
            try {
                account = await this.fetchBrevoAccount(key);
            }
            catch (e) {
                account = { error: e?.message || "Could not load Brevo account" };
            }
        }
        return {
            ...MarketingService.getBrevoPublic(rolled),
            dailyRemaining: rolled.dailyLimit != null
                ? Math.max(0, rolled.dailyLimit - (rolled.dailySent || 0))
                : null,
            monthlyRemaining: rolled.monthlyLimit != null
                ? Math.max(0, rolled.monthlyLimit - (rolled.monthlySent || 0))
                : null,
            account,
        };
    }
    static async fetchBrevoAccount(apiKey) {
        const res = await axios_1.default.get("https://api.brevo.com/v3/account", {
            headers: {
                "api-key": apiKey,
                Accept: "application/json",
            },
            timeout: 15000,
        });
        const data = res.data || {};
        const plans = Array.isArray(data.plan) ? data.plan : [];
        const creditPlan = plans.find((p) => p?.creditsType === "sendLimit" || p?.type === "subscription") ||
            plans[0] ||
            null;
        return {
            email: data.email ? String(data.email) : undefined,
            companyName: data.companyName ? String(data.companyName) : undefined,
            planCredits: creditPlan?.credits != null && Number.isFinite(Number(creditPlan.credits))
                ? Number(creditPlan.credits)
                : null,
            planCreditsType: creditPlan?.creditsType ? String(creditPlan.creditsType) : null,
            planType: creditPlan?.type ? String(creditPlan.type) : null,
        };
    }
    static async assertMerchantBrevoLimits(merchantId) {
        const { getDb, schema } = await Promise.resolve().then(() => __importStar(require("@/db")));
        const { eq } = await Promise.resolve().then(() => __importStar(require("drizzle-orm")));
        const db = getDb();
        const merchant = await db.query.merchants.findFirst({
            where: eq(schema.merchants.id, merchantId),
            columns: { emailBrevoSettings: true },
        });
        const s = this.rollBrevoCounters(merchant?.emailBrevoSettings || null);
        if (s.dailyLimit != null && (s.dailySent || 0) >= s.dailyLimit) {
            throw new Error(`Daily Brevo limit reached (${s.dailySent}/${s.dailyLimit}). Raise the limit in Settings → Email or try tomorrow.`);
        }
        if (s.monthlyLimit != null && (s.monthlySent || 0) >= s.monthlyLimit) {
            throw new Error(`Monthly Brevo limit reached (${s.monthlySent}/${s.monthlyLimit}). Raise the limit in Settings → Email.`);
        }
    }
    static async incrementMerchantBrevoUsage(merchantId, by = 1) {
        const { getDb, schema } = await Promise.resolve().then(() => __importStar(require("@/db")));
        const { eq } = await Promise.resolve().then(() => __importStar(require("drizzle-orm")));
        const db = getDb();
        const merchant = await db.query.merchants.findFirst({
            where: eq(schema.merchants.id, merchantId),
            columns: { emailBrevoSettings: true },
        });
        const s = this.rollBrevoCounters(merchant?.emailBrevoSettings || null);
        s.dailySent = (s.dailySent || 0) + by;
        s.monthlySent = (s.monthlySent || 0) + by;
        await db
            .update(schema.merchants)
            .set({ emailBrevoSettings: s, updatedAt: new Date() })
            .where(eq(schema.merchants.id, merchantId));
    }
    static async status(merchantId) {
        const cfg = await this.resolveConfig(merchantId);
        let apiKeyMasked = "";
        let apiKeySet = false;
        let mailcoPublic = null;
        try {
            const { PlatformSettingsService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-settings.service")));
            const pub = await PlatformSettingsService.getBrevoSettingsPublic();
            apiKeyMasked = pub.apiKeyMasked;
            apiKeySet = pub.apiKeySet;
            mailcoPublic = await PlatformSettingsService.getMailcoSettingsPublic();
            if (cfg.provider === "mailco" && mailcoPublic.apiKeySet) {
                apiKeyMasked = mailcoPublic.apiKeyMasked;
                apiKeySet = mailcoPublic.apiKeySet;
            }
        }
        catch {
            apiKeySet = !!(cfg.apiKey || this.envBrevoApiKey() || process.env.SENDGRID_API_KEY);
        }
        let merchantBrevo = null;
        if (merchantId) {
            try {
                merchantBrevo = await this.getMerchantBrevoUsage(merchantId);
                if (cfg.source === "merchant_brevo" && merchantBrevo.apiKeyMasked) {
                    apiKeyMasked = merchantBrevo.apiKeyMasked;
                    apiKeySet = merchantBrevo.apiKeySet;
                }
            }
            catch {
                merchantBrevo = null;
            }
        }
        return {
            configured: cfg.provider !== null || !!cfg.fallbackSmtp,
            provider: cfg.provider,
            fromEmail: cfg.fromEmail,
            fromName: cfg.fromName,
            source: cfg.source,
            apiKeySet,
            apiKeyMasked,
            brevoKeySet: cfg.source === "merchant_brevo" ||
                cfg.provider === "brevo" ||
                !!this.envBrevoApiKey() ||
                apiKeySet,
            mailcoKeySet: !!mailcoPublic?.apiKeySet,
            mailcoConfigured: !!mailcoPublic?.configured,
            platformEmailPrimary: mailcoPublic?.emailPrimary || "mailco",
            sendgridKeySet: !!process.env.SENDGRID_API_KEY,
            smtpEnabled: cfg.provider === "smtp",
            usingPlatformEmail: cfg.source === "database" || cfg.source === "env" || cfg.source === "none",
            merchantBrevo,
        };
    }
    static async send(input) {
        let cfg = await this.resolveConfig(input.merchantId);
        if (!cfg.provider && cfg.fallbackSmtp) {
            const reply = this.merchantReplyTo(null, input.to, cfg.fallbackSmtp.fromEmail);
            cfg = {
                ...cfg,
                provider: "smtp",
                fromEmail: String(cfg.fallbackSmtp.fromEmail).trim(),
                source: "merchant_smtp",
                smtp: cfg.fallbackSmtp,
                replyToEmail: cfg.replyToEmail || reply.replyToEmail,
            };
        }
        if (!cfg.provider) {
            throw new Error("Email is not configured. Configure platform mailco or Brevo in Superadmin → Settings, or add SMTP/Brevo in Settings → Email.");
        }
        const emailType = input.emailType || "general";
        const { EmailUsageService } = await Promise.resolve().then(() => __importStar(require("@/services/email-usage.service")));
        const hasAttachments = !!(input.attachments && input.attachments.length > 0);
        // mailco relay API is template-based; use Brevo when attachments are required.
        if (cfg.provider === "mailco" && hasAttachments && cfg.fallbackBrevo) {
            cfg = {
                ...cfg,
                provider: "brevo",
                apiKey: cfg.fallbackBrevo.apiKey,
                fromEmail: cfg.fallbackBrevo.fromEmail,
                fromName: cfg.fallbackBrevo.fromName,
            };
        }
        const logAndSend = async (activeCfg) => {
            if (activeCfg.provider === "smtp") {
                await this.sendViaSmtp(activeCfg, input);
            }
            else if (activeCfg.provider === "brevo") {
                if (activeCfg.source === "merchant_brevo" && activeCfg.merchantId) {
                    await this.assertMerchantBrevoLimits(activeCfg.merchantId);
                }
                await this.sendViaBrevo(activeCfg, input);
                if (activeCfg.source === "merchant_brevo" && activeCfg.merchantId) {
                    try {
                        await this.incrementMerchantBrevoUsage(activeCfg.merchantId, 1);
                    }
                    catch (e) {
                        console.warn("[email] failed to increment Brevo usage", e);
                    }
                }
            }
            else if (activeCfg.provider === "mailco") {
                await this.sendViaMailco(activeCfg, input);
            }
            else if (activeCfg.provider === "sendgrid") {
                mail_1.default.setApiKey(activeCfg.apiKey);
                await mail_1.default.send({
                    to: input.to,
                    from: activeCfg.fromEmail,
                    replyTo: this.formatReplyTo(activeCfg),
                    subject: input.subject,
                    html: input.html,
                    text: input.text || input.html.replace(/<[^>]+>/g, " "),
                    attachments: (input.attachments || []).map((a) => ({
                        filename: a.filename,
                        content: (Buffer.isBuffer(a.content)
                            ? a.content
                            : Buffer.from(String(a.content))).toString("base64"),
                        type: a.contentType,
                        disposition: "attachment",
                    })),
                });
            }
        };
        try {
            try {
                await logAndSend(cfg);
            }
            catch (primaryError) {
                let recovered = false;
                if (cfg.provider === "mailco" && cfg.fallbackBrevo && !hasAttachments) {
                    try {
                        const brevoCfg = {
                            ...cfg,
                            provider: "brevo",
                            apiKey: cfg.fallbackBrevo.apiKey,
                            fromEmail: cfg.fallbackBrevo.fromEmail,
                            fromName: cfg.fallbackBrevo.fromName,
                        };
                        await logAndSend(brevoCfg);
                        cfg = brevoCfg;
                        recovered = true;
                    }
                    catch {
                        /* try merchant SMTP next */
                    }
                }
                if (!recovered && cfg.fallbackSmtp && cfg.provider !== "smtp") {
                    const smtpCfg = {
                        ...cfg,
                        provider: "smtp",
                        fromEmail: String(cfg.fallbackSmtp.fromEmail).trim(),
                        source: "merchant_smtp",
                        smtp: cfg.fallbackSmtp,
                    };
                    await logAndSend(smtpCfg);
                    cfg = smtpCfg;
                    recovered = true;
                }
                if (!recovered)
                    throw primaryError;
            }
            await EmailUsageService.logSend({
                merchantId: input.merchantId || cfg.merchantId,
                provider: cfg.provider,
                source: cfg.source,
                emailType,
                recipient: input.to,
                subject: input.subject,
                status: "sent",
            });
        }
        catch (error) {
            await EmailUsageService.logSend({
                merchantId: input.merchantId || cfg.merchantId,
                provider: cfg.provider,
                source: cfg.source,
                emailType,
                recipient: input.to,
                subject: input.subject,
                status: "failed",
                error: error?.message || "Send failed",
            });
            throw error;
        }
    }
    static formatReplyTo(cfg) {
        const email = String(cfg.replyToEmail || "").trim();
        if (!email)
            return undefined;
        const name = String(cfg.replyToName || cfg.fromName || "").trim();
        return name ? `"${name}" <${email}>` : email;
    }
    static async sendViaSmtp(cfg, input) {
        const smtp = cfg.smtp || {};
        const port = Number(smtp.port) || (smtp.secure ? 465 : 587);
        const transporter = nodemailer_1.default.createTransport({
            host: String(smtp.host || "").trim(),
            port,
            secure: !!smtp.secure || port === 465,
            auth: smtp.user || smtp.password
                ? {
                    user: String(smtp.user || "").trim(),
                    pass: String(smtp.password || ""),
                }
                : undefined,
        });
        await transporter.sendMail({
            from: `"${cfg.fromName || "Shop"}" <${cfg.fromEmail}>`,
            to: input.to,
            replyTo: this.formatReplyTo(cfg),
            subject: input.subject,
            html: input.html,
            text: input.text || input.html.replace(/<[^>]+>/g, " "),
            attachments: (input.attachments || []).map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType,
            })),
        });
    }
    static async sendViaMailco(cfg, input) {
        const mailco = cfg.mailco;
        if (!mailco) {
            throw new Error("mailco configuration is missing");
        }
        const text = input.text || input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const idempotencyKey = (0, crypto_1.randomUUID)();
        const replyTo = cfg.replyToEmail
            ? [{ email: cfg.replyToEmail, name: cfg.replyToName || cfg.fromName || undefined }]
            : undefined;
        try {
            await axios_1.default.post(`${mailco.apiBase}/messages`, {
                from: {
                    email: cfg.fromEmail,
                    name: cfg.fromName || "Reborn",
                },
                to: [{ email: input.to }],
                ...(replyTo ? { reply_to: replyTo } : {}),
                template: mailco.templateSlug,
                data: {
                    subject: input.subject,
                    html: input.html,
                    text,
                },
                metadata: {
                    email_type: String(input.emailType || "general"),
                    merchant_id: cfg.merchantId ? String(cfg.merchantId) : "",
                },
            }, {
                headers: {
                    Authorization: `Bearer ${cfg.apiKey}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "Idempotency-Key": idempotencyKey,
                },
                timeout: 20000,
                validateStatus: (status) => status >= 200 && status < 300,
            });
        }
        catch (error) {
            const data = error?.response?.data;
            const detail = (typeof data === "object" && data !== null
                ? data.message ||
                    data.code
                : null) ||
                (typeof data === "string" ? data : null) ||
                error?.message ||
                "mailco send failed";
            throw new Error(typeof detail === "string" ? detail : "mailco send failed");
        }
    }
    static async sendViaBrevo(cfg, input) {
        try {
            const attachment = (input.attachments || []).map((a) => ({
                name: a.filename,
                content: Buffer.isBuffer(a.content)
                    ? a.content.toString("base64")
                    : Buffer.from(String(a.content)).toString("base64"),
            }));
            await axios_1.default.post("https://api.brevo.com/v3/smtp/email", {
                sender: {
                    name: cfg.fromName || "Reborn",
                    email: cfg.fromEmail,
                },
                to: [{ email: input.to }],
                ...(cfg.replyToEmail
                    ? {
                        replyTo: {
                            email: cfg.replyToEmail,
                            name: cfg.replyToName || cfg.fromName || undefined,
                        },
                    }
                    : {}),
                subject: input.subject,
                htmlContent: input.html,
                textContent: input.text || input.html.replace(/<[^>]+>/g, " "),
                ...(attachment.length ? { attachment } : {}),
            }, {
                headers: {
                    "api-key": cfg.apiKey,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                timeout: 20000,
            });
        }
        catch (error) {
            const detail = error?.response?.data?.message ||
                error?.response?.data?.error ||
                (typeof error?.response?.data === "string" ? error.response.data : null) ||
                error?.message ||
                "Brevo send failed";
            throw new Error(typeof detail === "string" ? detail : "Brevo send failed");
        }
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.service.js.map