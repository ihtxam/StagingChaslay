import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { merchantHasSmsLicense, readSmsAddonState } from "@/lib/sms-addon";
import {
  EsendexClient,
  resolveEsendexCredentials,
  type EsendexCredentials,
} from "@/lib/esendex-client";
import { isSmsStopKeyword, normalizeE164 } from "@/lib/sms-phone";
import {
  eventEnabled,
  gsmSegmentCount,
  normalizeSmsSettings,
  renderSmsTemplate,
  type SmsEventKey,
  type SmsSettings,
  type SmsTemplateVars,
} from "@/lib/sms-templates";
import { smsPeriodYm, smsQuotaSnapshot, smsTierAllowance } from "@/lib/sms-tiers";
import { PlatformSettingsService } from "@/services/platform-settings.service";

export type SmsMessageType = "otp" | "transactional" | "marketing";

export type SmsSendRequest = {
  merchantId: string;
  to: string;
  type: SmsMessageType;
  event: string;
  body?: string;
  templateKey?: SmsEventKey | "otpLogin" | "otpSignup";
  vars?: SmsTemplateVars;
  customerId?: string | null;
  campaignId?: string | null;
  requireMarketingOptIn?: boolean;
  skipEventToggle?: boolean;
};

export type SmsSendOutcome =
  | {
      ok: true;
      status: "sent";
      id: string;
      providerId: string | null;
      remaining: number;
    }
  | {
      ok: false;
      status: "failed" | "skipped";
      reason: string;
      remaining?: number;
      id?: string;
    };

async function loadMerchantSms(merchantId: string) {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: {
      id: true,
      name: true,
      country: true,
      smsAddonEnabled: true,
      smsTier: true,
      smsSettings: true,
    },
  });
  return merchant;
}

export class SmsService {
  static async ensureSchema() {
    const { ensureSmsAddonColumns } = await import("@/lib/ensure-merchant-schema");
    await ensureSmsAddonColumns();
  }

  static async isLicensed(merchantId: string): Promise<boolean> {
    return merchantHasSmsLicense(merchantId);
  }

  static async settingsFor(merchantId: string): Promise<SmsSettings> {
    const merchant = await loadMerchantSms(merchantId);
    return normalizeSmsSettings(merchant?.smsSettings);
  }

  static async resolveCredentials(merchantOriginator?: string | null): Promise<EsendexCredentials | null> {
    let platform: Awaited<ReturnType<typeof PlatformSettingsService.getEsendexSettings>> | null = null;
    try {
      platform = await PlatformSettingsService.getEsendexSettings();
    } catch {
      platform = null;
    }
    return resolveEsendexCredentials({
      user: platform?.user,
      password: platform?.password,
      apiKey: platform?.apiKey,
      accountRef: platform?.accountRef,
      originator: merchantOriginator || platform?.originator,
    });
  }

  static async usage(merchantId: string) {
    await this.ensureSchema();
    const state = await readSmsAddonState(merchantId);
    const periodYm = smsPeriodYm();
    const db = getDb();
    const [row] = await db
      .select({
        sentCount: schema.smsUsage.sentCount,
        failedCount: schema.smsUsage.failedCount,
      })
      .from(schema.smsUsage)
      .where(and(eq(schema.smsUsage.merchantId, merchantId), eq(schema.smsUsage.periodYm, periodYm)))
      .limit(1);
    const sent = Number(row?.sentCount || 0);
    const allowance = smsTierAllowance(state.tier);
    return {
      enabled: state.enabled,
      ...smsQuotaSnapshot({ tier: state.tier, sent, at: new Date() }),
      failed: Number(row?.failedCount || 0),
    };
  }

