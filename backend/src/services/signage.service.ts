import { randomBytes } from "crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  SIGNAGE_ORIENTATIONS,
  SIGNAGE_SLIDE_TYPES,
  SIGNAGE_TEMPLATES,
  type SignageOrientation,
  type SignageSchedule,
  type SignageSlideType,
  type SignageTemplate,
} from "@/db/schema";
import { ensureSignageAddonColumn } from "@/lib/ensure-merchant-schema";
import { readSignageAddon } from "@/lib/signage-addon";

export class SignageLicenseError extends Error {
  constructor(message = "Digital signage addon is not enabled") {
    super(message);
    this.name = "SignageLicenseError";
  }
}

export type SignageScreenInput = {
  name: string;
  orientation?: string;
  template?: string;
  playlistId?: string | null;
  screenSizeIn?: number;
};

export const SIGNAGE_SCREEN_SIZES = [10, 15, 23, 32, 43, 55, 65] as const;

export type SignagePlaylistInput = {
  name: string;
  template?: string;
  schedule?: SignageSchedule;
};

export type SignageSlideInput = {
  type?: string;
  durationSec?: number;
  sortOrder?: number;
  categoryIds?: string[];
  headline?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  showPrices?: boolean;
  showPhotos?: boolean;
};

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function clampScreenSize(raw: unknown): number {
  const n = Math.round(Number(raw));
  return (SIGNAGE_SCREEN_SIZES as readonly number[]).includes(n) ? n : 32;
}

async function newShortCode(db: ReturnType<typeof getDb>): Promise<string> {
  for (let attempt = 0; attempt < 80; attempt++) {
    const digits = attempt < 40 ? 5 : 6;
    const min = digits === 4 ? 1000 : digits === 5 ? 10000 : 100000;
    const max = digits === 4 ? 9999 : digits === 5 ? 99999 : 999999;
    const code = String(Math.floor(min + Math.random() * (max - min + 1)));
    const taken = await db.query.signageScreens.findFirst({
      where: eq(schema.signageScreens.shortCode, code),
      columns: { id: true },
    });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a screen code — try again");
}

async function ensureShortCodes(db: ReturnType<typeof getDb>, merchantId: string) {
  const rows = await db.query.signageScreens.findMany({
    where: and(eq(schema.signageScreens.merchantId, merchantId)),
    columns: { id: true, shortCode: true },
  });
  for (const row of rows) {
    if (row.shortCode) continue;
    const shortCode = await newShortCode(db);
    await db
      .update(schema.signageScreens)
      .set({ shortCode, updatedAt: new Date() })
      .where(eq(schema.signageScreens.id, row.id));
  }
}

function asTemplate(raw: unknown, fallback: SignageTemplate = "dark_pizza"): SignageTemplate {
  const v = String(raw || "").trim();
  return (SIGNAGE_TEMPLATES as readonly string[]).includes(v) ? (v as SignageTemplate) : fallback;
}

function asOrientation(raw: unknown): SignageOrientation {
  return String(raw || "") === "portrait" ? "portrait" : "landscape";
}

function asSlideType(raw: unknown): SignageSlideType {
  const v = String(raw || "").trim();
  return (SIGNAGE_SLIDE_TYPES as readonly string[]).includes(v) ? (v as SignageSlideType) : "menu";
}

function clampDuration(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 10;
  return Math.min(30, Math.max(5, n));
}

function normalizeSchedule(raw: unknown): SignageSchedule {
  if (!raw || typeof raw !== "object") return { type: "always" };
  const o = raw as Record<string, unknown>;
  const type = o.type === "weekdays" || o.type === "daypart" ? o.type : "always";
  const weekdays = Array.isArray(o.weekdays)
    ? o.weekdays.map((d) => Math.round(Number(d))).filter((d) => d >= 1 && d <= 7)
    : [];
  const daypart = o.daypart === "dinner" ? "dinner" : "lunch";
  const startTime = typeof o.startTime === "string" && /^\d{1,2}:\d{2}$/.test(o.startTime)
    ? o.startTime
    : daypart === "dinner"
      ? "17:00"
      : "11:00";
  const endTime = typeof o.endTime === "string" && /^\d{1,2}:\d{2}$/.test(o.endTime)
    ? o.endTime
    : daypart === "dinner"
      ? "22:00"
      : "14:30";
  if (type === "weekdays") return { type, weekdays };
  if (type === "daypart") return { type, daypart, startTime, endTime };
  return { type: "always" };
}

function zurichParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekdayRaw = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  return { weekday: map[weekdayRaw] || 1, minutes: hour * 60 + minute };
}

