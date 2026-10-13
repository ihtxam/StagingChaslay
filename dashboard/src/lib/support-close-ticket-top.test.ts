/**
 * Merchant support: Close ticket sits in the ticket header, not under the reply box.
 * run: npx tsx dashboard/src/lib/support-close-ticket-top.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const support = readFileSync(join(root, '../pages/merchant/Support.tsx'), 'utf8');

const header = support.indexOf('flex items-start justify-between gap-3 border-b');
const close = support.indexOf("t('supportCloseTicket')");
const reply = support.indexOf("t('supportTypeReply')");

assert.ok(header >= 0, 'ticket header must be a top-right flex row');
assert.ok(close >= 0, 'close ticket control must exist');
assert.ok(reply > close, 'close ticket must appear before the reply field');
assert.equal(support.split("t('supportCloseTicket')").length - 1, 1, 'close ticket only once');

console.log('support-close-ticket-top.test.ts OK');
