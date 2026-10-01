/**
 * HID scale wedge parsing — run: npx tsx dashboard/src/lib/scale-wedge.test.ts
 */
import assert from 'node:assert/strict';
import {
  looksLikeScaleWedgePayload,
  parseScaleWedgePayload,
} from './scale-wedge';

assert.equal(parseScaleWedgePayload('6420256002131'), null);

assert.deepEqual(parseScaleWedgePayload('1.250'), {
  weightKg: 1.25,
  displayUnit: 'kg',
});

assert.deepEqual(parseScaleWedgePayload('1,250'), {
  weightKg: 1.25,
  displayUnit: 'kg',
});

assert.deepEqual(parseScaleWedgePayload('1250'), {
  weightKg: 1.25,
  displayUnit: 'g',
});

assert.deepEqual(parseScaleWedgePayload('1250g'), {
  weightKg: 1.25,
  displayUnit: 'g',
});

assert.deepEqual(parseScaleWedgePayload('0.350kg'), {
  weightKg: 0.35,
  displayUnit: 'kg',
});

assert.deepEqual(parseScaleWedgePayload('W:0.512'), {
  weightKg: 0.512,
  displayUnit: 'kg',
});

assert.deepEqual(parseScaleWedgePayload('ST,GS,1.234,kg'), {
  weightKg: 1.234,
  displayUnit: 'kg',
});

assert.deepEqual(parseScaleWedgePayload('15'), {
  weightKg: 15,
  displayUnit: 'kg',
});

assert.equal(looksLikeScaleWedgePayload('2.500\r'), true);
assert.equal(looksLikeScaleWedgePayload('7601234567890'), false);

console.log('scale-wedge.test.ts OK');
