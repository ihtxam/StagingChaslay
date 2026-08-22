"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloorPlanService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
class FloorPlanService {
    static async list(merchantId) {
        const db = (0, db_1.getDb)();
        const plans = await db.query.floorPlans.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.floorPlans.merchantId, merchantId),
            with: {
                tables: { orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.diningTables.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.diningTables.label)] },
            },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.floorPlans.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.floorPlans.name)],
        });
        return plans.map((p) => this.serializePlan(p));
    }
    static async getPlan(merchantId, planId) {
        const db = (0, db_1.getDb)();
        const plan = await db.query.floorPlans.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, planId), (0, drizzle_orm_1.eq)(db_1.schema.floorPlans.merchantId, merchantId)),
            with: {
                tables: { orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.diningTables.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.diningTables.label)] },
            },
        });
        if (!plan)
            throw new Error("Floor plan not found");
        return this.serializePlan(plan);
    }
    static async createPlan(merchantId, name) {
        const db = (0, db_1.getDb)();
        const title = (name || "").trim() || "Main floor";
        const [plan] = await db
            .insert(db_1.schema.floorPlans)
            .values({ merchantId, name: title })
            .returning();
        return this.getPlan(merchantId, plan.id);
    }
    static async updatePlan(merchantId, planId, updates) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.floorPlans.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, planId), (0, drizzle_orm_1.eq)(db_1.schema.floorPlans.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Floor plan not found");
        await db
            .update(db_1.schema.floorPlans)
            .set({
            name: updates.name?.trim() || existing.name,
            canvasWidth: updates.canvasWidth ?? existing.canvasWidth,
            canvasHeight: updates.canvasHeight ?? existing.canvasHeight,
            isActive: updates.isActive !== undefined ? !!updates.isActive : existing.isActive,
            sortOrder: updates.sortOrder ?? existing.sortOrder,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, planId));
        return this.getPlan(merchantId, planId);
    }
    static async deletePlan(merchantId, planId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.floorPlans.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, planId), (0, drizzle_orm_1.eq)(db_1.schema.floorPlans.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Floor plan not found");
        await db.delete(db_1.schema.floorPlans).where((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, planId));
        return { success: true };
    }
    /** Replace all tables on a plan (designer save). */
    static async saveTables(merchantId, planId, tables, elements = []) {
        const db = (0, db_1.getDb)();
        const plan = await db.query.floorPlans.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, planId), (0, drizzle_orm_1.eq)(db_1.schema.floorPlans.merchantId, merchantId)),
        });
        if (!plan)
            throw new Error("Floor plan not found");
        await db.delete(db_1.schema.diningTables).where((0, drizzle_orm_1.eq)(db_1.schema.diningTables.floorPlanId, planId));
        const rows = tables
            .map((t, idx) => ({
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
                : "available"),
            sortOrder: t.sortOrder !== undefined ? Number(t.sortOrder) : idx,
        }))
            .filter((t) => t.label);
        if (rows.length) {
            await db.insert(db_1.schema.diningTables).values(rows);
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
            .update(db_1.schema.floorPlans)
            .set({
            elementsJson: elementRows.length ? elementRows : null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, planId));
        return this.getPlan(merchantId, planId);
    }
    /** Add multiple tables with sequential labels (batch create). */
    static async batchAddTables(merchantId, planId, input) {
        const plan = await this.getPlan(merchantId, planId);
        const prefix = String(input.prefix ?? "").trim() || "T";
        const startNumber = Math.max(0, Number(input.startNumber) || 1);
        const count = Math.max(1, Math.min(100, Number(input.count) || 1));
        const capacity = Math.max(1, Math.min(50, Number(input.capacity) || 4));
        const existing = (plan.tables || []).map((t) => ({
            id: t.id,
            label: t.label,
            capacity: t.capacity,
            shape: (t.shape === "round" ? "round" : "rect"),
            posX: t.posX,
            posY: t.posY,
            width: t.width,
            height: t.height,
            rotation: t.rotation,
            status: t.status,
            sortOrder: t.sortOrder,
        }));
        const additions = [];
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
    static async patchTable(merchantId, tableId, patch) {
        const db = (0, db_1.getDb)();
        const table = await db.query.diningTables.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId), (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId)),
        });
        if (!table)
            throw new Error("Table not found");
        if (patch.floorPlanId && patch.floorPlanId !== table.floorPlanId) {
            const target = await db.query.floorPlans.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.floorPlans.id, patch.floorPlanId), (0, drizzle_orm_1.eq)(db_1.schema.floorPlans.merchantId, merchantId)),
            });
            if (!target)
                throw new Error("Section not found");
        }
        const [updated] = await db
            .update(db_1.schema.diningTables)
            .set({
            floorPlanId: patch.floorPlanId ?? table.floorPlanId,
            label: patch.label !== undefined ? String(patch.label).trim() || table.label : table.label,
            capacity: patch.capacity !== undefined
                ? Math.max(1, Math.min(50, Number(patch.capacity) || table.capacity))
                : table.capacity,
            shape: patch.shape === "round" ? "round" : patch.shape === "rect" ? "rect" : table.shape,
            posX: patch.posX !== undefined ? Number(patch.posX) : table.posX,
            posY: patch.posY !== undefined ? Number(patch.posY) : table.posY,
            width: patch.width !== undefined ? Math.max(40, Number(patch.width) || table.width) : table.width,
            height: patch.height !== undefined ? Math.max(40, Number(patch.height) || table.height) : table.height,
            rotation: patch.rotation !== undefined ? Number(patch.rotation) : table.rotation,
            sortOrder: patch.sortOrder !== undefined ? Number(patch.sortOrder) : table.sortOrder,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId))
            .returning();
        return updated;
    }
    /** Delete one table from a plan. */
    static async deleteTable(merchantId, tableId) {
        const db = (0, db_1.getDb)();
        const table = await db.query.diningTables.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId), (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId)),
        });
        if (!table)
            throw new Error("Table not found");
        await db.delete(db_1.schema.diningTables).where((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId));
        return { success: true };
    }
    /** Add one table to a section. */
    static async addTable(merchantId, planId, input) {
        const plan = await this.getPlan(merchantId, planId);
        const label = String(input.label || "").trim();
        if (!label)
            throw new Error("Table label is required");
        const existing = (plan.tables || []).map((t) => ({
            id: t.id,
            label: t.label,
            capacity: t.capacity,
            shape: (t.shape === "round" ? "round" : "rect"),
            posX: t.posX,
            posY: t.posY,
            width: t.width,
            height: t.height,
            rotation: t.rotation,
            status: t.status,
            sortOrder: t.sortOrder,
        }));
        const idx = existing.length;
        return this.saveTables(merchantId, planId, [
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
        ], plan.elements || []);
    }
    static async setTableStatus(merchantId, tableId, status, currentOrderId) {
        const db = (0, db_1.getDb)();
        const table = await db.query.diningTables.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId), (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId)),
        });
        if (!table)
            throw new Error("Table not found");
        const [updated] = await db
            .update(db_1.schema.diningTables)
            .set({
            status,
            currentOrderId: currentOrderId === undefined ? table.currentOrderId : currentOrderId,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId))
            .returning();
        return updated;
    }
    /** Covers served today = sum(guest_count) for completed dine-in orders. */
    static async coversReport(merchantId, date = new Date()) {
        const db = (0, db_1.getDb)();
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        const orders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, start), (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, end)),
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
    static async listTablesForSync(merchantId) {
        const db = (0, db_1.getDb)();
        const tables = await db.query.diningTables.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId),
            with: { floorPlan: true },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.diningTables.label)],
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
    static serializePlan(p) {
        return {
            id: p.id,
            name: p.name,
            canvasWidth: p.canvasWidth,
            canvasHeight: p.canvasHeight,
            sortOrder: p.sortOrder,
            isActive: p.isActive,
            tables: (p.tables || []).map((t) => ({
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
            elements: (p.elementsJson || []),
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        };
    }
}
exports.FloorPlanService = FloorPlanService;
//# sourceMappingURL=floor-plan.service.js.map