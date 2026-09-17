/**
 * Shop hours schedule + remaining/upcoming helpers —
 * run: npx tsx dashboard/src/lib/shop-hours.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildScheduleDays,
  currentChannelClose,
  isChannelOpenAt,
  isShopHoursSoonWindow,
  minutesUntilChannelClose,
  minutesUntilChannelOpen,
  SHOP_HOURS_SOON_WINDOW_MINUTES,
  zonedLocalDate,
  type StoreHours,
} from './shop-hours.ts';

const scheduleHours: StoreHours = {
  takeaway: {
    wed: [{ open: '11:00', close: '22:00' }],
    thu: [{ open: '11:00', close: '22:00' }],
    fri: [{ open: '11:00', close: '22:00' }],
  },
};

const early = zonedLocalDate(2026, 9, 16, 10, 0);
const earlyDays = buildScheduleDays({
  storeHours: scheduleHours,
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
  storeHours: scheduleHours,
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

const hours: StoreHours = {
  takeaway: {
    wed: [{ open: '11:00', close: '23:00' }],
  },
  delivery: {
    wed: [{ open: '11:00', close: '22:00' }],
  },
};

const closingSoon = zonedLocalDate(2026, 9, 16, 22, 30);
assert.equal(isChannelOpenAt(hours, 'takeaway', closingSoon).open, true);
assert.equal(minutesUntilChannelClose(hours, 'takeaway', closingSoon), 30);
assert.deepEqual(currentChannelClose(hours, 'takeaway', closingSoon), {
  minutes: 30,
  labelHm: '23:00',
});
assert.equal(isChannelOpenAt(hours, 'delivery', closingSoon).open, false);
assert.equal(minutesUntilChannelClose(hours, 'delivery', closingSoon), null);

const beforeOpen = zonedLocalDate(2026, 9, 16, 10, 40);
assert.equal(isChannelOpenAt(hours, 'takeaway', beforeOpen).open, false);
assert.equal(minutesUntilChannelOpen(hours, 'takeaway', beforeOpen), 20);
assert.equal(minutesUntilChannelClose(hours, 'takeaway', beforeOpen), null);

const midday = zonedLocalDate(2026, 9, 16, 14, 0);
assert.equal(minutesUntilChannelClose(hours, 'takeaway', midday), 9 * 60);
assert.deepEqual(currentChannelClose(hours, 'takeaway', midday), {
  minutes: 9 * 60,
  labelHm: '23:00',
});
assert.equal(minutesUntilChannelOpen(hours, 'takeaway', midday), null);

assert.equal(SHOP_HOURS_SOON_WINDOW_MINUTES, 30);
assert.equal(isShopHoursSoonWindow(30), true);
assert.equal(isShopHoursSoonWindow(31), false);
assert.equal(isShopHoursSoonWindow(20), true);
assert.equal(isShopHoursSoonWindow(90), false);

console.log('shop-hours.test.ts OK');
