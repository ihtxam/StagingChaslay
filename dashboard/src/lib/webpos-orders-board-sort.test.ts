/**
 * POS Commandes card-grid sort — run: npx tsx dashboard/src/lib/webpos-orders-board-sort.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  comparePosBoardNewestFirst,
  posBoardItemTimeMs,
  sortPosBoardNewestFirst,
  toPosBoardTimeMs,
} from './webpos-orders-board-sort.ts';

test('toPosBoardTimeMs parses ISO and rejects empty', () => {
  assert.equal(toPosBoardTimeMs('2026-10-12T12:00:00.000Z'), Date.parse('2026-10-12T12:00:00.000Z'));
  assert.equal(toPosBoardTimeMs(null), 0);
  assert.equal(toPosBoardTimeMs(''), 0);
});

test('posBoardItemTimeMs prefers createdAt over updated/completed', () => {
  const now = Date.parse('2026-10-12T18:00:00.000Z');
  const ms = posBoardItemTimeMs(
    {
      createdAt: '2026-10-12T10:00:00.000Z',
      updatedAt: '2026-10-12T17:00:00.000Z',
      completedAt: '2026-10-12T17:30:00.000Z',
    },
    now
  );
  assert.equal(ms, Date.parse('2026-10-12T10:00:00.000Z'));
});

test('posBoardItemTimeMs falls back then treats missing as now (newest)', () => {
  const now = Date.parse('2026-10-12T18:00:00.000Z');
  assert.equal(
    posBoardItemTimeMs({ updatedAt: '2026-10-12T11:00:00.000Z' }, now),
    Date.parse('2026-10-12T11:00:00.000Z')
  );
  assert.equal(posBoardItemTimeMs({}, now), now);
});

test('sortPosBoardNewestFirst puts latest createdAt first (top-left)', () => {
  const now = Date.parse('2026-10-12T18:00:00.000Z');
  const sorted = sortPosBoardNewestFirst(
    [
      { id: 'old', createdAt: '2026-09-09T10:00:00.000Z' },
      { id: 'mid', createdAt: '2026-10-12T17:22:00.000Z' },
      { id: 'latest', createdAt: '2026-10-12T17:50:00.000Z' },
      { id: 'local-new' },
    ],
    now
  );
  assert.deepEqual(
    sorted.map((row) => row.id),
    ['local-new', 'latest', 'mid', 'old']
  );
});

test('comparePosBoardNewestFirst is newest-minus-older', () => {
  const now = Date.parse('2026-10-12T18:00:00.000Z');
  const newer = { createdAt: '2026-10-12T17:00:00.000Z' };
  const older = { createdAt: '2026-10-01T17:00:00.000Z' };
  assert.ok(comparePosBoardNewestFirst(newer, older, now) < 0);
  assert.ok(comparePosBoardNewestFirst(older, newer, now) > 0);
});
