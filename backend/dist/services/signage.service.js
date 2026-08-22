"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGNAGE_ORIENTATIONS = exports.SIGNAGE_TEMPLATES = exports.SignageService = exports.SIGNAGE_SCREEN_SIZES = exports.SignageLicenseError = void 0;
exports.scheduleIsActive = scheduleIsActive;
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const schema_1 = require("@/db/schema");
Object.defineProperty(exports, "SIGNAGE_ORIENTATIONS", { enumerable: true, get: function () { return schema_1.SIGNAGE_ORIENTATIONS; } });
Object.defineProperty(exports, "SIGNAGE_TEMPLATES", { enumerable: true, get: function () { return schema_1.SIGNAGE_TEMPLATES; } });
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const signage_addon_1 = require("@/lib/signage-addon");
class SignageLicenseError extends Error {
    constructor(message = "Digital signage addon is not enabled") {
        super(message);
        this.name = "SignageLicenseError";
    }
}
exports.SignageLicenseError = SignageLicenseError;
exports.SIGNAGE_SCREEN_SIZES = [10, 15, 23, 32, 43, 55, 65];
function newToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function clampScreenSize(raw) {
    const n = Math.round(Number(raw));
    return exports.SIGNAGE_SCREEN_SIZES.includes(n) ? n : 32;
}
async function newShortCode(db) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const digits = attempt < 40 ? 5 : 6;
        const min = digits === 4 ? 1000 : digits === 5 ? 10000 : 100000;
        const max = digits === 4 ? 9999 : digits === 5 ? 99999 : 999999;
        const code = String(Math.floor(min + Math.random() * (max - min + 1)));
        const taken = await db.query.signageScreens.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.shortCode, code),
            columns: { id: true },
        });
        if (!taken)
            return code;
    }
    throw new Error("Could not allocate a screen code — try again");
}
async function ensureShortCodes(db, merchantId) {
    const rows = await db.query.signageScreens.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signageScreens.merchantId, merchantId)),
        columns: { id: true, shortCode: true },
    });
    for (const row of rows) {
        if (row.shortCode)
            continue;
        const shortCode = await newShortCode(db);
        await db
            .update(db_1.schema.signageScreens)
            .set({ shortCode, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.signageScreens.id, row.id));
    }
}
function asTemplate(raw, fallback = "dark_pizza") {
    const v = String(raw || "").trim();
    return schema_1.SIGNAGE_TEMPLATES.includes(v) ? v : fallback;
}
function asOrientation(raw) {
    return String(raw || "") === "portrait" ? "portrait" : "landscape";
}
function asSlideType(raw) {
    const v = String(raw || "").trim();
    return schema_1.SIGNAGE_SLIDE_TYPES.includes(v) ? v : "menu";
}
function clampDuration(raw) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n))
        return 10;
    return Math.min(30, Math.max(5, n));
}
function normalizeWeekdays(raw) {
    if (!Array.isArray(raw))
        return [];
    return [...new Set(raw.map((d) => Math.round(Number(d))).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
}
function normalizeHm(raw, fallback) {
    return typeof raw === "string" && /^\d{1,2}:\d{2}$/.test(raw) ? raw : fallback;
}
function normalizeSchedule(raw) {
    if (!raw || typeof raw !== "object")
        return { type: "always" };
    const o = raw;
    const type = o.type === "weekdays" || o.type === "daypart" || o.type === "windows" ? o.type : "always";
    const weekdays = normalizeWeekdays(o.weekdays);
    const daypart = o.daypart === "dinner" ? "dinner" : "lunch";
    const startTime = normalizeHm(o.startTime, daypart === "dinner" ? "17:00" : "11:00");
    const endTime = normalizeHm(o.endTime, daypart === "dinner" ? "22:00" : "14:30");
    if (type === "windows") {
        const windows = Array.isArray(o.windows)
            ? o.windows
                .map((w) => {
                if (!w || typeof w !== "object")
                    return null;
                const win = w;
                const wDays = normalizeWeekdays(win.weekdays);
                if (!wDays.length)
                    return null;
                return {
                    label: typeof win.label === "string" ? win.label.slice(0, 40) : undefined,
                    weekdays: wDays,
                    startTime: normalizeHm(win.startTime, "11:00"),
                    endTime: normalizeHm(win.endTime, "14:30"),
                };
            })
                .filter((w) => Boolean(w))
            : [];
        if (windows.length)
            return { type: "windows", windows };
        return { type: "always" };
    }
    if (type === "weekdays")
        return { type, weekdays };
    if (type === "daypart")
        return { type, daypart, startTime, endTime };
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
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
    return { weekday: map[weekdayRaw] || 1, minutes: hour * 60 + minute };
}
function parseHm(raw) {
    const m = String(raw || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m)
        return 0;
    return Number(m[1]) * 60 + Number(m[2]);
}
function windowIsActive(weekdays, startTime, endTime, z) {
    if (!weekdays.includes(z.weekday))
        return false;
    const start = parseHm(startTime);
    const end = parseHm(endTime);
    if (end > start)
        return z.minutes >= start && z.minutes < end;
    return z.minutes >= start || z.minutes < end;
}
function scheduleIsActive(schedule, now = new Date()) {
    const s = normalizeSchedule(schedule);
    if (s.type === "always")
        return true;
    const z = zurichParts(now);
    if (s.type === "weekdays") {
        return (s.weekdays || []).includes(z.weekday);
    }
    if (s.type === "windows") {
        return (s.windows || []).some((w) => windowIsActive(w.weekdays, w.startTime, w.endTime, z));
    }
    const start = parseHm(s.startTime);
    const end = parseHm(s.endTime);
    if (end > start)
        return z.minutes >= start && z.minutes < end;
    return z.minutes >= start || z.minutes < end;
}
function specInStock(spec) {
    return !spec || spec.saleStatus !== "out_of_stock";
}
async function requireAddon(merchantId) {
    await (0, ensure_merchant_schema_1.ensureSignageAddonColumn)();
    const addon = await (0, signage_addon_1.readSignageAddon)(merchantId);
    if (!addon.enabled)
        throw new SignageLicenseError();
    return addon;
}
class SignageService {
    static async overview(merchantId) {
        const addon = await (0, signage_addon_1.readSignageAddon)(merchantId).catch(() => ({ enabled: false, screenLimit: 2 }));
        const db = (0, db_1.getDb)();
        const screens = await db.query.signageScreens.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.merchantId, merchantId),
            columns: { id: true },
        });
        return {
            enabled: addon.enabled,
            screenLimit: addon.screenLimit,
            screenCount: screens.length,
        };
    }
    static async listScreens(merchantId) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        await ensureShortCodes(db, merchantId);
        return db.query.signageScreens.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.signageScreens.name)],
        });
    }
    static async createScreen(merchantId, input) {
        const addon = await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const existing = await db.query.signageScreens.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.merchantId, merchantId),
            columns: { id: true },
        });
        if (existing.length >= addon.screenLimit) {
            throw new Error(`Screen limit reached (${addon.screenLimit}). Ask your agency to raise it.`);
        }
        const name = String(input.name || "").trim().slice(0, 255);
        if (!name)
            throw new Error("Screen name is required");
        let playlistId = input.playlistId || null;
        if (playlistId) {
            const pl = await db.query.signagePlaylists.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.id, playlistId), (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, merchantId)),
            });
            if (!pl)
                throw new Error("Playlist not found");
        }
        else {
            const first = await db.query.signagePlaylists.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.signagePlaylists.createdAt)],
            });
            if (first) {
                playlistId = first.id;
            }
            else {
                const [createdPl] = await db
                    .insert(db_1.schema.signagePlaylists)
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
            .insert(db_1.schema.signageScreens)
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
    static async updateScreen(merchantId, id, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.name != null) {
            const name = String(input.name).trim().slice(0, 255);
            if (!name)
                throw new Error("Screen name is required");
            patch.name = name;
        }
        if (input.orientation != null)
            patch.orientation = asOrientation(input.orientation);
        if (input.template != null)
            patch.template = asTemplate(input.template);
        if (input.screenSizeIn != null)
            patch.screenSizeIn = clampScreenSize(input.screenSizeIn);
        if (input.playlistId !== undefined) {
            if (input.playlistId) {
                const pl = await db.query.signagePlaylists.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.id, input.playlistId), (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, merchantId)),
                });
                if (!pl)
                    throw new Error("Playlist not found");
                patch.playlistId = input.playlistId;
            }
            else {
                patch.playlistId = null;
            }
        }
        const [row] = await db
            .update(db_1.schema.signageScreens)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signageScreens.id, id), (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("Screen not found");
        return row;
    }
    static async deleteScreen(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.signageScreens)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signageScreens.id, id), (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.merchantId, merchantId)));
        return { ok: true };
    }
    static async rotateToken(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.signageScreens)
            .set({
            token: newToken(),
            shortCode: await newShortCode(db),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signageScreens.id, id), (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("Screen not found");
        return row;
    }
    static async listPlaylists(merchantId) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const playlists = await db.query.signagePlaylists.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.signagePlaylists.name)],
            with: { slides: true },
        });
        return playlists.map((p) => ({
            ...p,
            slides: (p.slides || []).sort((a, b) => a.sortOrder - b.sortOrder),
        }));
    }
    static async createPlaylist(merchantId, input) {
        await requireAddon(merchantId);
        const name = String(input.name || "").trim().slice(0, 255);
        if (!name)
            throw new Error("Playlist name is required");
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.signagePlaylists)
            .values({
            merchantId,
            name,
            template: asTemplate(input.template),
            schedule: normalizeSchedule(input.schedule),
        })
            .returning();
        return row;
    }
    static async updatePlaylist(merchantId, id, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.name != null) {
            const name = String(input.name).trim().slice(0, 255);
            if (!name)
                throw new Error("Playlist name is required");
            patch.name = name;
        }
        if (input.template != null)
            patch.template = asTemplate(input.template);
        if (input.schedule != null)
            patch.schedule = normalizeSchedule(input.schedule);
        const [row] = await db
            .update(db_1.schema.signagePlaylists)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.id, id), (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("Playlist not found");
        return row;
    }
    static async deletePlaylist(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.signagePlaylists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.id, id), (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, merchantId)));
        return { ok: true };
    }
    static async createSlide(merchantId, playlistId, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const playlist = await db.query.signagePlaylists.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.id, playlistId), (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, merchantId)),
        });
        if (!playlist)
            throw new Error("Playlist not found");
        const existing = await db.query.signageSlides.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageSlides.playlistId, playlistId),
            columns: { sortOrder: true },
        });
        const nextOrder = input.sortOrder != null
            ? Math.max(0, Math.round(Number(input.sortOrder) || 0))
            : existing.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
        const [row] = await db
            .insert(db_1.schema.signageSlides)
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
    static async updateSlide(merchantId, id, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const slide = await db.query.signageSlides.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageSlides.id, id),
            with: { playlist: true },
        });
        if (!slide?.playlist || slide.playlist.merchantId !== merchantId) {
            throw new Error("Slide not found");
        }
        const patch = { updatedAt: new Date() };
        if (input.type != null)
            patch.type = asSlideType(input.type);
        if (input.durationSec != null)
            patch.durationSec = clampDuration(input.durationSec);
        if (input.sortOrder != null)
            patch.sortOrder = Math.max(0, Math.round(Number(input.sortOrder) || 0));
        if (input.categoryIds != null)
            patch.categoryIds = input.categoryIds.map(String);
        if (input.headline !== undefined)
            patch.headline = input.headline?.trim()?.slice(0, 255) || null;
        if (input.body !== undefined)
            patch.body = input.body?.trim()?.slice(0, 2000) || null;
        if (input.imageUrl !== undefined)
            patch.imageUrl = input.imageUrl?.trim()?.slice(0, 500) || null;
        if (input.showPrices != null)
            patch.showPrices = !!input.showPrices;
        if (input.showPhotos != null)
            patch.showPhotos = !!input.showPhotos;
        const [row] = await db
            .update(db_1.schema.signageSlides)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.signageSlides.id, id))
            .returning();
        return row;
    }
    static async deleteSlide(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const slide = await db.query.signageSlides.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageSlides.id, id),
            with: { playlist: true },
        });
        if (!slide?.playlist || slide.playlist.merchantId !== merchantId) {
            throw new Error("Slide not found");
        }
        await db.delete(db_1.schema.signageSlides).where((0, drizzle_orm_1.eq)(db_1.schema.signageSlides.id, id));
        return { ok: true };
    }
    static async listCatalog(merchantId) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const categories = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.categories.name)],
            columns: { id: true, name: true },
        });
        return { categories };
    }
    static async playerForToken(token) {
        const trimmed = String(token || "").trim();
        if (!trimmed)
            throw new Error("Invalid screen link");
        await (0, ensure_merchant_schema_1.ensureSignageAddonColumn)();
        const db = (0, db_1.getDb)();
        const screen = await db.query.signageScreens.findFirst({
            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.signageScreens.shortCode, trimmed), (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.token, trimmed)),
        });
        if (!screen)
            throw new Error("Invalid screen link");
        const addon = await (0, signage_addon_1.readSignageAddon)(screen.merchantId).catch(() => ({ enabled: false, screenLimit: 2 }));
        if (!addon.enabled)
            throw new Error("Digital signage is not enabled");
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, screen.merchantId),
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
            where: (0, drizzle_orm_1.eq)(db_1.schema.signagePlaylists.merchantId, screen.merchantId),
            with: { slides: true },
        });
        let playlist = playlists.find((p) => p.id === screen.playlistId) || null;
        if (playlist && !scheduleIsActive(playlist.schedule)) {
            const fallback = playlists.find((p) => p.id !== playlist.id && scheduleIsActive(p.schedule)) ||
                playlists.find((p) => p.schedule?.type === "always");
            if (fallback)
                playlist = fallback;
        }
        if (!playlist && playlists.length) {
            playlist = playlists.find((p) => scheduleIsActive(p.schedule)) || playlists[0];
        }
        const slides = (playlist?.slides || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        const categoryIds = [
            ...new Set(slides.flatMap((s) => (Array.isArray(s.categoryIds) ? s.categoryIds : []))),
        ];
        const categories = categoryIds.length
            ? await db.query.categories.findMany({
                where: (0, drizzle_orm_1.inArray)(db_1.schema.categories.id, categoryIds),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.categories.name)],
            })
            : [];
        const products = categoryIds.length
            ? await db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, screen.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.isActive, true), (0, drizzle_orm_1.inArray)(db_1.schema.products.categoryId, categoryIds)),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.products.name)],
            })
            : [];
        const menuCategories = categories.map((cat) => {
            const items = products
                .filter((p) => p.categoryId === cat.id)
                .map((p) => {
                if (p.productType === "modifier" || p.isOpenPrice)
                    return null;
                const specs = Array.isArray(p.specifications) ? p.specifications : [];
                const inStockSpecs = specs.filter((s) => specInStock(s));
                if (specs.length && !inStockSpecs.length)
                    return null;
                const pick = inStockSpecs.find((s) => s.isDefault) ||
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
exports.SignageService = SignageService;
//# sourceMappingURL=signage.service.js.map