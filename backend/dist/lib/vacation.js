"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOT_ACCEPTING_RESERVATIONS_MESSAGE = exports.NOT_ACCEPTING_ORDERS_MESSAGE = exports.VACATION_BLOCK_MESSAGE = void 0;
exports.ymdZurich = ymdZurich;
exports.zurichDayBounds = zurichDayBounds;
exports.hmZurich = hmZurich;
exports.normalizeLocalizedText = normalizeLocalizedText;
exports.resolveLocalized = resolveLocalized;
exports.isVacationEnabled = isVacationEnabled;
exports.normalizeVacationSettings = normalizeVacationSettings;
exports.findActiveVacationPeriod = findActiveVacationPeriod;
exports.isVacationActive = isVacationActive;
exports.isDateInVacationPeriods = isDateInVacationPeriods;
exports.vacationPublicPayload = vacationPublicPayload;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
/** Calendar date YYYY-MM-DD in Europe/Zurich. */
function ymdZurich(at = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(at);
}
/**
 * Inclusive start / end instants for a Zurich calendar day (YYYY-MM-DD).
 * Avoids `new Date("YYYY-MM-DDT00:00:00")` which is server-local/UTC and drops
 * early-morning Zurich sales from "today" lists.
 */
function zurichDayBounds(ymd) {
    const fallbackStart = new Date(`${ymd}T00:00:00+02:00`);
    const fallbackEnd = new Date(`${ymd}T23:59:59.999+02:00`);
    try {
        const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Zurich",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        let guess = new Date(`${ymd}T00:00:00Z`);
        for (let i = 0; i < 48; i++) {
            const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
            const got = `${parts.year}-${parts.month}-${parts.day}`;
            const hour = Number(parts.hour === "24" ? "0" : parts.hour);
            if (got === ymd && hour === 0)
                break;
            if (got < ymd)
                guess = new Date(guess.getTime() + 3600000);
            else if (got > ymd)
                guess = new Date(guess.getTime() - 3600000);
            else
                guess = new Date(guess.getTime() - hour * 3600000);
        }
        const startZ = guess;
        const endZ = new Date(startZ.getTime() + 24 * 3600000 - 1);
        return { start: startZ, end: endZ };
    }
    catch {
        return { start: fallbackStart, end: fallbackEnd };
    }
}
/** HH:mm in Europe/Zurich. */
function hmZurich(at = new Date()) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Zurich",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(at);
}
function normalizeTime(raw, fallback) {
    const t = String(raw || "").trim().slice(0, 5);
    if (TIME_RE.test(t))
        return t;
    return fallback;
}
function normalizeLocalizedText(raw) {
    if (raw == null)
        return null;
    if (typeof raw === "string") {
        const s = raw.trim().slice(0, 500);
        return s ? { en: s, fr: s, de: s } : null;
    }
    if (typeof raw !== "object")
        return null;
    const en = raw.en != null ? String(raw.en).trim().slice(0, 500) : "";
    const fr = raw.fr != null ? String(raw.fr).trim().slice(0, 500) : "";
    const de = raw.de != null ? String(raw.de).trim().slice(0, 500) : "";
    if (!en && !fr && !de)
        return null;
    return {
        en: en || null,
        fr: fr || null,
        de: de || null,
    };
}
function resolveLocalized(raw, locale, fallback = "") {
    if (raw == null)
        return fallback;
    if (typeof raw === "string")
        return raw.trim() || fallback;
    const lang = (locale || "en").toLowerCase().slice(0, 2);
    const pick = raw[lang] ||
        raw.en ||
        raw.fr ||
        raw.de ||
        "";
    return String(pick || "").trim() || fallback;
}
/** Master switch: schedules only apply when enabled. */
function isVacationEnabled(raw) {
    if (!raw || typeof raw !== "object")
        return false;
    if (raw.enabled !== undefined)
        return !!raw.enabled;
    // Legacy: old "Closed for holidays right now" flag
    return !!raw.manualActive;
}
function normalizeVacationSettings(raw) {
    const periods = [];
    const list = Array.isArray(raw?.periods) ? raw.periods : [];
    for (const p of list) {
        if (!p || typeof p !== "object")
            continue;
        const startDate = String(p.startDate || "").slice(0, 10);
        const endDate = String(p.endDate || "").slice(0, 10);
        if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate))
            continue;
        if (endDate < startDate)
            continue;
        const startTime = normalizeTime(p.startTime, "00:00");
        const endTime = normalizeTime(p.endTime, "23:59");
        if (startDate === endDate && endTime < startTime)
            continue;
        periods.push({
            id: String(p.id || `${startDate}-${endDate}`),
            startDate,
            startTime,
            endDate,
            endTime,
            title: normalizeLocalizedText(p.title),
        });
    }
    periods.sort((a, b) => {
        const c = a.startDate.localeCompare(b.startDate);
        if (c !== 0)
            return c;
        return String(a.startTime || "").localeCompare(String(b.startTime || ""));
    });
    const popupImageUrl = raw?.popupImageUrl != null && String(raw.popupImageUrl).trim()
        ? String(raw.popupImageUrl).trim().slice(0, 500)
        : null;
    return {
        enabled: isVacationEnabled(raw),
        popupImageUrl,
        popupTitle: normalizeLocalizedText(raw?.popupTitle),
        message: normalizeLocalizedText(raw?.message),
        periods,
    };
}
function periodContainsDateTime(period, at) {
    const ymd = ymdZurich(at);
    const hm = hmZurich(at);
    const start = `${period.startDate}T${normalizeTime(period.startTime, "00:00")}`;
    const end = `${period.endDate}T${normalizeTime(period.endTime, "23:59")}`;
    const cur = `${ymd}T${hm}`;
    return cur >= start && cur <= end;
}
function findActiveVacationPeriod(raw, at = new Date()) {
    const settings = normalizeVacationSettings(raw);
    if (!settings.enabled)
        return null;
    return (settings.periods || []).find((p) => periodContainsDateTime(p, at)) || null;
}
function isVacationActive(raw, at = new Date()) {
    return !!findActiveVacationPeriod(raw, at);
}
/**
 * True when a calendar date (YYYY-MM-DD) overlaps a programmed vacation period.
 * Only when the master switch is enabled.
 */
function isDateInVacationPeriods(raw, ymd) {
    const settings = normalizeVacationSettings(raw);
    if (!settings.enabled)
        return false;
    if (!DATE_RE.test(ymd))
        return false;
    return (settings.periods || []).some((p) => p.startDate <= ymd && ymd <= p.endDate);
}
function vacationPublicPayload(raw, at = new Date()) {
    const settings = normalizeVacationSettings(raw);
    const activePeriod = findActiveVacationPeriod(settings, at);
    const active = !!activePeriod;
    return {
        active,
        enabled: !!settings.enabled,
        message: settings.message,
        popupTitle: settings.popupTitle,
        popupImageUrl: settings.popupImageUrl,
        periods: settings.periods,
    };
}
exports.VACATION_BLOCK_MESSAGE = "We are currently on vacation. Online orders and reservations are temporarily unavailable.";
exports.NOT_ACCEPTING_ORDERS_MESSAGE = "We are not accepting orders at the moment, please call us";
exports.NOT_ACCEPTING_RESERVATIONS_MESSAGE = "We are not accepting reservations at the moment, please call us";
//# sourceMappingURL=vacation.js.map