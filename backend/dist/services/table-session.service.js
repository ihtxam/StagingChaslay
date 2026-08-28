"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableSessionService = void 0;
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
class TableSessionService {
    static newToken() {
        return (0, crypto_1.randomBytes)(24).toString("hex");
    }
    static async resolveTable(merchantId, tableId) {
        const db = (0, db_1.getDb)();
        const table = await db.query.diningTables.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId), (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId)),
        });
        return table ?? null;
    }
    /** Open or resume the active session for a table. */
    static async openOrResume(merchantId, tableId) {
        const db = (0, db_1.getDb)();
        const table = await this.resolveTable(merchantId, tableId);
        if (!table)
            throw new Error("Table not found");
        const existing = await db.query.tableSessions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableSessions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.tableSessions.tableId, tableId), (0, drizzle_orm_1.eq)(db_1.schema.tableSessions.status, "open")),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.tableSessions.openedAt)],
        });
        if (existing)
            return { session: existing, table };
        const token = this.newToken();
        const [session] = await db
            .insert(db_1.schema.tableSessions)
            .values({
            merchantId,
            tableId,
            sessionToken: token,
            status: "open",
        })
            .returning();
        return { session, table };
    }
    static async getByToken(merchantId, sessionToken) {
        const db = (0, db_1.getDb)();
        return db.query.tableSessions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableSessions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.tableSessions.sessionToken, sessionToken)),
        });
    }
    static async listSessionOrders(merchantId, sessionId) {
        const db = (0, db_1.getDb)();
        const orders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.tableSessionId, sessionId)),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt)],
            with: {
                items: true,
            },
        });
        return orders;
    }
    static async closeSession(merchantId, sessionId) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.tableSessions)
            .set({ status: "closed", closedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableSessions.id, sessionId), (0, drizzle_orm_1.eq)(db_1.schema.tableSessions.merchantId, merchantId)))
            .returning();
        return row ?? null;
    }
    static async markPaid(merchantId, sessionId) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.tableSessions)
            .set({ status: "paid", closedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableSessions.id, sessionId), (0, drizzle_orm_1.eq)(db_1.schema.tableSessions.merchantId, merchantId)))
            .returning();
        return row ?? null;
    }
    static async sessionSummary(merchantId, sessionId) {
        const orders = await this.listSessionOrders(merchantId, sessionId);
        const activeStatuses = new Set([
            "pending",
            "pending_approval",
            "accepted",
            "preparing",
            "ready",
            "completed",
        ]);
        const relevant = orders.filter((o) => activeStatuses.has(String(o.status)));
        const total = relevant.reduce((sum, o) => sum + Number(o.total || 0), 0);
        return { orders: relevant, total };
    }
    static async ordersForTable(merchantId, tableId) {
        const db = (0, db_1.getDb)();
        const open = await db.query.tableSessions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableSessions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.tableSessions.tableId, tableId), (0, drizzle_orm_1.eq)(db_1.schema.tableSessions.status, "open")),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.tableSessions.openedAt)],
        });
        if (!open)
            return { session: null, orders: [] };
        const orders = await this.listSessionOrders(merchantId, open.id);
        return { session: open, orders };
    }
    static async assertOpenSession(merchantId, tableId, sessionToken) {
        if (sessionToken) {
            const session = await this.getByToken(merchantId, sessionToken);
            if (!session || session.tableId !== tableId || session.status !== "open") {
                throw new Error("Table session expired. Scan the QR code again.");
            }
            return session;
        }
        const { session } = await this.openOrResume(merchantId, tableId);
        return session;
    }
}
exports.TableSessionService = TableSessionService;
//# sourceMappingURL=table-session.service.js.map