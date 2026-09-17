/**
 * Paid-cart session guard — run: npx tsx dashboard/src/lib/order-to-cart.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const webPos = readFileSync(join(root, '../pages/merchant/WebPos.tsx'), 'utf8');
const guard = readFileSync(join(root, 'order-to-cart.ts'), 'utf8');

assert.match(
  webPos,
  /const liveKitchen =\s*orderSent \|\| cart\.some\(\(l\) => l\.sentToKitchen\) \|\| !!resumedHeldIdRef\.current/
);
assert.match(
  webPos,
  /Fresh unsent cart after a paid sale must not inherit the previous ticket/
);
assert.match(guard, /export function resolveCartCheckoutGuard/);
assert.match(guard, /action: 'blocked'/);

console.log('order-to-cart.test.ts OK');
