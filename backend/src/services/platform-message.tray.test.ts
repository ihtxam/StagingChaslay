import assert from 'node:assert/strict';
import { buildNotificationTray, filterMessagesForViewer } from './platform-message.service';

const visible = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const dismissed = new Set(['b']);

const tray = buildNotificationTray(visible, dismissed, 2);
assert.equal(tray.length, 2);
assert.deepEqual(
  tray.map((row) => ({ id: row.id, unread: row.unread })),
  [
    { id: 'a', unread: true },
    { id: 'b', unread: false },
  ]
);

const empty = buildNotificationTray([], new Set(), 20);
assert.deepEqual(empty, []);

const mixed = [
  { id: 'a', kind: 'announcement' },
  { id: 't', kind: 'support_reply' },
];
assert.deepEqual(
  filterMessagesForViewer(mixed, { canSeeSupport: false }).map((m) => m.id),
  ['a']
);
assert.deepEqual(
  filterMessagesForViewer(mixed, { canSeeSupport: true }).map((m) => m.id),
  ['a', 't']
);

console.log('platform-message.tray.test.ts: ok');
