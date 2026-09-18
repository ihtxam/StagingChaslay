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
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
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
        await (0, ensure_merchant_schema_1.ensurePosSessionsSchema)();
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => this.listActiveRows(merchantId, sessionKind));
    }
    static mapSessionRow(r) {
        return {
            id: r.id,
            locationId: r.locationId ?? r.location_id ?? null,
            sessionKind: (r.sessionKind ?? r.session_kind),
            platform: r.platform,
            deviceId: String(r.deviceId ?? r.device_id ?? ""),
            deviceLabel: r.deviceLabel ?? r.device_label ?? null,
            staffId: r.staffId ?? r.staff_id ?? null,
            staffName: r.staffName ?? r.staff_name ?? null,
            printAgentOnline: r.printAgentOnline ?? r.print_agent_online ?? null,
            lastHeartbeat: (r.lastHeartbeat ?? r.last_heartbeat),
            createdAt: (r.createdAt ?? r.created_at),
        };
    }
    static async listActiveRows(merchantId, sessionKind) {
        const db = (0, db_1.getDb)();
        const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
        try {
            const rows = await db.query.posSessions.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt), (0, drizzle_orm_1.gt)(db_1.schema.posSessions.lastHeartbeat, cutoff), sessionKind ? (0, drizzle_orm_1.eq)(db_1.schema.posSessions.sessionKind, sessionKind) : undefined),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.posSessions.createdAt)],
            });
            return rows.map((r) => this.mapSessionRow(r));
        }
        catch (error) {
            console.warn("[pos-sessions] relational list failed, using legacy SQL:", error);
            const rows = await (0, ensure_merchant_schema_1.queryRaw)(`SELECT id, merchant_id, session_kind, platform, device_id, device_label,
                staff_id, staff_name, last_heartbeat, created_at
         FROM pos_sessions
         WHERE merchant_id = $1
           AND revoked_at IS NULL
           AND last_heartbeat > $2
           AND ($3::text IS NULL OR session_kind = $3)
         ORDER BY created_at ASC`, [merchantId, cutoff, sessionKind || null]);
            return rows.map((r) => this.mapSessionRow(r));
        }
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
        let active;
        try {
            active = await db.query.posSessions.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.posSessions.sessionKind, sessionKind), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt), (0, drizzle_orm_1.gt)(db_1.schema.posSessions.lastHeartbeat, cutoff)),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.posSessions.createdAt)],
            });
        }
        catch (error) {
            console.warn("[pos-sessions] enforceLimit list failed, using legacy SQL:", error);
            const rows = await (0, ensure_merchant_schema_1.queryRaw)(`SELECT id, device_id FROM pos_sessions
         WHERE merchant_id = $1 AND session_kind = $2
           AND revoked_at IS NULL AND last_heartbeat > $3
         ORDER BY created_at ASC`, [merchantId, sessionKind, cutoff]);
            active = rows.map((r) => ({ id: r.id, deviceId: r.device_id }));
        }
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
        // Last login wins: make room for this device by revoking oldest active stations.
        while (max > 0 && active.length >= max) {
            const victim = active.shift();
            if (!victim)
                break;
            await db
                .update(db_1.schema.posSessions)
                .set({ revokedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, victim.id));
            kicked.push(victim.id);
        }
        return kicked;
    }
    static async registerSession(merchantId, input) {
        const deviceId = String(input.deviceId || "").trim().slice(0, 128);
        if (!deviceId)
            throw new Error("deviceId is required");
        await (0, ensure_merchant_schema_1.ensurePosSessionsSchema)();
        await this.evictStale(merchantId);
        const limits = await this.getLimits(merchantId);
        const max = input.sessionKind === "waiter" ? limits.maxWaiterPosts : limits.maxPosPosts;
        const db = (0, db_1.getDb)();
        const now = new Date();
        let locationId = null;
        try {
            const { LocationsService } = await Promise.resolve().then(() => __importStar(require("@/services/locations.service")));
            locationId = await LocationsService.resolveLocationId(merchantId, input.locationId);
        }
        catch (error) {
            console.warn("[pos-sessions] location resolve skipped:", error);
        }
        const { row, kickedSessionIds } = await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => db.transaction(async (tx) => {
            const kickedSessionIds = await this.enforceLimit(tx, merchantId, input.sessionKind, max, deviceId);
            try {
                const [inserted] = await tx
                    .insert(db_1.schema.posSessions)
                    .values({
                    merchantId,
                    locationId,
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
            }
            catch (error) {
                console.warn("[pos-sessions] insert with location_id failed, using legacy SQL:", error);
                const rows = await (0, ensure_merchant_schema_1.queryRaw)(`INSERT INTO pos_sessions
               (merchant_id, session_kind, platform, device_id, device_label, staff_id, staff_name, last_heartbeat)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`, [
                    merchantId,
                    input.sessionKind,
                    input.platform,
                    deviceId,
                    input.deviceLabel?.trim()?.slice(0, 255) || null,
                    input.staffId || null,
                    input.staffName?.trim()?.slice(0, 255) || null,
                    now,
                ]);
                const inserted = rows[0];
                if (!inserted)
                    throw error;
                return { row: inserted, kickedSessionIds };
            }
        }));
        return {
            sessionId: row.id,
            heartbeatIntervalSec: exports.POS_SESSION_HEARTBEAT_SEC,
            maxPosPosts: limits.maxPosPosts,
            maxWaiterPosts: limits.maxWaiterPosts,
            kickedSessionIds,
        };
    }
    static async heartbeat(merchantId, sessionId, opts) {
        await (0, ensure_merchant_schema_1.ensurePosSessionsSchema)();
        const db = (0, db_1.getDb)();
        const row = await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            try {
                return await db.query.posSessions.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, sessionId), (0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt)),
                });
            }
            catch {
                const rows = await (0, ensure_merchant_schema_1.queryRaw)(`SELECT id FROM pos_sessions
           WHERE id = $1 AND merchant_id = $2 AND revoked_at IS NULL
           LIMIT 1`, [sessionId, merchantId]);
                return rows[0] || null;
            }
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
        try {
            await db
                .update(db_1.schema.posSessions)
                .set(patch)
                .where((0, drizzle_orm_1.eq)(db_1.schema.posSessions.id, sessionId));
        }
        catch {
            await (0, ensure_merchant_schema_1.queryRaw)(`UPDATE pos_sessions SET last_heartbeat = $1 WHERE id = $2`, [
                now,
                sessionId,
            ]);
        }
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
    /** Revoke every active POS / waiter session for a merchant (force logout all devices). */
    static async revokeAllForMerchant(merchantId) {
        const db = (0, db_1.getDb)();
        await (0, ensure_merchant_schema_1.ensurePosSessionsSchema)();
        await db
            .update(db_1.schema.posSessions)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.posSessions.merchantId, merchantId), (0, drizzle_orm_1.isNull)(db_1.schema.posSessions.revokedAt)));
        return { ok: true };
    }
}
exports.PosSessionsService = PosSessionsService;
//# sourceMappingURL=pos-sessions.service.js.map