/**
 * Held ticket search — run: npx tsx dashboard/src/lib/webpos-held.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ticketQueryMatches } from './webpos-ticket-search.ts';

test('partial numeric query matches kitchen ticket numbers', () => {
  assert.equal(ticketQueryMatches('39', '#3929'), true);
  assert.equal(ticketQueryMatches('392', '3929'), true);
  assert.equal(ticketQueryMatches('3929', '#3929'), true);
});

test('exact numeric query still matches', () => {
  assert.equal(ticketQueryMatches('1001', 'D-1001'), true);
  assert.equal(ticketQueryMatches('5126', '#5126'), true);
});

test('non-matching numeric fragments do not match unrelated tickets', () => {
  assert.equal(ticketQueryMatches('99', '#3929'), false);
});

test('text query matches labels', () => {
  assert.equal(ticketQueryMatches('poco', 'Poco Loco · #3929'), true);
});
