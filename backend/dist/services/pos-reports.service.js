"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosReportsService = void 0;
exports.isCountableSale = isCountableSale;
exports.resolveReportRange = resolveReportRange;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const payment_breakdown_1 = require("@/lib/payment-breakdown");
function zurichDayBounds(ymd) {
    const start = new Date(`${ymd}T00:00:00+02:00`);
    const end = new Date(`${ymd}T23:59:59.999+02:00`);
    try {
        const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Zurich",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        let guess = new Date(`${ymd}T00:00:00Z`);
        for (let i = 0; i < 48; i++) {
            const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
            const got = `${parts.year}-${parts.month}-${parts.day}`;
            const hour = Number(parts.hour);
            if (got === ymd && hour === 0)
                break;
            if (got < ymd)
                guess = new Date(guess.getTime() + 3600000);
            else if (got > ymd)
                guess = new Date(guess.getTime() - 3600000);
            else
                guess = new Date(guess.getTime() - hour * 3600000);
        }
        const startZ = guess;
        const endZ = new Date(startZ.getTime() + 24 * 3600000 - 1);
        return { start: startZ, end: endZ };
    }
    catch {
        return { start, end };
    }
}
function ymdInZurich(d = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}
function addDaysYmd(ymd, delta) {
    const { start } = zurichDayBounds(ymd);
    const next = new Date(start.getTime() + delta * 24 * 3600000);
    return ymdInZurich(next);
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
/** Paid tickets count as sales even while kitchen fulfillment is still open. */
function isCountableSale(o) {
    const status = String(o.status || "").toLowerCase();
    const pay = String(o.paymentStatus || "").toLowerCase();
    if (["cancelled", "canceled", "refunded"].includes(status))
        return false;
    if (["cancelled", "canceled", "refunded"].includes(pay))
        return false;
    if (["completed", "partially_refunded"].includes(status))
        return true;
    if (["completed", "paid", "partially_refunded"].includes(pay))
        return true;
    return false;
}
function channelLabel(ch) {
    switch (ch) {
        case "dine_in":
            return "Dine-in";
        case "delivery":
            return "Delivery";
        default:
            return "Takeaway";
    }
}
function resolveReportRange(preset, from, to) {
    const today = ymdInZurich();
    if (preset === "custom") {
        const f = (from || today).slice(0, 10);
        const t = (to || f).slice(0, 10);
        const a = zurichDayBounds(f);
        const b = zurichDayBounds(t);
        return { start: a.start, end: b.end, label: `${f} to ${t}`, from: f, to: t };
    }
    if (preset === "yesterday") {
        const y = addDaysYmd(today, -1);
        const b = zurichDayBounds(y);
        return { start: b.start, end: b.end, label: y, from: y, to: y };
    }
    if (preset === "last_week") {
        const f = addDaysYmd(today, -6);
        const a = zurichDayBounds(f);
        const b = zurichDayBounds(today);
        return { start: a.start, end: b.end, label: `${f} to ${today}`, from: f, to: today };
    }
    if (preset === "this_month") {
        const f = `${today.slice(0, 7)}-01`;
        const a = zurichDayBounds(f);
        const b = zurichDayBounds(today);
        return { start: a.start, end: b.end, label: `${f} to ${today}`, from: f, to: today };
    }
    if (preset === "last_month") {
        const f = addDaysYmd(today, -29);
        const a = zurichDayBounds(f);
        const b = zurichDayBounds(today);
        return { start: a.start, end: b.end, label: `${f} to ${today}`, from: f, to: today };
    }
    if (preset === "last_3_months") {
        const f = addDaysYmd(today, -89);
        const a = zurichDayBounds(f);
        const b = zurichDayBounds(today);
        return { start: a.start, end: b.end, label: `${f} to ${today}`, from: f, to: today };
    }
    const b = zurichDayBounds(today);
    return { start: b.start, end: b.end, label: today, from: today, to: today };
}
class PosReportsService {
    /** Shift-scoped sales report (exact openedAt–closedAt window, not full calendar day). */
    static async getShiftReport(merchantId, opts) {
        return this.getEndOfDayReport(merchantId, {
            startAt: opts.from,
            endAt: opts.to,
            staffId: opts.staffId,
            staffName: opts.staffName,
        });
    }
    static async getEndOfDayReport(merchantId, opts) {
        const db = (0, db_1.getDb)();
        let range;
        if (opts.startAt && opts.endAt) {
            const start = new Date(opts.startAt);
            const end = new Date(opts.endAt);
            if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
                throw new Error("Invalid shift period");
            }
            const fmt = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Zurich",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
            const fromLabel = fmt.format(start);
            const toLabel = fmt.format(end);
            range = {
                start,
                end,
                label: fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`,
                from: opts.startAt,
                to: opts.endAt,
            };
        }
        else {
            range = resolveReportRange(opts.preset || "today", opts.from, opts.to);
        }
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        const money = (n) => Number(n) || 0;
        const rateTakeaway = money(merchant?.taxTakeawayRate) || money(merchant?.vatRate) || 2.6;
        const rateDineIn = money(merchant?.taxDineInRate) || money(merchant?.vatRate) || 8.1;
        const rateDelivery = money(merchant?.taxDeliveryRate) || money(merchant?.taxTakeawayRate) || money(merchant?.vatRate) || 2.6;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conditions = [
            (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId),
            (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, range.start),
            (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, range.end),
        ];
        if (opts.channel && ["takeaway", "dine_in", "delivery"].includes(opts.channel)) {
            conditions.push((0, drizzle_orm_1.eq)(db_1.schema.orders.fulfillmentChannel, opts.channel));
        }
        const scopeStaffId = opts.staffId ? String(opts.staffId).trim() : "";
        const scopeStaffName = opts.staffName ? String(opts.staffName).trim() : "";
        if (scopeStaffId) {
            const staffMatch = scopeStaffName
                ? (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.orders.staffId, scopeStaffId), (0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(db_1.schema.orders.staffId), (0, drizzle_orm_1.eq)(db_1.schema.orders.staffName, scopeStaffName)))
                : (0, drizzle_orm_1.eq)(db_1.schema.orders.staffId, scopeStaffId);
            if (staffMatch)
                conditions.push(staffMatch);
        }
        const rows = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)(...conditions),
            with: { items: true },
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt)],
        });
        const staffIds = [
            ...new Set(rows.map((o) => o.staffId).filter((id) => !!id)),
        ];
        const staffNameById = new Map();
        if (staffIds.length) {
            const staffRows = await db.query.merchantStaff.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.merchantStaff.id, staffIds)),
            });
            for (const s of staffRows) {
                staffNameById.set(s.id, s.name.trim());
            }
        }
        const resolveStaffName = (o) => {
            const fromOrder = (o.staffName || "").trim();
            if (fromOrder)
                return fromOrder;
            if (o.staffId) {
                const fromStaff = staffNameById.get(o.staffId);
                if (fromStaff)
                    return fromStaff;
            }
            return "Unassigned";
        };
        const completed = rows.filter((o) => isCountableSale(o));
        const cancelled = rows.filter((o) => o.status === "cancelled");
        const refunded = rows.filter((o) => o.status === "refunded" ||
            o.status === "partially_refunded" ||
            Number(o.refundAmount || 0) > 0);
        /** Taxable gross (excl. tips). Tips are not taxable. */
        const brutOf = (o) => Math.max(0, money(o.total) - money(o.tipAmount));
        let revenue = 0;
        let taxTotal = 0;
        let subtotal = 0;
        let discountTotal = 0;
        let tipsTotal = 0;
        let refundTotal = 0;
        let cancelledTotal = 0;
        let covers = 0;
        const payments = {};
        const refundByMethod = {};
        const channels = {};
        const products = new Map();
        const staffMap = new Map();
        const vatByChannel = {};
        for (const o of completed) {
            const tip = money(o.tipAmount);
            const refundAmt = money(o.refundAmount);
            const brut = Math.max(0, brutOf(o) - Math.min(refundAmt, brutOf(o)));
            const tax = money(o.taxAmount);
            // Reduce tax proportionally when part of the ticket was refunded.
            const grossBefore = Math.max(0.0001, money(o.total));
            const keepRatio = Math.max(0, Math.min(1, (grossBefore - refundAmt) / grossBefore));
            const taxKept = round2(tax * keepRatio);
            revenue += brut;
            taxTotal += taxKept;
            subtotal += round2(money(o.subtotal) * keepRatio);
            discountTotal += round2((money(o.discountAmount) + money(o.pointsDiscount)) * keepRatio);
            tipsTotal += round2(tip * keepRatio);
            refundTotal += refundAmt;
            if (o.guestCount)
                covers += Number(o.guestCount) || 0;
            // Payment buckets: net money kept after refunds (gift-first for split tenders).
            const netBuckets = (0, payment_breakdown_1.netPaymentBucketsAfterRefund)(money(o.total), refundAmt, o.paymentBreakdown, o.paymentMethod);
            const sliceKey = netBuckets.size === 1
                ? [...netBuckets.keys()][0]
                : (0, payment_breakdown_1.normalizePaymentMethod)(o.paymentMethod || "") || "other";
            payments[sliceKey] = payments[sliceKey] || { count: 0, total: 0 };
            payments[sliceKey].count += 1;
            for (const [method, net] of netBuckets) {
                payments[method] = payments[method] || { count: 0, total: 0 };
                payments[method].total += net;
            }
            if (refundAmt > 0) {
                for (const [method, amt] of (0, payment_breakdown_1.refundBucketsFromCumulative)(refundAmt, o.paymentBreakdown, o.paymentMethod, money(o.total))) {
                    refundByMethod[method] = round2((refundByMethod[method] || 0) + amt);
                }
            }
            const ch = String(o.fulfillmentChannel || "takeaway");
            channels[ch] = channels[ch] || { count: 0, total: 0 };
            channels[ch].count += 1;
            channels[ch].total += brut;
            vatByChannel[ch] = vatByChannel[ch] || { brut: 0, tva: 0 };
            vatByChannel[ch].brut += brut;
            vatByChannel[ch].tva += taxKept;
            const staff = resolveStaffName(o);
            const st = staffMap.get(staff) || { name: staff, count: 0, total: 0 };
            st.count += 1;
            st.total += brut;
            staffMap.set(staff, st);
            for (const item of o.items || []) {
                const key = item.productId || item.productName || "open";
                const name = item.productName || "Item";
                const qty = money(item.quantity);
                const refundedQty = money(item.refundedQuantity);
                const keptQty = Math.max(0, qty - refundedQty);
                if (keptQty <= 0.0005)
                    continue;
                const cur = products.get(key) || { name, qty: 0, total: 0 };
                const unit = qty > 0 ? money(item.totalPrice) / qty : 0;
                cur.qty += keptQty;
                cur.total += unit * keptQty;
                products.set(key, cur);
            }
        }
        const cancelledOrders = cancelled.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            total: round2(money(o.total)),
            cancelReason: o.cancelReason || null,
            channel: o.fulfillmentChannel || "takeaway",
            staffName: o.staffName || null,
            cancelledAt: o.cancelledAt?.toISOString?.() ?? o.createdAt?.toISOString?.() ?? null,
        }));
        const refundedOrders = refunded.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            total: round2(money(o.total)),
            refundAmount: round2(money(o.refundAmount || o.total)),
            refundReason: o.refundReason || null,
            channel: o.fulfillmentChannel || "takeaway",
            staffName: o.staffName || null,
            refundedAt: o.refundedAt?.toISOString?.() ?? o.completedAt?.toISOString?.() ?? null,
            status: o.status,
        }));
        for (const o of cancelled) {
            cancelledTotal += money(o.total);
        }
        for (const o of refunded) {
            if (!completed.includes(o))
                refundTotal += money(o.refundAmount || o.total);
        }
        const rateFor = (ch) => {
            if (ch === "dine_in")
                return rateDineIn;
            if (ch === "delivery")
                return rateDelivery;
            return rateTakeaway;
        };
        const vatRows = Object.entries(vatByChannel)
            .map(([ch, v]) => {
            const brut = round2(v.brut);
            const tva = round2(v.tva);
            const rate = rateFor(ch);
            return {
                label: `${channelLabel(ch)} ${rate.toFixed(1)}%`,
                channel: ch,
                rate,
                net: round2(brut - tva),
                tva,
                brut,
            };
        })
            .sort((a, b) => b.brut - a.brut);
        const netTotal = round2(revenue - taxTotal);
        const grandTotal = round2(revenue + tipsTotal);
        const productsSold = [...products.values()]
            .sort((a, b) => b.total - a.total)
            .slice(0, 100)
            .map((p) => ({
            name: p.name,
            quantity: Math.round(p.qty * 1000) / 1000,
            total: round2(p.total),
        }));
        const userPerformance = [...staffMap.values()]
            .sort((a, b) => b.total - a.total)
            .map((u) => ({
            name: u.name,
            salesCount: u.count,
            total: round2(u.total),
        }));
        const orderTypeRows = Object.entries(channels).map(([channel, v]) => ({
            channel,
            label: channelLabel(channel),
            count: v.count,
            percent: completed.length
                ? round2((v.count / completed.length) * 100)
                : 0,
            total: round2(v.total),
        }));
        // Closed shifts overlapping the report period (for opening float / fond de base on EOD).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shiftConditions = [
            (0, drizzle_orm_1.eq)(db_1.schema.posShifts.merchantId, merchantId),
            (0, drizzle_orm_1.eq)(db_1.schema.posShifts.status, "closed"),
            (0, drizzle_orm_1.gte)(db_1.schema.posShifts.closedAt, range.start),
            (0, drizzle_orm_1.lte)(db_1.schema.posShifts.closedAt, range.end),
        ];
        if (scopeStaffId) {
            const shiftMatch = scopeStaffName
                ? (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.posShifts.staffId, scopeStaffId), (0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(db_1.schema.posShifts.staffId), (0, drizzle_orm_1.eq)(db_1.schema.posShifts.staffName, scopeStaffName)))
                : (0, drizzle_orm_1.eq)(db_1.schema.posShifts.staffId, scopeStaffId);
            if (shiftMatch)
                shiftConditions.push(shiftMatch);
        }
        const closedShifts = await db.query.posShifts.findMany({
            where: (0, drizzle_orm_1.and)(...shiftConditions),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.posShifts.closedAt)],
        });
        const shiftIds = closedShifts.map((s) => s.id);
        const movementTotals = new Map();
        if (shiftIds.length) {
            try {
                const movementRows = await db
                    .select({
                    shiftId: db_1.schema.posCashMovements.shiftId,
                    type: db_1.schema.posCashMovements.type,
                    amount: db_1.schema.posCashMovements.amount,
                    reason: db_1.schema.posCashMovements.reason,
                    staffName: db_1.schema.posCashMovements.staffName,
                    createdAt: db_1.schema.posCashMovements.createdAt,
                })
                    .from(db_1.schema.posCashMovements)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posCashMovements.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.posCashMovements.shiftId, shiftIds)));
                for (const row of movementRows) {
                    const cur = movementTotals.get(row.shiftId) || {
                        cashIn: 0,
                        cashOut: 0,
                        movements: [],
                    };
                    const amt = money(row.amount);
                    const type = String(row.type).toLowerCase() === "out" ? "out" : "in";
                    if (type === "out")
                        cur.cashOut = round2(cur.cashOut + amt);
                    else
                        cur.cashIn = round2(cur.cashIn + amt);
                    cur.movements.push({
                        type,
                        amount: round2(amt),
                        reason: row.reason || null,
                        staffName: row.staffName || null,
                        createdAt: row.createdAt?.toISOString?.() ?? null,
                    });
                    movementTotals.set(row.shiftId, cur);
                }
                for (const cur of movementTotals.values()) {
                    cur.movements.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
                }
            }
            catch {
                /* table may not exist yet on older DBs */
            }
        }
        const cashRefundForOrder = (o) => {
            const status = String(o.status || "").toLowerCase();
            if (status === "cancelled" || status === "canceled")
                return 0;
            const refundAmt = money(o.refundAmount);
            if (refundAmt <= 0)
                return 0;
            if (status === "refunded") {
                const full = refundAmt > 0 ? refundAmt : money(o.total);
                return (0, payment_breakdown_1.refundBucketsFromCumulative)(full, o.paymentBreakdown, o.paymentMethod, money(o.total)).get("cash") || 0;
            }
            return (0, payment_breakdown_1.refundBucketsFromCumulative)(refundAmt, o.paymentBreakdown, o.paymentMethod, money(o.total)).get("cash") || 0;
        };
        const shiftCash = closedShifts.map((s) => {
            const mov = movementTotals.get(s.id) || { cashIn: 0, cashOut: 0, movements: [] };
            const openedAt = s.openedAt ? new Date(s.openedAt).getTime() : 0;
            const closedAt = s.closedAt ? new Date(s.closedAt).getTime() : Number.POSITIVE_INFINITY;
            const cashRefunds = round2(rows.reduce((sum, o) => {
                const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
                if (t < openedAt || t > closedAt)
                    return sum;
                return sum + cashRefundForOrder(o);
            }, 0));
            const openingFloat = round2(money(s.openingCash));
            const cashSales = round2(money(s.cashSales));
            const storedExpected = s.expectedCash != null ? round2(money(s.expectedCash)) : null;
            const expectedCash = storedExpected != null && Number.isFinite(storedExpected)
                ? storedExpected
                : round2(openingFloat + cashSales + mov.cashIn - mov.cashOut);
            return {
                openingFloat,
                cashSales,
                cashIn: mov.cashIn,
                cashOut: mov.cashOut,
                cashRefunds,
                movements: mov.movements,
                expectedCash,
                closingCashCounted: s.closingCashCounted != null ? round2(money(s.closingCashCounted)) : null,
                variance: s.variance != null ? round2(money(s.variance)) : null,
                staffName: s.staffName || null,
                openedAt: s.openedAt?.toISOString?.() ?? null,
                closedAt: s.closedAt?.toISOString?.() ?? null,
            };
        });
        const salesScope = scopeStaffId
            ? {
                mode: "own",
                staffId: scopeStaffId,
                staffName: scopeStaffName || null,
            }
            : { mode: "all", staffId: null, staffName: null };
        return {
            range: {
                preset: opts.preset || "today",
                from: range.from,
                to: range.to,
                label: range.label,
                start: range.start.toISOString(),
                end: range.end.toISOString(),
            },
            salesScope,
            salesCount: completed.length,
            cancelledCount: cancelled.length,
            cancelledOrders,
            refundCount: refunded.length,
            refundedOrders,
            /** Taxable revenue / net sales (tips excluded — tips are not taxable) */
            revenue: round2(revenue),
            /** Alias of revenue for clients that want an explicit “excl. tips” field */
            netSalesExclTips: round2(revenue),
            subtotal: round2(subtotal),
            taxTotal: round2(taxTotal),
            /** Net of VAT (also excl. tips) */
            netTotal,
            brutTotal: round2(revenue),
            discountTotal: round2(discountTotal),
            tipsTotal: round2(tipsTotal),
            refundTotal: round2(refundTotal),
            cancelledTotal: round2(cancelledTotal),
            /** Net sales + tips (money collected) */
            grandTotal,
            coversServed: covers || null,
            vatRows,
            paymentRows: Object.entries(payments)
                .map(([method, v]) => ({
                method,
                count: v.count,
                total: round2(v.total),
                percent: grandTotal > 0 ? round2((v.total / grandTotal) * 100) : 0,
            }))
                .sort((a, b) => b.total - a.total),
            refundRows: Object.entries(refundByMethod)
                .map(([method, total]) => ({
                method,
                total: round2(total),
            }))
                .filter((r) => r.total > 0)
                .sort((a, b) => b.total - a.total),
            channelRows: Object.entries(channels).map(([channel, v]) => ({
                channel,
                count: v.count,
                total: round2(v.total),
            })),
            orderTypeRows,
            productsSold,
            userPerformance,
            cashTotal: round2(payments.cash?.total || 0),
            cardTotal: round2(payments.card?.total || 0),
            terminalTotal: round2(payments.terminal?.total || 0),
            /** Opening float (fond de base) + drawer reconciliation per closed shift */
            shiftCash,
            businessName: merchant?.name || "",
        };
    }
    /**
     * Merchant Overview dashboard: EOD metrics + sales-over-time + period comparison.
     */
    static async getOverviewDashboard(merchantId, opts) {
        const current = await this.getEndOfDayReport(merchantId, opts);
        const range = resolveReportRange(opts.preset || "today", opts.from, opts.to);
        const msPerDay = 24 * 3600000;
        const spanDays = Math.max(1, Math.round((zurichDayBounds(range.to).start.getTime() -
            zurichDayBounds(range.from).start.getTime()) /
            msPerDay) + 1);
        // Previous period of equal length ending the day before `from`.
        const prevTo = addDaysYmd(range.from, -1);
        const prevFrom = addDaysYmd(prevTo, -(spanDays - 1));
        const previous = await this.getEndOfDayReport(merchantId, {
            preset: "custom",
            from: prevFrom,
            to: prevTo,
            staffId: opts.staffId,
            staffName: opts.staffName,
        });
        const pctChange = (cur, prev) => {
            if (!prev && !cur)
                return 0;
            if (!prev)
                return 100;
            return round2(((cur - prev) / Math.abs(prev)) * 100);
        };
        const totalSales = current.revenue;
        const netSales = current.netTotal;
        const fundingAmount = round2(current.revenue + current.tipsTotal);
        const orders = current.salesCount;
        const customers = current.coversServed ?? current.salesCount;
        const db = (0, db_1.getDb)();
        const conditions = [
            (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId),
            (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, range.start),
            (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, range.end),
        ];
        const rows = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)(...conditions),
            columns: {
                createdAt: true,
                total: true,
                tipAmount: true,
                refundAmount: true,
                status: true,
                paymentStatus: true,
            },
        });
        const completed = rows.filter((o) => isCountableSale(o));
        const singleDay = range.from === range.to;
        const salesOverTime = [];
        const hourBuckets = Array.from({ length: 24 }, () => 0);
        for (const o of completed) {
            const hour = Number(new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/Zurich",
                hour: "2-digit",
                hour12: false,
            }).format(o.createdAt));
            const brut = (0, payment_breakdown_1.netTaxableSale)(Number(o.total || 0), Number(o.tipAmount || 0), Number(o.refundAmount || 0));
            if (hour >= 0 && hour < 24)
                hourBuckets[hour] += brut;
        }
        const salesByHour = hourBuckets.map((amount, h) => ({
            label: String(h).padStart(2, "0"),
            amount: round2(amount),
        }));
        if (singleDay) {
            for (let h = 0; h < 24; h++) {
                salesOverTime.push({
                    label: String(h).padStart(2, "0"),
                    amount: round2(hourBuckets[h] || 0),
                });
            }
        }
        else {
            const byDay = new Map();
            let cursor = range.from;
            while (cursor <= range.to) {
                byDay.set(cursor, 0);
                cursor = addDaysYmd(cursor, 1);
            }
            for (const o of completed) {
                const day = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Europe/Zurich",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                }).format(o.createdAt);
                const brut = (0, payment_breakdown_1.netTaxableSale)(Number(o.total || 0), Number(o.tipAmount || 0), Number(o.refundAmount || 0));
                if (byDay.has(day))
                    byDay.set(day, (byDay.get(day) || 0) + brut);
            }
            for (const [label, amount] of byDay) {
                salesOverTime.push({ label, amount: round2(amount) });
            }
        }
        const paymentMethods = (current.paymentRows || []).map((p) => ({
            method: p.method,
            label: (0, payment_breakdown_1.paymentMethodLabelEn)(p.method),
            total: p.total,
            count: p.count,
            percent: p.percent ?? 0,
        }));
        const orderTypes = (current.orderTypeRows || []).map((r) => {
            const salesTotal = totalSales || 1;
            return {
                channel: r.channel,
                label: r.label,
                total: r.total,
                count: r.count,
                percent: round2((r.total / salesTotal) * 100),
            };
        });
        return {
            range: current.range,
            kpis: {
                totalSales,
                netSales,
                fundingAmount,
                orders,
                customers,
                tipsTotal: current.tipsTotal,
                taxTotal: current.taxTotal,
                changes: {
                    totalSales: pctChange(totalSales, previous.revenue),
                    netSales: pctChange(netSales, previous.netTotal),
                    fundingAmount: pctChange(fundingAmount, round2(previous.revenue + previous.tipsTotal)),
                    orders: pctChange(orders, previous.salesCount),
                    customers: pctChange(customers, previous.coversServed ?? previous.salesCount),
                },
                previousLabel: previous.range.label,
            },
            salesBreakdown: {
                productAmount: netSales,
                tax: current.taxTotal,
                totalSales,
            },
            salesOverTime,
            salesByHour,
            paymentMethods,
            orderTypes,
            products: (current.productsSold || []).slice(0, 12),
            staff: current.userPerformance || [],
            shiftCash: current.shiftCash || [],
            businessName: current.businessName,
            /** Full EOD payload for export / email */
            eod: current,
            previous: {
                range: previous.range,
                totalSales: previous.revenue,
                netSales: previous.netTotal,
                orders: previous.salesCount,
            },
        };
    }
    /** Top product ids by quantity sold over the last N days (for POS "Most Sold" category). */
    static async getBestsellerProductIds(merchantId, opts = {}) {
        const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
        const days = Math.min(90, Math.max(1, opts.days ?? 30));
        const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const db = (0, db_1.getDb)();
        const orders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, start), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "partially_refunded"), (0, drizzle_orm_1.eq)(db_1.schema.orders.paymentStatus, "completed"), (0, drizzle_orm_1.eq)(db_1.schema.orders.paymentStatus, "paid"), (0, drizzle_orm_1.eq)(db_1.schema.orders.paymentStatus, "partially_refunded"))),
            with: { items: true },
        });
        const qtyByProduct = new Map();
        for (const order of orders) {
            for (const item of order.items || []) {
                const pid = item.productId ? String(item.productId) : null;
                if (!pid)
                    continue;
                const qty = Number(item.quantity) || 0;
                const refunded = Number(item.refundedQuantity) || 0;
                const kept = Math.max(0, qty - refunded);
                if (kept <= 0)
                    continue;
                qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + kept);
            }
        }
        return [...qtyByProduct.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id]) => id);
    }
    /** Revenue list by day, calendar week, or month (SumUp-style reporting). */
    static async getRevenueBreakdown(merchantId, opts) {
        const year = Math.max(2020, Math.min(2100, opts.year || new Date().getFullYear()));
        const month = opts.month != null ? Math.max(1, Math.min(12, opts.month)) : undefined;
        const db = (0, db_1.getDb)();
        let rangeStart;
        let rangeEnd;
        if (opts.mode === "custom") {
            const range = resolveReportRange("custom", opts.from, opts.to);
            rangeStart = range.start;
            rangeEnd = range.end;
        }
        else if (opts.mode === "months") {
            rangeStart = zurichDayBounds(`${year}-01-01`).start;
            rangeEnd = zurichDayBounds(`${year}-12-31`).end;
        }
        else {
            const m = month || new Date().getMonth() + 1;
            const mm = String(m).padStart(2, "0");
            const lastDay = new Date(year, m, 0).getDate();
            rangeStart = zurichDayBounds(`${year}-${mm}-01`).start;
            rangeEnd = zurichDayBounds(`${year}-${mm}-${String(lastDay).padStart(2, "0")}`).end;
        }
        const orders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, rangeStart), (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, rangeEnd)),
            columns: {
                createdAt: true,
                total: true,
                tipAmount: true,
                refundAmount: true,
                status: true,
                paymentStatus: true,
                staffId: true,
                staffName: true,
            },
        });
        const scoped = orders.filter((o) => {
            if (!isCountableSale(o))
                return false;
            if (opts.staffId) {
                return (String(o.staffId || "") === String(opts.staffId) ||
                    (!o.staffId && opts.staffName && String(o.staffName || "") === opts.staffName));
            }
            return true;
        });
        const saleAmount = (o) => (0, payment_breakdown_1.netTaxableSale)(Number(o.total || 0), Number(o.tipAmount || 0), Number(o.refundAmount || 0));
        const fmtDay = (d) => new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Zurich",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(d);
        const fmtDisplayDay = (ymd) => {
            const [y, m, d] = ymd.split("-").map(Number);
            const dt = new Date(`${ymd}T12:00:00+02:00`);
            const weekday = new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/Zurich",
                weekday: "long",
            }).format(dt);
            return {
                label: `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`,
                sublabel: weekday,
                sortKey: ymd,
            };
        };
        const isoWeek = (d) => {
            const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
            return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        };
        const rows = [];
        if (opts.mode === "days" || opts.mode === "custom") {
            const byDay = new Map();
            if (opts.mode === "custom") {
                const cur = new Date(rangeStart);
                while (cur <= rangeEnd) {
                    const ymd = fmtDay(cur);
                    byDay.set(ymd, 0);
                    cur.setDate(cur.getDate() + 1);
                }
            }
            else {
                const m = month || 1;
                const mm = String(m).padStart(2, "0");
                const lastDay = new Date(year, m, 0).getDate();
                for (let d = lastDay; d >= 1; d--) {
                    const ymd = `${year}-${mm}-${String(d).padStart(2, "0")}`;
                    byDay.set(ymd, 0);
                }
            }
            for (const o of scoped) {
                const day = fmtDay(o.createdAt);
                if (byDay.has(day))
                    byDay.set(day, (byDay.get(day) || 0) + saleAmount(o));
            }
            for (const [ymd, total] of byDay) {
                const { label, sublabel, sortKey } = fmtDisplayDay(ymd);
                rows.push({ id: ymd, label, sublabel, total: round2(total), sortKey, from: ymd, to: ymd });
            }
            rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        }
        else if (opts.mode === "weeks") {
            const byWeek = new Map();
            for (const o of scoped) {
                const day = fmtDay(o.createdAt);
                const dt = new Date(`${day}T12:00:00+02:00`);
                const w = isoWeek(dt);
                const key = `${year}-W${String(w).padStart(2, "0")}`;
                const cur = byWeek.get(key) || { total: 0, week: w, from: day, to: day };
                cur.total += saleAmount(o);
                if (day < cur.from)
                    cur.from = day;
                if (day > cur.to)
                    cur.to = day;
                byWeek.set(key, cur);
            }
            const m = month || 1;
            const mm = String(m).padStart(2, "0");
            const monthStart = `${year}-${mm}-01`;
            const lastDay = new Date(year, m, 0).getDate();
            const monthEnd = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
            for (const [, v] of byWeek) {
                if (v.to < monthStart || v.from > monthEnd)
                    continue;
                const fmtShort = (ymd) => {
                    const [, mo, da] = ymd.split("-");
                    return `${da}.${mo}`;
                };
                const fmtEnd = (ymd) => {
                    const [y, mo, da] = ymd.split("-");
                    return `${da}.${mo}.${y}`;
                };
                rows.push({
                    id: `CW${v.week}`,
                    label: `CW ${v.week}`,
                    sublabel: `${fmtShort(v.from)} - ${fmtEnd(v.to)}`,
                    total: round2(v.total),
                    sortKey: String(v.week).padStart(2, "0"),
                    from: v.from,
                    to: v.to,
                });
            }
            rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        }
        else {
            const byMonth = new Map();
            for (let m = 12; m >= 1; m--) {
                byMonth.set(String(m).padStart(2, "0"), 0);
            }
            for (const o of scoped) {
                const parts = fmtDay(o.createdAt).split("-");
                const mo = parts[1] || "01";
                if (byMonth.has(mo))
                    byMonth.set(mo, (byMonth.get(mo) || 0) + saleAmount(o));
            }
            const monthNames = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ];
            for (const [mo, total] of byMonth) {
                const idx = Number(mo) - 1;
                const lastDay = new Date(year, Number(mo), 0).getDate();
                const from = `${year}-${mo}-01`;
                const to = `${year}-${mo}-${String(lastDay).padStart(2, "0")}`;
                rows.push({
                    id: `${year}-${mo}`,
                    label: monthNames[idx] || mo,
                    total: round2(total),
                    sortKey: mo,
                    from,
                    to,
                });
            }
            rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        }
        return {
            mode: opts.mode,
            year,
            month: month || null,
            rows,
        };
    }
}
exports.PosReportsService = PosReportsService;
//# sourceMappingURL=pos-reports.service.js.map