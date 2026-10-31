/**
 * addDaysYmd must step the calendar, not the clock.
 *
 * Regression: on 2026-10-25 the Zurich clocks went back, making that day 25
 * hours long. The old implementation added 24h to Zurich midnight and landed
 * at 23:00 the same day, so addDaysYmd("2026-10-25", 1) returned
 * "2026-10-25". The day-bucket loop in getOverviewDashboard never advanced
 * past it and pinned the API at 100% CPU until it was restarted.
 *
 * Run: npx tsx backend/src/lib/ymd.test.ts
 */
import assert from "node:assert/strict";
import { addDaysYmd } from "./ymd";

// The exact day that broke production.
assert.equal(addDaysYmd("2026-10-25", 1), "2026-10-26", "DST-back day must advance");

// Spring transition (clocks forward) must not skip a day either.
assert.equal(addDaysYmd("2026-03-29", 1), "2026-03-30", "DST-forward day must advance by one");

// Walking a whole year must always advance by exactly one day.
let cursor = "2026-01-01";
let steps = 0;
while (cursor < "2027-01-01") {
  const next = addDaysYmd(cursor, 1);
  assert.ok(next > cursor, `cursor failed to advance at ${cursor}`);
  cursor = next;
  steps += 1;
  assert.ok(steps <= 400, "walked too many steps — the cursor is not advancing");
}
assert.equal(steps, 365, "2026 has 365 days");

// Negative deltas power the "yesterday" preset.
assert.equal(addDaysYmd("2026-10-26", -1), "2026-10-25");
assert.equal(addDaysYmd("2026-03-30", -1), "2026-03-29");

// Month and year boundaries.
assert.equal(addDaysYmd("2026-01-31", 1), "2026-02-01");
assert.equal(addDaysYmd("2026-02-28", 1), "2026-03-01");
assert.equal(addDaysYmd("2026-12-31", 1), "2027-01-01");

// Leap year.
assert.equal(addDaysYmd("2028-02-28", 1), "2028-02-29");
assert.equal(addDaysYmd("2028-02-29", 1), "2028-03-01");

console.log("ymd.test.ts ok");
