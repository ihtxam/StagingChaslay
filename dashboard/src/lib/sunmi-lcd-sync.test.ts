import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSunmiLcdLines } from './sunmi-lcd-format';

test('formatSunmiLcdLines shows last item and running total while building', () => {
  const out = formatSunmiLcdLines({
    phase: 'building',
    currency: 'CHF',
    total: 24.5,
    lines: [{ name: 'Espresso', qty: 1 }, { name: 'Croissant', qty: 2 }],
  });
  assert.equal(out.topText, '2x Croissant');
  assert.equal(out.bottomText, 'CHF 24.50');
});

test('formatSunmiLcdLines shows TOTAL on payment phase', () => {
  const out = formatSunmiLcdLines({
    phase: 'payment',
    currency: 'CHF',
    total: 10,
    lines: [{ name: 'Tea', qty: 1 }],
  });
  assert.equal(out.topText, 'TOTAL');
  assert.equal(out.bottomText, 'CHF 10.00');
});
