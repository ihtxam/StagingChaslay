import assert from 'node:assert/strict';

/** Mirrors PlatformMessagesProvider.buildModalTray for unit coverage. */
function buildModalTray<T extends { id: string; kind: string; unread?: boolean }>(
  tray: Array<T & { unread: boolean }>,
  whatsNew: T[],
  messages: T[]
): Array<T & { unread: boolean }> {
  if (tray.length) return tray;
  const merged = [...whatsNew, ...messages.filter((m) => m.kind === 'incident')];
  const seen = new Set<string>();
  return merged
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .map((m) => ({ ...m, unread: true }));
}

const fromApi = [
  { id: '1', kind: 'announcement', unread: false },
  { id: '2', kind: 'whats_new', unread: true },
];
assert.equal(buildModalTray(fromApi, [], []).length, 2);
assert.equal(buildModalTray(fromApi, [], [])[0]!.unread, false);
assert.equal(buildModalTray(fromApi, [], [])[1]!.unread, true);

const fallback = buildModalTray(
  [],
  [{ id: 'a', kind: 'announcement' }],
  [
    { id: 'a', kind: 'announcement' },
    { id: 'i', kind: 'incident' },
  ]
);
assert.deepEqual(
  fallback.map((m) => m.id),
  ['a', 'i']
);
assert.ok(fallback.every((m) => m.unread));

assert.deepEqual(buildModalTray([], [], []), []);

console.log('platform-notifications-tray.test.ts: ok');
