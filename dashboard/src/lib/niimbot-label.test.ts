/**
 * Niimbot test-print bitmap must be non-empty so Android Bridge accepts it.
 * run: npx tsx dashboard/src/lib/niimbot-label.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const label = readFileSync(join(root, 'niimbot-label.ts'), 'utf8');
const settings = readFileSync(join(root, '../pages/merchant/Settings.tsx'), 'utf8');
const protocol = readFileSync(join(root, 'label-print-protocol.ts'), 'utf8');
const android = join(root, '../../../print-agent-android/app/src/main/java/com/rebornsense/printbridge');
const bridge = readFileSync(join(android, 'http/BridgeHttpServer.kt'), 'utf8');
const main = readFileSync(join(android, 'MainActivity.kt'), 'utf8');
const client = readFileSync(join(android, 'print/NiimbotPrintClient.kt'), 'utf8');

assert.match(label, /export function buildNiimbotTestPatternBitmap/);
assert.match(label, /0355:/);
assert.match(settings, /niimbotTestPatternBase64/);
assert.doesNotMatch(settings, /bitmapBase64: ''/);
assert.match(protocol, /0355:/);
assert.match(bridge, /optBoolean\("testPattern"/);
assert.doesNotMatch(bridge, /bitmapBase64, widthPx, heightPx required/);
assert.match(main, /performNiimbotTestPrint/);
assert.match(main, /isNiimbotEndpoint/);
assert.match(client, /fun buildTestPatternBitmap/);
assert.match(client, /0x0355/);

console.log('niimbot-label.test.ts OK');
