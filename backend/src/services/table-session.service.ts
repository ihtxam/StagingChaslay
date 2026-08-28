import { randomBytes } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

export class TableSessionService {
  static newToken(): string {
    return randomBytes(24).toString("hex");
  }

  static async resolveTable(merchantId: string, tableId: string) {
    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(
        eq(schema.diningTables.id, tableId),
        eq(schema.diningTables.merchantId, merchantId)
      ),
    });
    return table ?? null;
  }

  /** Open or resume the active session for a table. */
  static async openOrResume(merchantId: string, tableId: string) {
    const db = getDb();
    const table = await this.resolveTable(merchantId, tableId);
    if (!table) throw new Error("Table not found");

    const existing = await db.query.tableSessions.findFirst({
      where: and(
        eq(schema.tableSessions.merchantId, merchantId),
        eq(schema.tableSessions.tableId, tableId),
        eq(schema.tableSessions.status, "open")
      ),
      orderBy: [desc(schema.tableSessions.openedAt)],
    });

    if (existing) return { session: existing, table };

    const token = this.newToken();
    const [session] = await db
      .insert(schema.tableSessions)
      .values({
        merchantId,
        tableId,
        sessionToken: token,
        status: "open",
      })
      .returning();

    return { session, table };
  }

  static async getByToken(merchantId: string, sessionToken: string) {
    const db = getDb();
    return db.query.tableSessions.findFirst({
      where: and(
        eq(schema.tableSessions.merchantId, merchantId),
        eq(schema.tableSessions.sessionToken, sessionToken)
      ),
    });
  }

  static async listSessionOrders(merchantId: string, sessionId: string) {
    const db = getDb();
    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.tableSessionId, sessionId)
      ),
      orderBy: [desc(schema.orders.createdAt)],
      with: {
        items: true,
      },
    });
    return orders;
  }

  static async closeSession(merchantId: string, sessionId: string) {
    const db = getDb();
    const [row] = await db
      .update(schema.tableSessions)
      .set({ status: "closed", closedAt: new Date() })
      .where(
        and(eq(schema.tableSessions.id, sessionId), eq(schema.tableSessions.merchantId, merchantId))
      )
      .returning();
    return row ?? null;
  }

  static async markPaid(merchantId: string, sessionId: string) {
    const db = getDb();
    const [row] = await db
      .update(schema.tableSessions)
      .set({ status: "paid", closedAt: new Date() })
      .where(
        and(eq(schema.tableSessions.id, sessionId), eq(schema.tableSessions.merchantId, merchantId))
      )
      .returning();
    return row ?? null;
  }

  static async sessionSummary(merchantId: string, sessionId: string) {
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

  static async ordersForTable(merchantId: string, tableId: string) {
    const db = getDb();
    const open = await db.query.tableSessions.findFirst({
      where: and(
        eq(schema.tableSessions.merchantId, merchantId),
        eq(schema.tableSessions.tableId, tableId),
        eq(schema.tableSessions.status, "open")
      ),
      orderBy: [desc(schema.tableSessions.openedAt)],
    });
    if (!open) return { session: null, orders: [] as Awaited<ReturnType<typeof this.listSessionOrders>> };
    const orders = await this.listSessionOrders(merchantId, open.id);
    return { session: open, orders };
  }

  static async assertOpenSession(
    merchantId: string,
    tableId: string,
    sessionToken?: string | null
  ) {
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
