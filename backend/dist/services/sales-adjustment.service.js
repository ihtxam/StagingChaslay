"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesAdjustmentService = void 0;
exports.isCashOnlyOrder = isCashOnlyOrder;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const money_1 = require("@/lib/money");
const vacation_1 = require("@/lib/vacation");
const payment_breakdown_1 = require("@/lib/payment-breakdown");
const ALLOWED_PERCENTS = [20, 40];
function zurichMonthBounds(monthKey) {
    let year;
    let month;
    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
        [year, month] = monthKey.split("-").map(Number);
    }
    else {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Zurich",
            year: "numeric",
            month: "2-digit",
        }).formatToParts(new Date());
        year = Number(parts.find((p) => p.type === "year").value);
        month = Number(parts.find((p) => p.type === "month").value);
    }
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const lastDay = new Date(year, month, 0).getDate();
    return {
        monthKey: key,
        start: (0, vacation_1.zurichDayBounds)(`${key}-01`).start,
        end: (0, vacation_1.zurichDayBounds)(`${key}-${String(lastDay).padStart(2, "0")}`).end,
    };
}
function orderNetTotal(order) {
    return (0, money_1.roundMoney2)(Math.max(0, Number(order.total) || 0) - (Number(order.refundAmount) || 0));
}
/** True when the order was paid entirely in cash (card/terminal/gift portions excluded). */
function isCashOnlyOrder(order) {
    const net = orderNetTotal(order);
    if (net <= 0)
        return false;
    const method = (0, payment_breakdown_1.normalizePaymentMethod)(String(order.paymentMethod || ""));
    if (["card", "terminal"].includes(method))
        return false;
    const tenders = (0, payment_breakdown_1.parsePaymentBreakdown)(order.paymentBreakdown, order.paymentMethod, Number(order.total) || 0);
    if (!tenders.length)
        return method === "cash";
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
function unitLineValue(item) {
    const qty = effectiveQty(item);
    if (qty <= 0)
        return 0;
    return (0, money_1.roundMoney2)(Number(item.totalPrice) / qty);
}
function scaleOrderAmounts(order, ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    const subtotal = (0, money_1.roundMoney2)(Number(order.subtotal) * r);
    const taxAmount = (0, money_1.roundMoney2)(Number(order.taxAmount) * r);
    const discountAmount = (0, money_1.roundMoney2)(Number(order.discountAmount || 0) * r);
    const tip = (0, money_1.roundMoney2)(Number(order.tipAmount || 0));
    const rounding = (0, money_1.roundMoney2)(Number(order.roundingAmount || 0));
    const total = (0, money_1.roundMoney2)(subtotal + taxAmount - discountAmount + tip + rounding);
    return {
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        total: total.toFixed(2),
    };
}
function scalePaymentBreakdown(order, newTotal) {
    const oldTotal = Number(order.total) || 0;
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
        return ALLOWED_PERCENTS;
    }
    static async preview(merchantId, targetPercent, monthKey) {
        if (!ALLOWED_PERCENTS.includes(targetPercent)) {
            throw new Error("Target percent must be 20 or 40");
        }
        const { start, end, monthKey: key } = zurichMonthBounds(monthKey);
        const orders = await SalesAdjustmentService.loadEligibleOrders(merchantId, start, end);
        let currentCashTotal = 0;
        let eligibleOrderCount = 0;
        let adjustableItemCount = 0;
        for (const o of orders) {
            if (!isCashOnlyOrder(o))
                continue;
            const net = orderNetTotal(o);
            currentCashTotal = (0, money_1.roundMoney2)(currentCashTotal + net);
            eligibleOrderCount += 1;
            for (const item of o.items || []) {
                if (item.weightKg != null && Number(item.weightKg) > 0)
                    continue;
                if (effectiveQty(item) >= 1)
                    adjustableItemCount += 1;
            }
        }
        const reductionNeeded = (0, money_1.roundMoney2)(currentCashTotal * (targetPercent / 100));
        const targetCashTotal = (0, money_1.roundMoney2)(currentCashTotal - reductionNeeded);
        return {
            monthKey: key,
            targetPercent,
            currentCashTotal,
            targetCashTotal,
            reductionNeeded,
            eligibleOrderCount,
            adjustableItemCount,
        };
    }
    static async apply(merchantId, targetPercent, monthKey) {
        const preview = await SalesAdjustmentService.preview(merchantId, targetPercent, monthKey);
        if (preview.reductionNeeded <= 0.01) {
            throw new Error("Nothing to adjust — cash sales are already at or below the target.");
        }
        if (preview.adjustableItemCount === 0) {
            throw new Error("No adjustable cash order lines found for this month.");
        }
        const { start, end, monthKey: key } = zurichMonthBounds(monthKey);
        const orders = await SalesAdjustmentService.loadEligibleOrders(merchantId, start, end);
        const db = (0, db_1.getDb)();
        let remaining = preview.reductionNeeded;
        let ordersAdjusted = 0;
        let itemsAdjusted = 0;
        const adjustedOrderIds = new Set();
        const buildCandidates = () => {
            const list = [];
            for (const order of orders) {
                if (!isCashOnlyOrder(order))
                    continue;
                for (const item of order.items || []) {
                    if (item.weightKg != null && Number(item.weightKg) > 0)
                        continue;
                    const qty = effectiveQty(item);
                    if (qty < 1)
                        continue;
                    const unitValue = unitLineValue(item);
                    if (unitValue <= 0)
                        continue;
                    list.push({ order, item, unitValue });
                }
            }
            list.sort((a, b) => b.unitValue - a.unitValue);
            return list;
        };
        while (remaining > 0.01) {
            const candidates = buildCandidates();
            if (!candidates.length)
                break;
            const pick = candidates[0];
            const oldQty = effectiveQty(pick.item);
            const newQty = (0, money_1.roundMoney2)(Math.max(0, oldQty - 1));
            const ratio = oldQty > 0 ? newQty / oldQty : 0;
            const newTotalPrice = (0, money_1.roundMoney2)(Number(pick.item.totalPrice) * ratio);
            const newTaxAmount = (0, money_1.roundMoney2)(Number(pick.item.taxAmount) * ratio);
            const newQuantity = (0, money_1.roundMoney2)(Number(pick.item.quantity) - 1);
            await db
                .update(db_1.schema.orderItems)
                .set({
                quantity: Math.max(0, newQuantity).toFixed(3),
                totalPrice: newTotalPrice.toFixed(2),
                taxAmount: newTaxAmount.toFixed(2),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.id, pick.item.id));
            pick.item.quantity = Math.max(0, newQuantity).toFixed(3);
            pick.item.totalPrice = newTotalPrice.toFixed(2);
            pick.item.taxAmount = newTaxAmount.toFixed(2);
            const oldItemsSum = (pick.order.items || []).reduce((s, it) => s + Number(it.totalPrice), 0);
            const newItemsSum = (pick.order.items || []).reduce((s, it) => s + Number(it.totalPrice), 0);
            const orderRatio = oldItemsSum > 0 ? newItemsSum / oldItemsSum : 1;
            const scaled = scaleOrderAmounts(pick.order, orderRatio);
            pick.order.subtotal = scaled.subtotal;
            pick.order.taxAmount = scaled.taxAmount;
            pick.order.discountAmount = scaled.discountAmount;
            pick.order.total = scaled.total;
            if (!adjustedOrderIds.has(pick.order.id)) {
                adjustedOrderIds.add(pick.order.id);
                ordersAdjusted += 1;
            }
            itemsAdjusted += 1;
            const applied = (0, money_1.roundMoney2)(Math.min(remaining, pick.unitValue));
            remaining = (0, money_1.roundMoney2)(remaining - applied);
        }
        for (const orderId of adjustedOrderIds) {
            const order = orders.find((o) => o.id === orderId);
            if (!order)
                continue;
            const paymentBreakdown = scalePaymentBreakdown(order, Number(order.total));
            order.paymentBreakdown = paymentBreakdown;
            await db
                .update(db_1.schema.orders)
                .set({
                subtotal: order.subtotal,
                taxAmount: order.taxAmount,
                discountAmount: order.discountAmount || "0",
                total: order.total,
                paymentBreakdown,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
        }
        const afterPreview = await SalesAdjustmentService.preview(merchantId, targetPercent, key);
        const beforeCashTotal = preview.currentCashTotal;
        const afterCashTotal = afterPreview.currentCashTotal;
        return {
            monthKey: key,
            targetPercent,
            beforeCashTotal,
            afterCashTotal,
            reductionApplied: (0, money_1.roundMoney2)(beforeCashTotal - afterCashTotal),
            ordersAdjusted,
            itemsAdjusted,
        };
    }
    static async loadEligibleOrders(merchantId, start, end) {
        const db = (0, db_1.getDb)();
        return db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.orderType, ["pos"]), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.gte)(db_1.schema.orders.completedAt, start), (0, drizzle_orm_1.lte)(db_1.schema.orders.completedAt, end)),
            with: { items: true },
            orderBy: (orders, { desc }) => [desc(orders.completedAt)],
        });
    }
}
exports.SalesAdjustmentService = SalesAdjustmentService;
//# sourceMappingURL=sales-adjustment.service.js.map