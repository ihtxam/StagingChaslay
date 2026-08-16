import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb, schema, type Database } from "@/db";

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
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { maxPosPosts: true, maxWaiterPosts: true },
    });
    return {
      maxPosPosts: Math.max(0, Number(merchant?.maxPosPosts ?? 0)),
      maxWaiterPosts: Math.max(0, Number(merchant?.maxWaiterPosts ?? 0)),
    };
  }

  static async listActive(merchantId: string, sessionKind?: PosSessionKind) {
    const db = getDb();
    const cutoff = new Date(Date.now() - HEARTBEAT_TTL_MS);
    const rows = await db.query.posSessions.findMany({
      where: and(
        eq(schema.posSessions.merchantId, merchantId),
        isNull(schema.posSessions.revokedAt),
        gt(schema.posSessions.lastHeartbeat, cutoff),
        sessionKind ? eq(schema.posSessions.sessionKind, sessionKind) : undefined
      ),
      orderBy: [asc(schema.posSessions.createdAt)],
    });
    return rows.map((r) => ({
      id: r.id,
      sessionKind: r.sessionKind as PosSessionKind,
      platform: r.platform as PosSessionPlatform,
      deviceId: r.deviceId,
      deviceLabel: r.deviceLabel,
      staffId: r.staffId,
      staffName: r.staffName,
      lastHeartbeat: r.lastHeartbeat,
      createdAt: r.createdAt,
    }));
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
    let active = await db.query.posSessions.findMany({
      where: and(
        eq(schema.posSessions.merchantId, merchantId),
        eq(schema.posSessions.sessionKind, sessionKind),
        isNull(schema.posSessions.revokedAt),
        gt(schema.posSessions.lastHeartbeat, cutoff)
      ),
      orderBy: [asc(schema.posSessions.createdAt)],
    });

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

    while (active.length >= max) {
      const oldest = active.shift();
      if (!oldest) break;
      await db
        .update(schema.posSessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.posSessions.id, oldest.id));
      kicked.push(oldest.id);
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
    }
  ) {
    const deviceId = String(input.deviceId || "").trim().slice(0, 128);
    if (!deviceId) throw new Error("deviceId is required");

    await this.evictStale(merchantId);
    const limits = await this.getLimits(merchantId);
    const max =
      input.sessionKind === "waiter" ? limits.maxWaiterPosts : limits.maxPosPosts;

    const db = getDb();
    const now = new Date();

    const { row, kickedSessionIds } = await db.transaction(async (tx) => {
      const kickedSessionIds = await this.enforceLimit(
        tx,
        merchantId,
        input.sessionKind,
        max,
        deviceId
      );
      const [inserted] = await tx
        .insert(schema.posSessions)
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
      heartbeatIntervalSec: POS_SESSION_HEARTBEAT_SEC,
      maxPosPosts: limits.maxPosPosts,
      maxWaiterPosts: limits.maxWaiterPosts,
      kickedSessionIds,
    };
  }

  static async heartbeat(merchantId: string, sessionId: string) {
    const db = getDb();
    const row = await db.query.posSessions.findFirst({
      where: and(
        eq(schema.posSessions.id, sessionId),
        eq(schema.posSessions.merchantId, merchantId),
        isNull(schema.posSessions.revokedAt)
      ),
    });
    if (!row) {
      throw new Error("POS session expired or revoked");
    }
    const now = new Date();
    await db
      .update(schema.posSessions)
      .set({ lastHeartbeat: now })
      .where(eq(schema.posSessions.id, sessionId));
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
