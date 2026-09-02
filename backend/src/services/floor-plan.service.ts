import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type TableShape = "rect" | "round";
export type TableStatus = "available" | "occupied" | "reserved" | "dirty";

export type DiningTableInput = {
  id?: string;
  label: string;
  capacity?: number;
  shape?: TableShape;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  status?: TableStatus;
  sortOrder?: number;
};

export type FloorPlanElementInput = {
  id: string;
  elementType: "WALL" | "DOOR" | "BAR" | "OBSTACLE";
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation?: number;
};

export class FloorPlanService {
  static async list(merchantId: string) {
    const db = getDb();
    const plans = await db.query.floorPlans.findMany({
      where: eq(schema.floorPlans.merchantId, merchantId),
      with: {
        tables: { orderBy: [asc(schema.diningTables.sortOrder), asc(schema.diningTables.label)] },
      },
      orderBy: [asc(schema.floorPlans.sortOrder), asc(schema.floorPlans.name)],
    });
    return plans.map((p) => this.serializePlan(p));
  }

  static async getPlan(merchantId: string, planId: string) {
    const db = getDb();
    const plan = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
      with: {
        tables: { orderBy: [asc(schema.diningTables.sortOrder), asc(schema.diningTables.label)] },
      },
    });
    if (!plan) throw new Error("Floor plan not found");
    return this.serializePlan(plan);
  }

  static async createPlan(merchantId: string, name: string) {
    const db = getDb();
    const title = (name || "").trim() || "Main floor";
    const [plan] = await db
      .insert(schema.floorPlans)
      .values({ merchantId, name: title })
      .returning();
    return this.getPlan(merchantId, plan.id);
  }

  static async updatePlan(
    merchantId: string,
    planId: string,
    updates: {
      name?: string;
      canvasWidth?: number;
      canvasHeight?: number;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    const db = getDb();
    const existing = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Floor plan not found");

    await db
      .update(schema.floorPlans)
      .set({
        name: updates.name?.trim() || existing.name,
        canvasWidth: updates.canvasWidth ?? existing.canvasWidth,
        canvasHeight: updates.canvasHeight ?? existing.canvasHeight,
        isActive: updates.isActive !== undefined ? !!updates.isActive : existing.isActive,
        sortOrder: updates.sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(schema.floorPlans.id, planId));

    return this.getPlan(merchantId, planId);
  }

  static async deletePlan(merchantId: string, planId: string) {
    const db = getDb();
    const existing = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Floor plan not found");
    await db.delete(schema.floorPlans).where(eq(schema.floorPlans.id, planId));
    return { success: true };
  }

  /** Replace all tables on a plan (designer save). Preserves table IDs when provided. */
  static async saveTables(
    merchantId: string,
    planId: string,
    tables: DiningTableInput[],
    elements: FloorPlanElementInput[] = []
  ) {
    const db = getDb();
    const plan = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
    });
    if (!plan) throw new Error("Floor plan not found");

    const existing = await db.query.diningTables.findMany({
      where: eq(schema.diningTables.floorPlanId, planId),
    });
    const existingById = new Map(existing.map((t) => [t.id, t]));
    const keepIds = new Set<string>();

    const rows = tables
      .map((t, idx) => ({
        id: t.id && existingById.has(t.id) ? t.id : undefined,
        merchantId,
        floorPlanId: planId,
        label: (t.label || `T${idx + 1}`).trim(),
        capacity: Math.max(1, Number(t.capacity) || 2),
        shape: t.shape === "round" ? "round" : "rect",
        posX: Number(t.posX) || 40,
        posY: Number(t.posY) || 40,
        width: Math.max(40, Number(t.width) || 100),
        height: Math.max(40, Number(t.height) || 80),
        rotation: Number(t.rotation) || 0,
        status: (["available", "occupied", "reserved", "dirty"].includes(String(t.status))
          ? t.status
          : "available") as TableStatus,
        sortOrder: t.sortOrder !== undefined ? Number(t.sortOrder) : idx,
      }))
      .filter((t) => t.label);

    for (const row of rows) {
      if (row.id) {
        keepIds.add(row.id);
        const prior = existingById.get(row.id)!;
        await db
          .update(schema.diningTables)
          .set({
            label: row.label,
            capacity: row.capacity,
            shape: row.shape,
            posX: row.posX,
            posY: row.posY,
            width: row.width,
            height: row.height,
            rotation: row.rotation,
            status: prior.status === "occupied" || prior.status === "reserved" ? prior.status : row.status,
            sortOrder: row.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(schema.diningTables.id, row.id));
      } else {
        const [inserted] = await db
          .insert(schema.diningTables)
          .values({
            merchantId: row.merchantId,
            floorPlanId: row.floorPlanId,
            label: row.label,
            capacity: row.capacity,
            shape: row.shape,
            posX: row.posX,
            posY: row.posY,
            width: row.width,
            height: row.height,
            rotation: row.rotation,
            status: row.status,
            sortOrder: row.sortOrder,
          })
          .returning({ id: schema.diningTables.id });
        if (inserted) keepIds.add(inserted.id);
      }
    }

    for (const table of existing) {
      if (!keepIds.has(table.id)) {
        await db.delete(schema.diningTables).where(eq(schema.diningTables.id, table.id));
      }
    }

    const elementRows = (elements || [])
      .map((el) => ({
        id: String(el.id || "").trim(),
        elementType: String(el.elementType || "WALL").toUpperCase(),
        posX: Number(el.posX) || 0,
        posY: Number(el.posY) || 0,
        width: Math.max(20, Number(el.width) || 80),
        height: Math.max(8, Number(el.height) || 24),
        rotation: Number(el.rotation) || 0,
      }))
      .filter((el) => el.id);

    await db
      .update(schema.floorPlans)
      .set({
        elementsJson: elementRows.length ? elementRows : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.floorPlans.id, planId));

    return this.getPlan(merchantId, planId);
  }

  /** Add multiple tables with sequential labels (batch create). */
  static async batchAddTables(
    merchantId: string,
    planId: string,
    input: {
      prefix?: string;
      startNumber?: number;
      count?: number;
      capacity?: number;
    }
  ) {
    const plan = await this.getPlan(merchantId, planId);
    const prefix = String(input.prefix ?? "").trim() || "T";
    const startNumber = Math.max(0, Number(input.startNumber) || 1);
    const count = Math.max(1, Math.min(100, Number(input.count) || 1));
    const capacity = Math.max(1, Math.min(50, Number(input.capacity) || 4));

    const existing = (plan.tables || []).map((t) => ({
      id: t.id,
      label: t.label,
      capacity: t.capacity,
      shape: (t.shape === "round" ? "round" : "rect") as TableShape,
      posX: t.posX,
      posY: t.posY,
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      status: t.status as TableStatus,
      sortOrder: t.sortOrder,
    }));

    const additions: DiningTableInput[] = [];
    for (let i = 0; i < count; i++) {
      const idx = existing.length + i;
      additions.push({
        label: `${prefix}${startNumber + i}`,
        capacity,
        shape: "rect",
        posX: 40 + (idx % 6) * 120,
        posY: 40 + Math.floor(idx / 6) * 100,
        width: 100,
        height: 80,
        rotation: 0,
        status: "available",
        sortOrder: idx,
      });
    }

    return this.saveTables(merchantId, planId, [...existing, ...additions], plan.elements || []);
  }

  /** Patch a single table without replacing the whole plan. */
  static async patchTable(
    merchantId: string,
    tableId: string,
    patch: Partial<DiningTableInput & { floorPlanId?: string }>
  ) {
    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(eq(schema.diningTables.id, tableId), eq(schema.diningTables.merchantId, merchantId)),
    });
    if (!table) throw new Error("Table not found");

    if (patch.floorPlanId && patch.floorPlanId !== table.floorPlanId) {
      const target = await db.query.floorPlans.findFirst({
        where: and(
          eq(schema.floorPlans.id, patch.floorPlanId),
          eq(schema.floorPlans.merchantId, merchantId)
        ),
      });
      if (!target) throw new Error("Section not found");
    }

    const [updated] = await db
      .update(schema.diningTables)
      .set({
        floorPlanId: patch.floorPlanId ?? table.floorPlanId,
        label: patch.label !== undefined ? String(patch.label).trim() || table.label : table.label,
        capacity:
          patch.capacity !== undefined
            ? Math.max(1, Math.min(50, Number(patch.capacity) || table.capacity))
            : table.capacity,
        shape: patch.shape === "round" ? "round" : patch.shape === "rect" ? "rect" : table.shape,
        posX: patch.posX !== undefined ? Number(patch.posX) : table.posX,
        posY: patch.posY !== undefined ? Number(patch.posY) : table.posY,
        width: patch.width !== undefined ? Math.max(40, Number(patch.width) || table.width) : table.width,
        height:
          patch.height !== undefined ? Math.max(40, Number(patch.height) || table.height) : table.height,
        rotation: patch.rotation !== undefined ? Number(patch.rotation) : table.rotation,
        sortOrder: patch.sortOrder !== undefined ? Number(patch.sortOrder) : table.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(schema.diningTables.id, tableId))
      .returning();

    return updated!;
  }

  /** Delete one table from a plan. */
  static async deleteTable(merchantId: string, tableId: string) {
    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(eq(schema.diningTables.id, tableId), eq(schema.diningTables.merchantId, merchantId)),
    });
    if (!table) throw new Error("Table not found");
    await db.delete(schema.diningTables).where(eq(schema.diningTables.id, tableId));
    return { success: true };
  }

  /** Add one table to a section. */
  static async addTable(
    merchantId: string,
    planId: string,
    input: { label: string; capacity?: number }
  ) {
    const plan = await this.getPlan(merchantId, planId);
    const label = String(input.label || "").trim();
    if (!label) throw new Error("Table label is required");

    const existing = (plan.tables || []).map((t) => ({
      id: t.id,
      label: t.label,
      capacity: t.capacity,
      shape: (t.shape === "round" ? "round" : "rect") as TableShape,
      posX: t.posX,
      posY: t.posY,
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      status: t.status as TableStatus,
      sortOrder: t.sortOrder,
    }));

    const idx = existing.length;
    return this.saveTables(
      merchantId,
      planId,
      [
        ...existing,
        {
          label,
          capacity: Math.max(1, Math.min(50, Number(input.capacity) || 4)),
          shape: "rect",
          posX: 40 + (idx % 6) * 120,
          posY: 40 + Math.floor(idx / 6) * 100,
          width: 100,
          height: 80,
          rotation: 0,
          status: "available",
          sortOrder: idx,
        },
      ],
      plan.elements || []
    );
  }

  static async setTableStatus(
    merchantId: string,
    tableId: string,
    status: TableStatus,
    currentOrderId?: string | null
  ) {
    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(eq(schema.diningTables.id, tableId), eq(schema.diningTables.merchantId, merchantId)),
    });
    if (!table) throw new Error("Table not found");

    const [updated] = await db
      .update(schema.diningTables)
      .set({
        status,
        currentOrderId: currentOrderId === undefined ? table.currentOrderId : currentOrderId,
        updatedAt: new Date(),
      })
      .where(eq(schema.diningTables.id, tableId))
      .returning();

    return updated;
  }

  /** Covers served today = sum(guest_count) for completed dine-in orders. */
  static async coversReport(merchantId: string, date = new Date()) {
    const db = getDb();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.status, "completed"),
        gte(schema.orders.createdAt, start),
        lte(schema.orders.createdAt, end)
      ),
      columns: {
        id: true,
        fulfillmentChannel: true,
        guestCount: true,
        tableLabel: true,
        total: true,
      },
    });

    const dineIn = orders.filter((o) => o.fulfillmentChannel === "dine_in");
    const covers = dineIn.reduce((sum, o) => sum + (o.guestCount || 0), 0);
    const checksWithPax = dineIn.filter((o) => (o.guestCount || 0) > 0).length;

    return {
      date: start.toISOString().slice(0, 10),
      totalOrders: orders.length,
      dineInOrders: dineIn.length,
      coversServed: covers,
      averagePartySize: checksWithPax ? Math.round((covers / checksWithPax) * 10) / 10 : 0,
      dineInRevenue: dineIn.reduce((s, o) => s + parseFloat(o.total?.toString() || "0"), 0),
    };
  }

  /** Flat table list for POS sync. */
  static async listTablesForSync(merchantId: string) {
    const db = getDb();
    const tables = await db.query.diningTables.findMany({
      where: eq(schema.diningTables.merchantId, merchantId),
      with: { floorPlan: true },
      orderBy: [asc(schema.diningTables.label)],
    });
    return tables.map((t) => ({
      id: t.id,
      floorPlanId: t.floorPlanId,
      floorPlanName: t.floorPlan?.name || "Floor",
      label: t.label,
      capacity: t.capacity,
      shape: t.shape,
      posX: t.posX,
      posY: t.posY,
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      status: t.status,
      currentOrderId: t.currentOrderId,
    }));
  }

  private static serializePlan(p: any) {
    return {
      id: p.id,
      name: p.name,
      canvasWidth: p.canvasWidth,
      canvasHeight: p.canvasHeight,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      tables: (p.tables || []).map((t: any) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape,
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        status: t.status,
        currentOrderId: t.currentOrderId,
        sortOrder: t.sortOrder,
      })),
      elements: (p.elementsJson || []) as FloorPlanElementInput[],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
