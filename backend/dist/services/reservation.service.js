"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationService = exports.DEFAULT_RESERVATION_SETTINGS = void 0;
exports.normalizeReservationSettings = normalizeReservationSettings;
exports.resolveSettings = resolveSettings;
exports.resolveDineInHours = resolveDineInHours;
exports.zurichLocalToDate = zurichLocalToDate;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
const geo_1 = require("@/lib/geo");
const transactional_email_labels_1 = require("@/lib/transactional-email-labels");
const email_service_1 = require("@/services/email.service");
const floor_plan_service_1 = require("@/services/floor-plan.service");
const chaslay_floor_service_1 = require("@/services/chaslay-floor.service");
const date_format_1 = require("@/lib/date-format");
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
exports.DEFAULT_RESERVATION_SETTINGS = {
    dineInHoursMode: "same_as_takeaway",
    slotIntervalMinutes: 30,
    seatingDurationMinutes: 90,
    bufferMinutes: 15,
    minPartySize: 1,
    maxPartySize: 12,
    minHoursBefore: 2,
    maxDaysAhead: 30,
    autoAccept: false,
    sendConfirmationEmail: true,
    sendStatusEmails: true,
    reminderEnabled: true,
    reminderHoursBefore: 24,
    sendReminderEmail: true,
    notifyAdminEmail: true,
    dailySummaryEnabled: true,
    maxCoversPerSlot: null,
    policiesText: null,
    slotDiscounts: [],
    lastDailySummaryDate: null,
};
const ACTIVE_STATUSES = ["pending", "confirmed", "seated"];
function clampInt(n, min, max, fallback) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v))
        return fallback;
    return Math.min(max, Math.max(min, v));
}
function normalizeReservationSettings(raw) {
    const s = raw || {};
    return {
        dineInHoursMode: s.dineInHoursMode === "custom" ? "custom" : "same_as_takeaway",
        slotIntervalMinutes: [15, 30, 45, 60].includes(Number(s.slotIntervalMinutes))
            ? Number(s.slotIntervalMinutes)
            : exports.DEFAULT_RESERVATION_SETTINGS.slotIntervalMinutes,
        seatingDurationMinutes: clampInt(s.seatingDurationMinutes, 30, 360, 90),
        bufferMinutes: clampInt(s.bufferMinutes, 0, 120, 15),
        minPartySize: clampInt(s.minPartySize, 1, 50, 1),
        maxPartySize: clampInt(s.maxPartySize, 1, 100, 12),
        minHoursBefore: clampInt(s.minHoursBefore, 0, 72, 2),
        maxDaysAhead: clampInt(s.maxDaysAhead, 1, 180, 30),
        autoAccept: s.autoAccept !== false && s.autoAccept !== undefined ? !!s.autoAccept : !!s.autoAccept,
        sendConfirmationEmail: s.sendConfirmationEmail !== false,
        sendStatusEmails: s.sendStatusEmails !== false,
        maxCoversPerSlot: s.maxCoversPerSlot == null || Number(s.maxCoversPerSlot) <= 0
            ? null
            : clampInt(s.maxCoversPerSlot, 1, 500, 40),
        policiesText: s.policiesText?.trim() || null,
        reminderEnabled: s.reminderEnabled !== false,
        reminderHoursBefore: clampInt(s.reminderHoursBefore, 1, 168, 24),
        sendReminderEmail: s.sendReminderEmail !== false,
        notifyAdminEmail: s.notifyAdminEmail !== false,
        dailySummaryEnabled: s.dailySummaryEnabled !== false,
        lastDailySummaryDate: s.lastDailySummaryDate?.trim() || null,
        slotDiscounts: Array.isArray(s.slotDiscounts)
            ? s.slotDiscounts
                .filter((d) => d && Number(d.percentOff) > 0)
                .map((d) => ({
                id: String(d.id || (0, crypto_1.randomUUID)()),
                name: String(d.name || `${d.percentOff}% off`).slice(0, 80),
                percentOff: Math.min(90, Math.max(1, Math.floor(Number(d.percentOff) || 0))),
                scheduleMode: d.scheduleMode === "whole_week" ? "whole_week" : "specific_days",
                daysOfWeek: Array.isArray(d.daysOfWeek) ? d.daysOfWeek.map(String) : [],
                timeStart: d.timeStart || null,
                timeEnd: d.timeEnd || null,
                enabled: d.enabled !== false,
            }))
            : [],
    };
}
/** Fix autoAccept default: when undefined, false (manual confirmation). */
function resolveSettings(raw) {
    const n = normalizeReservationSettings(raw);
    if (raw?.autoAccept === undefined)
        n.autoAccept = false;
    return n;
}
function copyWeek(src) {
    const out = {};
    for (const d of DAY_KEYS) {
        const slots = src?.[d];
        if (slots?.length)
            out[d] = slots.map((s) => ({ open: s.open, close: s.close }));
    }
    return out;
}
function resolveDineInHours(storeHours, settings) {
    if (settings.dineInHoursMode === "same_as_takeaway") {
        return copyWeek(storeHours?.takeaway || storeHours?.dine_in);
    }
    const custom = storeHours?.dine_in;
    if (custom && Object.keys(custom).length)
        return copyWeek(custom);
    return copyWeek(storeHours?.takeaway);
}
function pad2(n) {
    return String(n).padStart(2, "0");
}
function zurichParts(at) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: geo_1.MERCHANT_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(at);
    const map = {};
    for (const p of parts) {
        if (p.type !== "literal")
            map[p.type] = p.value;
    }
    return {
        y: Number(map.year),
        m: Number(map.month),
        d: Number(map.day),
        hour: Number(map.hour === "24" ? "0" : map.hour),
        minute: Number(map.minute),
    };
}
/** Build a Date for a Zurich wall-clock YYYY-MM-DD + HH:mm */
function zurichLocalToDate(dateStr, hm) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const [hh, mm] = hm.split(":").map(Number);
    // Approximate via iterative offset (Zurich DST-safe enough for booking)
    const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
    for (let i = 0; i < 3; i++) {
        const p = zurichParts(guess);
        const want = Date.UTC(y, mo - 1, d, hh, mm);
        const got = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute);
        guess.setTime(guess.getTime() + (want - got));
    }
    return guess;
}
function formatZurichDate(at) {
    const p = zurichParts(at);
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}
function formatZurichHm(at) {
    const p = zurichParts(at);
    return `${pad2(p.hour)}:${pad2(p.minute)}`;
}
function addDaysYmd(ymd, days) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
function dayKeyForYmd(ymd) {
    const noon = zurichLocalToDate(ymd, "12:00");
    const short = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Zurich",
        weekday: "short",
    }).format(noon);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return DAY_KEYS[map[short] ?? 0];
}
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}
function matchSlotDiscount(settings, reservedAt) {
    const dayKey = dayKeyForYmd(formatZurichDate(reservedAt));
    const hm = formatZurichHm(reservedAt);
    let best = null;
    for (const d of settings.slotDiscounts || []) {
        if (d.enabled === false)
            continue;
        const wholeWeek = d.scheduleMode === "whole_week";
        const days = d.daysOfWeek || [];
        if (!wholeWeek && days.length && !days.includes(dayKey))
            continue;
        const s = d.timeStart ? (0, geo_1.parseHm)(d.timeStart) : null;
        const e = d.timeEnd ? (0, geo_1.parseHm)(d.timeEnd) : null;
        const cur = (0, geo_1.parseHm)(hm);
        if (cur == null)
            continue;
        if (s != null && e != null) {
            if (!(cur >= s && cur < e))
                continue;
        }
        else if (s != null && !(cur >= s))
            continue;
        else if (e != null && !(cur < e))
            continue;
        if (!best || d.percentOff > best.percentOff) {
            best = { percentOff: d.percentOff, name: d.name };
        }
    }
    if (!best)
        return null;
    return {
        percentOff: best.percentOff,
        name: best.name,
        label: `${best.percentOff}% off`,
    };
}
function makeCode() {
    return `RES-${Date.now().toString(36).toUpperCase().slice(-6)}-${(0, crypto_1.randomUUID)().slice(0, 4).toUpperCase()}`;
}
async function getMerchant(merchantId) {
    const db = (0, db_1.getDb)();
    const merchant = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
    });
    if (!merchant)
        throw new Error("Merchant not found");
    return merchant;
}
class ReservationService {
    static getSettingsForMerchant(merchant) {
        const settings = resolveSettings(merchant.reservationSettings);
        const hours = resolveDineInHours(merchant.storeHours, settings);
        return {
            enabled: !!merchant.reservationsEnabled,
            dineInEnabled: merchant.dineInEnabled !== false,
            settings,
            hours,
            shopName: merchant.name || "Restaurant",
            address: [merchant.address, merchant.city].filter(Boolean).join(", "),
            phone: merchant.phone || null,
            email: merchant.email || null,
        };
    }
    static async getConfig(merchantId) {
        const merchant = await getMerchant(merchantId);
        return this.getSettingsForMerchant(merchant);
    }
    static async updateSettings(merchantId, input) {
        const db = (0, db_1.getDb)();
        const merchant = await getMerchant(merchantId);
        const current = resolveSettings(merchant.reservationSettings);
        const nextSettings = resolveSettings({
            ...current,
            ...(input.settings || {}),
            // Keep internal daily-summary cursor unless explicitly provided
            lastDailySummaryDate: input.settings && Object.prototype.hasOwnProperty.call(input.settings, "lastDailySummaryDate")
                ? input.settings.lastDailySummaryDate ?? null
                : current.lastDailySummaryDate,
        });
        const storeHours = {
            ...(merchant.storeHours || {}),
        };
        if (input.dineInHours && nextSettings.dineInHoursMode === "custom") {
            storeHours.dine_in = copyWeek(input.dineInHours);
        }
        else if (nextSettings.dineInHoursMode === "same_as_takeaway") {
            // Keep dine_in in sync with takeaway for POS/display consistency
            storeHours.dine_in = copyWeek(storeHours.takeaway);
        }
        const [updated] = await db
            .update(db_1.schema.merchants)
            .set({
            reservationsEnabled: input.enabled !== undefined ? !!input.enabled : merchant.reservationsEnabled,
            reservationSettings: nextSettings,
            storeHours,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
            .returning();
        return this.getSettingsForMerchant(updated);
    }
    static async totalTableCapacity(merchantId) {
        const tables = await floor_plan_service_1.FloorPlanService.listTablesForSync(merchantId);
        return tables.reduce((s, t) => s + Math.max(0, Number(t.capacity) || 0), 0);
    }
    static async listOverlapping(merchantId, start, end, excludeId) {
        const db = (0, db_1.getDb)();
        const rows = await db.query.reservations.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.reservations.status, ACTIVE_STATUSES), 
            // reservedAt within a wide window; filter in JS for duration overlap
            (0, drizzle_orm_1.gte)(db_1.schema.reservations.reservedAt, new Date(start.getTime() - 8 * 3600000)), (0, drizzle_orm_1.lte)(db_1.schema.reservations.reservedAt, new Date(end.getTime() + 8 * 3600000))),
        });
        return rows.filter((r) => {
            if (excludeId && r.id === excludeId)
                return false;
            const rStart = new Date(r.reservedAt).getTime();
            const rEnd = rStart + (Number(r.durationMinutes) || 90) * 60000;
            return rangesOverlap(start.getTime(), end.getTime(), rStart, rEnd);
        });
    }
    static async getSlots(merchantId, dateYmd, partySize) {
        const cfg = await this.getConfig(merchantId);
        if (!cfg.enabled)
            throw new Error("Reservations are not enabled");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd))
            throw new Error("Invalid date");
        const settings = cfg.settings;
        const size = clampInt(partySize, settings.minPartySize, settings.maxPartySize, 2);
        if (size < settings.minPartySize || size > settings.maxPartySize) {
            throw new Error(`Party size must be between ${settings.minPartySize} and ${settings.maxPartySize}`);
        }
        const day = dayKeyForYmd(dateYmd);
        const daySlots = cfg.hours[day] || [];
        if (!daySlots.length) {
            return { date: dateYmd, partySize: size, slots: [] };
        }
        const tableCap = await this.totalTableCapacity(merchantId);
        const maxCovers = settings.maxCoversPerSlot != null && settings.maxCoversPerSlot > 0
            ? settings.maxCoversPerSlot
            : tableCap > 0
                ? tableCap
                : 40;
        const interval = settings.slotIntervalMinutes;
        const duration = settings.seatingDurationMinutes;
        const buffer = settings.bufferMinutes;
        const now = new Date();
        const minStart = new Date(now.getTime() + settings.minHoursBefore * 3600000);
        const maxDate = addDaysYmd(formatZurichDate(now), settings.maxDaysAhead);
        if (dateYmd > maxDate) {
            return { date: dateYmd, partySize: size, slots: [] };
        }
        // Load day's active reservations once
        const dayStart = zurichLocalToDate(dateYmd, "00:00");
        const dayEnd = zurichLocalToDate(addDaysYmd(dateYmd, 1), "00:00");
        const overlapping = await this.listOverlapping(merchantId, dayStart, dayEnd);
        const slots = [];
        const dayKey = day;
        const matchDiscount = (hm) => {
            const at = zurichLocalToDate(dateYmd, hm);
            return matchSlotDiscount(settings, at);
        };
        for (const range of daySlots) {
            let cursor = (0, geo_1.parseHm)(range.open);
            const close = (0, geo_1.parseHm)(range.close);
            const endBound = close >= cursor ? close : close + 24 * 60;
            while (cursor + 1 < endBound) {
                const minsOfDay = cursor % (24 * 60);
                const hm = `${pad2(Math.floor(minsOfDay / 60))}:${pad2(minsOfDay % 60)}`;
                // Slot must finish seating before close (best-effort)
                const slotStart = zurichLocalToDate(dateYmd, hm);
                // If overnight and mins rolled past midnight, date may need +1 — keep simple: only generate within open<=close same day for now
                if (close < (0, geo_1.parseHm)(range.open)) {
                    // overnight: still generate until midnight then skip (rare for restaurants)
                }
                if (slotStart.getTime() <= now.getTime() || slotStart < minStart) {
                    cursor += interval;
                    continue;
                }
                const slotEnd = new Date(slotStart.getTime() + (duration + buffer) * 60000);
                const used = overlapping
                    .filter((r) => {
                    const rStart = new Date(r.reservedAt).getTime();
                    const rEnd = rStart + ((Number(r.durationMinutes) || duration) + buffer) * 60000;
                    return rangesOverlap(slotStart.getTime(), slotEnd.getTime(), rStart, rEnd);
                })
                    .reduce((s, r) => s + (Number(r.partySize) || 0), 0);
                const remaining = Math.max(0, maxCovers - used);
                const disc = matchDiscount(hm);
                slots.push({
                    time: hm,
                    available: remaining >= size,
                    remainingCovers: remaining,
                    discountPercent: disc?.percentOff || undefined,
                    discountLabel: disc?.label || null,
                });
                cursor += interval;
            }
        }
        return { date: dateYmd, partySize: size, slots, settings: {
                slotIntervalMinutes: interval,
                seatingDurationMinutes: duration,
                bufferMinutes: buffer,
                minHoursBefore: settings.minHoursBefore,
                maxDaysAhead: settings.maxDaysAhead,
            } };
    }
    static async create(merchantId, input) {
        const db = (0, db_1.getDb)();
        const merchant = await getMerchant(merchantId);
        const cfg = this.getSettingsForMerchant(merchant);
        if (!cfg.enabled) {
            throw new Error("Reservations are not enabled");
        }
        const settings = cfg.settings;
        const name = (input.guestName || "").trim().slice(0, 200);
        const phone = (input.guestPhone || "").trim().slice(0, 50);
        const email = input.guestEmail?.trim().toLowerCase().slice(0, 255) || null;
        if (!name)
            throw new Error("Guest name is required");
        if (!phone)
            throw new Error("Phone is required");
        const partySize = clampInt(input.partySize, settings.minPartySize, settings.maxPartySize, 2);
        if (partySize < settings.minPartySize || partySize > settings.maxPartySize) {
            throw new Error(`Party size must be between ${settings.minPartySize} and ${settings.maxPartySize}`);
        }
        const reservedAt = input.reservedAt instanceof Date ? input.reservedAt : new Date(input.reservedAt);
        if (Number.isNaN(reservedAt.getTime()))
            throw new Error("Invalid reservation time");
        if (input.source === "web" || !input.skipSlotCheck) {
            const dateYmd = formatZurichDate(reservedAt);
            const hm = formatZurichHm(reservedAt);
            const slotRes = await this.getSlots(merchantId, dateYmd, partySize);
            const match = slotRes.slots.find((s) => s.time === hm && s.available);
            if (!match)
                throw new Error("Selected time is not available");
            const minStart = new Date(Date.now() + settings.minHoursBefore * 3600000);
            if (reservedAt < minStart) {
                throw new Error(`Please book at least ${settings.minHoursBefore} hour(s) in advance`);
            }
        }
        let status = input.status ||
            (settings.autoAccept || input.source === "dashboard" || input.source === "pos" || input.source === "phone"
                ? "confirmed"
                : "pending");
        if (input.source === "web") {
            status = settings.autoAccept ? "confirmed" : "pending";
        }
        let tableId = input.tableId || null;
        let tableLabel = null;
        if (tableId) {
            const tables = await floor_plan_service_1.FloorPlanService.listTablesForSync(merchantId);
            const table = tables.find((t) => t.id === tableId);
            if (!table)
                throw new Error("Table not found");
            if (Number(table.capacity) < partySize)
                throw new Error("Table is too small for this party");
            tableLabel = table.label;
        }
        const durationMinutes = settings.seatingDurationMinutes;
        const slotDeal = matchSlotDiscount(settings, reservedAt);
        const [row] = await db
            .insert(db_1.schema.reservations)
            .values({
            merchantId,
            code: makeCode(),
            customerId: input.customerId || null,
            guestName: name,
            guestEmail: email,
            guestPhone: phone,
            partySize,
            reservedAt,
            durationMinutes,
            status,
            tableId,
            tableLabel,
            discountPercent: slotDeal?.percentOff ?? null,
            discountLabel: slotDeal?.label ?? null,
            notes: input.notes?.trim() || null,
            source: input.source || "web",
            acceptedAt: status === "confirmed" ? new Date() : null,
        })
            .returning();
        if (tableId && (status === "confirmed" || status === "pending")) {
            try {
                await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, tableId, "reserved");
            }
            catch {
                /* non-fatal */
            }
        }
        if (settings.sendConfirmationEmail && email) {
            await this.sendLifecycleEmail(merchant, row, status === "confirmed" ? "confirmed" : "received");
        }
        else {
            await this.sendAdminNotifyEmail(merchant, row, status === "confirmed" ? "confirmed" : "received");
        }
        if (status === "pending" || status === "confirmed") {
            await ReservationService.enqueuePosAlert(merchantId, row.id);
        }
        return row;
    }
    /** WebPOS auto-print + alert via floor print job queue. */
    static async enqueuePosAlert(merchantId, reservationId) {
        try {
            await chaslay_floor_service_1.ChaslayFloorService.createPrintJob(merchantId, {
                jobType: "ESCPOS",
                payload: {
                    kind: "auto_print_reservation",
                    reservationId,
                },
                sourceDeviceId: "reservation",
            });
        }
        catch (err) {
            console.warn("Reservation POS alert enqueue failed:", err);
        }
    }
    static async list(merchantId, opts = {}) {
        const db = (0, db_1.getDb)();
        const conditions = [(0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId)];
        if (opts.from)
            conditions.push((0, drizzle_orm_1.gte)(db_1.schema.reservations.reservedAt, opts.from));
        if (opts.to)
            conditions.push((0, drizzle_orm_1.lte)(db_1.schema.reservations.reservedAt, opts.to));
        if (opts.status && opts.status !== "all") {
            conditions.push((0, drizzle_orm_1.eq)(db_1.schema.reservations.status, opts.status));
        }
        return db.query.reservations.findMany({
            where: (0, drizzle_orm_1.and)(...conditions),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.reservations.reservedAt)],
            limit: Math.min(500, opts.limit || 200),
        });
    }
    static async listForSync(merchantId) {
        const now = new Date();
        const from = new Date(now.getTime() - 6 * 3600000);
        const to = new Date(now.getTime() + 48 * 3600000);
        return this.list(merchantId, {
            from,
            to,
            limit: 100,
        }).then((rows) => rows.filter((r) => ACTIVE_STATUSES.includes(r.status) || r.status === "pending"));
    }
    static async get(merchantId, id) {
        const db = (0, db_1.getDb)();
        const row = await db.query.reservations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId)),
        });
        if (!row)
            throw new Error("Reservation not found");
        return row;
    }
    static async action(merchantId, id, action, payload = {}) {
        const db = (0, db_1.getDb)();
        const merchant = await getMerchant(merchantId);
        const current = await this.get(merchantId, id);
        const patch = { updatedAt: new Date() };
        let emailKind = null;
        if (payload.internalNotes !== undefined) {
            patch.internalNotes = payload.internalNotes;
        }
        if (payload.cancelReason?.trim()) {
            patch.internalNotes = payload.cancelReason.trim().slice(0, 500);
        }
        switch (action) {
            case "accept":
                if (!["pending", "rejected"].includes(current.status)) {
                    throw new Error("Only pending reservations can be accepted");
                }
                patch.status = "confirmed";
                patch.acceptedAt = new Date();
                emailKind = "confirmed";
                break;
            case "reject":
                if (!["pending", "confirmed"].includes(current.status)) {
                    throw new Error("Only pending or confirmed reservations can be rejected");
                }
                patch.status = "rejected";
                patch.cancelledAt = new Date();
                emailKind = "rejected";
                if (current.tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
                    }
                    catch {
                        /* ignore */
                    }
                    patch.tableId = null;
                    patch.tableLabel = null;
                }
                break;
            case "seat":
                if (!["confirmed", "pending"].includes(current.status)) {
                    throw new Error("Cannot seat this reservation");
                }
                patch.status = "seated";
                patch.seatedAt = new Date();
                if (current.tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "occupied");
                    }
                    catch {
                        /* ignore */
                    }
                }
                break;
            case "complete":
                patch.status = "completed";
                if (current.tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "dirty");
                    }
                    catch {
                        /* ignore */
                    }
                }
                break;
            case "cancel":
                patch.status = "cancelled";
                patch.cancelledAt = new Date();
                emailKind = payload.sendRejectionEmail ? "rejected" : "cancelled";
                if (current.tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
                    }
                    catch {
                        /* ignore */
                    }
                    patch.tableId = null;
                    patch.tableLabel = null;
                }
                break;
            case "no_show":
                patch.status = "no_show";
                if (current.tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
                    }
                    catch {
                        /* ignore */
                    }
                }
                break;
            case "assign_table": {
                const tableId = payload.tableId;
                if (!tableId)
                    throw new Error("tableId required");
                const tables = await floor_plan_service_1.FloorPlanService.listTablesForSync(merchantId);
                const table = tables.find((t) => t.id === tableId);
                if (!table)
                    throw new Error("Table not found");
                if (Number(table.capacity) < current.partySize) {
                    throw new Error("Table is too small for this party");
                }
                if (current.tableId && current.tableId !== tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
                    }
                    catch {
                        /* ignore */
                    }
                }
                patch.tableId = tableId;
                patch.tableLabel = table.label;
                if (["confirmed", "pending"].includes(current.status)) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, tableId, "reserved");
                    }
                    catch {
                        /* ignore */
                    }
                }
                break;
            }
            case "unassign_table":
                if (current.tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
                    }
                    catch {
                        /* ignore */
                    }
                }
                patch.tableId = null;
                patch.tableLabel = null;
                break;
            default:
                throw new Error("Unknown action");
        }
        const [updated] = await db
            .update(db_1.schema.reservations)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId)))
            .returning();
        const settings = resolveSettings(merchant.reservationSettings);
        if (action === "assign_table" && updated.discountPercent) {
            await this.sendAdminNotifyEmail(merchant, updated, updated.status === "confirmed" ? "confirmed" : "received");
        }
        else if (emailKind && settings.sendStatusEmails && updated.guestEmail) {
            await this.sendLifecycleEmail(merchant, updated, emailKind);
        }
        else if (emailKind) {
            await this.sendAdminNotifyEmail(merchant, updated, emailKind);
        }
        if (action === "accept" && updated.status === "confirmed") {
            await ReservationService.enqueuePosAlert(merchantId, updated.id);
        }
        return updated;
    }
    static async update(merchantId, id, input) {
        const db = (0, db_1.getDb)();
        const merchant = await getMerchant(merchantId);
        const current = await this.get(merchantId, id);
        if (["cancelled", "rejected", "completed", "no_show"].includes(current.status)) {
            throw new Error("Cannot edit a closed reservation");
        }
        const settings = resolveSettings(merchant.reservationSettings);
        const patch = { updatedAt: new Date() };
        if (input.guestName !== undefined) {
            const name = input.guestName.trim().slice(0, 200);
            if (!name)
                throw new Error("Guest name is required");
            patch.guestName = name;
        }
        if (input.guestPhone !== undefined) {
            const phone = input.guestPhone.trim().slice(0, 50);
            if (!phone)
                throw new Error("Phone is required");
            patch.guestPhone = phone;
        }
        if (input.guestEmail !== undefined) {
            patch.guestEmail = input.guestEmail?.trim().toLowerCase().slice(0, 255) || null;
        }
        if (input.notes !== undefined) {
            patch.notes = input.notes?.trim() || null;
        }
        if (input.internalNotes !== undefined) {
            patch.internalNotes = input.internalNotes?.trim() || null;
        }
        let reservedAt = current.reservedAt;
        if (input.date && input.time) {
            reservedAt = zurichLocalToDate(String(input.date), String(input.time));
            patch.reservedAt = reservedAt;
        }
        else if (input.reservedAt) {
            reservedAt = input.reservedAt instanceof Date ? input.reservedAt : new Date(input.reservedAt);
            if (Number.isNaN(reservedAt.getTime()))
                throw new Error("Invalid reservation time");
            patch.reservedAt = reservedAt;
        }
        let partySize = Number(current.partySize) || 2;
        if (input.partySize !== undefined) {
            partySize = clampInt(input.partySize, settings.minPartySize, settings.maxPartySize, partySize);
            patch.partySize = partySize;
        }
        if (patch.reservedAt || input.partySize !== undefined) {
            const dateYmd = formatZurichDate(new Date(reservedAt));
            const hm = formatZurichHm(new Date(reservedAt));
            const slotRes = await this.getSlots(merchantId, dateYmd, partySize);
            const match = slotRes.slots.find((s) => s.time === hm && s.available);
            const sameSlot = formatZurichDate(new Date(current.reservedAt)) === dateYmd &&
                formatZurichHm(new Date(current.reservedAt)) === hm &&
                Number(current.partySize) === partySize;
            if (!match && !sameSlot) {
                throw new Error("Selected time is not available");
            }
            const slotDeal = matchSlotDiscount(settings, new Date(reservedAt));
            patch.discountPercent = slotDeal?.percentOff ?? null;
            patch.discountLabel = slotDeal?.label ?? null;
        }
        if (input.tableId !== undefined) {
            const tableId = input.tableId || null;
            if (!tableId) {
                if (current.tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
                    }
                    catch {
                        /* ignore */
                    }
                }
                patch.tableId = null;
                patch.tableLabel = null;
            }
            else {
                const tables = await floor_plan_service_1.FloorPlanService.listTablesForSync(merchantId);
                const table = tables.find((t) => t.id === tableId);
                if (!table)
                    throw new Error("Table not found");
                if (Number(table.capacity) < partySize) {
                    throw new Error("Table is too small for this party");
                }
                if (current.tableId && current.tableId !== tableId) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, current.tableId, "available");
                    }
                    catch {
                        /* ignore */
                    }
                }
                patch.tableId = tableId;
                patch.tableLabel = table.label;
                if (["confirmed", "pending"].includes(current.status)) {
                    try {
                        await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, tableId, "reserved");
                    }
                    catch {
                        /* ignore */
                    }
                }
            }
        }
        const [updated] = await db
            .update(db_1.schema.reservations)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId)))
            .returning();
        return updated;
    }
    static async sendLifecycleEmail(merchant, reservation, kind) {
        if (!reservation.guestEmail) {
            await this.sendAdminNotifyEmail(merchant, reservation, kind);
            return;
        }
        if (!(await email_service_1.EmailService.isConfigured(merchant.id)))
            return;
        const when = (0, date_format_1.formatDateTimeDDMMYYYY)(reservation.reservedAt);
        const shop = merchant.name || "Restaurant";
        const place = [merchant.address, merchant.city].filter(Boolean).join(", ");
        const locale = (0, transactional_email_labels_1.resolveTxLocale)({
            guestLocale: reservation.guestLocale,
            shopLanguage: merchant.shopLanguage,
            panelLanguage: merchant.panelLanguage,
        });
        const copy = (0, transactional_email_labels_1.reservationEmailCopy)(kind, shop, locale);
        const labels = copy.labels;
        const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:20px">${copy.subject}</h1>
        <p>${copy.body}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">${labels.code}</td><td style="padding:6px 0;text-align:right"><strong>${reservation.code}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c">${labels.when}</td><td style="padding:6px 0;text-align:right">${when}</td></tr>
          <tr><td style="padding:6px 0;color:#78716c">${labels.guests}</td><td style="padding:6px 0;text-align:right">${reservation.partySize}</td></tr>
          <tr><td style="padding:6px 0;color:#78716c">${labels.name}</td><td style="padding:6px 0;text-align:right">${reservation.guestName}</td></tr>
          ${reservation.discountPercent ? `<tr><td style="padding:6px 0;color:#b45309">${labels.offer}</td><td style="padding:6px 0;text-align:right"><strong style="color:#b45309">${reservation.discountLabel || `${reservation.discountPercent}% off`}</strong></td></tr>` : ""}
          ${reservation.tableLabel ? `<tr><td style="padding:6px 0;color:#78716c">${labels.table}</td><td style="padding:6px 0;text-align:right">${reservation.tableLabel}${reservation.discountPercent ? ` · <strong style="color:#b45309">${reservation.discountLabel || `${reservation.discountPercent}% off`}</strong>` : ""}</td></tr>` : ""}
          ${place ? `<tr><td style="padding:6px 0;color:#78716c">${labels.where}</td><td style="padding:6px 0;text-align:right">${place}</td></tr>` : ""}
        </table>
        ${reservation.discountPercent ? `<p style="background:#fffbeb;border:1px solid #fcd34d;padding:10px 12px;font-size:14px;color:#92400e"><strong>${reservation.discountLabel || `${reservation.discountPercent}% off`}</strong> applies to this reservation.</p>` : ""}
        ${merchant.phone ? `<p style="font-size:13px;color:#78716c">${labels.questions} ${merchant.phone}</p>` : ""}
      </div>
    `;
        try {
            await email_service_1.EmailService.send({
                to: reservation.guestEmail,
                subject: copy.subject,
                html,
                text: `${copy.subject}\n${copy.body}\n${labels.code}: ${reservation.code}\n${labels.when}: ${when}\n${labels.guests}: ${reservation.partySize}`,
                merchantId: merchant.id,
                emailType: kind === "reminder" ? "reservation_status" : "reservation_confirmation",
            });
            const db = (0, db_1.getDb)();
            if (kind === "reminder") {
                await db
                    .update(db_1.schema.reservations)
                    .set({ reminderSentAt: new Date(), updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.reservations.id, reservation.id));
            }
            else {
                await db
                    .update(db_1.schema.reservations)
                    .set({ confirmationSentAt: new Date(), updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.reservations.id, reservation.id));
            }
        }
        catch (err) {
            console.error("[reservations] guest email failed", err);
        }
        if (kind !== "reminder") {
            await this.sendAdminNotifyEmail(merchant, reservation, kind);
        }
    }
    /** Notify the restaurant (merchant account email) about a booking event. */
    static async sendAdminNotifyEmail(merchant, reservation, kind) {
        const settings = resolveSettings(merchant.reservationSettings);
        if (settings.notifyAdminEmail === false)
            return;
        const to = String(merchant.email || "").trim();
        if (!to)
            return;
        if (!(await email_service_1.EmailService.isConfigured(merchant.id)))
            return;
        const when = (0, date_format_1.formatDateTimeDDMMYYYY)(reservation.reservedAt);
        const shop = merchant.name || "Restaurant";
        const subjects = {
            received: reservation.discountPercent
                ? `New reservation ${reservation.discountLabel || `${reservation.discountPercent}% off`} — ${reservation.code}`
                : `New reservation request — ${reservation.code}`,
            confirmed: reservation.discountPercent
                ? `Confirmed ${reservation.discountLabel || `${reservation.discountPercent}% off`} — ${reservation.code}`
                : `Reservation confirmed — ${reservation.code}`,
            rejected: `Reservation rejected — ${reservation.code}`,
            cancelled: `Reservation cancelled — ${reservation.code}`,
            seated: `Guest seated — ${reservation.code}`,
            reminder: `Reservation reminder — ${reservation.code}`,
        };
        const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:20px">${subjects[kind]}</h1>
        <p style="font-size:14px;color:#57534e">${shop} — reservation update</p>
        ${reservation.discountPercent
            ? `<p style="background:#fffbeb;border:1px solid #f59e0b;padding:12px 14px;font-size:15px;color:#92400e;font-weight:700">
                ★ ${reservation.discountLabel || `${reservation.discountPercent}% off`}
                ${reservation.tableLabel ? ` · Table ${reservation.tableLabel}` : ""}
              </p>`
            : ""}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">Status</td><td style="padding:6px 0;text-align:right"><strong>${kind}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Code</td><td style="padding:6px 0;text-align:right"><strong>${reservation.code}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c">When</td><td style="padding:6px 0;text-align:right">${when}</td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Guests</td><td style="padding:6px 0;text-align:right">${reservation.partySize}</td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Name</td><td style="padding:6px 0;text-align:right">${reservation.guestName}</td></tr>
          ${reservation.guestPhone ? `<tr><td style="padding:6px 0;color:#78716c">Phone</td><td style="padding:6px 0;text-align:right">${reservation.guestPhone}</td></tr>` : ""}
          ${reservation.guestEmail ? `<tr><td style="padding:6px 0;color:#78716c">Email</td><td style="padding:6px 0;text-align:right">${reservation.guestEmail}</td></tr>` : ""}
          ${reservation.tableLabel ? `<tr><td style="padding:6px 0;color:#78716c">Table</td><td style="padding:6px 0;text-align:right"><strong>${reservation.tableLabel}</strong>${reservation.discountPercent ? ` · <span style="color:#b45309;font-weight:700">${reservation.discountLabel || `${reservation.discountPercent}% off`}</span>` : ""}</td></tr>` : ""}
          ${reservation.discountPercent && !reservation.tableLabel ? `<tr><td style="padding:6px 0;color:#b45309">Offer</td><td style="padding:6px 0;text-align:right"><strong style="color:#b45309">${reservation.discountLabel || `${reservation.discountPercent}% off`}</strong></td></tr>` : ""}
          ${reservation.notes ? `<tr><td style="padding:6px 0;color:#78716c">Notes</td><td style="padding:6px 0;text-align:right">${reservation.notes}</td></tr>` : ""}
        </table>
      </div>
    `;
        try {
            await email_service_1.EmailService.send({
                to,
                subject: subjects[kind],
                html,
                text: `${subjects[kind]}\n${reservation.guestName} · ${reservation.partySize} guests · ${when}`,
                merchantId: merchant.id,
                emailType: "reservation_admin",
            });
        }
        catch (err) {
            console.error("[reservations] admin email failed", err);
        }
    }
    /** Hourly: email guests before their reservation (pending/confirmed). */
    static async processReminders() {
        const db = (0, db_1.getDb)();
        const merchants = await db.query.merchants.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.reservationsEnabled, true),
            columns: {
                id: true,
                name: true,
                email: true,
                address: true,
                city: true,
                phone: true,
                reservationSettings: true,
                emailSmtpSettings: true,
            },
        });
        let sent = 0;
        const now = Date.now();
        for (const merchant of merchants) {
            const settings = resolveSettings(merchant.reservationSettings);
            if (!settings.reminderEnabled || !settings.sendReminderEmail)
                continue;
            const hours = settings.reminderHoursBefore;
            const windowStart = new Date(now + (hours - 0.75) * 3600000);
            const windowEnd = new Date(now + (hours + 0.75) * 3600000);
            const rows = await db.query.reservations.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchant.id), (0, drizzle_orm_1.inArray)(db_1.schema.reservations.status, ["pending", "confirmed"]), (0, drizzle_orm_1.gte)(db_1.schema.reservations.reservedAt, windowStart), (0, drizzle_orm_1.lte)(db_1.schema.reservations.reservedAt, windowEnd)),
            });
            for (const r of rows) {
                if (r.reminderSentAt)
                    continue;
                if (!r.guestEmail)
                    continue;
                await this.sendLifecycleEmail(merchant, r, "reminder");
                sent += 1;
            }
        }
        return { sent };
    }
    /**
     * After 10:00 Europe/Zurich each day, email the merchant a lunch/dinner
     * summary of today's reservations (once per calendar day).
     */
    static async processDailySummaries() {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const parts = zurichParts(now);
        if (parts.hour < 10)
            return { sent: 0 };
        const today = `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`;
        const dayStart = zurichLocalToDate(today, "00:00");
        const tomorrow = addDaysYmd(today, 1);
        const dayEnd = zurichLocalToDate(tomorrow, "00:00");
        const merchants = await db.query.merchants.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.reservationsEnabled, true),
            columns: {
                id: true,
                name: true,
                email: true,
                reservationSettings: true,
                emailSmtpSettings: true,
            },
        });
        let sent = 0;
        for (const merchant of merchants) {
            const settings = resolveSettings(merchant.reservationSettings);
            if (settings.dailySummaryEnabled === false)
                continue;
            if (settings.lastDailySummaryDate === today)
                continue;
            const to = String(merchant.email || "").trim();
            if (!to)
                continue;
            if (!(await email_service_1.EmailService.isConfigured(merchant.id)))
                continue;
            const rows = await db.query.reservations.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchant.id), (0, drizzle_orm_1.inArray)(db_1.schema.reservations.status, ["pending", "confirmed", "seated"]), (0, drizzle_orm_1.gte)(db_1.schema.reservations.reservedAt, dayStart), (0, drizzle_orm_1.lte)(db_1.schema.reservations.reservedAt, new Date(dayEnd.getTime() - 1))),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.reservations.reservedAt)],
            });
            const lunch = [];
            const dinner = [];
            for (const r of rows) {
                const hm = zurichParts(new Date(r.reservedAt));
                if (hm.hour < 15)
                    lunch.push(r);
                else
                    dinner.push(r);
            }
            const rowHtml = (list) => {
                if (!list.length) {
                    return `<p style="color:#a8a29e;font-size:14px;margin:8px 0">None</p>`;
                }
                return `
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 16px">
            <thead>
              <tr style="text-align:left;color:#78716c;border-bottom:1px solid #e7e5e4">
                <th style="padding:6px 4px">Time</th>
                <th style="padding:6px 4px">Name</th>
                <th style="padding:6px 4px">Guests</th>
                <th style="padding:6px 4px">Status</th>
                <th style="padding:6px 4px">Table</th>
              </tr>
            </thead>
            <tbody>
              ${list
                    .map((r) => {
                    const time = formatZurichHm(new Date(r.reservedAt));
                    return `<tr style="border-bottom:1px solid #f5f5f4">
                    <td style="padding:6px 4px"><strong>${time}</strong></td>
                    <td style="padding:6px 4px">${r.guestName}</td>
                    <td style="padding:6px 4px">${r.partySize}</td>
                    <td style="padding:6px 4px">${r.status}</td>
                    <td style="padding:6px 4px">${r.tableLabel || "—"}</td>
                  </tr>`;
                })
                    .join("")}
            </tbody>
          </table>`;
            };
            const lunchCovers = lunch.reduce((s, r) => s + Number(r.partySize || 0), 0);
            const dinnerCovers = dinner.reduce((s, r) => s + Number(r.partySize || 0), 0);
            const shop = merchant.name || "Restaurant";
            const dateLabel = (0, date_format_1.formatDateDDMMYYYY)(dayStart);
            const subject = `Today's reservations — ${shop} (${dateLabel})`;
            const html = `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#1c1917">
          <h1 style="font-size:20px;margin-bottom:4px">Today's reservations</h1>
          <p style="color:#78716c;font-size:14px;margin-top:0">${shop} · ${dateLabel}</p>
          <p style="font-size:14px">
            <strong>${rows.length}</strong> booking${rows.length === 1 ? "" : "s"} ·
            <strong>${lunchCovers + dinnerCovers}</strong> covers
          </p>
          <h2 style="font-size:16px;margin:20px 0 4px">Lunch <span style="color:#78716c;font-weight:500">(${lunch.length} · ${lunchCovers} covers)</span></h2>
          ${rowHtml(lunch)}
          <h2 style="font-size:16px;margin:20px 0 4px">Dinner <span style="color:#78716c;font-weight:500">(${dinner.length} · ${dinnerCovers} covers)</span></h2>
          ${rowHtml(dinner)}
        </div>
      `;
            const text = [
                subject,
                `Total: ${rows.length} bookings, ${lunchCovers + dinnerCovers} covers`,
                "",
                `LUNCH (${lunch.length})`,
                ...lunch.map((r) => `${formatZurichHm(new Date(r.reservedAt))} · ${r.guestName} · ${r.partySize} · ${r.status}`),
                "",
                `DINNER (${dinner.length})`,
                ...dinner.map((r) => `${formatZurichHm(new Date(r.reservedAt))} · ${r.guestName} · ${r.partySize} · ${r.status}`),
            ].join("\n");
            try {
                await email_service_1.EmailService.send({
                    to,
                    subject,
                    html,
                    text,
                    merchantId: merchant.id,
                    emailType: "reservation_daily",
                });
                const nextSettings = {
                    ...settings,
                    lastDailySummaryDate: today,
                };
                await db
                    .update(db_1.schema.merchants)
                    .set({
                    reservationSettings: nextSettings,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchant.id));
                sent += 1;
            }
            catch (err) {
                console.error("[reservations] daily summary failed", merchant.id, err);
            }
        }
        return { sent };
    }
}
exports.ReservationService = ReservationService;
//# sourceMappingURL=reservation.service.js.map