import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ensureMerchantTables } from "@/lib/ensure-merchant-schema";

export type DriverPayMode = "hourly" | "per_order" | "both";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function zurichDayBounds(ymd: string): { start: Date; end: Date } {
  const start = new Date(`${ymd}T00:00:00+01:00`);
  const end = new Date(`${ymd}T23:59:59.999+01:00`);
  return { start, end };
}

function ymdInZurich(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export class DeliveryDriverPayService {
  static async ensureSchema() {
    await ensureMerchantTables();
  }

  static resolvePayMode(raw: string | null | undefined): DriverPayMode {
    if (raw === "hourly" || raw === "per_order") return raw;
    return "both";
  }

  static async getPayConfig(merchantId: string, staffId: string) {
    await this.ensureSchema();
    const db = getDb();
    const [merchant, staff] = await Promise.all([
      db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: {
          deliveryDriverPayMode: true,
          deliveryDriverHourlyRate: true,
          deliveryPerOrderFee: true,
        },
      }),
      db.query.merchantStaff.findFirst({
        where: and(
          eq(schema.merchantStaff.id, staffId),
          eq(schema.merchantStaff.merchantId, merchantId)
        ),
        columns: {
          deliveryHourlyRateOverride: true,
          deliveryPerOrderFeeOverride: true,
        },
      }),
    ]);
    const hourlyRate =
      staff?.deliveryHourlyRateOverride != null
        ? num(staff.deliveryHourlyRateOverride)
        : num(merchant?.deliveryDriverHourlyRate);
    const perOrderFee =
      staff?.deliveryPerOrderFeeOverride != null
        ? num(staff.deliveryPerOrderFeeOverride)
        : num(merchant?.deliveryPerOrderFee);
    return {
      payMode: this.resolvePayMode(merchant?.deliveryDriverPayMode),
      hourlyRate,
      perOrderFee,
    };
  }

  /** Open shift when driver starts GPS tracking (one open shift per staff). */
  static async startShift(merchantId: string, staffId: string) {
    await this.ensureSchema();
    const db = getDb();
    const open = await db.query.deliveryDriverShifts.findFirst({
      where: and(
        eq(schema.deliveryDriverShifts.merchantId, merchantId),
        eq(schema.deliveryDriverShifts.staffId, staffId),
        isNull(schema.deliveryDriverShifts.endedAt)
      ),
      orderBy: [desc(schema.deliveryDriverShifts.startedAt)],
    });
    if (open) return open;
    const [row] = await db
      .insert(schema.deliveryDriverShifts)
      .values({ merchantId, staffId, startedAt: new Date() })
      .returning();
    return row!;
  }

  static async endShift(merchantId: string, staffId: string) {
    await this.ensureSchema();
    const db = getDb();
    const open = await db.query.deliveryDriverShifts.findFirst({
      where: and(
        eq(schema.deliveryDriverShifts.merchantId, merchantId),
        eq(schema.deliveryDriverShifts.staffId, staffId),
        isNull(schema.deliveryDriverShifts.endedAt)
      ),
      orderBy: [desc(schema.deliveryDriverShifts.startedAt)],
    });
    if (!open) return null;
    const now = new Date();
    await db
      .update(schema.deliveryDriverShifts)
      .set({ endedAt: now })
      .where(eq(schema.deliveryDriverShifts.id, open.id));
    return { ...open, endedAt: now };
  }

  static async getDailySummary(merchantId: string, staffId: string, dateYmd?: string) {
    await this.ensureSchema();
    const db = getDb();
    const day = dateYmd || ymdInZurich();
    const { start, end } = zurichDayBounds(day);
    const config = await this.getPayConfig(merchantId, staffId);

    const shifts = await db.query.deliveryDriverShifts.findMany({
      where: and(
        eq(schema.deliveryDriverShifts.merchantId, merchantId),
        eq(schema.deliveryDriverShifts.staffId, staffId),
        gte(schema.deliveryDriverShifts.startedAt, start),
        lte(schema.deliveryDriverShifts.startedAt, end)
      ),
    });

    const now = Date.now();
    let hoursWorked = 0;
    for (const s of shifts) {
      const from = s.startedAt ? new Date(s.startedAt).getTime() : now;
      const to = s.endedAt ? new Date(s.endedAt).getTime() : now;
      hoursWorked += Math.max(0, (to - from) / 3600000);
    }
    hoursWorked = round2(hoursWorked);

    const completed = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.fulfillmentChannel, "delivery"),
        eq(schema.orders.assignedDeliveryStaffId, staffId),
        eq(schema.orders.status, "completed"),
        gte(schema.orders.completedAt, start),
        lte(schema.orders.completedAt, end)
      ),
      columns: {
        id: true,
        orderNumber: true,
        total: true,
        completedAt: true,
        customerName: true,
        shippingAddress: true,
      },
      orderBy: [desc(schema.orders.completedAt)],
      limit: 100,
    });

    const deliveryCount = completed.length;
    const hourlyPay =
      config.payMode === "per_order" ? 0 : round2(hoursWorked * config.hourlyRate);
    const orderPay =
      config.payMode === "hourly" ? 0 : round2(deliveryCount * config.perOrderFee);
    const totalPay = round2(hourlyPay + orderPay);

    return {
      date: day,
      payMode: config.payMode,
      hourlyRate: config.hourlyRate,
      perOrderFee: config.perOrderFee,
      hoursWorked,
      deliveryCount,
      hourlyPay,
      orderPay,
      totalPay,
      completedOrders: completed.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: num(o.total),
        completedAt: o.completedAt ? new Date(o.completedAt).toISOString() : null,
        customerName: o.customerName,
        shippingAddress: o.shippingAddress,
      })),
    };
  }
}
