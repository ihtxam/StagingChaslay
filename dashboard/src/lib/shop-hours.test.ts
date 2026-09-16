/**
 * Shop hours remaining / upcoming helpers — run: npx tsx dashboard/src/lib/shop-hours.test.ts
 */
import assert from 'node:assert/strict';
import {
  isChannelOpenAt,
  minutesUntilChannelClose,
  minutesUntilChannelOpen,
  zonedLocalDate,
  type StoreHours,
} from './shop-hours';

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
assert.equal(isChannelOpenAt(hours, 'delivery', closingSoon).open, false);
assert.equal(minutesUntilChannelClose(hours, 'delivery', closingSoon), null);

const beforeOpen = zonedLocalDate(2026, 9, 16, 10, 40);
assert.equal(isChannelOpenAt(hours, 'takeaway', beforeOpen).open, false);
assert.equal(minutesUntilChannelOpen(hours, 'takeaway', beforeOpen), 20);
assert.equal(minutesUntilChannelClose(hours, 'takeaway', beforeOpen), null);

const midday = zonedLocalDate(2026, 9, 16, 14, 0);
assert.equal(minutesUntilChannelClose(hours, 'takeaway', midday), 9 * 60);
assert.equal(minutesUntilChannelOpen(hours, 'takeaway', midday), null);

console.log('shop-hours.test.ts ok');
