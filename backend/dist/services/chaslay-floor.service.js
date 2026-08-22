"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChaslayFloorService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
/** PROCESSING jobs older than this are returned to PENDING (crashed / unacked printers). */
const PRINT_JOB_STALE_MS = 5 * 60 * 1000;
function normalizeRole(role) {
    if (role === "MAIN_POS" || role === "WAITER" || role === "STANDARD")
        return role;
    return "STANDARD";
}
class ChaslayFloorService {
    static async registerDevice(merchantId, input) {
        const db = (0, db_1.getDb)();
        const role = normalizeRole(input.role);
        const now = new Date();
        const existing = await db.query.chaslayFloorDevices.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorDevices.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorDevices.deviceId, input.deviceId)),
        });
        if (existing) {
            await db
                .update(db_1.schema.chaslayFloorDevices)
                .set({
                deviceName: input.deviceName ?? existing.deviceName,
                role,
                lanHost: input.lanHost ?? existing.lanHost,
                appVersion: input.appVersion ?? existing.appVersion,
                lastSeenAt: now,
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorDevices.id, existing.id));
        }
        else {
            await db.insert(db_1.schema.chaslayFloorDevices).values({
                merchantId,
                deviceId: input.deviceId,
                deviceName: input.deviceName ?? null,
                role,
                lanHost: input.lanHost ?? null,
                appVersion: input.appVersion ?? null,
                lastSeenAt: now,
            });
        }
        return { ok: true, serverTime: Date.now() };
    }
    static async getMainPos(merchantId) {
        const db = (0, db_1.getDb)();
        const devices = await db.query.chaslayFloorDevices.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorDevices.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorDevices.role, "MAIN_POS")),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.chaslayFloorDevices.lastSeenAt)],
        });
        const withHost = devices
            .filter((d) => d.lanHost && d.lanHost.trim() !== "")
            .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
        const row = withHost[0];
        if (!row) {
            return { lanHost: null, deviceName: null, lastSeenAt: null };
        }
        return {
            lanHost: row.lanHost,
            deviceName: row.deviceName,
            lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        };
    }
    static async listOrders(merchantId, sinceMs) {
        const db = (0, db_1.getDb)();
        const sinceDate = sinceMs > 0 ? new Date(sinceMs) : new Date(0);
        const rows = await db.query.chaslayFloorTableOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorTableOrders.merchantId, merchantId), (0, drizzle_orm_1.gt)(db_1.schema.chaslayFloorTableOrders.updatedAt, sinceDate)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.chaslayFloorTableOrders.updatedAt)],
        });
        return {
            serverTime: Date.now(),
            orders: rows.map((r) => ({
                local_order_id: r.localOrderId,
                table_id: r.tableId,
                table_name: r.tableName,
                status: r.status,
                service_type: r.serviceType,
                user_id: r.userId,
                user_name: r.userName,
                cart_json: r.cartJson,
                source_device_id: r.sourceDeviceId,
                updated_at: r.updatedAt?.toISOString() ?? null,
            })),
        };
    }
    static async upsertOrder(merchantId, localOrderId, body) {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const existing = await db.query.chaslayFloorTableOrders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorTableOrders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorTableOrders.localOrderId, localOrderId)),
        });
        const values = {
            tableId: Number(body.tableId ?? 0),
            tableName: body.tableName ?? "",
            status: body.status ?? "OPEN",
            serviceType: body.serviceType ?? "DINE_IN",
            userId: Number(body.userId ?? 0),
            userName: body.userName ?? "",
            cartJson: (body.cart ?? {}),
            sourceDeviceId: body.sourceDeviceId ?? "",
            updatedAt: now,
        };
        if (existing) {
            await db
                .update(db_1.schema.chaslayFloorTableOrders)
                .set(values)
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorTableOrders.id, existing.id));
        }
        else {
            await db.insert(db_1.schema.chaslayFloorTableOrders).values({
                merchantId,
                localOrderId,
                ...values,
            });
        }
        return { ok: true, serverTime: Date.now() };
    }
    static async createPrintJob(merchantId, input) {
        const db = (0, db_1.getDb)();
        const raw = String(input.jobType || "").toUpperCase();
        const safeType = raw === "RECEIPT" || raw === "ESCPOS" || raw === "KITCHEN" ? raw : "KITCHEN";
        const inserted = await db
            .insert(db_1.schema.chaslayFloorPrintJobs)
            .values({
            merchantId,
            jobType: safeType,
            status: "PENDING",
            payload: input.payload,
            sourceDeviceId: input.sourceDeviceId ?? "",
            orderId: input.orderId ?? null,
        })
            .returning();
        const row = inserted[0];
        return {
            ok: true,
            jobId: row.id,
            createdAt: row.createdAt?.toISOString() ?? null,
        };
    }
    /**
     * Atomically claim PENDING print jobs (→ PROCESSING) so overlapping pollers
     * (WebPOS 2.5s interval, multi-tab, Android MAIN_POS) cannot reprint the same job.
     */
    static async listPendingPrintJobs(merchantId, limit, opts) {
        const db = (0, db_1.getDb)();
        const typeConds = [];
        if (opts?.jobTypes?.length) {
            typeConds.push((0, drizzle_orm_1.inArray)(db_1.schema.chaslayFloorPrintJobs.jobType, opts.jobTypes.map((t) => t.toUpperCase())));
        }
        else if (opts?.excludeJobTypes?.length) {
            typeConds.push((0, drizzle_orm_1.notInArray)(db_1.schema.chaslayFloorPrintJobs.jobType, opts.excludeJobTypes.map((t) => t.toUpperCase())));
        }
        // Reclaim leases from crashed / disconnected printers.
        const staleBefore = new Date(Date.now() - PRINT_JOB_STALE_MS);
        await db
            .update(db_1.schema.chaslayFloorPrintJobs)
            .set({ status: "PENDING", processedAt: null })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.status, "PROCESSING"), (0, drizzle_orm_1.lt)(db_1.schema.chaslayFloorPrintJobs.processedAt, staleBefore), ...typeConds));
        const candidates = await db.query.chaslayFloorPrintJobs.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.status, "PENDING"), ...typeConds),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.chaslayFloorPrintJobs.createdAt)],
            limit: Math.max(1, Math.min(limit, 50)),
        });
        const claimed = [];
        const now = new Date();
        for (const row of candidates) {
            // Only one poller wins: UPDATE … WHERE status='PENDING' RETURNING.
            const [won] = await db
                .update(db_1.schema.chaslayFloorPrintJobs)
                .set({ status: "PROCESSING", processedAt: now })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.id, row.id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.status, "PENDING")))
                .returning();
            if (won)
                claimed.push(won);
        }
        return {
            serverTime: Date.now(),
            jobs: claimed.map((r) => ({
                id: r.id,
                job_type: r.jobType,
                jobType: r.jobType,
                payload: r.payload,
                source_device_id: r.sourceDeviceId,
                sourceDeviceId: r.sourceDeviceId,
                order_id: r.orderId,
                orderId: r.orderId,
                created_at: r.createdAt?.toISOString() ?? null,
                createdAt: r.createdAt?.toISOString() ?? null,
            })),
        };
    }
    static async ackPrintJob(merchantId, jobId, status) {
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.chaslayFloorPrintJobs)
            .set({ status, processedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.id, jobId), 
        // Accept PENDING (legacy) or PROCESSING (claimed).
        (0, drizzle_orm_1.inArray)(db_1.schema.chaslayFloorPrintJobs.status, ["PENDING", "PROCESSING"])));
        return { ok: true };
    }
    /** Emergency: mark all open print jobs FAILED so runaway printers stop. */
    static async failOpenPrintJobs(merchantId) {
        const db = (0, db_1.getDb)();
        const rows = await db
            .update(db_1.schema.chaslayFloorPrintJobs)
            .set({ status: "FAILED", processedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorPrintJobs.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.chaslayFloorPrintJobs.status, ["PENDING", "PROCESSING"])))
            .returning({ id: db_1.schema.chaslayFloorPrintJobs.id });
        return { ok: true, cleared: rows.length };
    }
}
exports.ChaslayFloorService = ChaslayFloorService;
//# sourceMappingURL=chaslay-floor.service.js.map