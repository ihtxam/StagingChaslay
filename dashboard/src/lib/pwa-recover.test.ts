import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRebornBuildStamp } from './pwa-recover.ts';

test('parseRebornBuildStamp reads name-then-content meta', () => {
  assert.equal(
    parseRebornBuildStamp('<meta name="reborn-build" content="2026-10-12T18:00:00" />'),
    '2026-10-12T18:00:00'
  );
});

test('parseRebornBuildStamp reads reversed attribute order', () => {
  assert.equal(
    parseRebornBuildStamp('<meta content="abc123" name="reborn-build">'),
    'abc123'
  );
});

test('parseRebornBuildStamp returns null when missing', () => {
  assert.equal(parseRebornBuildStamp('<html><head></head></html>'), null);
});
