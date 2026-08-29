import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

export class InventoryTransferService {
  static async ensureLocationStock(
    merchantId: string,
    locationId: string,
    itemId: string,
    qtyDelta: number
  ) {
    const db = getDb();
    const existing = await db.query.inventoryLocationStock.findFirst({
      where: and(
        eq(schema.inventoryLocationStock.merchantId, merchantId),
        eq(schema.inventoryLocationStock.locationId, locationId),
        eq(schema.inventoryLocationStock.itemId, itemId)
      ),
    });

    if (existing) {
      const next = Math.max(0, Number(existing.onHand) + qtyDelta);
      const [row] = await db
        .update(schema.inventoryLocationStock)
        .set({ onHand: String(next), updatedAt: new Date() })
        .where(eq(schema.inventoryLocationStock.id, existing.id))
        .returning();
      return row!;
    }

    const item = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.id, itemId),
        eq(schema.inventoryItems.merchantId, merchantId)
      ),
    });
    if (!item) throw new Error("Inventory item not found");

    const start = qtyDelta >= 0 ? qtyDelta : Math.max(0, Number(item.onHand) + qtyDelta);
    const [row] = await db
      .insert(schema.inventoryLocationStock)
      .values({
        merchantId,
        locationId,
        itemId,
        onHand: String(Math.max(0, start)),
      })
      .returning();
    return row;
  }

  static async backfillDefaultLocation(merchantId: string) {
    const { LocationsService } = await import("@/services/locations.service");
    const defaultId = await LocationsService.getDefaultId(merchantId);
    const db = getDb();
    const items = await db.query.inventoryItems.findMany({
      where: eq(schema.inventoryItems.merchantId, merchantId),
    });
    let created = 0;
    for (const item of items) {
      const exists = await db.query.inventoryLocationStock.findFirst({
        where: and(
          eq(schema.inventoryLocationStock.locationId, defaultId),
          eq(schema.inventoryLocationStock.itemId, item.id)
        ),
      });
      if (exists) continue;
      await db.insert(schema.inventoryLocationStock).values({
        merchantId,
        locationId: defaultId,
        itemId: item.id,
        onHand: String(item.onHand || 0),
      });
      created += 1;
    }
    return { created, locationId: defaultId };
  }

  static async list(merchantId: string, status?: string) {
    const db = getDb();
    const conditions = [eq(schema.inventoryTransfers.merchantId, merchantId)];
    if (status) {
      conditions.push(eq(schema.inventoryTransfers.status, status));
    }
    const rows = await db.query.inventoryTransfers.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.inventoryTransfers.createdAt)],
      limit: 100,
    });
    const itemIds = [...new Set(rows.map((r) => r.itemId))];
    const items =
      itemIds.length > 0
        ? await db.query.inventoryItems.findMany({
            where: and(
              eq(schema.inventoryItems.merchantId, merchantId),
              inArray(schema.inventoryItems.id, itemIds)
            ),
            columns: { id: true, name: true, unit: true },
          })
        : [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    return rows.map((r) => ({
      ...r,
      item: itemById.get(r.itemId) || null,
    }));
  }

  static async create(
    merchantId: string,
    input: {
      fromLocationId: string;
      toLocationId: string;
      itemId: string;
      qty: number;
      note?: string;
      staffId?: string | null;
      staffName?: string | null;
    }
  ) {
    const fromId = String(input.fromLocationId || "").trim();
    const toId = String(input.toLocationId || "").trim();
    if (!fromId || !toId) throw new Error("From and to locations are required");
    if (fromId === toId) throw new Error("Locations must be different");
    const qty = Number(input.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity must be positive");

    const db = getDb();
    const item = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.id, input.itemId),
        eq(schema.inventoryItems.merchantId, merchantId)
      ),
    });
    if (!item) throw new Error("Inventory item not found");

    const [row] = await db
      .insert(schema.inventoryTransfers)
      .values({
        merchantId,
        fromLocationId: fromId,
        toLocationId: toId,
        itemId: input.itemId,
        qty: String(qty),
        status: "pending",
        note: input.note?.trim() || null,
        createdByStaffId: input.staffId || null,
        createdByName: input.staffName || null,
      })
      .returning();
    return row;
  }

  static async confirm(merchantId: string, transferId: string) {
    const db = getDb();
    const transfer = await db.query.inventoryTransfers.findFirst({
      where: and(
        eq(schema.inventoryTransfers.id, transferId),
        eq(schema.inventoryTransfers.merchantId, merchantId)
      ),
    });
    if (!transfer) throw new Error("Transfer not found");
    if (transfer.status !== "pending") throw new Error("Transfer is not pending");

    const qty = Number(transfer.qty);
    const fromStock = await db.query.inventoryLocationStock.findFirst({
      where: and(
        eq(schema.inventoryLocationStock.locationId, transfer.fromLocationId),
        eq(schema.inventoryLocationStock.itemId, transfer.itemId)
      ),
    });
    const available = fromStock ? Number(fromStock.onHand) : 0;
    if (available < qty) {
      throw new Error(`Insufficient stock at source location (${available} available)`);
    }

    await this.ensureLocationStock(merchantId, transfer.fromLocationId, transfer.itemId, -qty);
    await this.ensureLocationStock(merchantId, transfer.toLocationId, transfer.itemId, qty);

    const [updated] = await db
      .update(schema.inventoryTransfers)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(schema.inventoryTransfers.id, transferId))
      .returning();
    return updated;
  }

  static async cancel(merchantId: string, transferId: string) {
    const db = getDb();
    const [row] = await db
      .update(schema.inventoryTransfers)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(schema.inventoryTransfers.id, transferId),
          eq(schema.inventoryTransfers.merchantId, merchantId),
          eq(schema.inventoryTransfers.status, "pending")
        )
      )
      .returning();
    if (!row) throw new Error("Transfer not found or not pending");
    return row;
  }

  static async locationStockSummary(merchantId: string, locationId: string) {
    const db = getDb();
    const rows = await db.query.inventoryLocationStock.findMany({
      where: and(
        eq(schema.inventoryLocationStock.merchantId, merchantId),
        eq(schema.inventoryLocationStock.locationId, locationId)
      ),
    });
    const itemIds = rows.map((r) => r.itemId);
    const items =
      itemIds.length > 0
        ? await db.query.inventoryItems.findMany({
            where: and(
              eq(schema.inventoryItems.merchantId, merchantId),
              inArray(schema.inventoryItems.id, itemIds)
            ),
            columns: { id: true, name: true, unit: true, onHand: true },
          })
        : [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    return rows.map((r) => ({
      itemId: r.itemId,
      name: itemById.get(r.itemId)?.name || "Item",
      unit: itemById.get(r.itemId)?.unit || "piece",
      onHand: Number(r.onHand),
      merchantOnHand: Number(itemById.get(r.itemId)?.onHand || 0),
    }));
  }
}