  /**
   * Atomically consume one SMS from the monthly allowance.
   * Returns remaining after consume, or null if over quota.
   */
  static async consumeQuota(merchantId: string): Promise<{ remaining: number; sent: number } | null> {
    await this.ensureSchema();
    const state = await readSmsAddonState(merchantId);
    const allowance = smsTierAllowance(state.tier);
    const periodYm = smsPeriodYm();
    const db = getDb();
    const result = await db.execute(sql`
      INSERT INTO sms_usage (merchant_id, period_ym, sent_count, failed_count, updated_at)
      VALUES (${merchantId}, ${periodYm}, 1, 0, NOW())
      ON CONFLICT (merchant_id, period_ym)
      DO UPDATE SET
        sent_count = sms_usage.sent_count + 1,
        updated_at = NOW()
      WHERE sms_usage.sent_count < ${allowance}
      RETURNING sent_count
    `);
    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: Array<{ sent_count?: number; sentCount?: number }> }).rows ?? []);
    const sent = Number(rows[0]?.sent_count ?? rows[0]?.sentCount);
    if (!Number.isFinite(sent) || sent < 1) return null;
    return { sent, remaining: Math.max(0, allowance - sent) };
  }

  static async refundQuota(merchantId: string) {
    const periodYm = smsPeriodYm();
    const db = getDb();
    await db.execute(sql`
      UPDATE sms_usage
      SET sent_count = GREATEST(sent_count - 1, 0),
          failed_count = failed_count + 1,
          updated_at = NOW()
      WHERE merchant_id = ${merchantId} AND period_ym = ${periodYm}
    `);
  }

  static async send(req: SmsSendRequest): Promise<SmsSendOutcome> {
    await this.ensureSchema();
    const licensed = await this.isLicensed(req.merchantId);
    if (!licensed) {
      return { ok: false, status: "skipped", reason: "addon_off" };
    }

    const merchant = await loadMerchantSms(req.merchantId);
    if (!merchant) return { ok: false, status: "skipped", reason: "merchant_not_found" };
    const settings = normalizeSmsSettings(merchant.smsSettings);
    const phone = normalizeE164(req.to, settings.defaultCountry || merchant.country || "CH");
    if (!phone.ok) return { ok: false, status: "skipped", reason: phone.error };

    if (req.type === "transactional" && !req.skipEventToggle) {
      const eventKey = req.templateKey && req.templateKey in settings.events
        ? (req.templateKey as SmsEventKey)
        : null;
      if (eventKey && !eventEnabled(settings, eventKey)) {
        return { ok: false, status: "skipped", reason: "event_disabled" };
      }
    }

    if (req.requireMarketingOptIn || req.type === "marketing") {
      const opted = await this.hasMarketingSmsOptIn(req.merchantId, phone.e164, req.customerId);
      if (!opted) return { ok: false, status: "skipped", reason: "no_marketing_opt_in" };
    }

    const body = sanitizeOutgoing(
      req.body ||
        (req.templateKey
          ? renderSmsTemplate(settings.templates[req.templateKey], {
              shopName: merchant.name || "Shop",
              ...req.vars,
            })
          : "")
    );
    if (!body) return { ok: false, status: "skipped", reason: "empty_body" };

    const creds = await this.resolveCredentials(settings.senderName);
    if (!creds) return { ok: false, status: "skipped", reason: "esendex_not_configured" };

    const quota = await this.consumeQuota(req.merchantId);
    if (!quota) {
      const usage = await this.usage(req.merchantId);
      const db = getDb();
      const [row] = await db
        .insert(schema.smsMessages)
        .values({
          merchantId: req.merchantId,
          customerId: req.customerId || null,
          campaignId: req.campaignId || null,
          toE164: phone.e164,
          type: req.type,
          event: req.event,
          body,
          segments: gsmSegmentCount(body),
          status: "failed",
          error: "quota_exceeded",
        })
        .returning({ id: schema.smsMessages.id });
      return {
        ok: false,
        status: "failed",
        reason: "quota_exceeded",
        remaining: usage.remaining,
        id: row?.id,
      };
    }

    const db = getDb();
    const [row] = await db
      .insert(schema.smsMessages)
      .values({
        merchantId: req.merchantId,
        customerId: req.customerId || null,
        campaignId: req.campaignId || null,
        toE164: phone.e164,
        type: req.type,
        event: req.event,
        body,
        segments: gsmSegmentCount(body),
        status: "queued",
      })
      .returning({ id: schema.smsMessages.id });

    const client = new EsendexClient(creds);
    const result = await client.sendSms({
      to: phone.e164,
      body,
      originator: settings.senderName || creds.originator,
    });

    if (!result.ok) {
      await this.refundQuota(req.merchantId);
      if (row?.id) {
        await db
          .update(schema.smsMessages)
          .set({
            status: "failed",
            error: `${result.code}: ${result.message}`.slice(0, 500),
            updatedAt: new Date(),
          })
          .where(eq(schema.smsMessages.id, row.id));
      }
      return {
        ok: false,
        status: "failed",
        reason: result.code,
        remaining: quota.remaining + 1,
        id: row?.id,
      };
    }

    if (row?.id) {
      await db
        .update(schema.smsMessages)
        .set({
          status: "sent",
          providerId: result.providerId,
          providerBatchId: result.batchId,
          updatedAt: new Date(),
        })
        .where(eq(schema.smsMessages.id, row.id));
    }

    return {
      ok: true,
      status: "sent",
      id: row?.id || "",
      providerId: result.providerId,
      remaining: quota.remaining,
    };
  }

  static async sendTransactional(
    merchantId: string,
    event: SmsEventKey,
    to: string | null | undefined,
    vars: SmsTemplateVars,
    customerId?: string | null
  ): Promise<SmsSendOutcome> {
    if (!to) return { ok: false, status: "skipped", reason: "no_phone" };
    try {
      return await this.send({
        merchantId,
        to,
        type: "transactional",
        event,
        templateKey: event,
        vars,
        customerId,
      });
    } catch (err) {
      console.warn("[sms] transactional send failed", event, err);
      return { ok: false, status: "failed", reason: err instanceof Error ? err.message : "send_failed" };
    }
  }

  static async hasMarketingSmsOptIn(
    merchantId: string,
    phoneE164: string,
    customerId?: string | null
  ): Promise<boolean> {
    const db = getDb();
    if (customerId) {
      const row = await db.query.customers.findFirst({
        where: and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)),
        columns: { marketingSmsOptIn: true },
      });
      return row?.marketingSmsOptIn === true;
    }
    const rows = await db.query.customers.findMany({
      where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.phone, phoneE164)),
      columns: { marketingSmsOptIn: true, phone: true },
      limit: 20,
    });
    if (rows.some((r) => r.marketingSmsOptIn === true)) return true;
    const all = await db.query.customers.findMany({
      where: eq(schema.customers.merchantId, merchantId),
      columns: { marketingSmsOptIn: true, phone: true },
    });
    return all.some((r) => {
      if (r.marketingSmsOptIn !== true || !r.phone) return false;
      const n = normalizeE164(r.phone);
      return n.ok && n.e164 === phoneE164;
    });
  }

  static async setMarketingSmsOptIn(merchantId: string, phoneRaw: string, optIn: boolean) {
    await this.ensureSchema();
    const settings = await this.settingsFor(merchantId);
    const phone = normalizeE164(phoneRaw, settings.defaultCountry);
    if (!phone.ok) return { updated: 0 };
    const db = getDb();
    const customers = await db.query.customers.findMany({
      where: eq(schema.customers.merchantId, merchantId),
      columns: { id: true, phone: true },
    });
    let updated = 0;
    for (const c of customers) {
      const n = normalizeE164(c.phone, settings.defaultCountry);
      if (!n.ok || n.e164 !== phone.e164) continue;
      await db
        .update(schema.customers)
        .set({ marketingSmsOptIn: optIn, updatedAt: new Date() })
        .where(eq(schema.customers.id, c.id));
      updated += 1;
    }
    return { updated };
  }

  static async honorInboundStop(from: string, body: string, merchantId?: string | null) {
    if (!isSmsStopKeyword(body)) return { stopped: false };
    if (merchantId) {
      await this.setMarketingSmsOptIn(merchantId, from, false);
      return { stopped: true };
    }
    const db = getDb();
    const merchants = await db.query.merchants.findMany({
      columns: { id: true },
      where: eq(schema.merchants.smsAddonEnabled, true),
    });
    for (const m of merchants) {
      await this.setMarketingSmsOptIn(m.id, from, false);
    }
    return { stopped: true };
  }

  static async processInbox(merchantId?: string) {
    const creds = await this.resolveCredentials();
    if (!creds) return { processed: 0 };
    const client = new EsendexClient(creds);
    const inbox = await client.listInbox();
    let processed = 0;
    for (const msg of inbox) {
      if (!msg.from || !isSmsStopKeyword(msg.body)) continue;
      await this.honorInboundStop(msg.from, msg.body, merchantId);
      processed += 1;
    }
    return { processed, inboxCount: inbox.length };
  }

  static async listMessages(merchantId: string, limit = 50) {
    await this.ensureSchema();
    const db = getDb();
    return db.query.smsMessages.findMany({
      where: eq(schema.smsMessages.merchantId, merchantId),
      orderBy: [desc(schema.smsMessages.createdAt)],
      limit: Math.min(200, Math.max(1, limit)),
    });
  }

  static async updateSettings(merchantId: string, raw: unknown) {
    await this.ensureSchema();
    const next = normalizeSmsSettings(raw);
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ smsSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return next;
  }

  static async overview(merchantId: string) {
    const [usage, settings, licensed] = await Promise.all([
      this.usage(merchantId),
      this.settingsFor(merchantId),
      this.isLicensed(merchantId),
    ]);
    const creds = await this.resolveCredentials(settings.senderName);
    return {
      licensed,
      configured: !!creds,
      usage,
      settings,
      tiers: (await import("@/lib/sms-tiers")).SMS_TIERS,
    };
  }
}

function sanitizeOutgoing(body: string): string {
  return String(body || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 612);
}
