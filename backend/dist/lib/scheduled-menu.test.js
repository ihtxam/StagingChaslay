"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scheduled_menu_1 = require("./scheduled-menu");
(0, vitest_1.describe)("scheduled-menu", () => {
    (0, vitest_1.it)("handles midnight wrap time window", () => {
        (0, vitest_1.expect)((0, scheduled_menu_1.isHmInWindow)((0, scheduled_menu_1.parseHm)("22:00"), "21:00", "06:00")).toBe(true);
        (0, vitest_1.expect)((0, scheduled_menu_1.isHmInWindow)((0, scheduled_menu_1.parseHm)("12:00"), "21:00", "06:00")).toBe(false);
    });
    (0, vitest_1.it)("normalizes legacy single start/end into time ranges", () => {
        (0, vitest_1.expect)((0, scheduled_menu_1.normalizeTimeRanges)(null, "11:00", "14:00")).toEqual([{ start: "11:00", end: "14:00" }]);
    });
    (0, vitest_1.it)("weekly schedule respects day toggles", () => {
        const menu = {
            scheduleType: "weekly",
            daysOfWeek: [1, 2, 3, 4, 5],
            timeRanges: [{ start: "00:00", end: "23:59" }],
            isActive: true,
        };
        const monday = new Date("2026-03-02T12:00:00+01:00");
        const sunday = new Date("2026-03-01T12:00:00+01:00");
        (0, vitest_1.expect)((0, scheduled_menu_1.isMenuScheduleActive)(menu, monday, "Europe/Zurich")).toBe(true);
        (0, vitest_1.expect)((0, scheduled_menu_1.isMenuScheduleActive)(menu, sunday, "Europe/Zurich")).toBe(false);
    });
    (0, vitest_1.it)("monthly schedule respects day-of-month", () => {
        const menu = {
            scheduleType: "monthly",
            daysOfMonth: [1, 15],
            timeRanges: [{ start: "00:00", end: "23:59" }],
            isActive: true,
        };
        (0, vitest_1.expect)((0, scheduled_menu_1.isMenuScheduleActive)(menu, new Date("2026-03-01T10:00:00+01:00"), "Europe/Zurich")).toBe(true);
        (0, vitest_1.expect)((0, scheduled_menu_1.isMenuScheduleActive)(menu, new Date("2026-03-02T10:00:00+01:00"), "Europe/Zurich")).toBe(false);
    });
    (0, vitest_1.it)("picks non-default menu before default fallback", () => {
        const lunch = {
            id: "lunch",
            isDefault: false,
            sortOrder: 1,
            channels: ["pos"],
            locationIds: [],
            scheduleType: "weekly",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            timeRanges: [{ start: "11:00", end: "14:00" }],
            isActive: true,
        };
        const defaultMenu = {
            id: "default",
            isDefault: true,
            sortOrder: 0,
            channels: ["pos"],
            locationIds: [],
            scheduleType: "daily",
            timeRanges: [{ start: "00:00", end: "23:59" }],
            isActive: true,
        };
        const atLunch = new Date("2026-03-02T12:30:00+01:00");
        const picked = (0, scheduled_menu_1.pickActiveScheduledMenu)([defaultMenu, lunch], {
            channel: "pos",
            locationId: "loc-1",
            at: atLunch,
            timezone: "Europe/Zurich",
        });
        (0, vitest_1.expect)(picked?.id).toBe("lunch");
        const atNight = new Date("2026-03-02T20:00:00+01:00");
        const fallback = (0, scheduled_menu_1.pickActiveScheduledMenu)([defaultMenu, lunch], {
            channel: "pos",
            locationId: "loc-1",
            at: atNight,
            timezone: "Europe/Zurich",
        });
        (0, vitest_1.expect)(fallback?.id).toBe("default");
    });
    (0, vitest_1.it)("uniform pricing fixed and percent", () => {
        (0, vitest_1.expect)((0, scheduled_menu_1.applyUniformPricing)(10, { mode: "fixed", value: 2.5 })).toBe(12.5);
        (0, vitest_1.expect)((0, scheduled_menu_1.applyUniformPricing)(10, { mode: "fixed", value: -3 })).toBe(7);
        (0, vitest_1.expect)((0, scheduled_menu_1.applyUniformPricing)(10, { mode: "percent", value: 10, direction: "increase" })).toBe(11);
        (0, vitest_1.expect)((0, scheduled_menu_1.applyUniformPricing)(10, { mode: "percent", value: 10, direction: "decrease" })).toBe(9);
    });
    (0, vitest_1.it)("uniform pricing map applies per product", () => {
        const out = (0, scheduled_menu_1.applyUniformPricingToMap)({ a: 5, b: 20 }, { mode: "percent", value: 50, direction: "increase" });
        (0, vitest_1.expect)(out.a).toBe(7.5);
        (0, vitest_1.expect)(out.b).toBe(30);
    });
});
//# sourceMappingURL=scheduled-menu.test.js.map