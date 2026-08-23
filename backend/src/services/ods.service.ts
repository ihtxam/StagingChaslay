import { randomBytes } from "crypto";
import { and, asc, desc, eq, lt, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readOdsAddonEnabled } from "@/lib/ods-addon";
import { ensureOdsAddonColumn } from "@/lib/ensure-merchant-schema";
import {
  allocateDisplayShortCode,
  ensureOdsDisplayShortCodes,
} from "@/lib/display-short-code";

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

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function normalizeTheme(value: unknown): OdsTheme {
  const t = String(value || "light").toLowerCase();
  return ODS_THEMES.includes(t as OdsTheme) ? (t as OdsTheme) : "light";
}

function normalizeOrderNumber(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 64);
}

async function requireAddon(merchantId: string) {
  await ensureOdsAddonColumn();
  const enabled = await readOdsAddonEnabled(merchantId);
  if (!enabled) throw new OdsLicenseError();
}

async function purgeStale(merchantId: string) {
  const db = getDb();
  const now = Date.now();
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

    const existing = await db.query.odsOrders.findFirst({
      where: and(
        eq(schema.odsOrders.merchantId, merchantId),
        eq(schema.odsOrders.orderNumber, orderNumber)
      ),
    });

    const now = new Date();
    if (existing) {
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
    const num = normalizeOrderNumber(orderNumber);
    if (!num) throw new Error("orderNumber is required");
    const db = getDb();
    await db
      .delete(schema.odsOrders)
      .where(
        and(eq(schema.odsOrders.merchantId, merchantId), eq(schema.odsOrders.orderNumber, num))
      );
    return { ok: true };
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

    return {
      display: {
        id: display.id,
        name: display.name,
        theme: display.theme as OdsTheme,
      },
      serverTime: new Date().toISOString(),
      preparing: preparingRows.map((r) => r.orderNumber),
      ready: readyRows.map((r) => r.orderNumber),
    };
  }
}
