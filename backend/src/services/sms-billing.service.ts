import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  formatSmsBillChf,
  formatSmsUnitPriceChf,
  normalizeSmsUnitPriceCents,
  smsBillableCents,
} from "@/lib/sms-billing";
import { readSmsUnitPriceCents } from "@/lib/sms-addon";
import { smsPeriodYm } from "@/lib/sms-tiers";

export type SmsBillingMessageRow = {
  id: string;
  createdAt: string;
  toE164: string;
  type: string;
  event: string;
  segments: number;
  status: string;
  billableCents: number;
};

export type SmsBillingReport = {
  merchantId: string;
  merchantName: string;
  periodYm: string;
  unitPriceCents: number;
  unitPriceChf: string;
  sentCount: number;
  segmentsBilled: number;
  billableCents: number;
  billableChf: string;
  messages: SmsBillingMessageRow[];
};

function parseMonth(month: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || "").trim());
  if (!m) throw new Error("Invalid month (use YYYY-MM)");
  const year = Number(m[1]);
  const monthIndex = Number(m[2]);
  if (monthIndex < 1 || monthIndex > 12) throw new Error("Invalid month");
  return {
    start: new Date(Date.UTC(year, monthIndex - 1, 1)),
    end: new Date(Date.UTC(year, monthIndex, 1)),
  };
}

export class SmsBillingService {
  static currentPeriodYm(): string {
    return smsPeriodYm();
  }

  static async recordSuccessfulSend(
    merchantId: string,
    segments: number,
    unitPriceCents?: number
  ): Promise<void> {
    const unit = unitPriceCents ?? (await readSmsUnitPriceCents(merchantId));
    const segs = Math.max(1, Math.floor(Number(segments) || 1));
    const cents = smsBillableCents(segs, unit);
    const periodYm = smsPeriodYm();
    const db = getDb();
    await db.execute(sql`
      INSERT INTO sms_usage (merchant_id, period_ym, sent_count, failed_count, segments_billed, billable_cents, updated_at)
      VALUES (${merchantId}, ${periodYm}, 1, 0, ${segs}, ${cents}, NOW())
      ON CONFLICT (merchant_id, period_ym)
      DO UPDATE SET
        sent_count = sms_usage.sent_count + 1,
        segments_billed = sms_usage.segments_billed + ${segs},
        billable_cents = sms_usage.billable_cents + ${cents},
        updated_at = NOW()
    `);
  }

  static async recordFailedSend(merchantId: string): Promise<void> {
    const periodYm = smsPeriodYm();
    const db = getDb();
    await db.execute(sql`
      INSERT INTO sms_usage (merchant_id, period_ym, sent_count, failed_count, segments_billed, billable_cents, updated_at)
      VALUES (${merchantId}, ${periodYm}, 0, 1, 0, 0, NOW())
      ON CONFLICT (merchant_id, period_ym)
      DO UPDATE SET
        failed_count = sms_usage.failed_count + 1,
        updated_at = NOW()
    `);
  }

  static async getMonthlyReport(merchantId: string, month?: string): Promise<SmsBillingReport> {
    const periodYm = month?.trim() || smsPeriodYm();
    const { start, end } = parseMonth(periodYm);
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true, name: true, smsUnitPriceCents: true },
    });
    if (!merchant) throw new Error("Merchant not found");
    const unitPriceCents = normalizeSmsUnitPriceCents(merchant.smsUnitPriceCents);

    const rows = await db
      .select({
        id: schema.smsMessages.id,
        createdAt: schema.smsMessages.createdAt,
        toE164: schema.smsMessages.toE164,
        type: schema.smsMessages.type,
        event: schema.smsMessages.event,
        segments: schema.smsMessages.segments,
        status: schema.smsMessages.status,
      })
      .from(schema.smsMessages)
      .where(
        and(
          eq(schema.smsMessages.merchantId, merchantId),
          eq(schema.smsMessages.status, "sent"),
          gte(schema.smsMessages.createdAt, start),
          lt(schema.smsMessages.createdAt, end)
        )
      )
      .orderBy(asc(schema.smsMessages.createdAt));

    let segmentsBilled = 0;
    let billableCents = 0;
    const messages: SmsBillingMessageRow[] = rows.map((row) => {
      const segs = Math.max(1, Number(row.segments) || 1);
      const cents = smsBillableCents(segs, unitPriceCents);
      segmentsBilled += segs;
      billableCents += cents;
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        toE164: row.toE164,
        type: row.type,
        event: row.event,
        segments: segs,
        status: row.status,
        billableCents: cents,
      };
    });

    const [usageRow] = await db
      .select({
        sentCount: schema.smsUsage.sentCount,
        segmentsBilled: schema.smsUsage.segmentsBilled,
        billableCents: schema.smsUsage.billableCents,
      })
      .from(schema.smsUsage)
      .where(
        and(eq(schema.smsUsage.merchantId, merchantId), eq(schema.smsUsage.periodYm, periodYm))
      )
      .limit(1);

    const sentCount = Math.max(messages.length, Number(usageRow?.sentCount || 0));
    if (usageRow && Number(usageRow.billableCents) > 0) {
      segmentsBilled = Number(usageRow.segmentsBilled) || segmentsBilled;
      billableCents = Number(usageRow.billableCents) || billableCents;
    }

    return {
      merchantId,
      merchantName: merchant.name,
      periodYm,
      unitPriceCents,
      unitPriceChf: formatSmsUnitPriceChf(unitPriceCents),
      sentCount,
      segmentsBilled,
      billableCents,
      billableChf: formatSmsBillChf(billableCents),
      messages,
    };
  }

  static async listAddonMerchantsBilling(month?: string) {
    const periodYm = month?.trim() || smsPeriodYm();
    const db = getDb();
    const merchants = await db.query.merchants.findMany({
      where: eq(schema.merchants.smsAddonEnabled, true),
      columns: {
        id: true,
        name: true,
        slug: true,
        smsUnitPriceCents: true,
        smsTier: true,
      },
      orderBy: [asc(schema.merchants.name)],
    });

    const reports = await Promise.all(
      merchants.map(async (m) => {
        const summary = await this.getMonthlyReport(m.id, periodYm);
        return {
          merchantId: m.id,
          merchantName: m.name,
          slug: m.slug,
          smsTier: m.smsTier,
          unitPriceCents: summary.unitPriceCents,
          unitPriceChf: summary.unitPriceChf,
          sentCount: summary.sentCount,
          segmentsBilled: summary.segmentsBilled,
          billableCents: summary.billableCents,
          billableChf: summary.billableChf,
        };
      })
    );

    const totalBillableCents = reports.reduce((sum, r) => sum + r.billableCents, 0);
    return {
      periodYm,
      totalBillableCents,
      totalBillableChf: formatSmsBillChf(totalBillableCents),
      merchants: reports,
    };
  }
}
