/**
 * Run: cd dashboard && npx tsx src/lib/webpos-receipt-thermal-tweaks.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const receiptSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'webpos-receipt.ts'),
  'utf8'
);
assert.match(receiptSrc, /receiptUsesKioskThermalEscPosTweaks/);
assert.match(receiptSrc, /isDesktopApp\(\)/);
assert.match(
  receiptSrc,
  /headerLines\.length > 0 && receiptUsesKioskThermalEscPosTweaks\(\)/
);

console.log('webpos-receipt-thermal-tweaks.test.ts: ok');
