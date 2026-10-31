/**
 * Calendar-date helpers for YYYY-MM-DD strings.
 *
 * Kept free of database imports so the date arithmetic can be unit tested on
 * its own — the bug below took production down and must stay covered.
 */

/**
 * Step a calendar date by whole days. Never a clock.
 *
 * Anchoring at midday UTC and using setUTCDate makes this immune to DST.
 * The previous implementation added delta * 24h to Zurich midnight. On the day
 * the clocks go back that day is 25 hours long, so +24h landed at 23:00 on the
 * SAME calendar day: addDaysYmd("2026-10-25", 1) returned "2026-10-25".
 * A `while (cursor <= range.to)` day-bucket loop then never advanced past it,
 * pinning the Node event loop at 100% CPU until the API was restarted.
 */
export function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
