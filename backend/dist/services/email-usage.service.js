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
exports.EmailUsageService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
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
function zurichDayStart(ymd) {
    return new Date(`${ymd}T00:00:00+01:00`);
}
function zurichDayEnd(ymd) {
    return new Date(`${ymd}T23:59:59.999+01:00`);
}
function zurichMonthStart(ym) {
    return new Date(`${ym}-01T00:00:00+01:00`);
}
function zurichMonthEnd(ym) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return new Date(`${ym}-${String(last).padStart(2, "0")}T23:59:59.999+01:00`);
}
class EmailUsageService {
    static async ensureTable() {
        const { ensureMerchantTables } = await Promise.resolve().then(() => __importStar(require("@/lib/ensure-merchant-schema")));
        await ensureMerchantTables();
    }
    static async logSend(input) {
        try {
            await this.ensureTable();
            const db = (0, db_1.getDb)();
            await db.insert(db_1.schema.emailSendLog).values({
                merchantId: input.merchantId || null,
                provider: input.provider,
                source: input.source,
                emailType: input.emailType || "general",
                recipient: String(input.recipient || "").slice(0, 255),
                subject: input.subject ? String(input.subject).slice(0, 500) : null,
                status: input.status,
                error: input.error || null,
            });
        }
        catch (err) {
            console.warn("[email-usage] failed to log send", err);
        }
    }
    static async getPlatformUsageSummary() {
        await this.ensureTable();
        const db = (0, db_1.getDb)();
        const day = zurichYmd();
        const month = zurichYm();
        const dayStart = zurichDayStart(day);
        const dayEnd = zurichDayEnd(day);
        const monthStart = zurichMonthStart(month);
        const monthEnd = zurichMonthEnd(month);
        const platformSources = ["database", "env"];
        const platformFilter = (0, drizzle_orm_1.sql) `${db_1.schema.emailSendLog.source} IN ('database', 'env')`;
        const sentFilter = (0, drizzle_orm_1.eq)(db_1.schema.emailSendLog.status, "sent");
        const [todayRow] = await db
            .select({ n: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.emailSendLog)
            .where((0, drizzle_orm_1.and)(platformFilter, sentFilter, (0, drizzle_orm_1.gte)(db_1.schema.emailSendLog.createdAt, dayStart), (0, drizzle_orm_1.lte)(db_1.schema.emailSendLog.createdAt, dayEnd)));
        const [monthRow] = await db
            .select({ n: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.emailSendLog)
            .where((0, drizzle_orm_1.and)(platformFilter, sentFilter, (0, drizzle_orm_1.gte)(db_1.schema.emailSendLog.createdAt, monthStart), (0, drizzle_orm_1.lte)(db_1.schema.emailSendLog.createdAt, monthEnd)));
        const [totalRow] = await db
            .select({ n: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.emailSendLog)
            .where((0, drizzle_orm_1.and)(platformFilter, sentFilter));
        const byType = await db
            .select({
            emailType: db_1.schema.emailSendLog.emailType,
            count: (0, drizzle_orm_1.count)(),
        })
            .from(db_1.schema.emailSendLog)
            .where((0, drizzle_orm_1.and)(platformFilter, sentFilter, (0, drizzle_orm_1.gte)(db_1.schema.emailSendLog.createdAt, monthStart), (0, drizzle_orm_1.lte)(db_1.schema.emailSendLog.createdAt, monthEnd)))
            .groupBy(db_1.schema.emailSendLog.emailType)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)()));
        const byMerchant = await db
            .select({
            merchantId: db_1.schema.emailSendLog.merchantId,
            merchantName: db_1.schema.merchants.name,
            count: (0, drizzle_orm_1.count)(),
        })
            .from(db_1.schema.emailSendLog)
            .leftJoin(db_1.schema.merchants, (0, drizzle_orm_1.eq)(db_1.schema.emailSendLog.merchantId, db_1.schema.merchants.id))
            .where((0, drizzle_orm_1.and)(platformFilter, sentFilter, (0, drizzle_orm_1.gte)(db_1.schema.emailSendLog.createdAt, monthStart), (0, drizzle_orm_1.lte)(db_1.schema.emailSendLog.createdAt, monthEnd)))
            .groupBy(db_1.schema.emailSendLog.merchantId, db_1.schema.merchants.name)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)()))
            .limit(50);
        const { PlatformSettingsService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-settings.service")));
        const brevoPublic = await PlatformSettingsService.getBrevoSettingsPublic();
        let account = null;
        if (brevoPublic.apiKeySet) {
            try {
                const s = await PlatformSettingsService.getBrevoSettings();
                const key = (s.apiKey || "").trim() ||
                    process.env.BREVO_API_KEY ||
                    process.env.SENDINBLUE_API_KEY ||
                    "";
                if (key) {
                    const { EmailService } = await Promise.resolve().then(() => __importStar(require("@/services/email.service")));
                    account = await EmailService.fetchBrevoAccount(key);
                }
            }
            catch (e) {
                account = { error: e?.message || "Could not load Brevo account" };
            }
        }
        return {
            period: { day, month },
            platformSources,
            today: Number(todayRow?.n || 0),
            thisMonth: Number(monthRow?.n || 0),
            allTime: Number(totalRow?.n || 0),
            byType: byType.map((r) => ({
                emailType: r.emailType,
                count: Number(r.count || 0),
            })),
            byMerchant: byMerchant.map((r) => ({
                merchantId: r.merchantId,
                merchantName: r.merchantName || "(platform)",
                count: Number(r.count || 0),
            })),
            brevo: brevoPublic,
            account,
        };
    }
    static async getMerchantPlatformUsage(merchantId) {
        await this.ensureTable();
        const db = (0, db_1.getDb)();
        const day = zurichYmd();
        const month = zurichYm();
        const dayStart = zurichDayStart(day);
        const dayEnd = zurichDayEnd(day);
        const monthStart = zurichMonthStart(month);
        const monthEnd = zurichMonthEnd(month);
        const platformFilter = (0, drizzle_orm_1.sql) `${db_1.schema.emailSendLog.source} IN ('database', 'env')`;
        const sentFilter = (0, drizzle_orm_1.eq)(db_1.schema.emailSendLog.status, "sent");
        const merchantFilter = (0, drizzle_orm_1.eq)(db_1.schema.emailSendLog.merchantId, merchantId);
        const [todayRow] = await db
            .select({ n: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.emailSendLog)
            .where((0, drizzle_orm_1.and)(merchantFilter, platformFilter, sentFilter, (0, drizzle_orm_1.gte)(db_1.schema.emailSendLog.createdAt, dayStart), (0, drizzle_orm_1.lte)(db_1.schema.emailSendLog.createdAt, dayEnd)));
        const [monthRow] = await db
            .select({ n: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.emailSendLog)
            .where((0, drizzle_orm_1.and)(merchantFilter, platformFilter, sentFilter, (0, drizzle_orm_1.gte)(db_1.schema.emailSendLog.createdAt, monthStart), (0, drizzle_orm_1.lte)(db_1.schema.emailSendLog.createdAt, monthEnd)));
        return {
            period: { day, month },
            today: Number(todayRow?.n || 0),
            thisMonth: Number(monthRow?.n || 0),
        };
    }
}
exports.EmailUsageService = EmailUsageService;
//# sourceMappingURL=email-usage.service.js.map