/**
 * ODS status payload guards — run: npx tsx dashboard/src/lib/ods-push.test.ts
 */
import assert from 'node:assert/strict';
import { parseOdsStatusPayload } from './ods-status-parse';

assert.deepEqual(parseOdsStatusPayload(null), {
  licensed: false,
  preparing: [],
  ready: [],
});
assert.deepEqual(parseOdsStatusPayload({ licensed: true, preparing: null, ready: 'nope' }), {
  licensed: true,
  preparing: [],
  ready: [],
});
assert.deepEqual(
  parseOdsStatusPayload({ licensed: true, preparing: [' #7 ', ''], ready: [12] }),
  { licensed: true, preparing: ['#7'], ready: ['12'] }
);

console.log('ods-push.test.ts OK');
