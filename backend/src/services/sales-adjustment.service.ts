import { getDb, schema } from "@/db";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { roundMoney2 } from "@/lib/money";
import { zurichDayBounds } from "@/lib/vacation";
import {
  normalizePaymentMethod,
  netPaymentBucketsAfterRefund,
  parsePaymentBreakdown,
  paymentBreakdownTotals,
} from "@/lib/payment-breakdown";
import { resolveReportRange, type ReportPreset } from "@/services/pos-reports.service";

export type SalesAdjustmentPeriodPreset =
  | "today"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export type SalesAdjustmentPreview = {
  periodLabel: string;
  from: string;
  to: string;
  targetPercent: number;
  /** Cash the reports show for this period (all payment buckets). */
  reportCashTotal: number;
  /** Cash on orders this tool can adjust (100% cash, no card/terminal/gift). */
  currentCashTotal: number;
  targetCashTotal: number;
  reductionNeeded: number;
  eligibleOrderCount: number;
  adjustableItemCount: number;
  /** @deprecated use periodLabel */
  monthKey?: string;
};

export type SalesAdjustmentResult = {
  periodLabel: string;
  from: string;
  to: string;
  targetPercent: number;
  beforeCashTotal: number;
  afterCashTotal: number;
  reductionApplied: number;
  ordersAdjusted: number;
  itemsAdjusted: number;
  /** @deprecated use periodLabel */
  monthKey?: string;
};

function validatePercent(targetPercent: number): number {
  const p = Math.round(Number(targetPercent));
  if (!Number.isFinite(p) || p < 1 || p > 99) {
    throw new Error("Target percent must be between 1 and 99");
  }
  return p;
}

function calendarMonthBounds(monthKey: string): { start: Date; end: Date; from: string; to: string; label: string } {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("month must be YYYY-MM");
  }
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const from = `${monthKey}-01`;
  const to = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  return {
    from,
    to,
    label: monthKey,
    start: zurichDayBounds(from).start,
    end: zurichDayBounds(to).end,
  };
}

export function resolveSalesAdjustmentRange(opts: {
  preset?: string;
  from?: string;
  to?: string;
  month?: string;
}): { start: Date; end: Date; from: string; to: string; label: string } {
  if (opts.month) {
    return calendarMonthBounds(opts.month);
  }
  const preset = (opts.preset || "today") as ReportPreset;
  if (!["today", "last_week", "this_month", "last_month", "custom"].includes(preset)) {
    throw new Error("Invalid period preset");
  }
  if (preset === "custom") {
    const range = resolveReportRange("custom", opts.from, opts.to);
    return { start: range.start, end: range.end, from: range.from, to: range.to, label: range.label };
  }
  const range = resolveReportRange(preset);
  return { start: range.start, end: range.end, from: range.from, to: range.to, label: range.label };
}

function orderNetTotal(order: { total: unknown; refundAmount?: unknown | null }): number {
  return roundMoney2(
    Math.max(0, Number(order.total) || 0) - (Number(order.refundAmount) || 0)
  );
}

/** Net cash collected on this order (matches report payment buckets). */
export function orderCashNet(order: {
  paymentMethod?: string | null;
  paymentBreakdown?: unknown;
  total: unknown;
  refundAmount?: unknown | null;
}): number {
  return roundMoney2(
    netPaymentBucketsAfterRefund(
      Number(order.total) || 0,
      Number(order.refundAmount) || 0,
      order.paymentBreakdown,
      order.paymentMethod
    ).get("cash") || 0
  );
}

