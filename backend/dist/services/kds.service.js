"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KdsService = void 0;
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
function newToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function itemMatchesStation(item, station, channel) {
    const types = station.orderTypes || [];
    if (types.length && channel && !types.includes(String(channel)))
        return false;
    const cats = station.categoryIds || [];
    const prods = station.productIds || [];
    if (!cats.length && !prods.length)
        return true;
    if (item.productId && prods.includes(item.productId))
        return true;
    if (item.categoryId && cats.includes(item.categoryId))
        return true;
    return false;
}
class KdsService {
    static async listStations(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.kdsStations.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.kdsStations.name)],
        });
    }
    static async createStation(merchantId, input) {
        const db = (0, db_1.getDb)();
        const name = String(input.name || "").trim().slice(0, 255);
        if (!name)
            throw new Error("Station name is required");
        const [row] = await db
            .insert(db_1.schema.kdsStations)
            .values({
            merchantId,
            name,
            token: newToken(),
            orderTypes: input.orderTypes || [],
            categoryIds: input.categoryIds || [],
            productIds: input.productIds || [],
            isActive: input.isActive !== false,
        })
            .returning();
        return row;
    }
    static async updateStation(merchantId, id, input) {
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.name != null)
            patch.name = String(input.name).trim().slice(0, 255);
        if (input.orderTypes != null)
            patch.orderTypes = input.orderTypes;
        if (input.categoryIds != null)
            patch.categoryIds = input.categoryIds;
        if (input.productIds != null)
            patch.productIds = input.productIds;
        if (input.isActive != null)
            patch.isActive = !!input.isActive;
        const [row] = await db
            .update(db_1.schema.kdsStations)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("KDS station not found");
        return row;
    }
    static async deleteStation(merchantId, id) {
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.kdsStations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId)));
        return { ok: true };
    }
    static async rotateToken(merchantId, id) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.kdsStations)
            .set({ token: newToken(), updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("KDS station not found");
        return row;
    }
    static async stationByToken(token) {
        const db = (0, db_1.getDb)();
        return db.query.kdsStations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.token, token), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.isActive, true)),
        });
    }
    /** Upsert ticket + append new line items when kitchen receives an order. */
    static async pushKitchen(merchantId, payload) {
        const ticketKey = String(payload.ticketKey || "").trim().slice(0, 255);
        if (!ticketKey)
            throw new Error("ticketKey is required");
        const items = (payload.items || []).filter((i) => i.lineId && i.name);
        if (!items.length)
            return { ok: true, added: 0 };
        const db = (0, db_1.getDb)();
        let ticket = await db.query.kdsTickets.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.ticketKey, ticketKey), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.status, "pending")),
        });
        if (!ticket) {
            const [inserted] = await db
                .insert(db_1.schema.kdsTickets)
                .values({
                merchantId,
                ticketKey,
                orderNumber: payload.orderNumber?.trim()?.slice(0, 64) || null,
                tableLabel: payload.tableLabel?.trim()?.slice(0, 120) || null,
                tabNumber: payload.tabNumber?.trim()?.slice(0, 64) || null,
                channel: payload.channel?.trim()?.slice(0, 50) || null,
                status: "pending",
            })
                .returning();
            ticket = inserted;
        }
        else {
            await db
                .update(db_1.schema.kdsTickets)
                .set({
                orderNumber: payload.orderNumber?.trim()?.slice(0, 64) || ticket.orderNumber,
                tableLabel: payload.tableLabel?.trim()?.slice(0, 120) ?? ticket.tableLabel,
                tabNumber: payload.tabNumber?.trim()?.slice(0, 64) ?? ticket.tabNumber,
                channel: payload.channel?.trim()?.slice(0, 50) ?? ticket.channel,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticket.id));
        }
        const existing = await db.query.kdsTicketItems.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, ticket.id),
            columns: { lineId: true },
        });
        const seen = new Set(existing.map((r) => r.lineId));
        const toInsert = items.filter((i) => !seen.has(i.lineId));
        if (toInsert.length) {
            await db.insert(db_1.schema.kdsTicketItems).values(toInsert.map((i) => ({
                ticketId: ticket.id,
                lineId: i.lineId,
                productId: i.productId || null,
                categoryId: i.categoryId || null,
                name: String(i.name).slice(0, 255),
                quantity: String(i.quantity || 1),
                lineNote: i.lineNote?.trim()?.slice(0, 500) || null,
                courseNumber: i.courseNumber ?? null,
                modifiersJson: {
                    selectedExtras: i.selectedExtras || [],
                    comboSelections: i.comboSelections || [],
                },
                status: "pending",
            })));
        }
        return { ok: true, added: toInsert.length, ticketId: ticket.id };
    }
    static async listForToken(token, since) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        const db = (0, db_1.getDb)();
        const sinceDate = since ? new Date(since) : null;
        const tickets = await db.query.kdsTickets.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, station.merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.kdsTickets.status, ["pending", "completed"])),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.kdsTickets.createdAt)],
            with: { items: true },
        });
        const filtered = tickets
            .map((t) => {
            const items = (t.items || []).filter((item) => itemMatchesStation(item, station, t.channel));
            if (!items.length && t.status === "completed")
                return null;
            if (t.status === "completed" && items.every((i) => i.status === "ready"))
                return null;
            return {
                id: t.id,
                ticketKey: t.ticketKey,
                orderNumber: t.orderNumber,
                tableLabel: t.tableLabel,
                tabNumber: t.tabNumber,
                channel: t.channel,
                status: t.status,
                createdAt: t.createdAt,
                completedAt: t.completedAt,
                items: items.map((i) => ({
                    id: i.id,
                    lineId: i.lineId,
                    name: i.name,
                    quantity: Number(i.quantity),
                    lineNote: i.lineNote,
                    courseNumber: i.courseNumber,
                    status: i.status,
                    readyAt: i.readyAt,
                    modifiersJson: i.modifiersJson,
                })),
            };
        })
            .filter(Boolean);
        const updatedSince = sinceDate
            ? tickets.some((t) => t.updatedAt > sinceDate)
            : true;
        return {
            station: { id: station.id, name: station.name },
            serverTime: new Date().toISOString(),
            updated: updatedSince,
            tickets: filtered,
        };
    }
    static async markItemReady(token, itemId) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        const db = (0, db_1.getDb)();
        const item = await db.query.kdsTicketItems.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.id, itemId),
            with: { ticket: true },
        });
        if (!item?.ticket || item.ticket.merchantId !== station.merchantId) {
            throw new Error("Item not found");
        }
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "ready", readyAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.id, itemId));
        await db
            .update(db_1.schema.kdsTickets)
            .set({ updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, item.ticketId));
        return { ok: true, lineId: item.lineId, ticketKey: item.ticket.ticketKey };
    }
    static async completeTicket(token, ticketId) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        const db = (0, db_1.getDb)();
        const ticket = await db.query.kdsTickets.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, station.merchantId)),
            with: { items: true },
        });
        if (!ticket)
            throw new Error("Ticket not found");
        const now = new Date();
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "ready", readyAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, ticketId));
        await db
            .update(db_1.schema.kdsTickets)
            .set({ status: "completed", completedAt: now, updatedAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId));
        return { ok: true, ticketKey: ticket.ticketKey };
    }
    static async recallTicket(token, ticketId) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        const db = (0, db_1.getDb)();
        const ticket = await db.query.kdsTickets.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, station.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.status, "completed")),
        });
        if (!ticket)
            throw new Error("Ticket not found");
        await db
            .update(db_1.schema.kdsTickets)
            .set({ status: "pending", completedAt: null, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId));
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "pending", readyAt: null })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, ticketId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.status, "ready")));
        return { ok: true };
    }
    static async ticketStatusForPos(merchantId, ticketKey) {
        const db = (0, db_1.getDb)();
        const ticket = await db.query.kdsTickets.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.ticketKey, ticketKey)),
            with: { items: true },
        });
        if (!ticket)
            return { readyLineIds: [], total: 0, ready: 0 };
        const items = ticket.items || [];
        const readyLineIds = items.filter((i) => i.status === "ready").map((i) => i.lineId);
        return {
            status: ticket.status,
            readyLineIds,
            total: items.length,
            ready: readyLineIds.length,
        };
    }
}
exports.KdsService = KdsService;
//# sourceMappingURL=kds.service.js.map