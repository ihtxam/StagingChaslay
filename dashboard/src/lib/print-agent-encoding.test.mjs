import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, 'print-agent.ts'), 'utf8');
assert.match(src, /receiptEscPosTextEncodingForPrinter/);
assert.match(src, /sunmi-internal/);
assert.match(src, /return 'cp850'/);
console.log('print-agent-encoding.test.mjs ok');
