"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosSessionsService = exports.POS_SESSION_HEARTBEAT_SEC = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const HEARTBEAT_TTL_MS = 120000;
exports.POS_SESSION_HEARTBEAT_SEC = 45;
class PosSessionsService {
    static isActive(lastHeartbeat) {
        if (!lastHeartbeat)
            return false;
        return Date.now() - lastHeartbeat.getTime() < HEARTBEAT_TTL_MS;
    }
    static async getLimits(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { maxPosPosts: true, maxWaiterPosts: true },
        });
        return {
            maxPosPosts: Math.max(0, Number(merchant?.maxPosPosts ?? 0)),
            maxWaiterPosts: Math.max(0, Number(merchant?.maxWaiterPosts ?? 0)),
        };
    }
    static async listActive(merchantId, sessionKind) {
        const db = (0, db_1.getDb)();
        const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
        const rows = await db.query.posSessions.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt), (0, drizzle_orm_1.gt)(db_1.schema.posSessions.lastHeartbeat, cutoff), sessionKind ? (0, drizzle_orm_1.eq)(db_1.schema.posSessions.sessionKind, sessionKind) : undefined),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.posSessions.createdAt)],
        });
        return rows.map((r) => ({
            id: r.id,
            sessionKind: r.sessionKind,
            platform: r.platform,
            deviceId: r.deviceId,
            deviceLabel: r.deviceLabel,
            staffId: r.staffId,
            staffName: r.staffName,
            printAgentOnline: r.printAgentOnline ?? null,
            lastHeartbeat: r.lastHeartbeat,
            createdAt: r.createdAt,
        }));
    }
    static async evictStale(merchantId) {
        const db = (0, db_1.getDb)();
        const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
        await db
            .update(db_1.schema.posSessions)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt), (0, drizzle_orm_1.or)((0, drizzle_orm_1.lt)(db_1.schema.posSessions.lastHeartbeat, cutoff), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.lastHeartbeat))));
    }
    static async enforceLimit(db, merchantId, sessionKind, max, keepDeviceId) {
        if (max <= 0)
            return [];
        const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
        let active = await db.query.posSessions.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.posSessions.sessionKind, sessionKind), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt), (0, drizzle_orm_1.gt)(db_1.schema.posSessions.lastHeartbeat, cutoff)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.posSessions.createdAt)],
        });
        const kicked = [];
        // Same device re-registering: revoke its previous row first (does not count twice).
        const sameDevice = active.filter((s) => s.deviceId === keepDeviceId);
        for (const row of sameDevice) {
            await db
                .update(db_1.schema.posSessions)
                .set({ revokedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, row.id));
        }
        active = active.filter((s) => s.deviceId !== keepDeviceId);
        while (active.length >= max) {
            const oldest = active.shift();
            if (!oldest)
                break;
            await db
                .update(db_1.schema.posSessions)
                .set({ revokedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, oldest.id));
            kicked.push(oldest.id);
        }
        return kicked;
    }
    static async registerSession(merchantId, input) {
        const deviceId = String(input.deviceId || "").trim().slice(0, 128);
        if (!deviceId)
            throw new Error("deviceId is required");
        await this.evictStale(merchantId);
        const limits = await this.getLimits(merchantId);
        const max = input.sessionKind === "waiter" ? limits.maxWaiterPosts : limits.maxPosPosts;
        const db = (0, db_1.getDb)();
        const now = new Date();
        const { row, kickedSessionIds } = await db.transaction(async (tx) => {
            const kickedSessionIds = await this.enforceLimit(tx, merchantId, input.sessionKind, max, deviceId);
            const [inserted] = await tx
                .insert(db_1.schema.posSessions)
                .values({
                merchantId,
                sessionKind: input.sessionKind,
                platform: input.platform,
                deviceId,
                deviceLabel: input.deviceLabel?.trim()?.slice(0, 255) || null,
                staffId: input.staffId || null,
                staffName: input.staffName?.trim()?.slice(0, 255) || null,
                lastHeartbeat: now,
            })
                .returning();
            return { row: inserted, kickedSessionIds };
        });
        return {
            sessionId: row.id,
            heartbeatIntervalSec: exports.POS_SESSION_HEARTBEAT_SEC,
            maxPosPosts: limits.maxPosPosts,
            maxWaiterPosts: limits.maxWaiterPosts,
            kickedSessionIds,
        };
    }
    static async heartbeat(merchantId, sessionId, opts) {
        const db = (0, db_1.getDb)();
        const row = await db.query.posSessions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, sessionId), (0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt)),
        });
        if (!row) {
            throw new Error("POS session expired or revoked");
        }
        const now = new Date();
        const patch = {
            lastHeartbeat: now,
        };
        if (opts && "printAgentOnline" in opts) {
            patch.printAgentOnline =
                opts.printAgentOnline === true
                    ? true
                    : opts.printAgentOnline === false
                        ? false
                        : null;
        }
        await db
            .update(db_1.schema.posSessions)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, sessionId));
        return { ok: true, lastHeartbeat: now };
    }
    static async revokeSession(merchantId, sessionId) {
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.posSessions)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, sessionId), (0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt)));
        return { ok: true };
    }
    static async revokeByDevice(merchantId, deviceId, sessionKind) {
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.posSessions)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.posSessions.deviceId, deviceId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt), sessionKind ? (0, drizzle_orm_1.eq)(db_1.schema.posSessions.sessionKind, sessionKind) : undefined));
        return { ok: true };
    }
}
exports.PosSessionsService = PosSessionsService;
//# sourceMappingURL=pos-sessions.service.js.map