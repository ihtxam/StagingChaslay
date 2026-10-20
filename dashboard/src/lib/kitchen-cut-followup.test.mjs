/**
 * Run: node dashboard/src/lib/kitchen-cut-followup.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'print-agent.ts'), 'utf8');

assert.match(src, /export function shouldSendKitchenCutFollowUp/);
assert.match(src, /if \(!isBt\) return false/);
assert.match(src, /return !agentSupportsBtCutTrailer\(health\)/);

const relay = readFileSync(join(__dirname, 'webpos-print-relay.ts'), 'utf8');
assert.match(relay, /shouldSendKitchenCutFollowUp/);
assert.doesNotMatch(relay, /USB\/network and legacy BT: separate cut job/);

console.log('kitchen-cut-followup.test.mjs ok');