/** Completed POS sale paid in full — excludes open tickets, pay later, and invoices. */
export function isCompletedPaidCashAdjustmentOrder(order: {
  status?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentBreakdown?: unknown;
  invoiceNumber?: string | null;
  total: unknown;
}): boolean {
  const status = String(order.status || "").toLowerCase();
  const payStatus = String(order.paymentStatus || "").toLowerCase();
  if (status !== "completed") return false;
  if (!["completed", "paid"].includes(payStatus)) return false;
  if (order.invoiceNumber) return false;

  const rawMethod = String(order.paymentMethod || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (
    rawMethod === "pay_later" ||
    rawMethod.startsWith("pay_later:") ||
    rawMethod.startsWith("pay_later_") ||
    rawMethod === "invoice" ||
    rawMethod === "bank_transfer" ||
    rawMethod === "bank"
  ) {
    return false;
  }

  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    Number(order.total) || 0
  );
  for (const t of tenders) {
    const raw = String(t.method || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    const method = normalizePaymentMethod(t.method);
    if (
      method === "pay_later" ||
      method === "invoice" ||
      method === "bank_transfer" ||
      raw.startsWith("pay_later")
    ) {
      return false;
    }
  }

  return true;
}

/** True when the order was paid entirely in cash (card/terminal/gift portions excluded). */
export function isCashOnlyOrder(order: {
  paymentMethod?: string | null;
  paymentBreakdown?: unknown;
  total: unknown;
  refundAmount?: unknown | null;
}): boolean {
  const net = orderNetTotal(order);
  if (net <= 0) return false;

  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    Number(order.total) || 0
  );
  if (!tenders.length) {
    const method = normalizePaymentMethod(String(order.paymentMethod || ""));
    return method === "cash";
  }

  const { cash, terminal, giftCard, other } = paymentBreakdownTotals(tenders);
  if (terminal > 0.001 || giftCard > 0.001 || other > 0.001) return false;
  return cash >= net - 0.01;
}

type OrderRow = {
  id: string;
  status?: string | null;
  paymentStatus?: string | null;
  invoiceNumber?: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string | null;
  tipAmount: string | null;
  roundingAmount: string | null;
  total: string;
  refundAmount: string | null;
  paymentMethod: string | null;
  paymentBreakdown: unknown;
  items: Array<{
    id: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
    taxAmount: string;
    refundedQuantity: string | null;
    weightKg: string | null;
  }>;
};

function effectiveQty(item: OrderRow["items"][number]): number {
  const qty = Number(item.quantity) || 0;
  const refunded = Number(item.refundedQuantity) || 0;
  return roundMoney2(Math.max(0, qty - refunded));
}

function unitLineValue(item: OrderRow["items"][number]): number {
  const qty = effectiveQty(item);
  if (qty <= 0) return 0;
  return roundMoney2(Number(item.totalPrice) / qty);
}

