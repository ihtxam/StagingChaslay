/**
 * Run: cd dashboard && npx tsx src/lib/terminal-checkout-extras.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyTerminalTipToCheckoutExtras,
  normalizePosCheckoutExtras,
} from './terminal-checkout-extras.ts';

const base = applyTerminalTipToCheckoutExtras(
  { method: 'terminal', total: 50, tipAmount: 0, roundingAmount: 0 },
  { basePayable: 50, capture: { tipAmount: 5, authorizedAmount: 55 } }
);
assert.ok(base);
assert.equal(base!.total, 55);
assert.equal(base!.tipAmount, 5);
assert.equal(base!.tenders?.[0]?.amount, 55);

const fromAuth = applyTerminalTipToCheckoutExtras(null, {
  basePayable: 20,
  capture: { authorizedAmount: 24 },
});
assert.equal(fromAuth!.tipAmount, 4);
assert.equal(fromAuth!.total, 24);

const webposTip = normalizePosCheckoutExtras(
  {
    method: 'card',
    tipAmount: 3,
    roundingAmount: 0,
    total: 23,
    amountTendered: null,
  },
  'card'
);
assert.equal(webposTip.tenders?.[0]?.amount, 23);
assert.equal(webposTip.tipAmount, 3);
assert.equal(webposTip.amountTendered, 23);

console.log('terminal-checkout-extras.test.ts OK');
