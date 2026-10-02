import { describe, expect, it } from "vitest";
import { isCategoryShopScheduleVisible } from "./category-shop-schedule";

describe("category-shop-schedule", () => {
  it("shows category when schedule disabled", () => {
    expect(
      isCategoryShopScheduleVisible({ enabled: false }, new Date("2026-06-03T12:00:00Z"), "Europe/Zurich")
    ).toBe(true);
  });

  it("hides outside weekly window", () => {
    const schedule = {
      enabled: true,
      scheduleType: "weekly",
      daysOfWeek: [1, 2, 3, 4, 5],
      timeRanges: [{ start: "11:00", end: "14:00" }],
    };
    // Tuesday 10:00 Zurich (~08:00 UTC in winter — use noon local)
    const tuesdayLunch = new Date("2026-06-02T10:30:00.000Z");
    expect(isCategoryShopScheduleVisible(schedule, tuesdayLunch, "Europe/Zurich")).toBe(true);
    const tuesdayMorning = new Date("2026-06-02T07:00:00.000Z");
    expect(isCategoryShopScheduleVisible(schedule, tuesdayMorning, "Europe/Zurich")).toBe(false);
  });
});
