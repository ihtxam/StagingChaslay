import { describe, expect, it } from "vitest";
import {
  findActiveTimeSlot,
  isHmInWindow,
  localMinutesInTimezone,
  normalizeTimeSlotPricingSettings,
  resolveProductPrice,
  slotsOverlap,
} from "./time-slot-pricing";

describe("time-slot-pricing", () => {
  it("handles midnight wrap window", () => {
    expect(isHmInWindow(parseHm("22:00"), "21:00", "06:00")).toBe(true);
    expect(isHmInWindow(parseHm("12:00"), "21:00", "06:00")).toBe(false);
    expect(isHmInWindow(parseHm("03:00"), "21:00", "06:00")).toBe(true);
    expect(isHmInWindow(parseHm("06:00"), "21:00", "06:00")).toBe(true);
  });

  it("detects overlapping slots", () => {
    const a = { id: "a", start: "21:00", end: "06:00" };
    const b = { id: "b", start: "00:00", end: "02:00" };
    const c = { id: "c", start: "08:00", end: "12:00" };
    expect(slotsOverlap(a, b)).toBe(true);
    expect(slotsOverlap(a, c)).toBe(false);
  });

  it("resolves price override for active slot", () => {
    const settings = normalizeTimeSlotPricingSettings({
      enabled: true,
      slots: [{ id: "night", start: "21:00", end: "06:00", label: "Night" }],
    });
    const at = new Date("2026-01-15T23:30:00+01:00");
    const cur = localMinutesInTimezone(at, "Europe/Zurich");
    expect(isHmInWindow(cur, "21:00", "06:00")).toBe(true);

    const resolved = resolveProductPrice(
      {
        price: 10,
        timeSlotPrices: { night: { price: 7.5 } },
      },
      settings,
      { at, timezone: "Europe/Zurich" }
    );
    expect(resolved.resolvedPrice).toBe(7.5);
    expect(resolved.activeSlotId).toBe("night");
    expect(resolved.applied).toBe(true);
  });

  it("uses base price when feature disabled", () => {
    const settings = normalizeTimeSlotPricingSettings({ enabled: false, slots: [] });
    const resolved = resolveProductPrice(
      { price: 12, timeSlotPrices: { night: { price: 8 } } },
      settings
    );
    expect(resolved.resolvedPrice).toBe(12);
    expect(resolved.applied).toBe(false);
  });

  it("picks first matching slot when multiple match", () => {
    const settings = normalizeTimeSlotPricingSettings({
      enabled: true,
      slots: [
        { id: "first", start: "00:00", end: "23:59" },
        { id: "second", start: "12:00", end: "13:00" },
      ],
    });
    const at = new Date("2026-06-01T12:30:00+02:00");
    const active = findActiveTimeSlot(settings, at, "Europe/Zurich");
    expect(active?.id).toBe("first");
  });
});

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
