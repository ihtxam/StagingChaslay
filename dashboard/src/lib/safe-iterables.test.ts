/**
 * Safe iterable guards — run: npx tsx dashboard/src/lib/safe-iterables.test.ts
 */
import assert from 'node:assert/strict';
import { asArray, asStringArray } from './safe-iterables';

assert.deepEqual(asArray(null), []);
assert.deepEqual(asArray(undefined), []);
assert.deepEqual(asArray(0), []);
assert.deepEqual(asArray('abc'), []);
assert.deepEqual(asArray({ tickets: [1] }), []);
assert.deepEqual(asArray([1, 2]), [1, 2]);
assert.deepEqual(asArray(new Set(['a', 'b'])), ['a', 'b']);

assert.deepEqual(asStringArray(null), []);
assert.deepEqual(asStringArray(undefined), []);
assert.deepEqual(asStringArray(['  #12 ', '', 4]), ['#12', '4']);
assert.deepEqual(asStringArray(new Set(['x'])), ['x']);

console.log('safe-iterables.test.ts OK');