function scaleOrderAmounts(
  order: OrderRow,
  ratio: number
): { subtotal: string; taxAmount: string; discountAmount: string; total: string } {
  const r = Math.max(0, Math.min(1, ratio));
  const subtotal = roundMoney2(Number(order.subtotal) * r);
  const taxAmount = roundMoney2(Number(order.taxAmount) * r);
  const discountAmount = roundMoney2(Number(order.discountAmount || 0) * r);
  const tip = roundMoney2(Number(order.tipAmount || 0) * r);
  const rounding = roundMoney2(Number(order.roundingAmount || 0) * r);
  const total = roundMoney2(subtotal + taxAmount - discountAmount + tip + rounding);
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

function scalePaymentBreakdown(
  order: OrderRow,
  newTotal: number,
  previousTotal: number
): unknown {
  const oldTotal = roundMoney2(previousTotal);
  if (oldTotal <= 0) return order.paymentBreakdown;
  const ratio = Math.max(0, Math.min(1, newTotal / oldTotal));
  const tenders = parsePaymentBreakdown(
    order.paymentBreakdown,
    order.paymentMethod,
    oldTotal
  );
  if (!tenders.length) {
    const method = normalizePaymentMethod(String(order.paymentMethod || "cash")) || "cash";
    return [{ method, amount: roundMoney2(newTotal) }];
  }
  const scaled = tenders.map((t) => ({
    method: t.method,
    amount: roundMoney2(t.amount * ratio),
  }));
  const sum = roundMoney2(scaled.reduce((s, t) => s + t.amount, 0));
  const diff = roundMoney2(newTotal - sum);
  if (Math.abs(diff) >= 0.01 && scaled.length) {
    scaled[0]!.amount = roundMoney2(scaled[0]!.amount + diff);
  }
  return scaled;
}

export class SalesAdjustmentService {
  static allowedPercents(): readonly number[] {
    return [10, 20, 30, 40, 50, 60, 70, 80];
  }

  static async preview(
    merchantId: string,
    targetPercent: number,
    rangeOpts?: {
      preset?: string;
      from?: string;
      to?: string;
      month?: string;
    }
  ): Promise<SalesAdjustmentPreview> {
    const percent = validatePercent(targetPercent);
    const { start, end, from, to, label } = resolveSalesAdjustmentRange(rangeOpts || {});
    const orders = await SalesAdjustmentService.loadEligibleOrders(merchantId, start, end);

    let reportCashTotal = 0;
    let currentCashTotal = 0;
    let eligibleOrderCount = 0;
    let adjustableItemCount = 0;

    for (const o of orders) {
      if (!isCompletedPaidCashAdjustmentOrder(o)) continue;
      const cashNet = orderCashNet(o);
      if (cashNet > 0.001) {
        reportCashTotal = roundMoney2(reportCashTotal + cashNet);
      }
      if (!isCashOnlyOrder(o)) continue;

      currentCashTotal = roundMoney2(currentCashTotal + cashNet);
      eligibleOrderCount += 1;
      for (const item of o.items || []) {
        if (item.weightKg != null && Number(item.weightKg) > 0) continue;
        if (effectiveQty(item) > 0) adjustableItemCount += 1;
      }
    }

    const reductionNeeded = roundMoney2(currentCashTotal * (percent / 100));
    const targetCashTotal = roundMoney2(currentCashTotal - reductionNeeded);

    return {
      periodLabel: label,
      from,
      to,
      targetPercent: percent,
      reportCashTotal,
      currentCashTotal,
      targetCashTotal,
      reductionNeeded,
      eligibleOrderCount,
      adjustableItemCount,
      monthKey: from.slice(0, 7),
    };
  }

  static async apply(
    merchantId: string,
    targetPercent: number,
    rangeOpts?: {
      preset?: string;
      from?: string;
      to?: string;
      month?: string;
    }
  ): Promise<SalesAdjustmentResult> {
    const percent = validatePercent(targetPercent);
    const preview = await SalesAdjustmentService.preview(merchantId, percent, rangeOpts);
    if (preview.currentCashTotal <= 0.01) {
      if (preview.reportCashTotal > 0.01) {
        throw new Error(
          `Reports show CHF ${preview.reportCashTotal.toFixed(2)} cash for this period, but none of it is on 100% cash orders (card/terminal/mixed payments are excluded).`
        );
      }
      throw new Error("Nothing to adjust — no cash sales found for this period.");
    }
    if (preview.reductionNeeded <= 0.01) {
      throw new Error("Nothing to adjust — cash sales are already at or below the target.");
    }
    if (preview.adjustableItemCount === 0) {
      throw new Error("No adjustable cash order lines found for this period.");
    }

    const { start, end, from, to, label } = resolveSalesAdjustmentRange(rangeOpts || {});
    const orders = await SalesAdjustmentService.loadEligibleOrders(merchantId, start, end);
    const db = getDb();

    let remaining = preview.reductionNeeded;
    let ordersAdjusted = 0;
    let itemsAdjusted = 0;
    const adjustedOrderIds = new Set<string>();
    const originalOrderTotals = new Map<string, number>();

    type Candidate = {
      order: OrderRow;
      item: OrderRow["items"][number];
      unitValue: number;
    };

    const buildCandidates = (): Candidate[] => {
      const list: Candidate[] = [];
      for (const order of orders) {
        if (!isCashOnlyOrder(order)) continue;
        for (const item of order.items || []) {
          if (item.weightKg != null && Number(item.weightKg) > 0) continue;
          const qty = effectiveQty(item);
          if (qty <= 0) continue;
          const unitValue = unitLineValue(item);
          if (unitValue <= 0) continue;
          list.push({ order, item, unitValue });
        }
      }
      list.sort((a, b) => b.unitValue - a.unitValue);
      return list;
    };

    while (remaining > 0.01) {
      const candidates = buildCandidates();
      if (!candidates.length) break;

      const pick = candidates[0];
      const oldQty = effectiveQty(pick.item);
      const newQty =
        oldQty >= 1 ? roundMoney2(Math.max(0, oldQty - 1)) : 0;
      const ratio = oldQty > 0 ? newQty / oldQty : 0;

      const newTotalPrice = roundMoney2(Number(pick.item.totalPrice) * ratio);
      const newTaxAmount = roundMoney2(Number(pick.item.taxAmount) * ratio);
      const qtyDelta = roundMoney2(oldQty - newQty);
      const newQuantity = roundMoney2(Math.max(0, Number(pick.item.quantity) - qtyDelta));

      await db
        .update(schema.orderItems)
        .set({
          quantity: Math.max(0, newQuantity).toFixed(3),
          totalPrice: newTotalPrice.toFixed(2),
          taxAmount: newTaxAmount.toFixed(2),
        })
        .where(eq(schema.orderItems.id, pick.item.id));

      pick.item.quantity = Math.max(0, newQuantity).toFixed(3);
      pick.item.totalPrice = newTotalPrice.toFixed(2);
      pick.item.taxAmount = newTaxAmount.toFixed(2);

      const oldItemsSum = (pick.order.items || []).reduce(
        (s, it) => s + Number(it.totalPrice),
        0
      );
      const newItemsSum = (pick.order.items || []).reduce(
        (s, it) => s + Number(it.totalPrice),
        0
      );
      const orderRatio = oldItemsSum > 0 ? newItemsSum / oldItemsSum : 1;
      const scaled = scaleOrderAmounts(pick.order, orderRatio);

      if (!adjustedOrderIds.has(pick.order.id)) {
        originalOrderTotals.set(pick.order.id, Number(pick.order.total) || 0);
        adjustedOrderIds.add(pick.order.id);
        ordersAdjusted += 1;
      }

      pick.order.subtotal = scaled.subtotal;
      pick.order.taxAmount = scaled.taxAmount;
      pick.order.discountAmount = scaled.discountAmount;
      pick.order.total = scaled.total;
      itemsAdjusted += 1;

      const applied = roundMoney2(Math.min(remaining, pick.unitValue));
      remaining = roundMoney2(remaining - applied);
    }

    for (const orderId of adjustedOrderIds) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) continue;
      const previousTotal = originalOrderTotals.get(orderId) ?? (Number(order.total) || 0);
      const paymentBreakdown = scalePaymentBreakdown(
        order,
        Number(order.total),
        previousTotal
      ) as Array<{
        method: string;
        amount: number;
      }>;
      order.paymentBreakdown = paymentBreakdown;
      await db
        .update(schema.orders)
        .set({
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          discountAmount: order.discountAmount || "0",
          total: order.total,
          paymentBreakdown,
        })
        .where(eq(schema.orders.id, orderId));
    }

    const afterPreview = await SalesAdjustmentService.preview(merchantId, percent, rangeOpts);
    const beforeCashTotal = preview.currentCashTotal;
    const afterCashTotal = afterPreview.currentCashTotal;
    const reductionApplied = roundMoney2(beforeCashTotal - afterCashTotal);

    if (reductionApplied <= 0.01 && preview.reductionNeeded > 0.01) {
      if (ordersAdjusted === 0) {
        throw new Error(
          "No cash order lines could be reduced — eligible lines may have zero value (e.g. fully discounted). Try a different period."
        );
      }
      throw new Error(
        "Adjustment did not change reported cash totals. Reload and try again; if it persists, contact support."
      );
    }
    if (reductionApplied + 0.02 < preview.reductionNeeded * 0.25) {
      throw new Error(
        `Only CHF ${reductionApplied.toFixed(2)} of CHF ${preview.reductionNeeded.toFixed(2)} could be reduced — not enough adjustable line items.`
      );
    }

    return {
      periodLabel: label,
      from,
      to,
      targetPercent: percent,
      beforeCashTotal,
      afterCashTotal,
      reductionApplied,
      ordersAdjusted,
      itemsAdjusted,
      monthKey: from.slice(0, 7),
    };
  }

  private static async loadEligibleOrders(
    merchantId: string,
    start: Date,
    end: Date
  ): Promise<OrderRow[]> {
    const db = getDb();
    const rows = (await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.status, "completed"),
        inArray(schema.orders.paymentStatus, ["completed", "paid"]),
        gte(schema.orders.createdAt, start),
        lte(schema.orders.createdAt, end)
      ),
      with: { items: true },
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    })) as OrderRow[];
    return rows.filter(isCompletedPaidCashAdjustmentOrder);
  }
}
