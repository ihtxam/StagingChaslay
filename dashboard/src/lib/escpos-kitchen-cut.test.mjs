import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, 'webpos-receipt.ts'), 'utf8');
assert.match(src, /export function escposKitchenCut\(\): Uint8Array \{[\s\S]*0x1b, 0x40/);
assert.match(src, /const KITCHEN_TICKET_CUT[\s\S]*0x1d, 0x56, 0x00/);

console.log('escpos-kitchen-cut.test.mjs ok');
