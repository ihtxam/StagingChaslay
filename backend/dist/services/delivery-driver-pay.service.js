"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryDriverPayService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
function num(v) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
function zurichDayBounds(ymd) {
    const start = new Date(`${ymd}T00:00:00+01:00`);
    const end = new Date(`${ymd}T23:59:59.999+01:00`);
    return { start, end };
}
function ymdInZurich(d = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}
class DeliveryDriverPayService {
    static async ensureSchema() {
        await (0, ensure_merchant_schema_1.ensureMerchantTables)();
    }
    static resolvePayMode(raw) {
        if (raw === "hourly" || raw === "per_order")
            return raw;
        return "both";
    }
    static async getPayConfig(merchantId, staffId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const [merchant, staff] = await Promise.all([
            db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                columns: {
                    deliveryDriverPayMode: true,
                    deliveryDriverHourlyRate: true,
                    deliveryPerOrderFee: true,
                },
            }),
            db.query.merchantStaff.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId)),
                columns: {
                    deliveryHourlyRateOverride: true,
                    deliveryPerOrderFeeOverride: true,
                },
            }),
        ]);
        const hourlyRate = staff?.deliveryHourlyRateOverride != null
            ? num(staff.deliveryHourlyRateOverride)
            : num(merchant?.deliveryDriverHourlyRate);
        const perOrderFee = staff?.deliveryPerOrderFeeOverride != null
            ? num(staff.deliveryPerOrderFeeOverride)
            : num(merchant?.deliveryPerOrderFee);
        return {
            payMode: this.resolvePayMode(merchant?.deliveryDriverPayMode),
            hourlyRate,
            perOrderFee,
        };
    }
    /** Open shift when driver starts GPS tracking (one open shift per staff). */
    static async startShift(merchantId, staffId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const open = await db.query.deliveryDriverShifts.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverShifts.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverShifts.staffId, staffId), (0, drizzle_orm_1.isNull)(db_1.schema.deliveryDriverShifts.endedAt)),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.deliveryDriverShifts.startedAt)],
        });
        if (open)
            return open;
        const [row] = await db
            .insert(db_1.schema.deliveryDriverShifts)
            .values({ merchantId, staffId, startedAt: new Date() })
            .returning();
        return row;
    }
    static async endShift(merchantId, staffId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const open = await db.query.deliveryDriverShifts.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverShifts.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverShifts.staffId, staffId), (0, drizzle_orm_1.isNull)(db_1.schema.deliveryDriverShifts.endedAt)),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.deliveryDriverShifts.startedAt)],
        });
        if (!open)
            return null;
        const now = new Date();
        await db
            .update(db_1.schema.deliveryDriverShifts)
            .set({ endedAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverShifts.id, open.id));
        return { ...open, endedAt: now };
    }
    static async getDailySummary(merchantId, staffId, dateYmd) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const day = dateYmd || ymdInZurich();
        const { start, end } = zurichDayBounds(day);
        const config = await this.getPayConfig(merchantId, staffId);
        const shifts = await db.query.deliveryDriverShifts.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverShifts.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverShifts.staffId, staffId), (0, drizzle_orm_1.gte)(db_1.schema.deliveryDriverShifts.startedAt, start), (0, drizzle_orm_1.lte)(db_1.schema.deliveryDriverShifts.startedAt, end)),
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
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.fulfillmentChannel, "delivery"), (0, drizzle_orm_1.eq)(db_1.schema.orders.assignedDeliveryStaffId, staffId), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.gte)(db_1.schema.orders.completedAt, start), (0, drizzle_orm_1.lte)(db_1.schema.orders.completedAt, end)),
            columns: {
                id: true,
                orderNumber: true,
                total: true,
                completedAt: true,
                customerName: true,
                shippingAddress: true,
            },
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orders.completedAt)],
            limit: 100,
        });
        const deliveryCount = completed.length;
        const hourlyPay = config.payMode === "per_order" ? 0 : round2(hoursWorked * config.hourlyRate);
        const orderPay = config.payMode === "hourly" ? 0 : round2(deliveryCount * config.perOrderFee);
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
exports.DeliveryDriverPayService = DeliveryDriverPayService;
//# sourceMappingURL=delivery-driver-pay.service.js.map