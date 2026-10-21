import { getDb, schema } from "@/db";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  isCountableSale,
  resolveReportRange,
  type ReportPreset,
} from "@/services/pos-reports.service";

export type ProfitGranularity = "day" | "week" | "month";

export type ProfitRow = {
  id: string;
  label: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number | null;
  avgSalePrice: number | null;
  avgBuyingPrice: number | null;
  previousRevenue?: number;
  previousProfit?: number;
  revenueChangePct?: number | null;
  profitChangePct?: number | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function money(n: unknown) {
  return Number(n) || 0;
}

function marginPct(revenue: number, profit: number): number | null {
  if (revenue <= 0.0005) return profit > 0 ? 100 : null;
  return round2((profit / revenue) * 100);
}

function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return round2(((current - previous) / previous) * 100);
}

function ymdInZurich(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function weekStartYmd(ymd: string): string {
  const { start } = zurichDayBounds(ymd);
  const day = start.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(start.getTime() - diff * 24 * 3600_000);
  return ymdInZurich(monday);
}

function zurichDayBounds(ymd: string): { start: Date; end: Date } {
  const start = new Date(`${ymd}T00:00:00+02:00`);
  const end = new Date(`${ymd}T23:59:59.999+02:00`);
  return { start, end };
}

function periodKey(iso: Date | string | null | undefined, granularity: ProfitGranularity): string {
  const d = iso ? new Date(iso) : new Date();
  const ymd = ymdInZurich(d);
  if (granularity === "day") return ymd;
  if (granularity === "month") return ymd.slice(0, 7);
  return weekStartYmd(ymd);
}

function periodLabel(key: string, granularity: ProfitGranularity): string {
  if (granularity === "month") return key;
  if (granularity === "week") return `Week from ${key}`;
  return key;
}

type LineAgg = { qty: number; revenue: number; cogs: number };

function addLine(
  map: Map<string, LineAgg & { label?: string }>,
  key: string,
  label: string,
  keptQty: number,
  lineRevenue: number,
  lineCogs: number
) {
  const row = map.get(key) || { label, qty: 0, revenue: 0, cogs: 0 };
  row.qty += keptQty;
  row.revenue += lineRevenue;
  row.cogs += lineCogs;
  if (!row.label) row.label = label;
  map.set(key, row);
}

function toProfitRows(
  map: Map<string, LineAgg & { label?: string }>,
  previous?: Map<string, { revenue: number; profit: number }>
): ProfitRow[] {
  return [...map.entries()]
    .map(([id, row]) => {
      const revenue = round2(row.revenue);
      const cogs = round2(row.cogs);
      const profit = round2(revenue - cogs);
      const prev = previous?.get(id);
      return {
        id,
        label: row.label || id,
        quantity: round2(row.qty),
        revenue,
        cogs,
        profit,
        marginPct: marginPct(revenue, profit),
        avgSalePrice: row.qty > 0 ? round2(revenue / row.qty) : null,
        avgBuyingPrice: row.qty > 0 ? round2(cogs / row.qty) : null,
        previousRevenue: prev ? round2(prev.revenue) : undefined,
        previousProfit: prev ? round2(prev.profit) : undefined,
        revenueChangePct:
          prev !== undefined ? changePct(revenue, prev.revenue) : undefined,
        profitChangePct: prev !== undefined ? changePct(profit, prev.profit) : undefined,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

type AggregateOpts = {
  merchantId: string;
  start: Date;
  end: Date;
  staffId?: string | null;
  locationId?: string | null;
  productCosts: Map<string, number>;
  productCategory: Map<string, string | null>;
  categoryName: Map<string, string>;
};

async function aggregateSales(opts: AggregateOpts) {
  const db = getDb();
  const conditions = [
    eq(schema.orders.merchantId, opts.merchantId),
    gte(schema.orders.createdAt, opts.start),
    lte(schema.orders.createdAt, opts.end),
  ];
  if (opts.locationId) conditions.push(eq(schema.orders.locationId, opts.locationId));
  if (opts.staffId) conditions.push(eq(schema.orders.staffId, opts.staffId));

  const rows = await db.query.orders.findMany({
    where: and(...conditions),
    with: { items: true },
  });
  const completed = rows.filter((o) => isCountableSale(o));

  const productMap = new Map<string, LineAgg & { label?: string }>();
  const categoryMap = new Map<string, LineAgg & { label?: string }>();

  let totalRevenue = 0;
  let totalCogs = 0;
  let linesWithCost = 0;
  let linesMissingCost = 0;

  for (const o of completed) {
    for (const item of o.items || []) {
      const qty = money(item.quantity);
      const refundedQty = money(item.refundedQuantity);
      const keptQty = Math.max(0, qty - refundedQty);
      if (keptQty <= 0.0005) continue;
      const unit = qty > 0 ? money(item.totalPrice) / qty : 0;
      const lineRevenue = unit * keptQty;
      const unitCost = item.productId ? opts.productCosts.get(item.productId) || 0 : 0;
      const lineCogs = unitCost * keptQty;
      if (item.productId && unitCost > 0) linesWithCost += 1;
      else if (item.productId) linesMissingCost += 1;

      totalRevenue += lineRevenue;
      totalCogs += lineCogs;

      const pid = item.productId || item.productName || "unknown";
      const pLabel = item.productName || "Item";
      addLine(productMap, String(pid), pLabel, keptQty, lineRevenue, lineCogs);

      const catId = item.productId ? opts.productCategory.get(item.productId) : null;
      const catKey = catId || "uncategorized";
      const catLabel = catId ? opts.categoryName.get(catId) || "Category" : "Uncategorized";
      addLine(categoryMap, catKey, catLabel, keptQty, lineRevenue, lineCogs);
    }
  }

  return {
    orderCount: completed.length,
    totalRevenue: round2(totalRevenue),
    totalCogs: round2(totalCogs),
    totalProfit: round2(totalRevenue - totalCogs),
    marginPct: marginPct(totalRevenue, totalRevenue - totalCogs),
    linesWithCost,
    linesMissingCost,
    productMap,
    categoryMap,
    orders: completed,
  };
}

function aggregateByPeriod(
  orders: Array<{ createdAt: Date | null; items: Array<typeof schema.orderItems.$inferSelect> }>,
  granularity: ProfitGranularity,
  productCosts: Map<string, number>
) {
  const periodMap = new Map<string, LineAgg & { label?: string }>();
  for (const o of orders) {
    const key = periodKey(o.createdAt, granularity);
    for (const item of o.items || []) {
      const qty = money(item.quantity);
      const refundedQty = money(item.refundedQuantity);
      const keptQty = Math.max(0, qty - refundedQty);
      if (keptQty <= 0.0005) continue;
      const unit = qty > 0 ? money(item.totalPrice) / qty : 0;
      const lineRevenue = unit * keptQty;
      const unitCost = item.productId ? productCosts.get(item.productId) || 0 : 0;
      addLine(periodMap, key, periodLabel(key, granularity), keptQty, lineRevenue, unitCost * keptQty);
    }
  }
  return periodMap;
}

function resolveGranularity(
  preset: ReportPreset,
  requested?: string
): ProfitGranularity {
  const g = String(requested || "").toLowerCase();
  if (g === "day" || g === "week" || g === "month") return g;
  if (preset === "last_3_months" || preset === "last_month") return "month";
  if (preset === "this_month") return "week";
  if (preset === "last_week") return "day";
  return "day";
}

export class ProfitMarginService {
  static async getProfitMarginReport(
    merchantId: string,
    opts: {
      preset?: ReportPreset;
      from?: string;
      to?: string;
      staffId?: string | null;
      locationId?: string | null;
      granularity?: string;
    }
  ) {
    const preset = opts.preset || "today";
    const range = resolveReportRange(preset, opts.from, opts.to);
    const granularity = resolveGranularity(preset, opts.granularity);

    const db = getDb();
    const products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      columns: { id: true, categoryId: true, name: true, cost: true, price: true },
    });
    const productCosts = new Map<string, number>();
    const productCategory = new Map<string, string | null>();
    for (const p of products) {
      productCategory.set(p.id, p.categoryId);
      const c = money(p.cost);
      if (c > 0) productCosts.set(p.id, c);
    }
    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
      columns: { id: true, name: true },
    });
    const categoryName = new Map(categories.map((c) => [c.id, c.name || "Category"]));

    const current = await aggregateSales({
      merchantId,
      start: range.start,
      end: range.end,
      staffId: opts.staffId,
      locationId: opts.locationId,
      productCosts,
      productCategory,
      categoryName,
    });

    const msPerDay = 24 * 3600_000;
    const spanDays = Math.max(
      1,
      Math.round((range.end.getTime() - range.start.getTime()) / msPerDay) + 1
    );
    const prevEnd = new Date(range.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanDays * msPerDay + 1);
    const previous = await aggregateSales({
      merchantId,
      start: prevStart,
      end: prevEnd,
      staffId: opts.staffId,
      locationId: opts.locationId,
      productCosts,
      productCategory,
      categoryName,
    });

    const prevProduct = new Map(
      [...previous.productMap.entries()].map(([id, row]) => [
        id,
        { revenue: row.revenue, profit: row.revenue - row.cogs },
      ])
    );
    const prevCategory = new Map(
      [...previous.categoryMap.entries()].map(([id, row]) => [
        id,
        { revenue: row.revenue, profit: row.revenue - row.cogs },
      ])
    );

    const periodMap = aggregateByPeriod(current.orders, granularity, productCosts);

    const catalogPricing = products
      .map((p) => {
        const sale = money(p.price);
        const buy = money(p.cost);
        if (sale <= 0 && buy <= 0) return null;
        const profitUnit = sale - buy;
        return {
          id: p.id,
          name: p.name,
          salePrice: round2(sale),
          buyingPrice: buy > 0 ? round2(buy) : null,
          unitProfit: round2(profitUnit),
          marginPct: sale > 0 ? marginPct(sale, profitUnit) : null,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      salePrice: number;
      buyingPrice: number | null;
      unitProfit: number;
      marginPct: number | null;
    }>;

    return {
      range: { label: range.label, from: range.from, to: range.to, preset },
      previousRange: {
        from: ymdInZurich(prevStart),
        to: ymdInZurich(prevEnd),
        label: `${ymdInZurich(prevStart)} to ${ymdInZurich(prevEnd)}`,
      },
      granularity,
      summary: {
        orderCount: current.orderCount,
        revenue: current.totalRevenue,
        cogs: current.totalCogs,
        profit: current.totalProfit,
        marginPct: current.marginPct,
        revenueChangePct: changePct(current.totalRevenue, previous.totalRevenue),
        profitChangePct: changePct(current.totalProfit, previous.totalProfit),
        productsWithBuyingPrice: productCosts.size,
        catalogProductCount: products.length,
        linesMissingBuyingPrice: current.linesMissingCost,
      },
      byProduct: toProfitRows(current.productMap, prevProduct),
      byCategory: toProfitRows(current.categoryMap, prevCategory),
      byPeriod: toProfitRows(periodMap).sort((a, b) => a.id.localeCompare(b.id)),
      catalogPricing: catalogPricing.sort((a, b) => b.unitProfit - a.unitProfit).slice(0, 200),
    };
  }
}
