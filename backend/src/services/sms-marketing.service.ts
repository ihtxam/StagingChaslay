import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SmsService } from "@/services/sms.service";
import { normalizeE164 } from "@/lib/sms-phone";
import { renderSmsTemplate, sanitizeSmsTemplate } from "@/lib/sms-templates";

export type SmsAudienceRow = {
  id: string | null;
  phone: string;
  name: string;
  email: string | null;
  marketingSmsOptIn: boolean;
};

export class SmsMarketingService {
  static async listAudience(merchantId: string): Promise<SmsAudienceRow[]> {
    await SmsService.ensureSchema();
    const settings = await SmsService.settingsFor(merchantId);
    const db = getDb();
    const rows = await db.query.customers.findMany({
      where: eq(schema.customers.merchantId, merchantId),
      columns: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
        marketingSmsOptIn: true,
      },
    });
    const byPhone = new Map<string, SmsAudienceRow>();
    for (const c of rows) {
      if (c.marketingSmsOptIn !== true) continue;
      const n = normalizeE164(c.phone, settings.defaultCountry);
      if (!n.ok) continue;
      byPhone.set(n.e164, {
        id: c.id,
        phone: n.display,
        name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || n.display,
        email: c.email || null,
        marketingSmsOptIn: true,
      });
    }
    return Array.from(byPhone.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  static async listCampaigns(merchantId: string) {
    await SmsService.ensureSchema();
    const db = getDb();
    return db.query.smsCampaigns.findMany({
      where: eq(schema.smsCampaigns.merchantId, merchantId),
      orderBy: [desc(schema.smsCampaigns.createdAt)],
    });
  }

  static async saveCampaign(
    merchantId: string,
    input: {
      id?: string;
      title?: string;
      body?: string;
      audience?: "all" | "selected";
      selectedPhones?: string[];
    }
  ) {
    await SmsService.ensureSchema();
    const licensed = await SmsService.isLicensed(merchantId);
    if (!licensed) throw new Error("SMS addon is not enabled");
    const db = getDb();
    const title = String(input.title || "SMS campaign").trim().slice(0, 200) || "SMS campaign";
    const body = sanitizeSmsTemplate(input.body);
    if (!body) throw new Error("Message is required");
    const audience = input.audience === "selected" ? "selected" : "all";
    const selectedPhones = Array.isArray(input.selectedPhones)
      ? input.selectedPhones.map((p) => String(p).trim()).filter(Boolean).slice(0, 2000)
      : null;

    if (input.id) {
      const existing = await db.query.smsCampaigns.findFirst({
        where: and(eq(schema.smsCampaigns.id, input.id), eq(schema.smsCampaigns.merchantId, merchantId)),
      });
      if (!existing) throw new Error("Campaign not found");
      const [updated] = await db
        .update(schema.smsCampaigns)
        .set({
          title,
          body,
          audience,
          selectedPhones,
          updatedAt: new Date(),
        })
        .where(eq(schema.smsCampaigns.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(schema.smsCampaigns)
      .values({
        merchantId,
        title,
        body,
        audience,
        selectedPhones,
      })
      .returning();
    return created;
  }

  static async sendCampaign(
    merchantId: string,
    campaignId: string,
    options?: { audience?: "all" | "selected"; selectedPhones?: string[] }
  ) {
    const licensed = await SmsService.isLicensed(merchantId);
    if (!licensed) throw new Error("SMS addon is not enabled");

    const db = getDb();
    const campaign = await db.query.smsCampaigns.findFirst({
      where: and(eq(schema.smsCampaigns.id, campaignId), eq(schema.smsCampaigns.merchantId, merchantId)),
    });
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sending") throw new Error("Already sending");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { name: true },
    });
    const settings = await SmsService.settingsFor(merchantId);
    const audienceMode = options?.audience === "selected" || campaign.audience === "selected" ? "selected" : "all";
    const selected = options?.selectedPhones?.length
      ? options.selectedPhones
      : campaign.selectedPhones || [];

    const audience = await this.listAudience(merchantId);
    let recipients = audience;
    if (audienceMode === "selected") {
      const wanted = new Set(
        selected
          .map((p) => normalizeE164(p, settings.defaultCountry))
          .filter((n): n is { ok: true; e164: string; display: string } => n.ok)
          .map((n) => n.e164)
      );
      recipients = audience.filter((r) => {
        const n = normalizeE164(r.phone, settings.defaultCountry);
        return n.ok && wanted.has(n.e164);
      });
    }
    if (!recipients.length) {
      throw new Error(
        audienceMode === "selected"
          ? "No opted-in recipients selected"
          : "No customers have opted in to marketing SMS"
      );
    }

    await db
      .update(schema.smsCampaigns)
      .set({
        status: "sending",
        audience: audienceMode,
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(schema.smsCampaigns.id, campaignId));

    const footer = settings.templates.marketingFooter;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const r of recipients) {
      const body = [renderSmsTemplate(campaign.body, {
        firstName: r.name.split(" ")[0] || r.name,
        shopName: merchant?.name || "Shop",
      }), footer]
        .filter(Boolean)
        .join(" ");
      const result = await SmsService.send({
        merchantId,
        to: r.phone,
        type: "marketing",
        event: "marketing",
        body,
        customerId: r.id,
        campaignId,
        requireMarketingOptIn: true,
      });
      if (result.ok) sent += 1;
      else if (result.reason === "quota_exceeded") {
        failed += 1;
        skipped += recipients.length - sent - failed;
        break;
      } else if (result.status === "skipped") skipped += 1;
      else failed += 1;
    }

    const [updated] = await db
      .update(schema.smsCampaigns)
      .set({
        status: failed && !sent ? "failed" : "sent",
        sentCount: sent,
        failedCount: failed,
        skippedCount: skipped,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.smsCampaigns.id, campaignId))
      .returning();

    return updated;
  }
}
