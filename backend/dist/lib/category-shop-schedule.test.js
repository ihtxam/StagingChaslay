"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const category_shop_schedule_1 = require("./category-shop-schedule");
(0, vitest_1.describe)("category-shop-schedule", () => {
    (0, vitest_1.it)("shows category when schedule disabled", () => {
        (0, vitest_1.expect)((0, category_shop_schedule_1.isCategoryShopScheduleVisible)({ enabled: false }, new Date("2026-06-03T12:00:00Z"), "Europe/Zurich")).toBe(true);
    });
    (0, vitest_1.it)("hides outside weekly window", () => {
        const schedule = {
            enabled: true,
            scheduleType: "weekly",
            daysOfWeek: [1, 2, 3, 4, 5],
            timeRanges: [{ start: "11:00", end: "14:00" }],
        };
        // Tuesday 10:00 Zurich (~08:00 UTC in winter — use noon local)
        const tuesdayLunch = new Date("2026-06-02T10:30:00.000Z");
        (0, vitest_1.expect)((0, category_shop_schedule_1.isCategoryShopScheduleVisible)(schedule, tuesdayLunch, "Europe/Zurich")).toBe(true);
        const tuesdayMorning = new Date("2026-06-02T07:00:00.000Z");
        (0, vitest_1.expect)((0, category_shop_schedule_1.isCategoryShopScheduleVisible)(schedule, tuesdayMorning, "Europe/Zurich")).toBe(false);
    });
});
//# sourceMappingURL=category-shop-schedule.test.js.map