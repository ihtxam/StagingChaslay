import assert from 'node:assert/strict';
import { maskGiftCardNumberForReceipt } from './gift-card-receipt-mask';

assert.equal(maskGiftCardNumberForReceipt('1234567890123'), '********90123');
assert.equal(maskGiftCardNumberForReceipt('123456'), '**3456');
assert.equal(maskGiftCardNumberForReceipt('  AB 12 34 5678 '), '*****45678');
assert.equal(maskGiftCardNumberForReceipt(''), null);

console.log('gift-card-receipt-mask.test.ts ok');
