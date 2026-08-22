"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantDataResetService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
/**
 * Remove all transactional / sales data for a merchant so they can start fresh after testing.
 * Keeps menu, staff, settings, licenses, devices, and floor plan layout.
 */
class MerchantDataResetService {
    static async purgeSalesData(merchantId, opts = {}) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const deleteReservations = opts.deleteReservations !== false;
        const deleteCustomers = !!opts.deleteCustomers;
        return db.transaction(async (tx) => {
            const loyaltyPointEvents = await tx
                .delete(db_1.schema.loyaltyPointEvents)
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointEvents.merchantId, merchantId))
                .returning({ id: db_1.schema.loyaltyPointEvents.id });
            const loyaltyPointLots = await tx
                .delete(db_1.schema.loyaltyPointLots)
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.merchantId, merchantId))
                .returning({ id: db_1.schema.loyaltyPointLots.id });
            const loyaltyTransactions = await tx
                .delete(db_1.schema.loyaltyTransactions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyTransactions.merchantId, merchantId))
                .returning({ id: db_1.schema.loyaltyTransactions.id });
            const paymentTransactions = await tx
                .delete(db_1.schema.paymentTransactions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.merchantId, merchantId))
                .returning({ id: db_1.schema.paymentTransactions.id });
            const orders = await tx
                .delete(db_1.schema.orders)
                .where((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId))
                .returning({ id: db_1.schema.orders.id });
            const heldOrders = await tx
                .delete(db_1.schema.heldOrders)
                .where((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId))
                .returning({ id: db_1.schema.heldOrders.id });
            const dailyReports = await tx
                .delete(db_1.schema.dailyReports)
                .where((0, drizzle_orm_1.eq)(db_1.schema.dailyReports.merchantId, merchantId))
                .returning({ id: db_1.schema.dailyReports.id });
            const posShifts = await tx
                .delete(db_1.schema.posShifts)
                .where((0, drizzle_orm_1.eq)(db_1.schema.posShifts.merchantId, merchantId))
                .returning({ id: db_1.schema.posShifts.id });
            const giftCardTransactions = await tx
                .delete(db_1.schema.giftCardTransactions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.giftCardTransactions.merchantId, merchantId))
                .returning({ id: db_1.schema.giftCardTransactions.id });
            const floorTableOrders = await tx
                .delete(db_1.schema.chaslayFloorTableOrders)
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorTableOrders.merchantId, merchantId))
                .returning({ id: db_1.schema.chaslayFloorTableOrders.id });
            const floorPrintJobs = await tx
                .delete(db_1.schema.chaslayFloorPrintJobs)
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.merchantId, merchantId))
                .returning({ id: db_1.schema.chaslayFloorPrintJobs.id });
            let reservations = [];
            if (deleteReservations) {
                reservations = await tx
                    .delete(db_1.schema.reservations)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId))
                    .returning({ id: db_1.schema.reservations.id });
            }
            const diningTablesReset = await tx
                .update(db_1.schema.diningTables)
                .set({ status: "available", currentOrderId: null })
                .where((0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId))
                .returning({ id: db_1.schema.diningTables.id });
            const loyaltyCardsReset = await tx
                .update(db_1.schema.loyaltyCards)
                .set({ pointsBalance: 0, balance: "0" })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId))
                .returning({ id: db_1.schema.loyaltyCards.id });
            const giftCardsReset = await tx
                .update(db_1.schema.giftCards)
                .set({
                balance: "0",
                pointsBalance: 0,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.giftCards.merchantId, merchantId))
                .returning({ id: db_1.schema.giftCards.id });
            let customersDeleted = [];
            let customersReset = [];
            if (deleteCustomers) {
                await tx
                    .delete(db_1.schema.customerAddresses)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId));
                customersDeleted = await tx
                    .delete(db_1.schema.customers)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId))
                    .returning({ id: db_1.schema.customers.id });
            }
            else {
                customersReset = await tx
                    .update(db_1.schema.customers)
                    .set({
                    totalSpent: "0",
                    loyaltyPoints: 0,
                    lastOrderAt: null,
                    lastReorderReminderAt: null,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId))
                    .returning({ id: db_1.schema.customers.id });
            }
            return {
                merchantId,
                merchantName: merchant.name,
                deleted: {
                    orders: orders.length,
                    heldOrders: heldOrders.length,
                    paymentTransactions: paymentTransactions.length,
                    dailyReports: dailyReports.length,
                    posShifts: posShifts.length,
                    floorTableOrders: floorTableOrders.length,
                    floorPrintJobs: floorPrintJobs.length,
                    loyaltyTransactions: loyaltyTransactions.length,
                    loyaltyPointLots: loyaltyPointLots.length,
                    loyaltyPointEvents: loyaltyPointEvents.length,
                    giftCardTransactions: giftCardTransactions.length,
                    reservations: reservations.length,
                    ...(deleteCustomers ? { customers: customersDeleted.length } : {}),
                },
                reset: {
                    diningTables: diningTablesReset.length,
                    loyaltyCards: loyaltyCardsReset.length,
                    giftCards: giftCardsReset.length,
                    customers: deleteCustomers ? 0 : customersReset.length,
                },
            };
        });
    }
}
exports.MerchantDataResetService = MerchantDataResetService;
//# sourceMappingURL=merchant-data-reset.service.js.map