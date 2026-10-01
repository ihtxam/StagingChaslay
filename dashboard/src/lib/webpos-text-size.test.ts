/**
 * WebPOS menu text size helpers — run: npx tsx dashboard/src/lib/webpos-text-size.test.ts
 */
import assert from 'node:assert/strict';
import {
  WEBPOS_TEXT_SIZES,
  cycleWebPosTextSize,
  webPosTextSizeRootPercent,
} from './webpos-appearance';

assert.deepEqual(WEBPOS_TEXT_SIZES, ['sm', 'md', 'lg', 'xl']);

assert.equal(cycleWebPosTextSize('md', -1), 'sm');
assert.equal(cycleWebPosTextSize('md', 1), 'lg');
assert.equal(cycleWebPosTextSize('sm', -1), 'sm');
assert.equal(cycleWebPosTextSize('xl', 1), 'xl');

assert.equal(webPosTextSizeRootPercent('md'), 100);
assert.equal(webPosTextSizeRootPercent('lg'), 112);

console.log('webpos-text-size.test.ts: ok');
