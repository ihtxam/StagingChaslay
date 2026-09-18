"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesAdjustmentService = void 0;
exports.resolveSalesAdjustmentRange = resolveSalesAdjustmentRange;
exports.orderCashNet = orderCashNet;
exports.isCompletedPaidCashAdjustmentOrder = isCompletedPaidCashAdjustmentOrder;
exports.isCashOnlyOrder = isCashOnlyOrder;
exports.isAdjustableCashLine = isAdjustableCashLine;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const money_1 = require("@/lib/money");
const vacation_1 = require("@/lib/vacation");
const payment_breakdown_1 = require("@/lib/payment-breakdown");
const order_notes_meta_1 = require("@/lib/order-notes-meta");
const pos_reports_service_1 = require("@/services/pos-reports.service");
function validatePercent(targetPercent) {
    const p = Math.round(Number(targetPercent));
    if (!Number.isFinite(p) || p < 1 || p > 99) {
        throw new Error("Target percent must be between 1 and 99");
    }
    return p;
}
function calendarMonthBounds(monthKey) {
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
        start: (0, vacation_1.zurichDayBounds)(from).start,
        end: (0, vacation_1.zurichDayBounds)(to).end,
    };
}
function resolveSalesAdjustmentRange(opts) {
    if (opts.month) {
        return calendarMonthBounds(opts.month);
    }
    const preset = (opts.preset || "today");
    if (!["today", "last_week", "this_month", "last_month", "custom"].includes(preset)) {
        throw new Error("Invalid period preset");
    }
    if (preset === "custom") {
        const range = (0, pos_reports_service_1.resolveReportRange)("custom", opts.from, opts.to);
        return { start: range.start, end: range.end, from: range.from, to: range.to, label: range.label };
    }
    const range = (0, pos_reports_service_1.resolveReportRange)(preset);
    return { start: range.start, end: range.end, from: range.from, to: range.to, label: range.label };
}
function orderNetTotal(order) {
    return (0, money_1.roundMoney2)(Math.max(0, Number(order.total) || 0) - (Number(order.refundAmount) || 0));
}
/** Net cash collected on this order (matches report payment buckets). */
function orderCashNet(order) {
    return (0, money_1.roundMoney2)((0, payment_breakdown_1.netPaymentBucketsAfterRefund)(Number(order.total) || 0, Number(order.refundAmount) || 0, order.paymentBreakdown, order.paymentMethod).get("cash") || 0);
}
/** Completed POS sale paid in full — excludes open tickets, pay later, and invoices. */
function isCompletedPaidCashAdjustmentOrder(order) {
    const status = String(order.status || "").toLowerCase();
    const payStatus = String(order.paymentStatus || "").toLowerCase();
    if (status !== "completed")
        return false;
    if (!["completed", "paid"].includes(payStatus))
        return false;
    if (order.invoiceNumber)
        return false;
    const rawMethod = String(order.paymentMethod || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");
    if (rawMethod === "pay_later" ||
        rawMethod.startsWith("pay_later:") ||
        rawMethod.startsWith("pay_later_") ||
        rawMethod === "invoice" ||
        rawMethod === "bank_transfer" ||
        rawMethod === "bank") {
        return false;
    }
    const tenders = (0, payment_breakdown_1.parsePaymentBreakdown)(order.paymentBreakdown, order.paymentMethod, Number(order.total) || 0);
    for (const t of tenders) {
        const raw = String(t.method || "")
            .trim()
            .toLowerCase()
            .replace(/-/g, "_");
        const method = (0, payment_breakdown_1.normalizePaymentMethod)(t.method);
        if (method === "pay_later" ||
            method === "invoice" ||
            method === "bank_transfer" ||
            raw.startsWith("pay_later")) {
            return false;
        }
    }
    return true;
}
/** True when the order was paid entirely in cash (card/terminal/gift portions excluded). */
function isCashOnlyOrder(order) {
    const net = orderNetTotal(order);
    if (net <= 0)
        return false;
    const tenders = (0, payment_breakdown_1.parsePaymentBreakdown)(order.paymentBreakdown, order.paymentMethod, Number(order.total) || 0);
    if (!tenders.length) {
        const method = (0, payment_breakdown_1.normalizePaymentMethod)(String(order.paymentMethod || ""));
        return method === "cash";
    }
    const { cash, terminal, giftCard, other } = (0, payment_breakdown_1.paymentBreakdownTotals)(tenders);
    if (terminal > 0.001 || giftCard > 0.001 || other > 0.001)
        return false;
    return cash >= net - 0.01;
}
function effectiveQty(item) {
    const qty = Number(item.quantity) || 0;
    const refunded = Number(item.refundedQuantity) || 0;
    return (0, money_1.roundMoney2)(Math.max(0, qty - refunded));
}
function lineValue(item) {
    return (0, money_1.roundMoney2)(Number(item.totalPrice) || 0);
}
function isWeightedLine(item) {
    return item.weightKg != null && Number(item.weightKg) > 0;
}
/** Line can be reduced (weighed kg, unit qty, or positive line total). */
function isAdjustableCashLine(item) {
    const value = lineValue(item);
    if (value <= 0.001)
        return false;
    if (isWeightedLine(item))
        return true;
    return effectiveQty(item) > 0;
}
function unitLineValue(item) {
    const qty = effectiveQty(item);
    if (qty <= 0)
        return lineValue(item);
    return (0, money_1.roundMoney2)(Number(item.totalPrice) / qty);
}
/** Value removed in one reduction step (for prioritising larger lines). */
function reducibleStepValue(item) {
    const total = lineValue(item);
    if (total <= 0.001)
        return 0;
    if (isWeightedLine(item))
        return total;
    const qty = effectiveQty(item);
    if (qty <= 0)
        return total;
    if (qty >= 1)
        return unitLineValue(item);
    return total;
}
function scaleOrderAmounts(order, ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    const subtotal = (0, money_1.roundMoney2)(Number(order.subtotal) * r);
    const taxAmount = (0, money_1.roundMoney2)(Number(order.taxAmount) * r);
    const discountAmount = (0, money_1.roundMoney2)(Number(order.discountAmount || 0) * r);
    const tip = (0, money_1.roundMoney2)(Number(order.tipAmount || 0) * r);
    const rounding = (0, money_1.roundMoney2)(Number(order.roundingAmount || 0) * r);
    const total = (0, money_1.roundMoney2)(subtotal + taxAmount - discountAmount + tip + rounding);
    return {
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        total: total.toFixed(2),
    };
}
function scalePaymentBreakdown(order, newTotal, previousTotal) {
    const oldTotal = (0, money_1.roundMoney2)(previousTotal);
    if (oldTotal <= 0)
        return order.paymentBreakdown;
    const ratio = Math.max(0, Math.min(1, newTotal / oldTotal));
    const tenders = (0, payment_breakdown_1.parsePaymentBreakdown)(order.paymentBreakdown, order.paymentMethod, oldTotal);
    if (!tenders.length) {
        const method = (0, payment_breakdown_1.normalizePaymentMethod)(String(order.paymentMethod || "cash")) || "cash";
        return [{ method, amount: (0, money_1.roundMoney2)(newTotal) }];
    }
    const scaled = tenders.map((t) => ({
        method: t.method,
        amount: (0, money_1.roundMoney2)(t.amount * ratio),
    }));
    const sum = (0, money_1.roundMoney2)(scaled.reduce((s, t) => s + t.amount, 0));
    const diff = (0, money_1.roundMoney2)(newTotal - sum);
    if (Math.abs(diff) >= 0.01 && scaled.length) {
        scaled[0].amount = (0, money_1.roundMoney2)(scaled[0].amount + diff);
    }
    return scaled;
}
class SalesAdjustmentService {
    static allowedPercents() {
        return [10, 20, 30, 40, 50, 60, 70, 80];
    }
    static async preview(merchantId, targetPercent, rangeOpts) {
        const percent = validatePercent(targetPercent);
        const { start, end, from, to, label } = resolveSalesAdjustmentRange(rangeOpts || {});
        const orders = await SalesAdjustmentService.loadEligibleOrders(merchantId, start, end);
        let reportCashTotal = 0;
        let currentCashTotal = 0;
        let eligibleOrderCount = 0;
        let adjustableItemCount = 0;
        for (const o of orders) {
            if (!isCompletedPaidCashAdjustmentOrder(o))
                continue;
            const cashNet = orderCashNet(o);
            if (cashNet > 0.001) {
                reportCashTotal = (0, money_1.roundMoney2)(reportCashTotal + cashNet);
            }
            if (!isCashOnlyOrder(o))
                continue;
            currentCashTotal = (0, money_1.roundMoney2)(currentCashTotal + cashNet);
            eligibleOrderCount += 1;
            let orderHasAdjustableLine = false;
            for (const item of o.items || []) {
                if (isAdjustableCashLine(item)) {
                    adjustableItemCount += 1;
                    orderHasAdjustableLine = true;
                }
            }
            if (!orderHasAdjustableLine && cashNet > 0.001) {
                adjustableItemCount += 1;
            }
        }
        const reductionNeeded = (0, money_1.roundMoney2)(currentCashTotal * (percent / 100));
        const targetCashTotal = (0, money_1.roundMoney2)(currentCashTotal - reductionNeeded);
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
    static async apply(merchantId, targetPercent, rangeOpts) {
        const percent = validatePercent(targetPercent);
        const preview = await SalesAdjustmentService.preview(merchantId, percent, rangeOpts);
        if (preview.currentCashTotal <= 0.01) {
            if (preview.reportCashTotal > 0.01) {
                throw new Error(`Reports show CHF ${preview.reportCashTotal.toFixed(2)} cash for this period, but none of it is on 100% cash orders (card/terminal/mixed payments are excluded).`);
            }
            throw new Error("Nothing to adjust — no cash sales found for this period.");
        }
        if (preview.reductionNeeded <= 0.01) {
            throw new Error("Nothing to adjust — cash sales are already at or below the target.");
        }
        if (preview.adjustableItemCount === 0) {
            throw new Error("No adjustable cash order lines found for this period. Lines may be fully discounted or missing item detail on the order.");
        }
        const { start, end, from, to, label } = resolveSalesAdjustmentRange(rangeOpts || {});
        const orders = await SalesAdjustmentService.loadEligibleOrders(merchantId, start, end);
        const db = (0, db_1.getDb)();
        let remaining = preview.reductionNeeded;
        let ordersAdjusted = 0;
        let itemsAdjusted = 0;
        const adjustedOrderIds = new Set();
        const originalOrderTotals = new Map();
        const buildCandidates = () => {
            const list = [];
            for (const order of orders) {
                if (!isCashOnlyOrder(order))
                    continue;
                for (const item of order.items || []) {
                    if (!isAdjustableCashLine(item))
                        continue;
                    const stepValue = reducibleStepValue(item);
                    if (stepValue <= 0)
                        continue;
                    list.push({ order, item, stepValue });
                }
                const hasLines = (order.items || []).some(isAdjustableCashLine);
                const net = orderNetTotal(order);
                if (!hasLines && net > 0.001) {
                    list.push({ order, stepValue: net, orderHeaderOnly: true });
                }
            }
            list.sort((a, b) => b.stepValue - a.stepValue);
            return list;
        };
        const rescaleOrderFromItems = (order, oldItemsSum) => {
            const newItemsSum = (order.items || []).reduce((s, it) => s + Number(it.totalPrice), 0);
            const orderRatio = oldItemsSum > 0 ? newItemsSum / oldItemsSum : 1;
            const scaled = scaleOrderAmounts(order, orderRatio);
            order.subtotal = scaled.subtotal;
            order.taxAmount = scaled.taxAmount;
            order.discountAmount = scaled.discountAmount;
            order.total = scaled.total;
        };
        const markOrderAdjusted = (order) => {
            if (!adjustedOrderIds.has(order.id)) {
                originalOrderTotals.set(order.id, Number(order.total) || 0);
                adjustedOrderIds.add(order.id);
                ordersAdjusted += 1;
            }
        };
        const applyLineReduction = async (order, item, remaining) => {
            const oldItemsSum = (order.items || []).reduce((s, it) => s + Number(it.totalPrice), 0);
            const oldLineTotal = lineValue(item);
            const oldQty = effectiveQty(item);
            const weighted = isWeightedLine(item);
            if (!weighted && oldQty >= 1) {
                const newQty = (0, money_1.roundMoney2)(Math.max(0, oldQty - 1));
                const ratio = oldQty > 0 ? newQty / oldQty : 0;
                const newTotalPrice = (0, money_1.roundMoney2)(Number(item.totalPrice) * ratio);
                const newTaxAmount = (0, money_1.roundMoney2)(Number(item.taxAmount) * ratio);
                const qtyDelta = (0, money_1.roundMoney2)(oldQty - newQty);
                const newQuantity = (0, money_1.roundMoney2)(Math.max(0, Number(item.quantity) - qtyDelta));
                await db
                    .update(db_1.schema.orderItems)
                    .set({
                    quantity: Math.max(0, newQuantity).toFixed(3),
                    totalPrice: newTotalPrice.toFixed(2),
                    taxAmount: newTaxAmount.toFixed(2),
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.id, item.id));
                item.quantity = Math.max(0, newQuantity).toFixed(3);
                item.totalPrice = newTotalPrice.toFixed(2);
                item.taxAmount = newTaxAmount.toFixed(2);
                rescaleOrderFromItems(order, oldItemsSum);
                return (0, money_1.roundMoney2)(Math.min(remaining, oldLineTotal - newTotalPrice));
            }
            const reduceBy = (0, money_1.roundMoney2)(Math.min(remaining, oldLineTotal));
            if (reduceBy <= 0.001)
                return 0;
            const newLineTotal = (0, money_1.roundMoney2)(Math.max(0, oldLineTotal - reduceBy));
            const ratio = oldLineTotal > 0 ? newLineTotal / oldLineTotal : 0;
            const newTaxAmount = (0, money_1.roundMoney2)(Number(item.taxAmount) * ratio);
            const patch = {
                totalPrice: newLineTotal.toFixed(2),
                taxAmount: newTaxAmount.toFixed(2),
            };
            if (weighted && item.weightKg) {
                patch.weightKg = Math.max(0, Number(item.weightKg) * ratio).toFixed(3);
                item.weightKg = patch.weightKg;
            }
            else if (oldQty > 0) {
                const newQuantity = Math.max(0, Number(item.quantity) * ratio);
                patch.quantity = newQuantity.toFixed(3);
                item.quantity = patch.quantity;
            }
            await db.update(db_1.schema.orderItems).set(patch).where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.id, item.id));
            item.totalPrice = patch.totalPrice;
            item.taxAmount = patch.taxAmount;
            rescaleOrderFromItems(order, oldItemsSum);
            return reduceBy;
        };
        const applyOrderHeaderReduction = async (order, remaining) => {
            const net = orderNetTotal(order);
            if (net <= 0.001)
                return 0;
            const reduceBy = (0, money_1.roundMoney2)(Math.min(remaining, net));
            const ratio = Math.max(0, Math.min(1, (net - reduceBy) / net));
            const scaled = scaleOrderAmounts(order, ratio);
            order.subtotal = scaled.subtotal;
            order.taxAmount = scaled.taxAmount;
            order.discountAmount = scaled.discountAmount;
            order.total = scaled.total;
            return reduceBy;
        };
        while (remaining > 0.01) {
            const candidates = buildCandidates();
            if (!candidates.length)
                break;
            const pick = candidates[0];
            let applied = 0;
            if (pick.orderHeaderOnly || !pick.item) {
                applied = await applyOrderHeaderReduction(pick.order, remaining);
                if (applied <= 0.001)
                    break;
                markOrderAdjusted(pick.order);
                itemsAdjusted += 1;
            }
            else {
                applied = await applyLineReduction(pick.order, pick.item, remaining);
                if (applied <= 0.001)
                    break;
                markOrderAdjusted(pick.order);
                itemsAdjusted += 1;
            }
            remaining = (0, money_1.roundMoney2)(remaining - applied);
        }
        for (const orderId of adjustedOrderIds) {
            const order = orders.find((o) => o.id === orderId);
            if (!order)
                continue;
            const previousTotal = originalOrderTotals.get(orderId) ?? (Number(order.total) || 0);
            const paymentBreakdown = scalePaymentBreakdown(order, Number(order.total), previousTotal);
            order.paymentBreakdown = paymentBreakdown;
            const newTotal = Number(order.total) || 0;
            const cleanedNotes = (0, order_notes_meta_1.stripPosCheckoutMetaFromNotes)(order.notes);
            order.notes = cleanedNotes;
            const patch = {
                subtotal: order.subtotal,
                taxAmount: order.taxAmount,
                discountAmount: order.discountAmount || "0",
                total: order.total,
                paymentBreakdown,
                notes: cleanedNotes,
            };
            if (newTotal <= 0.01) {
                patch.amountTendered = null;
            }
            await db.update(db_1.schema.orders).set(patch).where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
        }
        const afterPreview = await SalesAdjustmentService.preview(merchantId, percent, rangeOpts);
        const beforeCashTotal = preview.currentCashTotal;
        const afterCashTotal = afterPreview.currentCashTotal;
        const reductionApplied = (0, money_1.roundMoney2)(beforeCashTotal - afterCashTotal);
        if (reductionApplied <= 0.01 && preview.reductionNeeded > 0.01) {
            if (ordersAdjusted === 0) {
                throw new Error("No cash order lines could be reduced — eligible lines may have zero value (e.g. fully discounted). Try a different period.");
            }
            throw new Error("Adjustment did not change reported cash totals. Reload and try again; if it persists, contact support.");
        }
        if (reductionApplied + 0.02 < preview.reductionNeeded * 0.25) {
            throw new Error(`Only CHF ${reductionApplied.toFixed(2)} of CHF ${preview.reductionNeeded.toFixed(2)} could be reduced — not enough adjustable line items.`);
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
    static async loadEligibleOrders(merchantId, start, end) {
        const db = (0, db_1.getDb)();
        const rows = (await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.inArray)(db_1.schema.orders.paymentStatus, ["completed", "paid"]), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, start), (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, end)),
            with: { items: true },
            orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        }));
        return rows.filter(isCompletedPaidCashAdjustmentOrder);
    }
}
exports.SalesAdjustmentService = SalesAdjustmentService;
//# sourceMappingURL=sales-adjustment.service.js.map