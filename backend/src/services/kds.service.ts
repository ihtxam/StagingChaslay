import { randomBytes } from "crypto";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type KdsStationInput = {
  name: string;
  orderTypes?: string[];
  categoryIds?: string[];
  productIds?: string[];
  isActive?: boolean;
};

export type KdsPushItem = {
  lineId: string;
  productId?: string | null;
  categoryId?: string | null;
  name: string;
  quantity: number;
  lineNote?: string | null;
  courseNumber?: number | null;
  selectedExtras?: unknown;
  comboSelections?: unknown;
};

export type KdsPushPayload = {
  ticketKey: string;
  orderNumber?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  channel?: string | null;
  items: KdsPushItem[];
};

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function itemMatchesStation(
  item: { categoryId?: string | null; productId?: string | null },
  station: {
    orderTypes: string[] | null;
    categoryIds: string[] | null;
    productIds: string[] | null;
  },
  channel?: string | null
): boolean {
  const types = station.orderTypes || [];
  if (types.length && channel && !types.includes(String(channel))) return false;

  const cats = station.categoryIds || [];
  const prods = station.productIds || [];
  if (!cats.length && !prods.length) return true;
  if (item.productId && prods.includes(item.productId)) return true;
  if (item.categoryId && cats.includes(item.categoryId)) return true;
  return false;
}

export class KdsService {
  static async listStations(merchantId: string) {
    const db = getDb();
    return db.query.kdsStations.findMany({
      where: eq(schema.kdsStations.merchantId, merchantId),
      orderBy: [asc(schema.kdsStations.name)],
    });
  }

