import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  floorStatusForReservation,
  isReservationOnZurichDay,
  overlayTableStatusWithTodayReservations,
  shouldReleaseFloorForReservation,
} from "./reservation-floor";

describe("reservation floor paint", () => {
  const today = new Date("2026-10-12T10:00:00.000Z");
  const laterThisWeek = new Date("2026-10-16T17:00:00.000Z");

  it("treats Oct 16 as a different Zurich day than Oct 12", () => {
    assert.equal(isReservationOnZurichDay(laterThisWeek, today), false);
    assert.equal(isReservationOnZurichDay(new Date("2026-10-12T18:30:00.000Z"), today), true);
  });

  it("does not paint reserved for a future assigned table", () => {
    assert.equal(floorStatusForReservation("confirmed", laterThisWeek, today), null);
    assert.equal(floorStatusForReservation("pending", laterThisWeek, today), null);
    assert.equal(shouldReleaseFloorForReservation("confirmed", laterThisWeek, today), false);
  });

  it("paints reserved only on the reservation day", () => {
    assert.equal(
      floorStatusForReservation("confirmed", new Date("2026-10-12T18:00:00.000Z"), today),
      "reserved"
    );
  });

  it("still marks seated tables occupied immediately", () => {
    assert.equal(floorStatusForReservation("seated", laterThisWeek, today), "occupied");
    assert.equal(shouldReleaseFloorForReservation("seated", laterThisWeek, today), true);
  });

  it("shows reserved today and clears stale reserved for future-only tables", () => {
    const reservedIds = new Set(["t-today"]);
    assert.equal(
      overlayTableStatusWithTodayReservations("available", "t-today", reservedIds),
      "reserved"
    );
    assert.equal(
      overlayTableStatusWithTodayReservations("reserved", "t-future", reservedIds),
      "available"
    );
    assert.equal(
      overlayTableStatusWithTodayReservations("occupied", "t-today", reservedIds),
      "occupied"
    );
  });
});
