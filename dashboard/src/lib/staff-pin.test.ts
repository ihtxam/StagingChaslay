/**
 * npx tsx dashboard/src/lib/staff-pin.test.ts
 */
import assert from 'node:assert/strict';
import { isValidStaffPin, sanitizeStaffPinInput, STAFF_PIN_LENGTH } from './staff-pin';

assert.equal(STAFF_PIN_LENGTH, 4);
assert.equal(sanitizeStaffPinInput('12345678'), '1234');
assert.equal(isValidStaffPin('0000'), true);
assert.equal(isValidStaffPin('12345'), false);

console.log('staff-pin: all assertions passed');
