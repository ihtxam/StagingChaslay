import { getDb, schema } from "@/db";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  isCountableSale,
  resolveReportRange,
  type ReportPreset,
} from "@/services/pos-reports.service";
import { normalizePaymentMethod, netPaymentBucketsAfterRefund } from "@/lib/payment-breakdown";

type MixRow = {
  id: string;
  label: string;
  quantity: number;
  revenue: number;
  revenueSharePct: number;
  quantitySharePct: number;
  previousRevenue?: number;
  revenueChangePct?: number | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function money(n: unknown) {
  return Number(n) || 0;
}

function sharePct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return round2((part / whole) * 100);
}

function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return round2(((current - previous) / previous) * 100);
}

function zurichHour(iso: Date | string | null | undefined): number {
  if (!iso) return 12;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === "hour")?.value || 12);
}

function daypartId(hour: number): string {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "dinner";
  return "late";
}

const DAYPART_LABELS: Record<string, string> = {
  breakfast: "Breakfast (05–11)",
  lunch: "Lunch (11–15)",
  afternoon: "Afternoon (15–17)",
  dinner: "Dinner (17–22)",
  late: "Late night",
};

function brutOfOrder(o: { total?: unknown; tipAmount?: unknown; refundAmount?: unknown }) {
  const brut = Math.max(0, money(o.total) - money(o.tipAmount));
  const refundAmt = money(o.refundAmount);
  return Math.max(0, brut - Math.min(refundAmt, brut));
}

type AggregateOpts = {
  merchantId: string;
  start: Date;
  end: Date;
  staffId?: string | null;
  locationId?: string | null;
};

async function aggregatePeriod(opts: AggregateOpts) {
  const db = getDb();
  const conditions = [
    eq(schema.orders.merchantId, opts.merchantId),
    gte(schema.orders.createdAt, opts.start),
    lte(schema.orders.createdAt, opts.end),
  ];
  if (opts.locationId) {
    conditions.push(eq(schema.orders.locationId, opts.locationId));
  }
  if (opts.staffId) {
    conditions.push(eq(schema.orders.staffId, opts.staffId));
  }

  const rows = await db.query.orders.findMany({
    where: and(...conditions),
    with: { items: true },
  });

  const completed = rows.filter((o) => isCountableSale(o));

  const products = await db.query.products.findMany({
    where: eq(schema.products.merchantId, opts.merchantId),
    columns: { id: true, categoryId: true, name: true },
  });
  const productCategory = new Map(products.map((p) => [p.id, p.categoryId]));
  const categories = await db.query.categories.findMany({
    where: eq(schema.categories.merchantId, opts.merchantId),
    columns: { id: true, name: true },
  });
  const categoryName = new Map(categories.map((c) => [c.id, c.name || "Category"]));

  let totalRevenue = 0;
  let totalQty = 0;
  const categoryMap = new Map<string, { label: string; qty: number; revenue: number }>();
  const productMap = new Map<string, { label: string; qty: number; revenue: number }>();
  const channelMap = new Map<string, { qty: number; revenue: number }>();
  const sourceMap = new Map<string, { qty: number; revenue: number }>();
  const paymentMap = new Map<string, { qty: number; revenue: number }>();
  const daypartMap = new Map<string, { qty: number; revenue: number }>();

  for (const o of completed) {
    const orderRevenue = brutOfOrder(o);
    totalRevenue += orderRevenue;
    const ch = String(o.fulfillmentChannel || "takeaway");
    const chRow = channelMap.get(ch) || { qty: 0, revenue: 0 };
    chRow.qty += 1;
    chRow.revenue += orderRevenue;
    channelMap.set(ch, chRow);

    const srcKey =
      String(o.orderType || "pos").toLowerCase() === "web_shop"
        ? `web:${String(o.orderSource || "online_shop").toLowerCase()}`
        : `pos:${String(o.orderSource || "pos").toLowerCase()}`;
    const srcRow = sourceMap.get(srcKey) || { qty: 0, revenue: 0 };
    srcRow.qty += 1;
    srcRow.revenue += orderRevenue;
    sourceMap.set(srcKey, srcRow);

    const dp = daypartId(zurichHour(o.createdAt));
    const dpRow = daypartMap.get(dp) || { qty: 0, revenue: 0 };
    dpRow.qty += 1;
    dpRow.revenue += orderRevenue;
    daypartMap.set(dp, dpRow);

    const netBuckets = netPaymentBucketsAfterRefund(
      money(o.total),
      money(o.refundAmount),
      o.paymentBreakdown,
      o.paymentMethod
    );
    for (const [method, net] of netBuckets) {
      if (net <= 0) continue;
      const key = normalizePaymentMethod(method);
      const pRow = paymentMap.get(key) || { qty: 0, revenue: 0 };
      pRow.qty += 1;
      pRow.revenue += net;
      paymentMap.set(key, pRow);
    }

    for (const item of o.items || []) {
      const qty = money(item.quantity);
      const refundedQty = money(item.refundedQuantity);
      const keptQty = Math.max(0, qty - refundedQty);
      if (keptQty <= 0.0005) continue;
      const unit = qty > 0 ? money(item.totalPrice) / qty : 0;
      const lineRevenue = unit * keptQty;
      totalQty += keptQty;

      const pid = item.productId || item.productName || "unknown";
      const pLabel = item.productName || "Item";
      const pRow = productMap.get(String(pid)) || { label: pLabel, qty: 0, revenue: 0 };
      pRow.qty += keptQty;
      pRow.revenue += lineRevenue;
      productMap.set(String(pid), pRow);

      const catId = item.productId ? productCategory.get(item.productId) : null;
      const catKey = catId || "uncategorized";
      const catLabel = catId ? categoryName.get(catId) || "Category" : "Uncategorized";
      const cRow = categoryMap.get(catKey) || { label: catLabel, qty: 0, revenue: 0 };
      cRow.qty += keptQty;
      cRow.revenue += lineRevenue;
      categoryMap.set(catKey, cRow);
    }
  }

  return {
    orderCount: completed.length,
    totalRevenue: round2(totalRevenue),
    totalQty: round2(totalQty),
    categoryMap,
    productMap,
    channelMap,
    sourceMap,
    paymentMap,
    daypartMap,
  };
}

