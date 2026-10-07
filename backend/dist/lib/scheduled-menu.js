"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHm = parseHm;
exports.isHmInWindow = isHmInWindow;
exports.normalizeTimeRanges = normalizeTimeRanges;
exports.normalizeProductPrices = normalizeProductPrices;
exports.isMenuScheduleActive = isMenuScheduleActive;
exports.pickActiveScheduledMenu = pickActiveScheduledMenu;
exports.applyUniformPricing = applyUniformPricing;
exports.applyUniformPricingToMap = applyUniformPricingToMap;
exports.applyMenuProductPrices = applyMenuProductPrices;
const money_1 = require("@/lib/money");
const catalog_visibility_1 = require("@/lib/catalog-visibility");
const DEFAULT_TIMEZONE = "Europe/Zurich";
function parseHm(time) {
    const [h, m] = String(time || "00:00").split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
function isHmInWindow(curMinutes, start, end) {
    const startM = parseHm(start);
    const endM = parseHm(end);
    if (startM <= endM)
        return curMinutes >= startM && curMinutes <= endM;
    return curMinutes >= startM || curMinutes <= endM;
}
function normalizeTimeRanges(ranges, fallbackStart, fallbackEnd) {
    const out = [];
    if (Array.isArray(ranges)) {
        for (const row of ranges) {
            if (!row || typeof row !== "object")
                continue;
            const r = row;
            const start = String(r.start || "").trim();
            const end = String(r.end || "").trim();
            if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end))
                continue;
            out.push({ start, end });
        }
    }
    if (!out.length && fallbackStart && fallbackEnd) {
        out.push({ start: fallbackStart, end: fallbackEnd });
    }
    if (!out.length) {
        out.push({ start: "00:00", end: "23:59" });
    }
    return out;
}
function normalizeProductPrices(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return {};
    const out = {};
    for (const [key, val] of Object.entries(raw)) {
        const id = String(key || "").trim();
        if (!id)
            continue;
        const n = (0, money_1.roundMoney2)(Number(val));
        if (Number.isFinite(n) && n >= 0)
            out[id] = n;
    }
    return out;
}
function zonedParts(at, timezone) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone || DEFAULT_TIMEZONE,
        weekday: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(at);
    const weekday = parts.find((p) => p.type === "weekday")?.value || "";
    const dayMap = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };
    const dow = dayMap[weekday] ?? at.getDay();
    const dayOfMonth = Number(parts.find((p) => p.type === "day")?.value || at.getDate());
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    return { dow, dayOfMonth, hour, minute };
}
function isMenuScheduleActive(menu, at, timezone = DEFAULT_TIMEZONE) {
    if (menu.isActive === false)
        return false;
    const scheduleType = (menu.scheduleType || "weekly");
    const { dow, dayOfMonth, hour, minute } = zonedParts(at, timezone);
    const cur = hour * 60 + minute;
    if (scheduleType === "weekly") {
        const days = Array.isArray(menu.daysOfWeek) && menu.daysOfWeek.length
            ? menu.daysOfWeek
            : [0, 1, 2, 3, 4, 5, 6];
        if (!days.includes(dow))
            return false;
    }
    else if (scheduleType === "monthly") {
        const dom = Array.isArray(menu.daysOfMonth) && menu.daysOfMonth.length ? menu.daysOfMonth : [];
        if (dom.length && !dom.includes(dayOfMonth))
            return false;
    }
    const ranges = normalizeTimeRanges(menu.timeRanges, menu.timeStart, menu.timeEnd);
    return ranges.some((r) => isHmInWindow(cur, r.start, r.end));
}
function pickActiveScheduledMenu(menus, opts) {
    const at = opts.at ?? new Date();
    const timezone = opts.timezone || DEFAULT_TIMEZONE;
    const active = menus
        .filter((m) => m.isActive !== false)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    const nonDefault = active.filter((m) => !m.isDefault);
    for (const menu of nonDefault) {
        if (!(0, catalog_visibility_1.menuIncludesCatalogChannel)(menu.channels, opts.channel))
            continue;
        const locIds = Array.isArray(menu.locationIds) ? menu.locationIds : [];
        if (locIds.length && !locIds.includes(opts.locationId))
            continue;
        if (isMenuScheduleActive(menu, at, timezone))
            return menu;
    }
    const defaultMenu = active.find((m) => m.isDefault);
    if (defaultMenu) {
        if (!(0, catalog_visibility_1.menuIncludesCatalogChannel)(defaultMenu.channels, opts.channel))
            return null;
        const locIds = Array.isArray(defaultMenu.locationIds) ? defaultMenu.locationIds : [];
        if (locIds.length && !locIds.includes(opts.locationId))
            return null;
        return defaultMenu;
    }
    return null;
}
function applyUniformPricing(basePrice, input) {
    const base = (0, money_1.roundMoney2)(Number(basePrice) || 0);
    const value = Number(input.value) || 0;
    if (input.mode === "fixed") {
        return (0, money_1.roundMoney2)(Math.max(0, base + value));
    }
    const dir = input.direction || (value < 0 ? "decrease" : "increase");
    const pct = Math.abs(value);
    const delta = (0, money_1.roundMoney2)((base * pct) / 100);
    if (dir === "decrease")
        return (0, money_1.roundMoney2)(Math.max(0, base - delta));
    return (0, money_1.roundMoney2)(base + delta);
}
function applyUniformPricingToMap(basePrices, input) {
    const out = {};
    for (const [id, price] of Object.entries(basePrices)) {
        out[id] = applyUniformPricing(price, input);
    }
    return out;
}
function applyMenuProductPrices(products, menuPrices) {
    const map = normalizeProductPrices(menuPrices);
    if (!Object.keys(map).length)
        return products;
    return products.map((p) => {
        if (p.isOpenPrice)
            return p;
        const override = map[p.id];
        if (override == null || !Number.isFinite(override))
            return p;
        const base = (0, money_1.roundMoney2)(Number(p.price) || 0);
        if (override === base)
            return p;
        return {
            ...p,
            price: override.toFixed(2),
            menuPriceApplied: true,
            catalogBasePrice: base,
        };
    });
}
//# sourceMappingURL=scheduled-menu.js.map