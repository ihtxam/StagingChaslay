/**
 * Display of WEB order numbers — run: npx tsx dashboard/src/lib/order-number.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatOrderNumberDisplay, guestOrderNumber } from './order-number.ts';

test('keeps scoped WEB-CODE-SEQ in full (does not drop merchant code)', () => {
  assert.equal(formatOrderNumberDisplay('WEB-AB12-2954'), 'WEB-AB12-2954');
  assert.equal(formatOrderNumberDisplay('WEB-2954'), 'WEB-2954');
});

test('legacy timestamp WEB numbers use last 8 digits, not 4', () => {
  assert.equal(formatOrderNumberDisplay('WEB-1712345678901'), 'WEB-' + '1712345678901'.slice(-8));
  assert.equal(formatOrderNumberDisplay('WEB-17123456789012'), 'WEB-' + '17123456789012'.slice(-8));
});

test('legacy WEB with hex suffix keeps suffix', () => {
  assert.equal(formatOrderNumberDisplay('WEB-1712345678901-A1B2'), 'WEB-A1B2');
});

test('guestOrderNumber prefers full WEB/TX over 4-digit shout', () => {
  assert.equal(
    guestOrderNumber({ orderNumber: 'WEB-AB12-2954', orderDisplay: '#2954' }),
    'WEB-AB12-2954'
  );
  assert.equal(guestOrderNumber({ orderNumber: 'TX-1001', orderDisplay: '#1001' }), 'TX-1001');
});
