import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(
  join(root, 'app/src/main/java/com/rebornsense/printbridge/print/BluetoothEscPosDriver.kt'),
  'utf8'
);

assert.match(src, /Mirror Windows Split-CutSuffix/);
assert.doesNotMatch(src, /splitCutSuffix\(data\)[\s\S]*0x64\.toByte\(\)/);
assert.match(src, /0x1B, 0x64, 0x05/);
assert.match(src, /val cutBytes = if \(cutSuffix\.isNotEmpty\(\)\)/);
assert.doesNotMatch(src, /stripTrailingFeedAndCut/);

console.log('bluetooth-cut-suffix.test.mjs: ok');
