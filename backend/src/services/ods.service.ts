import { randomBytes } from "crypto";
import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readOdsAddonEnabled } from "@/lib/ods-addon";
import { ensureOdsAddonColumn } from "@/lib/ensure-merchant-schema";
import {
  allocateDisplayShortCode,
  ensureOdsDisplayShortCodes,
} from "@/lib/display-short-code";
import { guestOrderNumber, parseOrderMetaFromNotes } from "@/lib/guest-order-number";
import { formatWebOrderNumberDisplay } from "@/lib/web-order-number";

export const ODS_THEMES = ["light", "teal", "dark"] as const;
export type OdsTheme = (typeof ODS_THEMES)[number];

export class OdsLicenseError extends Error {
  code = "ODS_ADDON_REQUIRED";
  constructor() {
    super("Order display (ODS) addon is not enabled for this merchant");
  }
}

export type OdsDisplayInput = {
  name: string;
  theme?: OdsTheme;
  isActive?: boolean;
};

export type OdsPushPayload = {
  orderNumber: string;
  status: "preparing" | "ready";
};

const READY_RETENTION_MS = 2 * 60 * 60 * 1000;
const PREPARING_RETENTION_MS = 24 * 60 * 60 * 1000;
/** Live “being prepared” rows older than this are hidden (stale kitchen queue). */
const LIVE_PREPARING_MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** Live “ready for pickup” rows older than this are hidden. */
const LIVE_READY_MAX_AGE_MS = 4 * 60 * 60 * 1000;

/** Order Center / web shop statuses shown on the “being prepared” column. */
const PREPARING_ORDER_STATUSES = ["accepted", "preparing", "sent_to_kitchen"] as const;

/** Statuses that remove an order from the customer board. */
const ODS_DISMISS_STATUSES = new Set([
  "completed",
  "cancelled",
  "out_for_delivery",
  "refunded",
  "partially_refunded",
]);

export type OrderForOds = {
  orderNumber?: string | null;
  notes?: string | null;
  status?: string | null;
};

export function resolveOdsDisplayNumber(order: OrderForOds): string {
  const meta = parseOrderMetaFromNotes(order.notes);
  const raw = guestOrderNumber({
    orderNumber: order.orderNumber,
    orderDisplay: meta.ticketDisplay,
    tabNumber: meta.tabNumber,
  });
  const web = formatWebOrderNumberDisplay(String(order.orderNumber || "").trim());
  const pick = raw || web || String(order.orderNumber || "").trim();
  return normalizeOrderNumber(pick);
}

function mergeBoardNumbers(
  shadow: { preparing: string[]; ready: string[] },
  live: { preparing: string[]; ready: string[] }
) {
  const readySet = new Set([...live.ready, ...shadow.ready]);
  const preparing: string[] = [];
  const seenPrep = new Set<string>();
  for (const num of [...shadow.preparing, ...live.preparing]) {
    if (readySet.has(num) || seenPrep.has(num)) continue;
    seenPrep.add(num);
    preparing.push(num);
  }
  const ready: string[] = [];
  const seenReady = new Set<string>();
  for (const num of [...live.ready, ...shadow.ready]) {
    if (seenReady.has(num)) continue;
    seenReady.add(num);
    ready.push(num);
  }
  return { preparing, ready };
}

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function normalizeTheme(value: unknown): OdsTheme {
  const t = String(value || "light").toLowerCase();
  return ODS_THEMES.includes(t as OdsTheme) ? (t as OdsTheme) : "light";
}

