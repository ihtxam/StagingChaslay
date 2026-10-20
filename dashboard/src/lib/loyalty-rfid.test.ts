/**
 * RFID UID helpers — run: npx tsx dashboard/src/lib/loyalty-rfid.test.ts
 */
import assert from 'node:assert/strict';
import { looksLikeRfidUid, normalizeRfidUid } from './loyalty-math';

assert.equal(normalizeRfidUid('04:a1:b2:c3'), '04A1B2C3');
assert.equal(normalizeRfidUid('04 A1 B2 C3'), '04A1B2C3');
assert.equal(normalizeRfidUid(' 04a1-b2_c3 '), '04A1B2C3');

assert.equal(looksLikeRfidUid('04A1B2C3'), true);
assert.equal(looksLikeRfidUid('04:a1:b2:c3'), true);
assert.equal(looksLikeRfidUid('04 A1 B2 C3 D4'), true);
assert.equal(looksLikeRfidUid('A1B2C3D4E5'), true);
assert.equal(looksLikeRfidUid('0012345678'), true);

assert.equal(looksLikeRfidUid('6420256002131'), false, 'EAN-13 is not RFID');
assert.equal(looksLikeRfidUid('012345678901'), false, 'UPC-A is not RFID');
assert.equal(looksLikeRfidUid('12345678'), false, 'EAN-8-length digits are not RFID');
assert.equal(looksLikeRfidUid('ABC'), false, 'too short');
assert.equal(looksLikeRfidUid('pizza-margherita'), false);

console.log('loyalty-rfid: all assertions passed');
