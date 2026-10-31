import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchSlotPromoForSlot, normalizeSlotPromos } from "./reservation-slot-promo.ts";

describe("reservation slot promos", () => {
  it("matches specific times on Thursday wine offer", () => {
    const promos = normalizeSlotPromos([
      {
        id: "1",
        name: "Thursday wine",
        kind: "free_wine",
        scheduleMode: "specific_days",
        daysOfWeek: ["thu"],
        specificTimes: ["19:00", "19:30", "20:00"],
        enabled: true,
      },
    ]);
    assert.equal(matchSlotPromoForSlot(promos, "thu", "19:30")?.kind, "free_wine");
    assert.equal(matchSlotPromoForSlot(promos, "thu", "18:30"), null);
    assert.equal(matchSlotPromoForSlot(promos, "fri", "19:30"), null);
  });

  it("matches dine_free book 4 pay 3", () => {
    const promos = normalizeSlotPromos([
      {
        id: "2",
        name: "Book 4 pay 3",
        kind: "dine_free",
        payCovers: 3,
        receiveCovers: 4,
        scheduleMode: "whole_week",
        daysOfWeek: [],
        timeStart: "18:00",
        timeEnd: "22:00",
        enabled: true,
      },
    ]);
    const m = matchSlotPromoForSlot(promos, "fri", "19:00");
    assert.equal(m?.kind, "dine_free");
    assert.match(m?.label || "", /4/);
  });
});