function normalizeOrderNumber(value: unknown): string {
  let s = String(value || "")
    .trim()
    .replace(/\s+/g, "");
  if (!s) return "";
  const bare = s.replace(/^#/, "");
  if (/^\d{1,6}$/.test(bare)) {
    return `#${bare}`;
  }
  if (/^WEB-/i.test(s)) {
    return formatWebOrderNumberDisplay(s);
  }
  return s.slice(0, 64);
}

async function findShadowRow(
  merchantId: string,
  orderNumber: string
): Promise<{ id: string; orderNumber: string; status: string } | null> {
  const db = getDb();
  const target = normalizeOrderNumber(orderNumber);
  if (!target) return null;
  const rows = await db.query.odsOrders.findMany({
    where: eq(schema.odsOrders.merchantId, merchantId),
    columns: { id: true, orderNumber: true, status: true },
  });
  return rows.find((r) => normalizeOrderNumber(r.orderNumber) === target) || null;
}

/** Drop shadow rows whose main order has already left the board. */
async function reconcileShadowBoard(merchantId: string) {
  const db = getDb();
  const shadowRows = await db.query.odsOrders.findMany({
    where: eq(schema.odsOrders.merchantId, merchantId),
    columns: { id: true, orderNumber: true },
  });
  if (!shadowRows.length) return;

  const liveOrders = await db.query.orders.findMany({
    where: and(
      eq(schema.orders.merchantId, merchantId),
      inArray(schema.orders.status, [
        ...Array.from(ODS_DISMISS_STATUSES),
        "ready",
        ...PREPARING_ORDER_STATUSES,
      ])
    ),
    columns: { orderNumber: true, notes: true, status: true },
  });

  const terminalNums = new Set<string>();
  for (const row of liveOrders) {
    const num = resolveOdsDisplayNumber(row);
    if (!num) continue;
    const st = String(row.status || "").toLowerCase();
    if (ODS_DISMISS_STATUSES.has(st)) terminalNums.add(num);
  }

  for (const shadow of shadowRows) {
    const num = normalizeOrderNumber(shadow.orderNumber);
    if (!num) continue;
    if (terminalNums.has(num)) {
      await db.delete(schema.odsOrders).where(eq(schema.odsOrders.id, shadow.id));
    }
  }
}

async function requireAddon(merchantId: string) {
  await ensureOdsAddonColumn();
  const enabled = await readOdsAddonEnabled(merchantId);
  if (!enabled) throw new OdsLicenseError();
}

async function purgeStale(merchantId: string) {
  const db = getDb();
  const now = Date.now();
  await reconcileShadowBoard(merchantId);
  await db
    .delete(schema.odsOrders)
    .where(
      and(
        eq(schema.odsOrders.merchantId, merchantId),
        eq(schema.odsOrders.status, "ready"),
        lt(schema.odsOrders.readyAt, new Date(now - READY_RETENTION_MS))
      )
    );
  await db
    .delete(schema.odsOrders)
    .where(
      and(
        eq(schema.odsOrders.merchantId, merchantId),
        eq(schema.odsOrders.status, "preparing"),
        lt(schema.odsOrders.updatedAt, new Date(now - PREPARING_RETENTION_MS))
      )
    );
}

export class OdsService {
  static async listDisplays(merchantId: string) {
    await requireAddon(merchantId);
    const db = getDb();
    await ensureOdsDisplayShortCodes(db, merchantId);
    return db.query.odsDisplays.findMany({
      where: eq(schema.odsDisplays.merchantId, merchantId),
      orderBy: [asc(schema.odsDisplays.name)],
    });
  }

  static async createDisplay(merchantId: string, input: OdsDisplayInput) {
    await requireAddon(merchantId);
    const db = getDb();
    const name = String(input.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Display name is required");
    const [row] = await db
      .insert(schema.odsDisplays)
      .values({
        merchantId,
        name,
        token: newToken(),
        shortCode: await allocateDisplayShortCode(db),
        theme: normalizeTheme(input.theme),
        isActive: input.isActive !== false,
      })
      .returning();
    return row;
  }

  static async updateDisplay(merchantId: string, id: string, input: Partial<OdsDisplayInput>) {
    await requireAddon(merchantId);
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name != null) patch.name = String(input.name).trim().slice(0, 255);
    if (input.theme != null) patch.theme = normalizeTheme(input.theme);
    if (input.isActive != null) patch.isActive = !!input.isActive;
    const [row] = await db
      .update(schema.odsDisplays)
      .set(patch)
      .where(and(eq(schema.odsDisplays.id, id), eq(schema.odsDisplays.merchantId, merchantId)))
      .returning();
    if (!row) throw new Error("ODS display not found");
    return row;
  }

  static async deleteDisplay(merchantId: string, id: string) {
    await requireAddon(merchantId);
    const db = getDb();
    await db
      .delete(schema.odsDisplays)
      .where(and(eq(schema.odsDisplays.id, id), eq(schema.odsDisplays.merchantId, merchantId)));
    return { ok: true };
  }

  static async rotateToken(merchantId: string, id: string) {
    await requireAddon(merchantId);
    const db = getDb();
    const [row] = await db
      .update(schema.odsDisplays)
      .set({
        token: newToken(),
        shortCode: await allocateDisplayShortCode(db),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.odsDisplays.id, id), eq(schema.odsDisplays.merchantId, merchantId)))
      .returning();
    if (!row) throw new Error("ODS display not found");
    return row;
  }

  static async displayByToken(accessKey: string) {
    const trimmed = String(accessKey || "").trim();
    if (!trimmed) return null;
    const db = getDb();
    return db.query.odsDisplays.findFirst({
      where: and(
        or(eq(schema.odsDisplays.shortCode, trimmed), eq(schema.odsDisplays.token, trimmed)),
        eq(schema.odsDisplays.isActive, true)
      ),
    });
  }

  /** Push or update an order on the customer board (POS / KDS integration). */
  static async pushOrder(merchantId: string, payload: OdsPushPayload) {
    const orderNumber = normalizeOrderNumber(payload.orderNumber);
    if (!orderNumber) throw new Error("orderNumber is required");
    const status = payload.status === "ready" ? "ready" : "preparing";

    let enabled = false;
    try {
      enabled = await readOdsAddonEnabled(merchantId);
    } catch {
      return { ok: false, skipped: true };
    }
    if (!enabled) return { ok: false, skipped: true };

    const db = getDb();
    await purgeStale(merchantId);

    const existing = await findShadowRow(merchantId, orderNumber);

    const now = new Date();
    if (existing) {
      if (existing.status === status) {
        return { ok: true, orderNumber, status, unchanged: true };
      }
      await db
        .update(schema.odsOrders)
        .set({
          status,
          readyAt: status === "ready" ? now : null,
          updatedAt: now,
        })
        .where(eq(schema.odsOrders.id, existing.id));
    } else {
      await db.insert(schema.odsOrders).values({
        merchantId,
        orderNumber,
        status,
        readyAt: status === "ready" ? now : null,
      });
    }
    return { ok: true, orderNumber, status };
  }

  static async dismissOrder(merchantId: string, orderNumber: string) {
    await requireAddon(merchantId);
    return this.dismissOrderSoft(merchantId, orderNumber);
  }

  /** Remove from board without throwing when addon is off (internal sync). */
  static async dismissOrderSoft(merchantId: string, orderNumber: string) {
    const num = normalizeOrderNumber(orderNumber);
    if (!num) throw new Error("orderNumber is required");
    let enabled = false;
    try {
      enabled = await readOdsAddonEnabled(merchantId);
    } catch {
      return { ok: false, skipped: true };
    }
    if (!enabled) return { ok: false, skipped: true };
    const db = getDb();
    const rows = await db.query.odsOrders.findMany({
      where: eq(schema.odsOrders.merchantId, merchantId),
      columns: { id: true, orderNumber: true },
    });
    const target = normalizeOrderNumber(num);
    const toDelete = rows.filter((r) => normalizeOrderNumber(r.orderNumber) === target);
    for (const row of toDelete) {
      await db.delete(schema.odsOrders).where(eq(schema.odsOrders.id, row.id));
    }
    return { ok: true };
  }

  /**
   * Keep ODS in sync with main order lifecycle (Order Center, online shop, POS pay-later).
   * Also used after POS kitchen send via shadow-table push — idempotent upsert/dismiss.
   */
  static async syncFromOrder(merchantId: string, order: OrderForOds) {
    const num = resolveOdsDisplayNumber(order);
    if (!num) return { ok: false, skipped: true };

    const status = String(order.status || "").toLowerCase();
    if ((PREPARING_ORDER_STATUSES as readonly string[]).includes(status)) {
      return this.pushOrder(merchantId, { orderNumber: num, status: "preparing" });
    }
    if (status === "ready") {
      return this.pushOrder(merchantId, { orderNumber: num, status: "ready" });
    }
    if (ODS_DISMISS_STATUSES.has(status)) {
      return this.dismissOrderSoft(merchantId, num);
    }
    return { ok: false, skipped: true };
  }

  /** Remove every shadow-board entry for this merchant (Settings → clear board). */
  static async clearAllOrders(merchantId: string) {
    await requireAddon(merchantId);
    const db = getDb();
    const deleted = await db
      .delete(schema.odsOrders)
      .where(eq(schema.odsOrders.merchantId, merchantId))
      .returning({ id: schema.odsOrders.id });
    return { ok: true, removed: deleted.length };
  }

  /** Live orders from the main orders table (online shop + POS pay-later / open fulfillment). */
  static async boardFromLiveOrders(merchantId: string) {
    const enabled = await readOdsAddonEnabled(merchantId).catch(() => false);
    if (!enabled) return { preparing: [] as string[], ready: [] as string[] };

    const db = getDb();
    const now = Date.now();
    const rows = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        inArray(schema.orders.status, [...PREPARING_ORDER_STATUSES, "ready"])
      ),
      columns: { orderNumber: true, notes: true, status: true, createdAt: true, updatedAt: true },
      orderBy: [asc(schema.orders.createdAt)],
    });

    const preparing: string[] = [];
    const ready: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const touched = row.updatedAt || row.createdAt;
      const ageMs = touched ? now - touched.getTime() : 0;
      const st = String(row.status || "").toLowerCase();
      if (st === "ready") {
        if (ageMs > LIVE_READY_MAX_AGE_MS) continue;
      } else if ((PREPARING_ORDER_STATUSES as readonly string[]).includes(st)) {
        if (ageMs > LIVE_PREPARING_MAX_AGE_MS) continue;
      }
      const num = resolveOdsDisplayNumber(row);
      if (!num || seen.has(num)) continue;
      seen.add(num);
      const st = String(row.status || "").toLowerCase();
      if (st === "ready") ready.push(num);
      else if ((PREPARING_ORDER_STATUSES as readonly string[]).includes(st)) preparing.push(num);
    }
    return { preparing, ready };
  }

  static async boardForToken(token: string) {
    const display = await this.displayByToken(token);
    if (!display) throw new Error("Invalid ODS link");

    const enabled = await readOdsAddonEnabled(display.merchantId).catch(() => false);
    if (!enabled) throw new OdsLicenseError();

    await purgeStale(display.merchantId);
    const db = getDb();

    const preparingRows = await db.query.odsOrders.findMany({
      where: and(
        eq(schema.odsOrders.merchantId, display.merchantId),
        eq(schema.odsOrders.status, "preparing")
      ),
      orderBy: [asc(schema.odsOrders.createdAt)],
    });

    const readyRows = await db.query.odsOrders.findMany({
      where: and(
        eq(schema.odsOrders.merchantId, display.merchantId),
        eq(schema.odsOrders.status, "ready")
      ),
      orderBy: [desc(schema.odsOrders.readyAt), desc(schema.odsOrders.updatedAt)],
    });

    const shadow = {
      preparing: preparingRows.map((r) => normalizeOrderNumber(r.orderNumber)).filter(Boolean),
      ready: readyRows.map((r) => normalizeOrderNumber(r.orderNumber)).filter(Boolean),
    };
    const live = await this.boardFromLiveOrders(display.merchantId);
    const merged = mergeBoardNumbers(shadow, live);

    return {
      display: {
        id: display.id,
        name: display.name,
        theme: display.theme as OdsTheme,
      },
      serverTime: new Date().toISOString(),
      preparing: merged.preparing,
      ready: merged.ready,
    };
  }
}
