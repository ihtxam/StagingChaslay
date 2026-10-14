/**
 * Run: npx tsx dashboard/src/lib/catering-addon.test.ts
 */
import assert from 'node:assert/strict';
import { isCateringLicensed } from './catering-addon';

assert.equal(isCateringLicensed(null), false);
assert.equal(isCateringLicensed({}), false);
assert.equal(isCateringLicensed({ cateringEnabled: false }), false);
assert.equal(isCateringLicensed({ cateringAddonEnabled: false }), false);
assert.equal(isCateringLicensed({ cateringEnabled: true }), true);
assert.equal(isCateringLicensed({ cateringAddonEnabled: true }), true);

console.log('catering-addon.test.ts: ok');
