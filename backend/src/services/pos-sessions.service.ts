import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb, schema, type Database } from "@/db";
import {
  ensurePosSessionsSchema,
  queryRaw,
  withMerchantSchemaRetry,
} from "@/lib/ensure-merchant-schema";

export type PosSessionKind = "main" | "waiter";
export type PosSessionPlatform = "webpos" | "waiter_web" | "android";

const HEARTBEAT_TTL_MS = 120_000;
export const POS_SESSION_HEARTBEAT_SEC = 45;

type DbClient = Database;

export class PosSessionsService {
  static isActive(lastHeartbeat: Date | null | undefined): boolean {
    if (!lastHeartbeat) return false;
    return Date.now() - lastHeartbeat.getTime() < HEARTBEAT_TTL_MS;
  }

  static async getLimits(merchantId: string) {
    const { MerchantEntitlementsService } = await import(
      "@/services/merchant-entitlements.service"
    );
    const limits = await MerchantEntitlementsService.getLimits(merchantId);
    return {
      maxPosPosts: limits.maxPosPosts,
      maxWaiterPosts: limits.maxWaiterPosts,
    };
  }

  static async listActive(merchantId: string, sessionKind?: PosSessionKind) {
    await ensurePosSessionsSchema();
    return withMerchantSchemaRetry(() => this.listActiveRows(merchantId, sessionKind));
  }

  private static mapSessionRow(r: {
    id: string;
    locationId?: string | null;
    location_id?: string | null;
    sessionKind?: string;
    session_kind?: string;
    platform: string;
    deviceId?: string;
    device_id?: string;
    deviceLabel?: string | null;
    device_label?: string | null;
    staffId?: string | null;
    staff_id?: string | null;
    staffName?: string | null;
    staff_name?: string | null;
    printAgentOnline?: boolean | null;
    print_agent_online?: boolean | null;
    lastHeartbeat?: Date | string;
    last_heartbeat?: Date | string;
    createdAt?: Date | string;
    created_at?: Date | string;
  }) {
    return {
      id: r.id,
      locationId: r.locationId ?? r.location_id ?? null,
      sessionKind: (r.sessionKind ?? r.session_kind) as PosSessionKind,
      platform: r.platform as PosSessionPlatform,
      deviceId: String(r.deviceId ?? r.device_id ?? ""),
      deviceLabel: r.deviceLabel ?? r.device_label ?? null,
      staffId: r.staffId ?? r.staff_id ?? null,
      staffName: r.staffName ?? r.staff_name ?? null,
      printAgentOnline: r.printAgentOnline ?? r.print_agent_online ?? null,
      lastHeartbeat: (r.lastHeartbeat ?? r.last_heartbeat) as Date,
      createdAt: (r.createdAt ?? r.created_at) as Date,
    };
  }

  private static async listActiveRows(merchantId: string, sessionKind?: PosSessionKind) {
    const db = getDb();
    const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
    try {
      const rows = await db.query.posSessions.findMany({
        where: and(
          eq(schema.posSessions.merchantId, merchantId),
          isNull(schema.posSessions.revokedAt),
          gt(schema.posSessions.lastHeartbeat, cutoff),
          sessionKind ? eq(schema.posSessions.sessionKind, sessionKind) : undefined
        ),
        orderBy: [asc(schema.posSessions.createdAt)],
      });
      return rows.map((r) => this.mapSessionRow(r));
    } catch (error) {
      console.warn("[pos-sessions] relational list failed, using legacy SQL:", error);
      const rows = await queryRaw(
        `SELECT id, merchant_id, session_kind, platform, device_id, device_label,
                staff_id, staff_name, last_heartbeat, created_at
         FROM pos_sessions
         WHERE merchant_id = $1
           AND revoked_at IS NULL
           AND last_heartbeat > $2
           AND ($3::text IS NULL OR session_kind = $3)
         ORDER BY created_at ASC`,
        [merchantId, cutoff, sessionKind || null]
      );
      return rows.map((r) => this.mapSessionRow(r as Record<string, unknown> as never));
    }
  }

