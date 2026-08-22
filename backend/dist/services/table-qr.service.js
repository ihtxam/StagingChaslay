"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableQrService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
function isActiveTemporary(row) {
    if (row.codeType !== "temporary")
        return true;
    if (!row.expiresAt)
        return true;
    return row.expiresAt.getTime() > Date.now();
}
class TableQrService {
    static async listForMerchant(merchantId) {
        const db = (0, db_1.getDb)();
        const rows = await db.query.tableQrCodes.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.tableQrCodes.createdAt)],
        });
        return rows.filter(isActiveTemporary).map((r) => ({
            id: r.id,
            tableId: r.tableId,
            codeType: (r.codeType === "temporary" ? "temporary" : "static"),
            code: r.code,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt,
        }));
    }
    static async listForTable(merchantId, tableId) {
        const db = (0, db_1.getDb)();
        const table = await db.query.diningTables.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId), (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId)),
        });
        if (!table)
            throw new Error("Table not found");
        const rows = await db.query.tableQrCodes.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.tableId, tableId)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.tableQrCodes.createdAt)],
        });
        return rows.filter(isActiveTemporary).map((r) => ({
            id: r.id,
            tableId: r.tableId,
            codeType: (r.codeType === "temporary" ? "temporary" : "static"),
            code: r.code,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt,
        }));
    }
    /** Prefer static override; fall back to first active temporary. */
    static async resolvePayload(merchantId, tableId, defaultPayload) {
        const codes = await this.listForTable(merchantId, tableId);
        const staticCode = codes.find((c) => c.codeType === "static");
        if (staticCode)
            return staticCode.code;
        const temp = codes.find((c) => c.codeType === "temporary");
        if (temp)
            return temp.code;
        return defaultPayload;
    }
    static async upsertStatic(merchantId, tableId, code) {
        const payload = String(code || "").trim();
        if (!payload)
            throw new Error("QR code is required");
        const db = (0, db_1.getDb)();
        const table = await db.query.diningTables.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId), (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId)),
        });
        if (!table)
            throw new Error("Table not found");
        const existing = await db.query.tableQrCodes.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.tableId, tableId), (0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.codeType, "static")),
        });
        if (existing) {
            const [updated] = await db
                .update(db_1.schema.tableQrCodes)
                .set({ code: payload })
                .where((0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.id, existing.id))
                .returning();
            return updated;
        }
        const [created] = await db
            .insert(db_1.schema.tableQrCodes)
            .values({
            merchantId,
            tableId,
            codeType: "static",
            code: payload,
        })
            .returning();
        return created;
    }
    static async createTemporary(merchantId, tableId, code, expiresInHours = 24) {
        const payload = String(code || "").trim();
        if (!payload)
            throw new Error("QR code is required");
        const db = (0, db_1.getDb)();
        const table = await db.query.diningTables.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.diningTables.id, tableId), (0, drizzle_orm_1.eq)(db_1.schema.diningTables.merchantId, merchantId)),
        });
        if (!table)
            throw new Error("Table not found");
        const hours = Math.max(1, Math.min(168, Number(expiresInHours) || 24));
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        const [created] = await db
            .insert(db_1.schema.tableQrCodes)
            .values({
            merchantId,
            tableId,
            codeType: "temporary",
            code: payload,
            expiresAt,
        })
            .returning();
        return created;
    }
    static generateTemporaryToken() {
        return (0, crypto_1.randomBytes)(16).toString("hex");
    }
    static async deleteCode(merchantId, codeId) {
        const db = (0, db_1.getDb)();
        const row = await db.query.tableQrCodes.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.id, codeId), (0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.merchantId, merchantId)),
        });
        if (!row)
            throw new Error("QR code not found");
        await db.delete(db_1.schema.tableQrCodes).where((0, drizzle_orm_1.eq)(db_1.schema.tableQrCodes.id, codeId));
        return { success: true };
    }
}
exports.TableQrService = TableQrService;
//# sourceMappingURL=table-qr.service.js.map