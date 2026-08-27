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
        const { MerchantEntitlementsService } = await Promise.resolve().then(() => __importStar(require("@/services/merchant-entitlements.service")));
        const limits = await MerchantEntitlementsService.getLimits(merchantId);
        return {
            maxPosPosts: limits.maxPosPosts,
            maxWaiterPosts: limits.maxWaiterPosts,
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
        if (max > 0 && active.length >= max) {
            const kind = sessionKind === "waiter" ? "waiter" : "POS";
            const err = new Error(`${kind} station limit reached (${max}). Close another session or upgrade your package.`);
            err.statusCode = 403;
            err.code = sessionKind === "waiter" ? "WAITER_LIMIT_REACHED" : "POS_LIMIT_REACHED";
            throw err;
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