  static async createStation(merchantId: string, input: KdsStationInput) {
    const db = getDb();
    const name = String(input.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Station name is required");
    const [row] = await db
      .insert(schema.kdsStations)
      .values({
        merchantId,
        name,
        token: newToken(),
        orderTypes: input.orderTypes || [],
        categoryIds: input.categoryIds || [],
        productIds: input.productIds || [],
        isActive: input.isActive !== false,
      })
      .returning();
    return row;
  }

  static async updateStation(merchantId: string, id: string, input: Partial<KdsStationInput>) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name != null) patch.name = String(input.name).trim().slice(0, 255);
    if (input.orderTypes != null) patch.orderTypes = input.orderTypes;
    if (input.categoryIds != null) patch.categoryIds = input.categoryIds;
    if (input.productIds != null) patch.productIds = input.productIds;
    if (input.isActive != null) patch.isActive = !!input.isActive;
    const [row] = await db
      .update(schema.kdsStations)
      .set(patch)
      .where(and(eq(schema.kdsStations.id, id), eq(schema.kdsStations.merchantId, merchantId)))
      .returning();
    if (!row) throw new Error("KDS station not found");
    return row;
  }

  static async deleteStation(merchantId: string, id: string) {
    const db = getDb();
    await db
      .delete(schema.kdsStations)
      .where(and(eq(schema.kdsStations.id, id), eq(schema.kdsStations.merchantId, merchantId)));
    return { ok: true };
  }

  static async rotateToken(merchantId: string, id: string) {
    const db = getDb();
    const [row] = await db
      .update(schema.kdsStations)
      .set({ token: newToken(), updatedAt: new Date() })
      .where(and(eq(schema.kdsStations.id, id), eq(schema.kdsStations.merchantId, merchantId)))
      .returning();
    if (!row) throw new Error("KDS station not found");
    return row;
  }

  static async stationByToken(token: string) {
    const db = getDb();
    return db.query.kdsStations.findFirst({
      where: and(eq(schema.kdsStations.token, token), eq(schema.kdsStations.isActive, true)),
    });
  }

  /** Upsert ticket + append new line items when kitchen receives an order. */
  static async pushKitchen(merchantId: string, payload: KdsPushPayload) {
    const ticketKey = String(payload.ticketKey || "").trim().slice(0, 255);
    if (!ticketKey) throw new Error("ticketKey is required");
    const items = (payload.items || []).filter((i) => i.lineId && i.name);
    if (!items.length) return { ok: true, added: 0 };

    const db = getDb();
    let ticket = await db.query.kdsTickets.findFirst({
      where: and(
        eq(schema.kdsTickets.merchantId, merchantId),
        eq(schema.kdsTickets.ticketKey, ticketKey),
        eq(schema.kdsTickets.status, "pending")
      ),
    });

    if (!ticket) {
      const [inserted] = await db
        .insert(schema.kdsTickets)
        .values({
          merchantId,
          ticketKey,
          orderNumber: payload.orderNumber?.trim()?.slice(0, 64) || null,
          tableLabel: payload.tableLabel?.trim()?.slice(0, 120) || null,
          tabNumber: payload.tabNumber?.trim()?.slice(0, 64) || null,
          channel: payload.channel?.trim()?.slice(0, 50) || null,
          status: "pending",
        })
        .returning();
      ticket = inserted;
    } else {
      await db
        .update(schema.kdsTickets)
        .set({
          orderNumber: payload.orderNumber?.trim()?.slice(0, 64) || ticket.orderNumber,
          tableLabel: payload.tableLabel?.trim()?.slice(0, 120) ?? ticket.tableLabel,
          tabNumber: payload.tabNumber?.trim()?.slice(0, 64) ?? ticket.tabNumber,
          channel: payload.channel?.trim()?.slice(0, 50) ?? ticket.channel,
          updatedAt: new Date(),
        })
        .where(eq(schema.kdsTickets.id, ticket.id));
    }

    const existing = await db.query.kdsTicketItems.findMany({
      where: eq(schema.kdsTicketItems.ticketId, ticket.id),
      columns: { lineId: true },
    });
    const seen = new Set(existing.map((r) => r.lineId));
    const toInsert = items.filter((i) => !seen.has(i.lineId));
    if (toInsert.length) {
      await db.insert(schema.kdsTicketItems).values(
        toInsert.map((i) => ({
          ticketId: ticket!.id,
          lineId: i.lineId,
          productId: i.productId || null,
          categoryId: i.categoryId || null,
          name: String(i.name).slice(0, 255),
          quantity: String(i.quantity || 1),
          lineNote: i.lineNote?.trim()?.slice(0, 500) || null,
          courseNumber: i.courseNumber ?? null,
          modifiersJson: {
            selectedExtras: i.selectedExtras || [],
            comboSelections: i.comboSelections || [],
          },
          status: "pending",
        }))
      );
    }
    return { ok: true, added: toInsert.length, ticketId: ticket.id };
  }

  static async listForToken(token: string, since?: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");

    const db = getDb();
    const sinceDate = since ? new Date(since) : null;
    const tickets = await db.query.kdsTickets.findMany({
      where: and(
        eq(schema.kdsTickets.merchantId, station.merchantId),
        inArray(schema.kdsTickets.status, ["pending", "completed"])
      ),
      orderBy: [asc(schema.kdsTickets.createdAt)],
      with: { items: true },
    });

    const filtered = tickets
      .map((t) => {
        const items = (t.items || []).filter((item) =>
          itemMatchesStation(item, station, t.channel)
        );
        if (!items.length && t.status === "completed") return null;
        if (t.status === "completed" && items.every((i) => i.status === "ready")) return null;
        return {
          id: t.id,
          ticketKey: t.ticketKey,
          orderNumber: t.orderNumber,
          tableLabel: t.tableLabel,
          tabNumber: t.tabNumber,
          channel: t.channel,
          status: t.status,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
          items: items.map((i) => ({
            id: i.id,
            lineId: i.lineId,
            name: i.name,
            quantity: Number(i.quantity),
            lineNote: i.lineNote,
            courseNumber: i.courseNumber,
            status: i.status,
            readyAt: i.readyAt,
            modifiersJson: i.modifiersJson,
          })),
        };
      })
      .filter(Boolean);

    const updatedSince = sinceDate
      ? tickets.some((t) => t.updatedAt > sinceDate!)
      : true;

    return {
      station: { id: station.id, name: station.name },
      serverTime: new Date().toISOString(),
      updated: updatedSince,
      tickets: filtered,
    };
  }

  static async markItemReady(token: string, itemId: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");
    const db = getDb();
    const item = await db.query.kdsTicketItems.findFirst({
      where: eq(schema.kdsTicketItems.id, itemId),
      with: { ticket: true },
    });
    if (!item?.ticket || item.ticket.merchantId !== station.merchantId) {
      throw new Error("Item not found");
    }
    const now = new Date();
    await db
      .update(schema.kdsTicketItems)
      .set({ status: "ready", readyAt: now })
      .where(eq(schema.kdsTicketItems.id, itemId));
    await db
      .update(schema.kdsTickets)
      .set({ updatedAt: now })
      .where(eq(schema.kdsTickets.id, item.ticketId));

    const ticket = await db.query.kdsTickets.findFirst({
      where: eq(schema.kdsTickets.id, item.ticketId),
      with: { items: true },
    });
    if (ticket && ticket.status === "pending") {
      const visible = (ticket.items || []).filter((row) =>
        itemMatchesStation(row, station, ticket.channel)
      );
      const allReady =
        visible.length > 0 && visible.every((row) => row.status === "ready");
      if (allReady) {
        await db
          .update(schema.kdsTicketItems)
          .set({ status: "ready", readyAt: now })
          .where(eq(schema.kdsTicketItems.ticketId, ticket.id));
        await db
          .update(schema.kdsTickets)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(schema.kdsTickets.id, ticket.id));
        return {
          ok: true,
          lineId: item.lineId,
          ticketKey: ticket.ticketKey,
          completed: true,
        };
      }
    }

    return { ok: true, lineId: item.lineId, ticketKey: item.ticket!.ticketKey };
  }

  static async completeTicket(token: string, ticketId: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");
    const db = getDb();
    const ticket = await db.query.kdsTickets.findFirst({
      where: and(
        eq(schema.kdsTickets.id, ticketId),
        eq(schema.kdsTickets.merchantId, station.merchantId)
      ),
      with: { items: true },
    });
    if (!ticket) throw new Error("Ticket not found");
    const now = new Date();
    await db
      .update(schema.kdsTicketItems)
      .set({ status: "ready", readyAt: now })
      .where(eq(schema.kdsTicketItems.ticketId, ticketId));
    await db
      .update(schema.kdsTickets)
      .set({ status: "completed", completedAt: now, updatedAt: now })
      .where(eq(schema.kdsTickets.id, ticketId));
    return { ok: true, ticketKey: ticket.ticketKey };
  }

  static async recallTicket(token: string, ticketId: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");
    const db = getDb();
    const ticket = await db.query.kdsTickets.findFirst({
      where: and(
        eq(schema.kdsTickets.id, ticketId),
        eq(schema.kdsTickets.merchantId, station.merchantId),
        eq(schema.kdsTickets.status, "completed")
      ),
    });
    if (!ticket) throw new Error("Ticket not found");
    await db
      .update(schema.kdsTickets)
      .set({ status: "pending", completedAt: null, updatedAt: new Date() })
      .where(eq(schema.kdsTickets.id, ticketId));
    await db
      .update(schema.kdsTicketItems)
      .set({ status: "pending", readyAt: null })
      .where(
        and(
          eq(schema.kdsTicketItems.ticketId, ticketId),
          eq(schema.kdsTicketItems.status, "ready")
        )
      );
    return { ok: true };
  }

  static async ticketStatusForPos(merchantId: string, ticketKey: string) {
    const base = String(ticketKey || "")
      .trim()
      .split("@")[0];
    if (!base) return { readyLineIds: [] as string[], total: 0, ready: 0 };

    const db = getDb();
    const tickets = await db.query.kdsTickets.findMany({
      where: and(
        eq(schema.kdsTickets.merchantId, merchantId),
        or(
          eq(schema.kdsTickets.ticketKey, base),
          sql`${schema.kdsTickets.ticketKey} LIKE ${`${base}@%`}`
        )
      ),
      with: { items: true },
    });
    if (!tickets.length) return { readyLineIds: [] as string[], total: 0, ready: 0 };
    const items = tickets.flatMap((t) => t.items || []);
    const readyLineIds = items.filter((i) => i.status === "ready").map((i) => i.lineId);
    return {
      status: tickets.some((t) => t.status === "pending") ? "pending" : "completed",
      readyLineIds,
      total: items.length,
      ready: readyLineIds.length,
    };
  }
}
