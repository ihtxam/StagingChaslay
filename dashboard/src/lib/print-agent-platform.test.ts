/**
 * Desktop download URLs must point at RebornPOS, not Print Agent 1.10.6.
 * Run: npx tsx dashboard/src/lib/print-agent-platform.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'print-agent-platform.ts'),
  'utf8'
);

assert.match(src, /REBORN_POS_SETUP_FILE = 'reborn-pos-setup\.exe'/);
assert.match(src, /REBORN_POS_MANIFEST = 'reborn-pos-setup\.json'/);
assert.match(src, /export function rebornPosDownloadUrl/);
assert.match(src, /export async function fetchRebornPosManifest/);
assert.equal(src.includes('reborn-print-agent-setup.exe'), true);
assert.match(src, /downloads\/\$\{REBORN_POS_SETUP_FILE\}/);

const settings = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../pages/merchant/Settings.tsx'),
  'utf8'
);
assert.match(settings, /desktopAppDownload/);
assert.match(settings, /reborn-pos-setup\.exe/);
assert.match(settings, /printAgentOptionalTitle/);

console.log('print-agent-platform.test.ts: ok');
