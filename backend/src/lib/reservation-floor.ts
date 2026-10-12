import { ymdZurich } from "@/lib/vacation";

const FLOOR_HOLD_STATUSES = new Set(["pending", "confirmed", "waitlist"]);

export function isReservationOnZurichDay(
  reservedAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!reservedAt) return false;
  const at = reservedAt instanceof Date ? reservedAt : new Date(reservedAt);
  if (Number.isNaN(at.getTime())) return false;
  return ymdZurich(at) === ymdZurich(now);
}

/** Persisted / live floor paint when assigning or seating a booking. */
export function floorStatusForReservation(
  reservationStatus: string,
  reservedAt: Date | string | null | undefined,
  now: Date = new Date()
): "occupied" | "reserved" | null {
  if (reservationStatus === "seated") return "occupied";
  if (!FLOOR_HOLD_STATUSES.has(reservationStatus)) return null;
  if (!isReservationOnZurichDay(reservedAt, now)) return null;
  return "reserved";
}

/** Only release the floor when this booking could have painted it. */
export function shouldReleaseFloorForReservation(
  reservationStatus: string,
  reservedAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (reservationStatus === "seated") return true;
  return isReservationOnZurichDay(reservedAt, now);
}

export function overlayTableStatusWithTodayReservations<T extends string>(
  stored: T,
  tableId: string,
  todayReservedTableIds: Set<string>,
  todaySeatedTableIds: Set<string> = new Set()
): T {
  if (stored === "occupied" || stored === "dirty") return stored;
  if (todaySeatedTableIds.has(tableId)) return "occupied" as T;
  if (todayReservedTableIds.has(tableId)) return "reserved" as T;
  if (stored === "reserved") return "available" as T;
  return stored;
}
