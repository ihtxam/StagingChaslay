import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, 'print-agent.ts'), 'utf8');
assert.match(src, /healStaleReceiptPrinterProfiles/);
assert.match(src, /localStorage\.setItem\(WEBPOS_PRINTER_STORAGE_KEY, fallback\)/);
console.log('print-agent-stale-printer.test.mjs ok');
