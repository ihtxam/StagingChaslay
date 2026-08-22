"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosShiftService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const geo_1 = require("@/lib/geo");
function round2(n) {
    return Math.round(n * 100) / 100;
}
function num(v) {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
}
/** Drawer expected: opening + cash sales (net of refunds) + cash in − cash out. */
function expectedDrawer(openingCash, cashSales, cashIn, cashOut) {
    return round2(num(openingCash) + cashSales + cashIn - cashOut);
}
/** Calendar YYYY-MM-DD in merchant timezone (Europe/Zurich). */
function ymdInMerchantTz(d = new Date(), timeZone = geo_1.MERCHANT_TZ) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}
/** Start/end of a Zurich calendar day. */
function zurichDayBounds(ymd) {
    const fallbackStart = new Date(`${ymd}T00:00:00+02:00`);
    const fallbackEnd = new Date(`${ymd}T23:59:59.999+02:00`);
    try {
        const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: geo_1.MERCHANT_TZ,
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
        return { start: fallbackStart, end: fallbackEnd };
    }
}
const AUTO_CLOSE_NOTE = "Auto-closed at end of business day (23:59 Europe/Zurich)";
class PosShiftService {
    static async getOpenShift(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.posShifts.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posShifts.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.posShifts.status, "open")),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.posShifts.openedAt)],
        });
    }
    /**
     * Close open shifts whose opening day is before today (merchant TZ).
     * Used by the hourly job and on next open / current-shift fetch.
     * Counted cash = expected (variance 0); notes mark auto-close.
     */
    static async autoCloseStaleShifts(merchantId) {
        const db = (0, db_1.getDb)();
        const todayYmd = ymdInMerchantTz();
        const { start: todayStart } = zurichDayBounds(todayYmd);
        const openShifts = await db.query.posShifts.findMany({
            where: merchantId
                ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posShifts.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.posShifts.status, "open"), (0, drizzle_orm_1.lt)(db_1.schema.posShifts.openedAt, todayStart))
                : (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posShifts.status, "open"), (0, drizzle_orm_1.lt)(db_1.schema.posShifts.openedAt, todayStart)),
        });
        let closed = 0;
        for (const open of openShifts) {
            try {
                const openedYmd = ymdInMerchantTz(open.openedAt);
                const { end: dayEnd } = zurichDayBounds(openedYmd);
                const live = await this.computeLiveTotals(open.merchantId, open.openedAt, dayEnd);
                const movements = await this.sumCashMovements(open.id);
                const expectedCash = expectedDrawer(num(open.openingCash), live.cashSales, movements.cashIn, movements.cashOut);
                await db
                    .update(db_1.schema.posShifts)
                    .set({
                    status: "closed",
                    closedAt: dayEnd,
                    closingCashCounted: expectedCash.toFixed(2),
                    expectedCash: expectedCash.toFixed(2),
                    cashSales: live.cashSales.toFixed(2),
                    cardSales: live.cardSales.toFixed(2),
                    terminalSales: live.terminalSales.toFixed(2),
                    otherSales: live.otherSales.toFixed(2),
                    orderCount: live.orderCount,
                    variance: "0.00",
                    notes: open.notes?.trim()
                        ? `${open.notes.trim()}\n${AUTO_CLOSE_NOTE}`
                        : AUTO_CLOSE_NOTE,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posShifts.id, open.id), (0, drizzle_orm_1.eq)(db_1.schema.posShifts.status, "open")));
                closed += 1;
            }
            catch (err) {
                console.error(`[pos-shifts] auto-close failed for ${open.id}`, err);
            }
        }
        return closed;
    }
    static async getCurrent(merchantId) {
        await this.autoCloseStaleShifts(merchantId);
        const open = await this.getOpenShift(merchantId);
        if (!open)
            return { shift: null, live: null };
        const live = await this.computeLiveTotals(merchantId, open.openedAt);
        const movements = await this.sumCashMovements(open.id);
        return {
            shift: this.serialize(open),
            live: {
                ...live,
                cashIn: movements.cashIn,
                cashOut: movements.cashOut,
                cashRefunds: live.cashRefunds,
                expectedCash: expectedDrawer(num(open.openingCash), live.cashSales, movements.cashIn, movements.cashOut),
            },
        };
    }
    static async startShift(merchantId, input) {
        await this.autoCloseStaleShifts(merchantId);
        const existing = await this.getOpenShift(merchantId);
        if (existing) {
            throw new Error("A shift is already open. Close it before starting a new one.");
        }
        // Opening float is optional — blank / null / NaN → 0
        const openingCash = round2(Math.max(0, Number(input.openingCash) || 0));
        const db = (0, db_1.getDb)();
        const [created] = await db
            .insert(db_1.schema.posShifts)
            .values({
            merchantId,
            staffId: input.staffId || null,
            staffName: input.staffName || null,
            status: "open",
            openingCash: openingCash.toFixed(2),
        })
            .returning();
        return this.serialize(created);
    }
    static async closeShift(merchantId, input) {
        const open = await this.getOpenShift(merchantId);
        if (!open)
            throw new Error("No open shift to close.");
        const live = await this.computeLiveTotals(merchantId, open.openedAt);
        const movements = await this.sumCashMovements(open.id);
        const movementLines = await this.listCashMovements(merchantId, open.id);
        const expectedCash = expectedDrawer(num(open.openingCash), live.cashSales, movements.cashIn, movements.cashOut);
        const counted = round2(Math.max(0, Number(input.closingCashCounted) || 0));
        const variance = round2(counted - expectedCash);
        const db = (0, db_1.getDb)();
        const [updated] = await db
            .update(db_1.schema.posShifts)
            .set({
            status: "closed",
            closedAt: new Date(),
            closingCashCounted: counted.toFixed(2),
            expectedCash: expectedCash.toFixed(2),
            cashSales: live.cashSales.toFixed(2),
            cardSales: live.cardSales.toFixed(2),
            terminalSales: live.terminalSales.toFixed(2),
            otherSales: live.otherSales.toFixed(2),
            orderCount: live.orderCount,
            variance: variance.toFixed(2),
            notes: input.notes?.trim() || null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posShifts.id, open.id), (0, drizzle_orm_1.eq)(db_1.schema.posShifts.merchantId, merchantId)))
            .returning();
        return {
            shift: this.serialize(updated),
            balanced: Math.abs(variance) < 0.005,
            reportPeriod: {
                from: open.openedAt.toISOString(),
                to: (updated.closedAt || new Date()).toISOString(),
            },
            cashIn: movements.cashIn,
            cashOut: movements.cashOut,
            cashRefunds: live.cashRefunds,
            movements: movementLines,
        };
    }
    /** Sum completed POS orders in [openedAt, until). */
    static async sumCashMovements(shiftId) {
        const db = (0, db_1.getDb)();
        try {
            const rows = await db
                .select({
                type: db_1.schema.posCashMovements.type,
                amount: db_1.schema.posCashMovements.amount,
            })
                .from(db_1.schema.posCashMovements)
                .where((0, drizzle_orm_1.eq)(db_1.schema.posCashMovements.shiftId, shiftId));
            let cashIn = 0;
            let cashOut = 0;
            for (const row of rows) {
                const amt = num(row.amount);
                if (String(row.type).toLowerCase() === "out")
                    cashOut += amt;
                else
                    cashIn += amt;
            }
            return { cashIn: round2(cashIn), cashOut: round2(cashOut) };
        }
        catch {
            return { cashIn: 0, cashOut: 0 };
        }
    }
    static async recordCashMovement(merchantId, input) {
        const open = await this.getOpenShift(merchantId);
        if (!open)
            throw new Error("No open shift. Start a shift before recording cash movements.");
        const type = String(input.type || "").toLowerCase();
        if (type !== "in" && type !== "out")
            throw new Error("type must be 'in' or 'out'");
        const amount = round2(Math.max(0, Number(input.amount) || 0));
        if (amount <= 0)
            throw new Error("amount must be greater than zero");
        const db = (0, db_1.getDb)();
        const [created] = await db
            .insert(db_1.schema.posCashMovements)
            .values({
            merchantId,
            shiftId: open.id,
            staffId: input.staffId || null,
            staffName: input.staffName || null,
            type,
            amount: amount.toFixed(2),
            reason: input.reason?.trim() || null,
        })
            .returning();
        const live = await this.computeLiveTotals(merchantId, open.openedAt);
        const movements = await this.sumCashMovements(open.id);
        return {
            movement: {
                id: created.id,
                shiftId: created.shiftId,
                type: created.type,
                amount: num(created.amount),
                reason: created.reason,
                staffId: created.staffId,
                staffName: created.staffName,
                createdAt: created.createdAt?.toISOString?.() ?? created.createdAt,
            },
            live: {
                ...live,
                cashIn: movements.cashIn,
                cashOut: movements.cashOut,
                cashRefunds: live.cashRefunds,
                expectedCash: expectedDrawer(num(open.openingCash), live.cashSales, movements.cashIn, movements.cashOut),
            },
        };
    }
    static async listCashMovements(merchantId, shiftId) {
        const db = (0, db_1.getDb)();
        try {
            const rows = await db
                .select()
                .from(db_1.schema.posCashMovements)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posCashMovements.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.posCashMovements.shiftId, shiftId)))
                .orderBy((0, drizzle_orm_1.desc)(db_1.schema.posCashMovements.createdAt));
            return rows.map((r) => ({
                id: r.id,
                shiftId: r.shiftId,
                type: r.type,
                amount: num(r.amount),
                reason: r.reason,
                staffId: r.staffId,
                staffName: r.staffName,
                createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
            }));
        }
        catch {
            return [];
        }
    }
    /** Sum completed POS orders in [openedAt, until). */
    static async computeLiveTotals(merchantId, openedAt, until = new Date()) {
        const db = (0, db_1.getDb)();
        const rows = await db
            .select({
            paymentMethod: db_1.schema.orders.paymentMethod,
            total: db_1.schema.orders.total,
            refundAmount: db_1.schema.orders.refundAmount,
            status: db_1.schema.orders.status,
        })
            .from(db_1.schema.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, openedAt), (0, drizzle_orm_1.lt)(db_1.schema.orders.createdAt, until), (0, drizzle_orm_1.sql) `lower(coalesce(${db_1.schema.orders.status}, '')) not in ('cancelled', 'canceled')`));
        let cashSales = 0;
        let cardSales = 0;
        let terminalSales = 0;
        let otherSales = 0;
        let cashRefunds = 0;
        let orderCount = 0;
        for (const row of rows) {
            const status = String(row.status || "").toLowerCase();
            const method = String(row.paymentMethod || "").toLowerCase();
            const refundAmt = num(row.refundAmount);
            if (method === "cash") {
                if (status === "refunded")
                    cashRefunds += refundAmt > 0 ? refundAmt : num(row.total);
                else
                    cashRefunds += Math.max(0, refundAmt);
            }
            // Fully refunded tickets contribute $0 net; partials keep total − refund.
            const amount = status === "refunded"
                ? 0
                : Math.max(0, num(row.total) - refundAmt);
            if (amount <= 0)
                continue;
            orderCount += 1;
            if (method === "cash")
                cashSales += amount;
            else if (method === "card")
                cardSales += amount;
            else if (method === "terminal")
                terminalSales += amount;
            else
                otherSales += amount;
        }
        return {
            cashSales: round2(cashSales),
            cashRefunds: round2(cashRefunds),
            cardSales: round2(cardSales),
            terminalSales: round2(terminalSales),
            otherSales: round2(otherSales),
            orderCount,
            totalSales: round2(cashSales + cardSales + terminalSales + otherSales),
        };
    }
    static serialize(row) {
        return {
            id: row.id,
            merchantId: row.merchantId,
            staffId: row.staffId,
            staffName: row.staffName,
            status: row.status,
            openedAt: row.openedAt?.toISOString?.() ?? row.openedAt,
            closedAt: row.closedAt?.toISOString?.() ?? row.closedAt,
            openingCash: num(row.openingCash),
            closingCashCounted: row.closingCashCounted != null ? num(row.closingCashCounted) : null,
            expectedCash: row.expectedCash != null ? num(row.expectedCash) : null,
            cashSales: num(row.cashSales),
            cardSales: num(row.cardSales),
            terminalSales: num(row.terminalSales),
            otherSales: num(row.otherSales),
            orderCount: row.orderCount ?? 0,
            variance: row.variance != null ? num(row.variance) : null,
            notes: row.notes,
        };
    }
}
exports.PosShiftService = PosShiftService;
//# sourceMappingURL=pos-shift.service.js.map