function toMixRows(
  map: Map<string, { label?: string; qty: number; revenue: number }>,
  totalRevenue: number,
  totalQty: number,
  previous?: Map<string, { revenue: number }>,
  labelFromKey?: (key: string, row: { label?: string }) => string
): MixRow[] {
  return [...map.entries()]
    .map(([id, row]) => {
      const label = row.label || labelFromKey?.(id, row) || id;
      const prevRev = previous?.get(id)?.revenue;
      return {
        id,
        label,
        quantity: round2(row.qty),
        revenue: round2(row.revenue),
        revenueSharePct: sharePct(row.revenue, totalRevenue),
        quantitySharePct: sharePct(row.qty, totalQty),
        previousRevenue: prevRev !== undefined ? round2(prevRev) : undefined,
        revenueChangePct:
          prevRev !== undefined ? changePct(row.revenue, prevRev) : undefined,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export class SalesMixService {
  static async getSalesMixReport(
    merchantId: string,
    opts: {
      preset?: ReportPreset;
      from?: string;
      to?: string;
      staffId?: string | null;
      locationId?: string | null;
    }
  ) {
    const preset = opts.preset || "today";
    const range = resolveReportRange(preset, opts.from, opts.to);

    const msPerDay = 24 * 3600_000;
    const spanDays = Math.max(
      1,
      Math.round((range.end.getTime() - range.start.getTime()) / msPerDay) + 1
    );
    const addDaysYmd = (ymd: string, delta: number) => {
      const d = new Date(`${ymd}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + delta);
      return d.toISOString().slice(0, 10);
    };
    const prevTo = addDaysYmd(range.from, -1);
    const prevFrom = addDaysYmd(prevTo, -(spanDays - 1));
    const prevRange = resolveReportRange("custom", prevFrom, prevTo);

    const baseOpts = {
      merchantId,
      staffId: opts.staffId,
      locationId: opts.locationId,
    };

    const current = await aggregatePeriod({
      ...baseOpts,
      start: range.start,
      end: range.end,
    });
    const previous = await aggregatePeriod({
      ...baseOpts,
      start: prevRange.start,
      end: prevRange.end,
    });

    const prevCat = new Map(
      [...previous.categoryMap.entries()].map(([k, v]) => [k, { revenue: v.revenue }])
    );
    const prevProd = new Map(
      [...previous.productMap.entries()].map(([k, v]) => [k, { revenue: v.revenue }])
    );

    const channelLabel = (id: string) => {
      if (id === "dine_in") return "Dine-in";
      if (id === "delivery") return "Delivery";
      return "Takeaway";
    };

    const sourceLabel = (id: string) => {
      const [kind, src] = id.split(":");
      if (kind === "web") return `Online (${src.replace(/_/g, " ")})`;
      return `POS (${src.replace(/_/g, " ")})`;
    };

    return {
      range: {
        preset,
        from: range.from,
        to: range.to,
        label: range.label,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      previousRange: {
        from: prevRange.from,
        to: prevRange.to,
        label: prevRange.label,
      },
      summary: {
        orderCount: current.orderCount,
        revenue: current.totalRevenue,
        itemQuantity: current.totalQty,
        averageOrderValue:
          current.orderCount > 0 ? round2(current.totalRevenue / current.orderCount) : 0,
        previousOrderCount: previous.orderCount,
        previousRevenue: previous.totalRevenue,
        revenueChangePct: changePct(current.totalRevenue, previous.totalRevenue),
        orderCountChangePct: changePct(current.orderCount, previous.orderCount),
      },
      categoryMix: toMixRows(
        new Map(
          [...current.categoryMap.entries()].map(([k, v]) => [k, v])
        ),
        current.totalRevenue,
        current.totalQty,
        prevCat
      ),
      productMix: toMixRows(
        new Map(
          [...current.productMap.entries()].map(([k, v]) => [k, v])
        ),
        current.totalRevenue,
        current.totalQty,
        prevProd
      ).slice(0, 50),
      channelMix: toMixRows(
        current.channelMap,
        current.totalRevenue,
        current.orderCount,
        undefined,
        (id) => channelLabel(id)
      ),
      orderSourceMix: toMixRows(
        current.sourceMap,
        current.totalRevenue,
        current.orderCount,
        undefined,
        (id) => sourceLabel(id)
      ),
      paymentMix: toMixRows(
        current.paymentMap,
        current.totalRevenue,
        current.orderCount
      ),
      daypartMix: toMixRows(
        new Map(
          [...current.daypartMap.entries()].map(([k, v]) => [
            k,
            { label: DAYPART_LABELS[k] || k, ...v },
          ])
        ),
        current.totalRevenue,
        current.orderCount
      ),
    };
  }
}
