import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export type PurgeSalesDataOptions = {
  /** Also remove customer profiles (default: keep customers, reset stats only) */
  deleteCustomers?: boolean;
  /** Remove table reservations (default: true) */
  deleteReservations?: boolean;
};

export type PurgeSalesDataResult = {
  merchantId: string;
  merchantName: string;
  deleted: {
    orders: number;
    heldOrders: number;
    paymentTransactions: number;
    dailyReports: number;
    posShifts: number;
    floorTableOrders: number;
    floorPrintJobs: number;
    loyaltyTransactions: number;
    loyaltyPointLots: number;
    loyaltyPointEvents: number;
    giftCardTransactions: number;
    reservations: number;
    customers?: number;
  };
  reset: {
    diningTables: number;
    loyaltyCards: number;
    giftCards: number;
    customers: number;
  };
};

/**
 * Remove all transactional / sales data for a merchant so they can start fresh after testing.
 * Keeps menu, staff, settings, licenses, devices, and floor plan layout.
 */
export class MerchantDataResetService {
  static async purgeSalesData(
    merchantId: string,
    opts: PurgeSalesDataOptions = {}
  ): Promise<PurgeSalesDataResult> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const deleteReservations = opts.deleteReservations !== false;
    const deleteCustomers = !!opts.deleteCustomers;

    return db.transaction(async (tx) => {
      const loyaltyPointEvents = await tx
        .delete(schema.loyaltyPointEvents)
        .where(eq(schema.loyaltyPointEvents.merchantId, merchantId))
        .returning({ id: schema.loyaltyPointEvents.id });

      const loyaltyPointLots = await tx
        .delete(schema.loyaltyPointLots)
        .where(eq(schema.loyaltyPointLots.merchantId, merchantId))
        .returning({ id: schema.loyaltyPointLots.id });

      const loyaltyTransactions = await tx
        .delete(schema.loyaltyTransactions)
        .where(eq(schema.loyaltyTransactions.merchantId, merchantId))
        .returning({ id: schema.loyaltyTransactions.id });

      const paymentTransactions = await tx
        .delete(schema.paymentTransactions)
        .where(eq(schema.paymentTransactions.merchantId, merchantId))
        .returning({ id: schema.paymentTransactions.id });

      const orders = await tx
        .delete(schema.orders)
        .where(eq(schema.orders.merchantId, merchantId))
        .returning({ id: schema.orders.id });

      const heldOrders = await tx
        .delete(schema.heldOrders)
        .where(eq(schema.heldOrders.merchantId, merchantId))
        .returning({ id: schema.heldOrders.id });

      const dailyReports = await tx
        .delete(schema.dailyReports)
        .where(eq(schema.dailyReports.merchantId, merchantId))
        .returning({ id: schema.dailyReports.id });

      const posShifts = await tx
        .delete(schema.posShifts)
        .where(eq(schema.posShifts.merchantId, merchantId))
        .returning({ id: schema.posShifts.id });

      const giftCardTransactions = await tx
        .delete(schema.giftCardTransactions)
        .where(eq(schema.giftCardTransactions.merchantId, merchantId))
        .returning({ id: schema.giftCardTransactions.id });

      const floorTableOrders = await tx
        .delete(schema.chaslayFloorTableOrders)
        .where(eq(schema.chaslayFloorTableOrders.merchantId, merchantId))
        .returning({ id: schema.chaslayFloorTableOrders.id });

      const floorPrintJobs = await tx
        .delete(schema.chaslayFloorPrintJobs)
        .where(eq(schema.chaslayFloorPrintJobs.merchantId, merchantId))
        .returning({ id: schema.chaslayFloorPrintJobs.id });

      let reservations: { id: string }[] = [];
      if (deleteReservations) {
        reservations = await tx
          .delete(schema.reservations)
          .where(eq(schema.reservations.merchantId, merchantId))
          .returning({ id: schema.reservations.id });
      }

      const diningTablesReset = await tx
        .update(schema.diningTables)
        .set({ status: "available", currentOrderId: null })
        .where(eq(schema.diningTables.merchantId, merchantId))
        .returning({ id: schema.diningTables.id });

      const loyaltyCardsReset = await tx
        .update(schema.loyaltyCards)
        .set({ pointsBalance: 0, balance: "0" })
        .where(eq(schema.loyaltyCards.merchantId, merchantId))
        .returning({ id: schema.loyaltyCards.id });

      const giftCardsReset = await tx
        .update(schema.giftCards)
        .set({
          balance: "0",
          pointsBalance: 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.giftCards.merchantId, merchantId))
        .returning({ id: schema.giftCards.id });

      let customersDeleted: { id: string }[] = [];
      let customersReset: { id: string }[] = [];

      if (deleteCustomers) {
        await tx
          .delete(schema.customerAddresses)
          .where(eq(schema.customerAddresses.merchantId, merchantId));
        customersDeleted = await tx
          .delete(schema.customers)
          .where(eq(schema.customers.merchantId, merchantId))
          .returning({ id: schema.customers.id });
      } else {
        customersReset = await tx
          .update(schema.customers)
          .set({
            totalSpent: "0",
            loyaltyPoints: 0,
            lastOrderAt: null,
            lastReorderReminderAt: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.customers.merchantId, merchantId))
          .returning({ id: schema.customers.id });
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
