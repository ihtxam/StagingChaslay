"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderPurgeService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const sales_adjustment_service_1 = require("@/services/sales-adjustment.service");
class OrderPurgeService {
    /** Completed, fully paid, 100% cash POS tickets only — permanent removal from reports. */
    static isPurgeEligible(order) {
        if (!(0, sales_adjustment_service_1.isCompletedPaidCashAdjustmentOrder)(order))
            return false;
        return (0, sales_adjustment_service_1.isCashOnlyOrder)(order);
    }
    static async purgeOrders(merchantId, orderIds) {
        const uniqueIds = [...new Set(orderIds.map((id) => String(id || "").trim()).filter(Boolean))];
        if (!uniqueIds.length)
            throw new Error("Select at least one order to delete");
        const db = (0, db_1.getDb)();
        const rows = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.id, uniqueIds)),
        });
        if (!rows.length)
            throw new Error("No matching orders found");
        const foundIds = new Set(rows.map((r) => r.id));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        if (missing.length)
            throw new Error("One or more orders were not found");
        const eligible = [];
        const skipped = [];
        for (const row of rows) {
            if (this.isPurgeEligible(row))
                eligible.push(row.id);
            else
                skipped.push(row.id);
        }
        if (!eligible.length) {
            throw new Error("None of the selected orders can be deleted. Only completed, fully paid, 100% cash sales are eligible.");
        }
        await db.transaction(async (tx) => {
            await tx
                .update(db_1.schema.diningTables)
                .set({ status: "available", currentOrderId: null })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.diningTables.currentOrderId, eligible)));
            await tx
                .delete(db_1.schema.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.id, eligible)));
        });
        return {
            deletedCount: eligible.length,
            deletedIds: eligible,
            skippedIds: skipped,
        };
    }
}
exports.OrderPurgeService = OrderPurgeService;
//# sourceMappingURL=order-purge.service.js.map