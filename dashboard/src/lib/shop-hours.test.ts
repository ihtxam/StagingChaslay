/**
 * Schedule days include remaining today slots — run:
 * npx tsx dashboard/src/lib/shop-hours.test.ts
 */
import assert from 'node:assert/strict';
import { buildScheduleDays, zonedLocalDate, type StoreHours } from './shop-hours.ts';

const hours: StoreHours = {
  takeaway: {
    wed: [{ open: '11:00', close: '22:00' }],
    thu: [{ open: '11:00', close: '22:00' }],
    fri: [{ open: '11:00', close: '22:00' }],
  },
};

const early = zonedLocalDate(2026, 9, 16, 10, 0);
const earlyDays = buildScheduleDays({
  storeHours: hours,
  channel: 'takeaway',
  now: early,
  leadMinutes: 30,
  intervalMinutes: 15,
  horizonDays: 2,
});
assert.ok(
  earlyDays.some((d) => d.offset === 0),
  'today should appear when remaining slots exist'
);
assert.ok(earlyDays.some((d) => d.offset === 1), 'tomorrow should appear');
assert.ok(earlyDays[0]?.slots.some((s) => s.label === '11:00'));

const late = zonedLocalDate(2026, 9, 16, 21, 50);
const lateDays = buildScheduleDays({
  storeHours: hours,
  channel: 'takeaway',
  now: late,
  leadMinutes: 30,
  intervalMinutes: 15,
  horizonDays: 2,
});
assert.ok(
  !lateDays.some((d) => d.offset === 0),
  'today should be omitted when no remaining slots remain after lead time'
);
assert.ok(lateDays.some((d) => d.offset === 1));

console.log('shop-hours.test.ts OK');
