import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { EmailSendType } from "@/db/schema";

function zurichYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function zurichYm(d = new Date()): string {
  return zurichYmd(d).slice(0, 7);
}

function zurichDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+01:00`);
}

function zurichDayEnd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+01:00`);
}

function zurichMonthStart(ym: string): Date {
  return new Date(`${ym}-01T00:00:00+01:00`);
}

function zurichMonthEnd(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(`${ym}-${String(last).padStart(2, "0")}T23:59:59.999+01:00`);
}

export type EmailLogInput = {
  merchantId?: string | null;
  provider: string;
  source: string;
  emailType: EmailSendType | string;
  recipient: string;
  subject?: string;
  status: "sent" | "failed";
  error?: string | null;
};

export class EmailUsageService {
  static async ensureTable() {
    const { ensureMerchantTables } = await import("@/lib/ensure-merchant-schema");
    await ensureMerchantTables();
  }

  static async logSend(input: EmailLogInput) {
    try {
      await this.ensureTable();
      const db = getDb();
      await db.insert(schema.emailSendLog).values({
        merchantId: input.merchantId || null,
        provider: input.provider,
        source: input.source,
        emailType: input.emailType || "general",
        recipient: String(input.recipient || "").slice(0, 255),
        subject: input.subject ? String(input.subject).slice(0, 500) : null,
        status: input.status,
        error: input.error || null,
      });
    } catch (err) {
      console.warn("[email-usage] failed to log send", err);
    }
  }

  static async getPlatformUsageSummary() {
    await this.ensureTable();
    const db = getDb();
    const day = zurichYmd();
    const month = zurichYm();
    const dayStart = zurichDayStart(day);
    const dayEnd = zurichDayEnd(day);
    const monthStart = zurichMonthStart(month);
    const monthEnd = zurichMonthEnd(month);

    const platformSources = ["database", "env"];
    const platformFilter = sql`${schema.emailSendLog.source} IN ('database', 'env')`;
    const sentFilter = eq(schema.emailSendLog.status, "sent");

    const [todayRow] = await db
      .select({ n: count() })
      .from(schema.emailSendLog)
      .where(
        and(
          platformFilter,
          sentFilter,
          gte(schema.emailSendLog.createdAt, dayStart),
          lte(schema.emailSendLog.createdAt, dayEnd)
        )
      );

    const [monthRow] = await db
      .select({ n: count() })
      .from(schema.emailSendLog)
      .where(
        and(
          platformFilter,
          sentFilter,
          gte(schema.emailSendLog.createdAt, monthStart),
          lte(schema.emailSendLog.createdAt, monthEnd)
        )
      );

    const [totalRow] = await db
      .select({ n: count() })
      .from(schema.emailSendLog)
      .where(and(platformFilter, sentFilter));

    const byType = await db
      .select({
        emailType: schema.emailSendLog.emailType,
        count: count(),
      })
      .from(schema.emailSendLog)
      .where(
        and(
          platformFilter,
          sentFilter,
          gte(schema.emailSendLog.createdAt, monthStart),
          lte(schema.emailSendLog.createdAt, monthEnd)
        )
      )
      .groupBy(schema.emailSendLog.emailType)
      .orderBy(desc(count()));

    const byMerchant = await db
      .select({
        merchantId: schema.emailSendLog.merchantId,
        merchantName: schema.merchants.name,
        count: count(),
      })
      .from(schema.emailSendLog)
      .leftJoin(schema.merchants, eq(schema.emailSendLog.merchantId, schema.merchants.id))
      .where(
        and(
          platformFilter,
          sentFilter,
          gte(schema.emailSendLog.createdAt, monthStart),
          lte(schema.emailSendLog.createdAt, monthEnd)
        )
      )
      .groupBy(schema.emailSendLog.merchantId, schema.merchants.name)
      .orderBy(desc(count()))
      .limit(50);

    const { PlatformSettingsService } = await import("@/services/platform-settings.service");
    const brevoPublic = await PlatformSettingsService.getBrevoSettingsPublic();

    let account: Awaited<
      ReturnType<typeof import("@/services/email.service").EmailService.fetchBrevoAccount>
    > | null = null;
    if (brevoPublic.apiKeySet) {
      try {
        const s = await PlatformSettingsService.getBrevoSettings();
        const key =
          (s.apiKey || "").trim() ||
          process.env.BREVO_API_KEY ||
          process.env.SENDINBLUE_API_KEY ||
          "";
        if (key) {
          const { EmailService } = await import("@/services/email.service");
          account = await EmailService.fetchBrevoAccount(key);
        }
      } catch (e: any) {
        account = { error: e?.message || "Could not load Brevo account" } as any;
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

  static async getMerchantPlatformUsage(merchantId: string) {
    await this.ensureTable();
    const db = getDb();
    const day = zurichYmd();
    const month = zurichYm();
    const dayStart = zurichDayStart(day);
    const dayEnd = zurichDayEnd(day);
    const monthStart = zurichMonthStart(month);
    const monthEnd = zurichMonthEnd(month);
    const platformFilter = sql`${schema.emailSendLog.source} IN ('database', 'env')`;
    const sentFilter = eq(schema.emailSendLog.status, "sent");
    const merchantFilter = eq(schema.emailSendLog.merchantId, merchantId);

    const [todayRow] = await db
      .select({ n: count() })
      .from(schema.emailSendLog)
      .where(
        and(
          merchantFilter,
          platformFilter,
          sentFilter,
          gte(schema.emailSendLog.createdAt, dayStart),
          lte(schema.emailSendLog.createdAt, dayEnd)
        )
      );

    const [monthRow] = await db
      .select({ n: count() })
      .from(schema.emailSendLog)
      .where(
        and(
          merchantFilter,
          platformFilter,
          sentFilter,
          gte(schema.emailSendLog.createdAt, monthStart),
          lte(schema.emailSendLog.createdAt, monthEnd)
        )
      );

    return {
      period: { day, month },
      today: Number(todayRow?.n || 0),
      thisMonth: Number(monthRow?.n || 0),
    };
  }
}
