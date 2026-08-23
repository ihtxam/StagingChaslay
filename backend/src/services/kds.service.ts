import { randomBytes } from "crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readKdsAddonEnabled } from "@/lib/kds-addon";
import { ensureKdsAddonColumn } from "@/lib/ensure-merchant-schema";

export class KdsLicenseError extends Error {
  code = "KDS_ADDON_REQUIRED";
  constructor() {
    super("Kitchen display (KDS) addon is not enabled for this merchant");
  }
}

async function requireAddon(merchantId: string) {
  await ensureKdsAddonColumn();
  const enabled = await readKdsAddonEnabled(merchantId);
  if (!enabled) throw new KdsLicenseError();
}

async function maybePushOdsReady(merchantId: string, orderNumber: string | null | undefined) {
  if (!orderNumber?.trim()) return;
  try {
    const { OdsService } = await import("@/services/ods.service");
    await OdsService.pushOrder(merchantId, { orderNumber: orderNumber.trim(), status: "ready" });
  } catch {
    /* ODS optional */
  }
}

export type KdsStationInput = {
  name: string;
  orderTypes?: string[];
  categoryIds?: string[];
  productIds?: string[];
  theme?: string;
  layoutMode?: string;
  gridColumns?: number;
  overdueMinutes?: number;
  isActive?: boolean;
};

const KDS_THEMES = new Set(["dark", "light", "teal"]);
const KDS_LAYOUT_MODES = new Set(["grid", "rows", "slider"]);

function normalizeKdsTheme(value: unknown): string {
  const t = String(value || "dark").toLowerCase();
  return KDS_THEMES.has(t) ? t : "dark";
}

function normalizeKdsLayoutMode(value: unknown): string {
  const m = String(value || "grid").toLowerCase();
  return KDS_LAYOUT_MODES.has(m) ? m : "grid";
}

function clampGridColumns(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 3;
  return Math.min(6, Math.max(1, n));
}

function clampOverdueMinutes(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 20;
  return Math.min(120, Math.max(5, n));
}

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

const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;

export class KdsService {
  static async listStations(merchantId: string) {
    await requireAddon(merchantId);
    const db = getDb();
    return db.query.kdsStations.findMany({
      where: eq(schema.kdsStations.merchantId, merchantId),
      orderBy: [asc(schema.kdsStations.name)],
    });
  }

