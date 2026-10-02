import { describe, expect, it } from "vitest";
import {
  applyUniformPricing,
  applyUniformPricingToMap,
  isHmInWindow,
  isMenuScheduleActive,
  normalizeTimeRanges,
  parseHm,
  pickActiveScheduledMenu,
} from "./scheduled-menu";

describe("scheduled-menu", () => {
  it("handles midnight wrap time window", () => {
    expect(isHmInWindow(parseHm("22:00"), "21:00", "06:00")).toBe(true);
    expect(isHmInWindow(parseHm("12:00"), "21:00", "06:00")).toBe(false);
  });

  it("normalizes legacy single start/end into time ranges", () => {
    expect(normalizeTimeRanges(null, "11:00", "14:00")).toEqual([{ start: "11:00", end: "14:00" }]);
  });

  it("weekly schedule respects day toggles", () => {
    const menu = {
      scheduleType: "weekly" as const,
      daysOfWeek: [1, 2, 3, 4, 5],
      timeRanges: [{ start: "00:00", end: "23:59" }],
      isActive: true,
    };
    const monday = new Date("2026-03-02T12:00:00+01:00");
    const sunday = new Date("2026-03-01T12:00:00+01:00");
    expect(isMenuScheduleActive(menu, monday, "Europe/Zurich")).toBe(true);
    expect(isMenuScheduleActive(menu, sunday, "Europe/Zurich")).toBe(false);
  });

  it("monthly schedule respects day-of-month", () => {
    const menu = {
      scheduleType: "monthly" as const,
      daysOfMonth: [1, 15],
      timeRanges: [{ start: "00:00", end: "23:59" }],
      isActive: true,
    };
    expect(isMenuScheduleActive(menu, new Date("2026-03-01T10:00:00+01:00"), "Europe/Zurich")).toBe(
      true
    );
    expect(isMenuScheduleActive(menu, new Date("2026-03-02T10:00:00+01:00"), "Europe/Zurich")).toBe(
      false
    );
  });

  it("picks non-default menu before default fallback", () => {
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
    const picked = pickActiveScheduledMenu([defaultMenu, lunch], {
      channel: "pos",
      locationId: "loc-1",
      at: atLunch,
      timezone: "Europe/Zurich",
    });
    expect(picked?.id).toBe("lunch");

    const atNight = new Date("2026-03-02T20:00:00+01:00");
    const fallback = pickActiveScheduledMenu([defaultMenu, lunch], {
      channel: "pos",
      locationId: "loc-1",
      at: atNight,
      timezone: "Europe/Zurich",
    });
    expect(fallback?.id).toBe("default");
  });

  it("uniform pricing fixed and percent", () => {
    expect(applyUniformPricing(10, { mode: "fixed", value: 2.5 })).toBe(12.5);
    expect(applyUniformPricing(10, { mode: "fixed", value: -3 })).toBe(7);
    expect(
      applyUniformPricing(10, { mode: "percent", value: 10, direction: "increase" })
    ).toBe(11);
    expect(
      applyUniformPricing(10, { mode: "percent", value: 10, direction: "decrease" })
    ).toBe(9);
  });

  it("uniform pricing map applies per product", () => {
    const out = applyUniformPricingToMap({ a: 5, b: 20 }, { mode: "percent", value: 50, direction: "increase" });
    expect(out.a).toBe(7.5);
    expect(out.b).toBe(30);
  });
});
