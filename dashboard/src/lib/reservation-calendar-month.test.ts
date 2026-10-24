/**
 * Run: cd dashboard && npx tsx src/lib/reservation-calendar-month.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildCalendarMonthGrid,
  groupReservationsByYmd,
  monthRangeIso,
  shiftCalendarViewYm,
} from './reservation-calendar-month.ts';

const oct = buildCalendarMonthGrid('2026-10-01');
assert.equal(oct.days.length, 31);
assert.equal(oct.days[0], '2026-10-01');
assert.equal(oct.firstWeekdayMon0, 3);

assert.equal(shiftCalendarViewYm('2026-10-01', 1), '2026-11-01');
assert.deepEqual(monthRangeIso('2026-10-01'), { from: '2026-10-01', to: '2026-10-31' });

const grouped = groupReservationsByYmd([
  { reservedAt: '2026-10-15T17:00:00.000Z', id: 'a' },
  { reservedAt: '2026-10-15T19:00:00.000Z', id: 'b' },
]);
assert.equal(grouped.get('2026-10-15')?.length, 2);

console.log('reservation-calendar-month.test.ts: ok');