  static async createStation(merchantId: string, input: KdsStationInput) {
    await requireAddon(merchantId);
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
        theme: normalizeKdsTheme(input.theme),
        layoutMode: normalizeKdsLayoutMode(input.layoutMode),
        gridColumns: clampGridColumns(input.gridColumns),
        overdueMinutes: clampOverdueMinutes(input.overdueMinutes),
        isActive: input.isActive !== false,
      })
      .returning();
    return row;
  }

  static async updateStation(merchantId: string, id: string, input: Partial<KdsStationInput>) {
    await requireAddon(merchantId);
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name != null) patch.name = String(input.name).trim().slice(0, 255);
    if (input.orderTypes != null) patch.orderTypes = input.orderTypes;
    if (input.categoryIds != null) patch.categoryIds = input.categoryIds;
    if (input.productIds != null) patch.productIds = input.productIds;
    if (input.theme != null) patch.theme = normalizeKdsTheme(input.theme);
    if (input.layoutMode != null) patch.layoutMode = normalizeKdsLayoutMode(input.layoutMode);
    if (input.gridColumns != null) patch.gridColumns = clampGridColumns(input.gridColumns);
    if (input.overdueMinutes != null) patch.overdueMinutes = clampOverdueMinutes(input.overdueMinutes);
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
    await requireAddon(merchantId);
    const db = getDb();
    await db
      .delete(schema.kdsStations)
      .where(and(eq(schema.kdsStations.id, id), eq(schema.kdsStations.merchantId, merchantId)));
    return { ok: true };
  }

  static async rotateToken(merchantId: string, id: string) {
    await requireAddon(merchantId);
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
    await requireAddon(merchantId);
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
    await requireAddon(station.merchantId);

    const db = getDb();
    const sinceDate = since ? new Date(since) : null;
    const completedSince = new Date(Date.now() - COMPLETED_RETENTION_MS);
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
        if (!items.length) return null;
        if (
          t.status === "completed" &&
          t.completedAt &&
          t.completedAt < completedSince
        ) {
          return null;
        }
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
      .filter(Boolean)
      .sort((a, b) => {
        if (a!.status === "completed" && b!.status === "completed") {
          const aAt = a!.completedAt ? new Date(a!.completedAt).getTime() : 0;
          const bAt = b!.completedAt ? new Date(b!.completedAt).getTime() : 0;
          return bAt - aAt;
        }
        if (a!.status === "completed") return 1;
        if (b!.status === "completed") return -1;
        return 0;
      });

    const updatedSince = sinceDate
      ? tickets.some((t) => t.updatedAt > sinceDate!)
      : true;

    return {
      station: {
        id: station.id,
        name: station.name,
        theme: normalizeKdsTheme(station.theme),
        layoutMode: normalizeKdsLayoutMode(station.layoutMode),
        gridColumns: clampGridColumns(station.gridColumns),
        overdueMinutes: clampOverdueMinutes(station.overdueMinutes),
      },
      serverTime: new Date().toISOString(),
      updated: updatedSince,
      tickets: filtered,
    };
  }

  /** POS sync: all open/recent KDS tickets with ready line ids and completion state. */
  static async boardStatusForMerchant(merchantId: string) {
    await requireAddon(merchantId);
    const db = getDb();
    const completedSince = new Date(Date.now() - COMPLETED_RETENTION_MS);
    const tickets = await db.query.kdsTickets.findMany({
      where: and(
        eq(schema.kdsTickets.merchantId, merchantId),
        inArray(schema.kdsTickets.status, ["pending", "completed"])
      ),
      with: { items: true },
    });
    return tickets
      .filter(
        (t) =>
          t.status === "pending" ||
          (t.completedAt && t.completedAt >= completedSince)
      )
      .map((t) => {
        const items = t.items || [];
        return {
          ticketKey: t.ticketKey,
          status: t.status,
          completedAt: t.completedAt?.toISOString() ?? null,
          readyLineIds: items.filter((i) => i.status === "ready").map((i) => i.lineId),
          total: items.length,
          ready: items.filter((i) => i.status === "ready").length,
        };
      });
  }

  static async markItemReady(token: string, itemId: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");
    await requireAddon(station.merchantId);
    const db = getDb();
    const item = await db.query.kdsTicketItems.findFirst({
      where: eq(schema.kdsTicketItems.id, itemId),
      with: { ticket: true },
    });
    if (!item?.ticket || item.ticket.merchantId !== station.merchantId) {
      throw new Error("Item not found");
    }
    await db
      .update(schema.kdsTicketItems)
      .set({ status: "ready", readyAt: new Date() })
      .where(eq(schema.kdsTicketItems.id, itemId));
    await db
      .update(schema.kdsTickets)
      .set({ updatedAt: new Date() })
      .where(eq(schema.kdsTickets.id, item.ticketId));

    const allItems = await db.query.kdsTicketItems.findMany({
      where: eq(schema.kdsTicketItems.ticketId, item.ticketId),
    });
    const allReady = allItems.length > 0 && allItems.every((i) => i.status === "ready");
    if (allReady) {
      await maybePushOdsReady(station.merchantId, item.ticket.orderNumber);
    }

    return { ok: true, lineId: item.lineId, ticketKey: item.ticket.ticketKey };
  }

  /** Recall one ready item from a completed (or ready) ticket back to preparation. */
  static async recallItem(token: string, itemId: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");
    await requireAddon(station.merchantId);
    const db = getDb();
    const item = await db.query.kdsTicketItems.findFirst({
      where: eq(schema.kdsTicketItems.id, itemId),
      with: { ticket: true },
    });
    if (!item?.ticket || item.ticket.merchantId !== station.merchantId) {
      throw new Error("Item not found");
    }
    if (item.status !== "ready") {
      throw new Error("Only ready items can be recalled");
    }
    const now = new Date();
    await db
      .update(schema.kdsTicketItems)
      .set({ status: "pending", readyAt: null })
      .where(eq(schema.kdsTicketItems.id, itemId));
    await db
      .update(schema.kdsTickets)
      .set({ status: "pending", completedAt: null, updatedAt: now })
      .where(eq(schema.kdsTickets.id, item.ticketId));
    return { ok: true, lineId: item.lineId, ticketKey: item.ticket.ticketKey };
  }

  static async completeTicket(token: string, ticketId: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");
    await requireAddon(station.merchantId);
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
    await maybePushOdsReady(station.merchantId, ticket.orderNumber);
    return { ok: true, ticketKey: ticket.ticketKey };
  }

  static async recallTicket(token: string, ticketId: string) {
    const station = await this.stationByToken(token);
    if (!station) throw new Error("Invalid KDS link");
    await requireAddon(station.merchantId);
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
    await requireAddon(merchantId);
    const db = getDb();
    const ticket = await db.query.kdsTickets.findFirst({
      where: and(
        eq(schema.kdsTickets.merchantId, merchantId),
        eq(schema.kdsTickets.ticketKey, ticketKey)
      ),
      with: { items: true },
    });
    if (!ticket) return { readyLineIds: [] as string[], total: 0, ready: 0 };
    const items = ticket.items || [];
    const readyLineIds = items.filter((i) => i.status === "ready").map((i) => i.lineId);
    return {
      status: ticket.status,
      readyLineIds,
      total: items.length,
      ready: readyLineIds.length,
    };
  }
}
