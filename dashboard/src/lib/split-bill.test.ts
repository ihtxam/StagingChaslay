/**
 * Split bill guards — run: npx tsx dashboard/src/lib/split-bill.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const webPos = readFileSync(join(root, '../pages/merchant/WebPos.tsx'), 'utf8');
const splitBill = readFileSync(join(root, 'split-bill.ts'), 'utf8');
const syncService = readFileSync(
  join(root, '../../../backend/src/services/sync.service.ts'),
  'utf8'
);
const checkoutView = readFileSync(
  join(root, '../components/webpos/WebPosCheckoutView.tsx'),
  'utf8'
);

assert.match(splitBill, /export function removePaidSplitLines/);
assert.match(webPos, /Prefer frozen per-part snapshot — cart mutates after each partial payment/);
assert.match(webPos, /if \(index > splitIndex\) return;/);
assert.match(
  syncService,
  /Split-bill parts share one kitchen ticket — sibling checks must not block the final part/
);
assert.match(
  syncService,
  /splitBillFullyPaid\(sale\) &&\s*\n\s*!String\(sale\.masterOrderId/
);
assert.match(checkoutView, /ticket\.index > splitActiveIndex/);

console.log('split-bill.test.ts OK');