function parseHm(raw?: string): number {
  const m = String(raw || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function scheduleIsActive(schedule: SignageSchedule | null | undefined, now = new Date()): boolean {
  const s = normalizeSchedule(schedule);
  if (s.type === "always") return true;
  const z = zurichParts(now);
  if (s.type === "weekdays") {
    return (s.weekdays || []).includes(z.weekday);
  }
  const start = parseHm(s.startTime);
  const end = parseHm(s.endTime);
  if (end > start) return z.minutes >= start && z.minutes < end;
  return z.minutes >= start || z.minutes < end;
}

function specInStock(spec: { saleStatus?: string } | undefined): boolean {
  return !spec || spec.saleStatus !== "out_of_stock";
}

async function requireAddon(merchantId: string) {
  await ensureSignageAddonColumn();
  const addon = await readSignageAddon(merchantId);
  if (!addon.enabled) throw new SignageLicenseError();
  return addon;
}

export class SignageService {
  static async overview(merchantId: string) {
    const addon = await readSignageAddon(merchantId).catch(() => ({ enabled: false, screenLimit: 2 }));
    const db = getDb();
    const screens = await db.query.signageScreens.findMany({
      where: eq(schema.signageScreens.merchantId, merchantId),
      columns: { id: true },
    });
    return {
      enabled: addon.enabled,
      screenLimit: addon.screenLimit,
      screenCount: screens.length,
    };
  }

  static async listScreens(merchantId: string) {
    await requireAddon(merchantId);
    const db = getDb();
    await ensureShortCodes(db, merchantId);
    return db.query.signageScreens.findMany({
      where: eq(schema.signageScreens.merchantId, merchantId),
      orderBy: [asc(schema.signageScreens.name)],
    });
  }

  static async createScreen(merchantId: string, input: SignageScreenInput) {
    const addon = await requireAddon(merchantId);
    const db = getDb();
    const existing = await db.query.signageScreens.findMany({
      where: eq(schema.signageScreens.merchantId, merchantId),
      columns: { id: true },
    });
    if (existing.length >= addon.screenLimit) {
      throw new Error(`Screen limit reached (${addon.screenLimit}). Ask your agency to raise it.`);
    }
    const name = String(input.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Screen name is required");
    let playlistId = input.playlistId || null;
    if (playlistId) {
      const pl = await db.query.signagePlaylists.findFirst({
        where: and(eq(schema.signagePlaylists.id, playlistId), eq(schema.signagePlaylists.merchantId, merchantId)),
      });
      if (!pl) throw new Error("Playlist not found");
    } else {
      const first = await db.query.signagePlaylists.findFirst({
        where: eq(schema.signagePlaylists.merchantId, merchantId),
        orderBy: [asc(schema.signagePlaylists.createdAt)],
      });
      if (first) {
        playlistId = first.id;
      } else {
        const [createdPl] = await db
          .insert(schema.signagePlaylists)
          .values({
            merchantId,
            name: "Main board",
            template: asTemplate(input.template),
            schedule: { type: "always" },
          })
          .returning();
        playlistId = createdPl.id;
      }
    }
    const [row] = await db
      .insert(schema.signageScreens)
      .values({
        merchantId,
        name,
        token: newToken(),
        shortCode: await newShortCode(db),
        orientation: asOrientation(input.orientation),
        template: asTemplate(input.template),
        screenSizeIn: clampScreenSize(input.screenSizeIn),
        playlistId,
      })
      .returning();
    return row;
  }

  static async updateScreen(merchantId: string, id: string, input: Partial<SignageScreenInput>) {
    await requireAddon(merchantId);
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name != null) {
      const name = String(input.name).trim().slice(0, 255);
      if (!name) throw new Error("Screen name is required");
      patch.name = name;
    }
    if (input.orientation != null) patch.orientation = asOrientation(input.orientation);
    if (input.template != null) patch.template = asTemplate(input.template);
    if (input.screenSizeIn != null) patch.screenSizeIn = clampScreenSize(input.screenSizeIn);
    if (input.playlistId !== undefined) {
      if (input.playlistId) {
        const pl = await db.query.signagePlaylists.findFirst({
          where: and(
            eq(schema.signagePlaylists.id, input.playlistId),
            eq(schema.signagePlaylists.merchantId, merchantId)
          ),
        });
        if (!pl) throw new Error("Playlist not found");
        patch.playlistId = input.playlistId;
      } else {
        patch.playlistId = null;
      }
    }
    const [row] = await db
      .update(schema.signageScreens)
      .set(patch)
      .where(and(eq(schema.signageScreens.id, id), eq(schema.signageScreens.merchantId, merchantId)))
      .returning();
    if (!row) throw new Error("Screen not found");
    return row;
  }

  static async deleteScreen(merchantId: string, id: string) {
    await requireAddon(merchantId);
    const db = getDb();
    await db
      .delete(schema.signageScreens)
      .where(and(eq(schema.signageScreens.id, id), eq(schema.signageScreens.merchantId, merchantId)));
    return { ok: true };
  }

  static async rotateToken(merchantId: string, id: string) {
    await requireAddon(merchantId);
    const db = getDb();
    const [row] = await db
      .update(schema.signageScreens)
      .set({
        token: newToken(),
        shortCode: await newShortCode(db),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.signageScreens.id, id), eq(schema.signageScreens.merchantId, merchantId)))
      .returning();
    if (!row) throw new Error("Screen not found");
    return row;
  }

  static async listPlaylists(merchantId: string) {
    await requireAddon(merchantId);
    const db = getDb();
    const playlists = await db.query.signagePlaylists.findMany({
      where: eq(schema.signagePlaylists.merchantId, merchantId),
      orderBy: [asc(schema.signagePlaylists.name)],
      with: { slides: true },
    });
    return playlists.map((p) => ({
      ...p,
      slides: (p.slides || []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }

  static async createPlaylist(merchantId: string, input: SignagePlaylistInput) {
    await requireAddon(merchantId);
    const name = String(input.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Playlist name is required");
    const db = getDb();
    const [row] = await db
      .insert(schema.signagePlaylists)
      .values({
        merchantId,
        name,
        template: asTemplate(input.template),
        schedule: normalizeSchedule(input.schedule),
      })
      .returning();
    return row;
  }

  static async updatePlaylist(merchantId: string, id: string, input: Partial<SignagePlaylistInput>) {
    await requireAddon(merchantId);
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name != null) {
      const name = String(input.name).trim().slice(0, 255);
      if (!name) throw new Error("Playlist name is required");
      patch.name = name;
    }
    if (input.template != null) patch.template = asTemplate(input.template);
    if (input.schedule != null) patch.schedule = normalizeSchedule(input.schedule);
    const [row] = await db
      .update(schema.signagePlaylists)
      .set(patch)
      .where(and(eq(schema.signagePlaylists.id, id), eq(schema.signagePlaylists.merchantId, merchantId)))
      .returning();
    if (!row) throw new Error("Playlist not found");
    return row;
  }

  static async deletePlaylist(merchantId: string, id: string) {
    await requireAddon(merchantId);
    const db = getDb();
    await db
      .delete(schema.signagePlaylists)
      .where(and(eq(schema.signagePlaylists.id, id), eq(schema.signagePlaylists.merchantId, merchantId)));
    return { ok: true };
  }

  static async createSlide(merchantId: string, playlistId: string, input: SignageSlideInput) {
    await requireAddon(merchantId);
    const db = getDb();
    const playlist = await db.query.signagePlaylists.findFirst({
      where: and(eq(schema.signagePlaylists.id, playlistId), eq(schema.signagePlaylists.merchantId, merchantId)),
    });
    if (!playlist) throw new Error("Playlist not found");
    const existing = await db.query.signageSlides.findMany({
      where: eq(schema.signageSlides.playlistId, playlistId),
      columns: { sortOrder: true },
    });
    const nextOrder =
      input.sortOrder != null
        ? Math.max(0, Math.round(Number(input.sortOrder) || 0))
        : existing.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
    const [row] = await db
      .insert(schema.signageSlides)
      .values({
        playlistId,
        type: asSlideType(input.type),
        durationSec: clampDuration(input.durationSec),
        sortOrder: nextOrder,
        categoryIds: Array.isArray(input.categoryIds) ? input.categoryIds.map(String) : [],
        headline: input.headline?.trim()?.slice(0, 255) || null,
        body: input.body?.trim()?.slice(0, 2000) || null,
        imageUrl: input.imageUrl?.trim()?.slice(0, 500) || null,
        showPrices: input.showPrices !== false,
        showPhotos: input.showPhotos !== false,
      })
      .returning();
    return row;
  }

  static async updateSlide(merchantId: string, id: string, input: Partial<SignageSlideInput>) {
    await requireAddon(merchantId);
    const db = getDb();
    const slide = await db.query.signageSlides.findFirst({
      where: eq(schema.signageSlides.id, id),
      with: { playlist: true },
    });
    if (!slide?.playlist || slide.playlist.merchantId !== merchantId) {
      throw new Error("Slide not found");
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.type != null) patch.type = asSlideType(input.type);
    if (input.durationSec != null) patch.durationSec = clampDuration(input.durationSec);
    if (input.sortOrder != null) patch.sortOrder = Math.max(0, Math.round(Number(input.sortOrder) || 0));
    if (input.categoryIds != null) patch.categoryIds = input.categoryIds.map(String);
    if (input.headline !== undefined) patch.headline = input.headline?.trim()?.slice(0, 255) || null;
    if (input.body !== undefined) patch.body = input.body?.trim()?.slice(0, 2000) || null;
    if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl?.trim()?.slice(0, 500) || null;
    if (input.showPrices != null) patch.showPrices = !!input.showPrices;
    if (input.showPhotos != null) patch.showPhotos = !!input.showPhotos;
    const [row] = await db
      .update(schema.signageSlides)
      .set(patch)
      .where(eq(schema.signageSlides.id, id))
      .returning();
    return row;
  }

  static async deleteSlide(merchantId: string, id: string) {
    await requireAddon(merchantId);
    const db = getDb();
    const slide = await db.query.signageSlides.findFirst({
      where: eq(schema.signageSlides.id, id),
      with: { playlist: true },
    });
    if (!slide?.playlist || slide.playlist.merchantId !== merchantId) {
      throw new Error("Slide not found");
    }
    await db.delete(schema.signageSlides).where(eq(schema.signageSlides.id, id));
    return { ok: true };
  }

  static async listCatalog(merchantId: string) {
    await requireAddon(merchantId);
    const db = getDb();
    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
      orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
      columns: { id: true, name: true },
    });
    return { categories };
  }

  static async playerForToken(token: string) {
    const trimmed = String(token || "").trim();
    if (!trimmed) throw new Error("Invalid screen link");
    await ensureSignageAddonColumn();
    const db = getDb();
    const screen = await db.query.signageScreens.findFirst({
      where: or(eq(schema.signageScreens.shortCode, trimmed), eq(schema.signageScreens.token, trimmed)),
    });
    if (!screen) throw new Error("Invalid screen link");

    const addon = await readSignageAddon(screen.merchantId).catch(() => ({ enabled: false, screenLimit: 2 }));
    if (!addon.enabled) throw new Error("Digital signage is not enabled");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, screen.merchantId),
      columns: {
        id: true,
        name: true,
        shopLogoUrl: true,
        status: true,
      },
    });
    if (!merchant || merchant.status === "suspended" || merchant.status === "expired") {
      throw new Error("Merchant unavailable");
    }

    const playlists = await db.query.signagePlaylists.findMany({
      where: eq(schema.signagePlaylists.merchantId, screen.merchantId),
      with: { slides: true },
    });

    let playlist = playlists.find((p) => p.id === screen.playlistId) || null;
    if (playlist && !scheduleIsActive(playlist.schedule as SignageSchedule)) {
      const fallback =
        playlists.find((p) => p.id !== playlist!.id && scheduleIsActive(p.schedule as SignageSchedule)) ||
        playlists.find((p) => (p.schedule as SignageSchedule)?.type === "always");
      if (fallback) playlist = fallback;
    }
    if (!playlist && playlists.length) {
      playlist = playlists.find((p) => scheduleIsActive(p.schedule as SignageSchedule)) || playlists[0];
    }

    const slides = (playlist?.slides || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const categoryIds = [
      ...new Set(slides.flatMap((s) => (Array.isArray(s.categoryIds) ? s.categoryIds : []))),
    ];

    const categories = categoryIds.length
      ? await db.query.categories.findMany({
          where: inArray(schema.categories.id, categoryIds),
          orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
        })
      : [];

    const products = categoryIds.length
      ? await db.query.products.findMany({
          where: and(
            eq(schema.products.merchantId, screen.merchantId),
            eq(schema.products.isActive, true),
            inArray(schema.products.categoryId, categoryIds)
          ),
          orderBy: [asc(schema.products.sortOrder), asc(schema.products.name)],
        })
      : [];

    const menuCategories = categories.map((cat) => {
      const items = products
        .filter((p) => p.categoryId === cat.id)
        .map((p) => {
          if (p.productType === "modifier" || p.isOpenPrice) return null;
          const specs = Array.isArray(p.specifications) ? p.specifications : [];
          const inStockSpecs = specs.filter((s) => specInStock(s));
          if (specs.length && !inStockSpecs.length) return null;
          const pick =
            inStockSpecs.find((s) => s.isDefault) ||
            inStockSpecs[0] ||
            specs.find((s) => s.isDefault) ||
            specs[0];
          const price = pick?.price != null ? Number(pick.price) : Number(p.price);
          return {
            id: p.id,
            name: p.name,
            description: p.description || "",
            price: Number.isFinite(price) ? price : 0,
            imageUrl: p.imageUrl || null,
          };
        })
        .filter(Boolean);
      return { id: cat.id, name: cat.name, imageUrl: cat.imageUrl || null, products: items };
    });

    const template = asTemplate(screen.template || playlist?.template);

    return {
      screen: {
        id: screen.id,
        name: screen.name,
        orientation: asOrientation(screen.orientation),
        template,
        screenSizeIn: screen.screenSizeIn ?? 32,
      },
      merchant: {
        name: merchant.name,
        logoUrl: merchant.shopLogoUrl || null,
      },
      playlist: playlist
        ? {
            id: playlist.id,
            name: playlist.name,
            schedule: normalizeSchedule(playlist.schedule),
          }
        : null,
      slides: slides.map((s) => ({
        id: s.id,
        type: asSlideType(s.type),
        durationSec: clampDuration(s.durationSec),
        categoryIds: Array.isArray(s.categoryIds) ? s.categoryIds : [],
        headline: s.headline,
        body: s.body,
        imageUrl: s.imageUrl,
        showPrices: s.showPrices !== false,
        showPhotos: s.showPhotos !== false,
      })),
      menu: { categories: menuCategories },
      currency: "CHF",
      serverTime: new Date().toISOString(),
    };
  }
}

export { SIGNAGE_TEMPLATES, SIGNAGE_ORIENTATIONS };
