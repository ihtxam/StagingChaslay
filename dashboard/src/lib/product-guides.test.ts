import assert from 'node:assert/strict';
import { searchGuideChapters } from './product-guides.ts';

const firstDay = searchGuideChapters('merchant', 'first day');
assert.ok(firstDay.length >= 1, 'merchant guides should match first-day search');

const empty = searchGuideChapters('merchant', '   ');
assert.deepEqual(empty, []);

const none = searchGuideChapters('merchant', 'zzzz-no-such-guide-term');
assert.deepEqual(none, []);

const agency = searchGuideChapters('reseller', 'price book');
assert.ok(agency.length >= 1, 'reseller guides should match price book');

console.log('product-guides.test.ts: ok');
