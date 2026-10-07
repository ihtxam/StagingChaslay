"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CATEGORY_SHOP_SCHEDULE = void 0;
exports.normalizeCategoryShopSchedule = normalizeCategoryShopSchedule;
exports.isCategoryShopScheduleVisible = isCategoryShopScheduleVisible;
const scheduled_menu_1 = require("@/lib/scheduled-menu");
exports.DEFAULT_CATEGORY_SHOP_SCHEDULE = {
    enabled: false,
    scheduleType: "weekly",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    daysOfMonth: [],
    timeRanges: [{ start: "00:00", end: "23:59" }],
};
function normalizeCategoryShopSchedule(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { ...exports.DEFAULT_CATEGORY_SHOP_SCHEDULE };
    }
    const o = raw;
    const scheduleType = (o.scheduleType || o.schedule_type || "weekly");
    const daysOfWeek = Array.isArray(o.daysOfWeek ?? o.days_of_week)
        ? (o.daysOfWeek ?? o.days_of_week)
        : exports.DEFAULT_CATEGORY_SHOP_SCHEDULE.daysOfWeek;
    const daysOfMonth = Array.isArray(o.daysOfMonth ?? o.days_of_month)
        ? (o.daysOfMonth ?? o.days_of_month)
        : [];
    const timeRanges = (0, scheduled_menu_1.normalizeTimeRanges)(o.timeRanges ?? o.time_ranges, typeof o.timeStart === "string" ? o.timeStart : null, typeof o.timeEnd === "string" ? o.timeEnd : null);
    return {
        enabled: o.enabled === true,
        scheduleType,
        daysOfWeek,
        daysOfMonth,
        timeRanges,
    };
}
/** When schedule disabled, category is always visible (subject to channel + products). */
function isCategoryShopScheduleVisible(schedule, at, timezone = "Europe/Zurich") {
    const normalized = normalizeCategoryShopSchedule(schedule);
    if (!normalized.enabled)
        return true;
    return (0, scheduled_menu_1.isMenuScheduleActive)({
        isActive: true,
        scheduleType: normalized.scheduleType,
        daysOfWeek: normalized.daysOfWeek,
        daysOfMonth: normalized.daysOfMonth,
        timeRanges: normalized.timeRanges,
    }, at, timezone);
}
//# sourceMappingURL=category-shop-schedule.js.map