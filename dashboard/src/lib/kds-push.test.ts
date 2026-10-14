/**
 * KDS board payload guards — run: npx tsx dashboard/src/lib/kds-push.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildKdsReadyMap,
  collectReadyLineIds,
  matchBoardTickets,
  parseKdsBoardPayload,
} from './kds-board-parse';

assert.deepEqual(parseKdsBoardPayload(null), []);
assert.deepEqual(parseKdsBoardPayload(undefined), []);
assert.deepEqual(parseKdsBoardPayload({}), []);
assert.deepEqual(parseKdsBoardPayload({ tickets: null }), []);
assert.deepEqual(parseKdsBoardPayload({ tickets: { not: 'array' } }), []);

const parsed = parseKdsBoardPayload({
  tickets: [
    { ticketKey: '#12', status: 'pending', readyLineIds: null, total: 2, ready: 1 },
    { ticket_key: '#13', status: 'completed', ready_line_ids: ['a', 'b'] },
    { status: 'pending' },
  ],
});
assert.equal(parsed.length, 2);
assert.deepEqual(parsed[0].readyLineIds, []);
assert.deepEqual(parsed[1].readyLineIds, ['a', 'b']);

const map = buildKdsReadyMap(null);
assert.equal(map.size, 0);
assert.doesNotThrow(() => buildKdsReadyMap(undefined));
assert.doesNotThrow(() => {
  for (const ticket of buildKdsReadyMap({} as never).values()) {
    void ticket;
  }
});

const ready = collectReadyLineIds(null);
assert.equal(ready.size, 0);
assert.equal(
  collectReadyLineIds([{ ticketKey: '#1', status: 'pending', readyLineIds: null as never, total: 1, ready: 0 }])
    .size,
  0
);

assert.deepEqual(matchBoardTickets(null, ['#12']), []);
assert.deepEqual(matchBoardTickets(parsed, null), []);
assert.equal(matchBoardTickets(parsed, ['#12']).length, 1);

console.log('kds-push.test.ts OK');
