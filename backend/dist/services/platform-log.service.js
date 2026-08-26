"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformLogService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
class PlatformLogService {
    static async write(input) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.platformEventLogs)
            .values({
            level: input.level || 'info',
            category: String(input.category || 'system').slice(0, 80),
            message: input.message,
            metadata: input.metadata || null,
            actorRole: input.actorRole?.slice(0, 20) || null,
            actorId: input.actorId || null,
            merchantId: input.merchantId || null,
            resellerId: input.resellerId || null,
        })
            .returning();
        return row;
    }
    static async list(opts) {
        const db = (0, db_1.getDb)();
        const page = Math.max(1, Number(opts?.page) || 1);
        const limit = Math.min(Math.max(Number(opts?.limit) || 50, 1), 200);
        const offset = (page - 1) * limit;
        const where = [];
        if (opts?.level)
            where.push((0, drizzle_orm_1.eq)(db_1.schema.platformEventLogs.level, opts.level));
        if (opts?.category)
            where.push((0, drizzle_orm_1.eq)(db_1.schema.platformEventLogs.category, opts.category));
        if (opts?.from)
            where.push((0, drizzle_orm_1.gte)(db_1.schema.platformEventLogs.createdAt, opts.from));
        if (opts?.to)
            where.push((0, drizzle_orm_1.lte)(db_1.schema.platformEventLogs.createdAt, opts.to));
        const rows = await db.query.platformEventLogs.findMany({
            where: where.length ? (0, drizzle_orm_1.and)(...where) : undefined,
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.platformEventLogs.createdAt)],
            limit,
            offset,
        });
        const [{ count }] = await db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
            .from(db_1.schema.platformEventLogs)
            .where(where.length ? (0, drizzle_orm_1.and)(...where) : undefined);
        return { logs: rows, page, limit, total: Number(count) || 0 };
    }
    /** POS / Android diagnostic reports — superadmin System Logs only, never support tickets. */
    static async writeMerchantDiagnostic(merchantId, input) {
        const body = String(input.body || "").slice(0, 120000);
        return this.write({
            level: input.auto ? "warn" : "info",
            category: "merchant_diagnostic",
            message: String(input.subject || "Diagnostic report").trim().slice(0, 2000),
            merchantId,
            resellerId: input.resellerId || null,
            actorRole: "merchant",
            actorId: input.actorId || null,
            metadata: {
                source: input.source,
                auto: !!input.auto,
                authorName: input.authorName || null,
                body,
            },
        });
    }
}
exports.PlatformLogService = PlatformLogService;
//# sourceMappingURL=platform-log.service.js.map