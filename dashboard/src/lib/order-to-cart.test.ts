/**
 * Paid-cart session guard — run: npx tsx dashboard/src/lib/order-to-cart.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const webPos = readFileSync(join(root, '../pages/merchant/WebPos.tsx'), 'utf8');
const ordersPanel = readFileSync(join(root, '../components/WebPosOrdersPanel.tsx'), 'utf8');
const guard = readFileSync(join(root, 'order-to-cart.ts'), 'utf8');

assert.match(
  webPos,
  /const liveKitchen =\s*orderSent \|\| cart\.some\(\(l\) => l\.sentToKitchen\) \|\| !!resumedHeldIdRef\.current/
);
assert.match(
  webPos,
  /Fresh unsent cart after a paid sale must not inherit the previous ticket/
);
assert.match(webPos, /if \(isPaidOrder\(order\)\)/);
assert.match(ordersPanel, /!isPaidOrder\(o\) && isAwaitingPaymentOrder\(o\)/);
assert.match(ordersPanel, /function findPaidOrderForHeldRow/);
assert.match(ordersPanel, /findPaidOrderForHeldRow\(h, ordersForList\)/);
assert.match(guard, /export function resolveCartCheckoutGuard/);
assert.match(guard, /action: 'blocked'/);
assert.match(guard, /export function findPaidOrderForCartLink/);

console.log('order-to-cart.test.ts OK');