  private static async evictStale(merchantId: string) {
    const db = getDb();
    const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
    await db
      .update(schema.posSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.posSessions.merchantId, merchantId),
          isNull(schema.posSessions.revokedAt),
          or(
            lt(schema.posSessions.lastHeartbeat, cutoff),
            isNull(schema.posSessions.lastHeartbeat)
          )
        )
      );
  }

  private static async enforceLimit(
    db: DbClient,
    merchantId: string,
    sessionKind: PosSessionKind,
    max: number,
    keepDeviceId: string
  ): Promise<string[]> {
    if (max <= 0) return [];
    const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
    let active: Array<{ id: string; deviceId: string }>;
    try {
      active = await db.query.posSessions.findMany({
        where: and(
          eq(schema.posSessions.merchantId, merchantId),
          eq(schema.posSessions.sessionKind, sessionKind),
          isNull(schema.posSessions.revokedAt),
          gt(schema.posSessions.lastHeartbeat, cutoff)
        ),
        orderBy: [asc(schema.posSessions.createdAt)],
      });
    } catch (error) {
      console.warn("[pos-sessions] enforceLimit list failed, using legacy SQL:", error);
      const rows = await queryRaw<{ id: string; device_id: string }>(
        `SELECT id, device_id FROM pos_sessions
         WHERE merchant_id = $1 AND session_kind = $2
           AND revoked_at IS NULL AND last_heartbeat > $3
         ORDER BY created_at ASC`,
        [merchantId, sessionKind, cutoff]
      );
      active = rows.map((r) => ({ id: r.id, deviceId: r.device_id }));
    }

    const kicked: string[] = [];

    // Same device re-registering: revoke its previous row first (does not count twice).
    const sameDevice = active.filter((s) => s.deviceId === keepDeviceId);
    for (const row of sameDevice) {
      await db
        .update(schema.posSessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.posSessions.id, row.id));
    }
    active = active.filter((s) => s.deviceId !== keepDeviceId);

    if (max > 0 && active.length >= max) {
      const kind = sessionKind === "waiter" ? "waiter" : "POS";
      const err = new Error(
        `${kind} station limit reached (${max}). Close another session or upgrade your package.`
      ) as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = sessionKind === "waiter" ? "WAITER_LIMIT_REACHED" : "POS_LIMIT_REACHED";
      throw err;
    }

    return kicked;
  }

  static async registerSession(
    merchantId: string,
    input: {
      sessionKind: PosSessionKind;
      platform: PosSessionPlatform;
      deviceId: string;
      deviceLabel?: string | null;
      staffId?: string | null;
      staffName?: string | null;
      locationId?: string | null;
    }
  ) {
    const deviceId = String(input.deviceId || "").trim().slice(0, 128);
    if (!deviceId) throw new Error("deviceId is required");

    await ensurePosSessionsSchema();
    await this.evictStale(merchantId);
    const limits = await this.getLimits(merchantId);
    const max =
      input.sessionKind === "waiter" ? limits.maxWaiterPosts : limits.maxPosPosts;

    const db = getDb();
    const now = new Date();
    let locationId: string | null = null;
    try {
      const { LocationsService } = await import("@/services/locations.service");
      locationId = await LocationsService.resolveLocationId(merchantId, input.locationId);
    } catch (error) {
      console.warn("[pos-sessions] location resolve skipped:", error);
    }

    const { row, kickedSessionIds } = await withMerchantSchemaRetry(() =>
      db.transaction(async (tx) => {
        const kickedSessionIds = await this.enforceLimit(
          tx,
          merchantId,
          input.sessionKind,
          max,
          deviceId
        );
        try {
          const [inserted] = await tx
            .insert(schema.posSessions)
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
        } catch (error) {
          console.warn("[pos-sessions] insert with location_id failed, using legacy SQL:", error);
          const rows = await queryRaw<{ id: string }>(
            `INSERT INTO pos_sessions
               (merchant_id, session_kind, platform, device_id, device_label, staff_id, staff_name, last_heartbeat)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
              merchantId,
              input.sessionKind,
              input.platform,
              deviceId,
              input.deviceLabel?.trim()?.slice(0, 255) || null,
              input.staffId || null,
              input.staffName?.trim()?.slice(0, 255) || null,
              now,
            ]
          );
          const inserted = rows[0];
          if (!inserted) throw error;
          return { row: inserted, kickedSessionIds };
        }
      })
    );

    return {
      sessionId: row.id,
      heartbeatIntervalSec: POS_SESSION_HEARTBEAT_SEC,
      maxPosPosts: limits.maxPosPosts,
      maxWaiterPosts: limits.maxWaiterPosts,
      kickedSessionIds,
    };
  }

  static async heartbeat(
    merchantId: string,
    sessionId: string,
    opts?: { printAgentOnline?: boolean | null }
  ) {
    await ensurePosSessionsSchema();
    const db = getDb();
    const row = await withMerchantSchemaRetry(async () => {
      try {
        return await db.query.posSessions.findFirst({
          where: and(
            eq(schema.posSessions.id, sessionId),
            eq(schema.posSessions.merchantId, merchantId),
            isNull(schema.posSessions.revokedAt)
          ),
        });
      } catch {
        const rows = await queryRaw<{ id: string }>(
          `SELECT id FROM pos_sessions
           WHERE id = $1 AND merchant_id = $2 AND revoked_at IS NULL
           LIMIT 1`,
          [sessionId, merchantId]
        );
        return rows[0] || null;
      }
    });
    if (!row) {
      throw new Error("POS session expired or revoked");
    }
    const now = new Date();
    const patch: { lastHeartbeat: Date; printAgentOnline?: boolean | null } = {
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
        .update(schema.posSessions)
        .set(patch)
        .where(eq(schema.posSessions.id, sessionId));
    } catch {
      await queryRaw(`UPDATE pos_sessions SET last_heartbeat = $1 WHERE id = $2`, [
        now,
        sessionId,
      ]);
    }
    return { ok: true, lastHeartbeat: now };
  }

  static async revokeSession(merchantId: string, sessionId: string) {
    const db = getDb();
    await db
      .update(schema.posSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.posSessions.id, sessionId),
          eq(schema.posSessions.merchantId, merchantId),
          isNull(schema.posSessions.revokedAt)
        )
      );
    return { ok: true };
  }

  static async revokeByDevice(
    merchantId: string,
    deviceId: string,
    sessionKind?: PosSessionKind
  ) {
    const db = getDb();
    await db
      .update(schema.posSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.posSessions.merchantId, merchantId),
          eq(schema.posSessions.deviceId, deviceId),
          isNull(schema.posSessions.revokedAt),
          sessionKind ? eq(schema.posSessions.sessionKind, sessionKind) : undefined
        )
      );
    return { ok: true };
  }
}
