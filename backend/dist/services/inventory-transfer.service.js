"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryTransferService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
class InventoryTransferService {
    static async ensureLocationStock(merchantId, locationId, itemId, qtyDelta) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.inventoryLocationStock.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.locationId, locationId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.itemId, itemId)),
        });
        if (existing) {
            const next = Math.max(0, Number(existing.onHand) + qtyDelta);
            const [row] = await db
                .update(db_1.schema.inventoryLocationStock)
                .set({ onHand: String(next), updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.id, existing.id))
                .returning();
            return row;
        }
        const item = await db.query.inventoryItems.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, itemId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId)),
        });
        if (!item)
            throw new Error("Inventory item not found");
        const start = qtyDelta >= 0 ? qtyDelta : Math.max(0, Number(item.onHand) + qtyDelta);
        const [row] = await db
            .insert(db_1.schema.inventoryLocationStock)
            .values({
            merchantId,
            locationId,
            itemId,
            onHand: String(Math.max(0, start)),
        })
            .returning();
        return row;
    }
    static async backfillDefaultLocation(merchantId) {
        const { LocationsService } = await Promise.resolve().then(() => __importStar(require("@/services/locations.service")));
        const defaultId = await LocationsService.getDefaultId(merchantId);
        const db = (0, db_1.getDb)();
        const items = await db.query.inventoryItems.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId),
        });
        let created = 0;
        for (const item of items) {
            const exists = await db.query.inventoryLocationStock.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.locationId, defaultId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.itemId, item.id)),
            });
            if (exists)
                continue;
            await db.insert(db_1.schema.inventoryLocationStock).values({
                merchantId,
                locationId: defaultId,
                itemId: item.id,
                onHand: String(item.onHand || 0),
            });
            created += 1;
        }
        return { created, locationId: defaultId };
    }
    static async list(merchantId, status) {
        const db = (0, db_1.getDb)();
        const conditions = [(0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.merchantId, merchantId)];
        if (status) {
            conditions.push((0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.status, status));
        }
        const rows = await db.query.inventoryTransfers.findMany({
            where: (0, drizzle_orm_1.and)(...conditions),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.inventoryTransfers.createdAt)],
            limit: 100,
        });
        const itemIds = [...new Set(rows.map((r) => r.itemId))];
        const items = itemIds.length > 0
            ? await db.query.inventoryItems.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.inventoryItems.id, itemIds)),
                columns: { id: true, name: true, unit: true },
            })
            : [];
        const itemById = new Map(items.map((i) => [i.id, i]));
        return rows.map((r) => ({
            ...r,
            item: itemById.get(r.itemId) || null,
        }));
    }
    static async create(merchantId, input) {
        const fromId = String(input.fromLocationId || "").trim();
        const toId = String(input.toLocationId || "").trim();
        if (!fromId || !toId)
            throw new Error("From and to locations are required");
        if (fromId === toId)
            throw new Error("Locations must be different");
        const qty = Number(input.qty);
        if (!Number.isFinite(qty) || qty <= 0)
            throw new Error("Quantity must be positive");
        const db = (0, db_1.getDb)();
        const item = await db.query.inventoryItems.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.id, input.itemId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId)),
        });
        if (!item)
            throw new Error("Inventory item not found");
        const [row] = await db
            .insert(db_1.schema.inventoryTransfers)
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
    static async confirm(merchantId, transferId) {
        const db = (0, db_1.getDb)();
        const transfer = await db.query.inventoryTransfers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.id, transferId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.merchantId, merchantId)),
        });
        if (!transfer)
            throw new Error("Transfer not found");
        if (transfer.status !== "pending")
            throw new Error("Transfer is not pending");
        const qty = Number(transfer.qty);
        const fromStock = await db.query.inventoryLocationStock.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.locationId, transfer.fromLocationId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.itemId, transfer.itemId)),
        });
        const available = fromStock ? Number(fromStock.onHand) : 0;
        if (available < qty) {
            throw new Error(`Insufficient stock at source location (${available} available)`);
        }
        await this.ensureLocationStock(merchantId, transfer.fromLocationId, transfer.itemId, -qty);
        await this.ensureLocationStock(merchantId, transfer.toLocationId, transfer.itemId, qty);
        const [updated] = await db
            .update(db_1.schema.inventoryTransfers)
            .set({ status: "confirmed", confirmedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.id, transferId))
            .returning();
        return updated;
    }
    static async cancel(merchantId, transferId) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.inventoryTransfers)
            .set({ status: "cancelled" })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.id, transferId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryTransfers.status, "pending")))
            .returning();
        if (!row)
            throw new Error("Transfer not found or not pending");
        return row;
    }
    static async locationStockSummary(merchantId, locationId) {
        const db = (0, db_1.getDb)();
        const rows = await db.query.inventoryLocationStock.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.inventoryLocationStock.locationId, locationId)),
        });
        const itemIds = rows.map((r) => r.itemId);
        const items = itemIds.length > 0
            ? await db.query.inventoryItems.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.inventoryItems.id, itemIds)),
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
exports.InventoryTransferService = InventoryTransferService;
//# sourceMappingURL=inventory-transfer.service.js.map