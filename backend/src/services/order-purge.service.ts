import { getDb, schema } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  isCashOnlyOrder,
  isCompletedPaidCashAdjustmentOrder,
} from "@/services/sales-adjustment.service";

export type OrderPurgeResult = {
  deletedCount: number;
  deletedIds: string[];
  skippedIds: string[];
};

export class OrderPurgeService {
  /** Completed, fully paid, 100% cash POS tickets only — permanent removal from reports. */
  static isPurgeEligible(order: {
    status?: string | null;
    paymentStatus?: string | null;
    invoiceNumber?: string | null;
    paymentMethod?: string | null;
    paymentBreakdown?: unknown;
    total: unknown;
    refundAmount?: unknown | null;
  }): boolean {
    if (!isCompletedPaidCashAdjustmentOrder(order)) return false;
    return isCashOnlyOrder(order);
  }

  static async purgeOrders(
    merchantId: string,
    orderIds: string[]
  ): Promise<OrderPurgeResult> {
    const uniqueIds = [...new Set(orderIds.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!uniqueIds.length) throw new Error("Select at least one order to delete");

    const db = getDb();
    const rows = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        inArray(schema.orders.id, uniqueIds)
      ),
    });

    if (!rows.length) throw new Error("No matching orders found");

    const foundIds = new Set(rows.map((r) => r.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length) throw new Error("One or more orders were not found");

    const eligible: string[] = [];
    const skipped: string[] = [];
    for (const row of rows) {
      if (this.isPurgeEligible(row)) eligible.push(row.id);
      else skipped.push(row.id);
    }

    if (!eligible.length) {
      throw new Error(
        "None of the selected orders can be deleted. Only completed, fully paid, 100% cash sales are eligible."
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.diningTables)
        .set({ status: "available", currentOrderId: null })
        .where(
          and(
            eq(schema.diningTables.merchantId, merchantId),
            inArray(schema.diningTables.currentOrderId, eligible)
          )
        );

      await tx
        .delete(schema.orders)
        .where(
          and(eq(schema.orders.merchantId, merchantId), inArray(schema.orders.id, eligible))
        );
    });

    return {
      deletedCount: eligible.length,
      deletedIds: eligible,
      skippedIds: skipped,
    };
  }
}
