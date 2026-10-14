/**
 * Addon poll 403 gate — run: npx tsx dashboard/src/lib/addon-poll.test.ts
 */
import assert from 'node:assert/strict';
import {
  createAddonPollGate,
  isAddonForbiddenStatus,
  readAddonLicenseFlag,
  shouldPollLicensedAddon,
} from './addon-poll';

assert.equal(isAddonForbiddenStatus({ response: { status: 403 } }), true);
assert.equal(
  isAddonForbiddenStatus({ response: { status: 400, data: { code: 'KDS_ADDON_REQUIRED' } } }),
  true
);
assert.equal(
  isAddonForbiddenStatus({ response: { status: 400, data: { code: 'ODS_ADDON_REQUIRED' } } }),
  true
);
assert.equal(
  isAddonForbiddenStatus({
    response: { status: 400, data: { code: 'INVENTORY_ADDON_REQUIRED' } },
  }),
  true
);
assert.equal(isAddonForbiddenStatus({ response: { status: 500 } }), false);
assert.equal(isAddonForbiddenStatus(new Error('network')), false);

assert.equal(shouldPollLicensedAddon(true, false), true);
assert.equal(shouldPollLicensedAddon(undefined, false), true);
assert.equal(shouldPollLicensedAddon(false, false), false);
assert.equal(shouldPollLicensedAddon(true, true), false);

assert.equal(readAddonLicenseFlag(undefined, null), undefined);
assert.equal(readAddonLicenseFlag(undefined, false), false);
assert.equal(readAddonLicenseFlag(true, false), true);

const gate = createAddonPollGate();
assert.equal(gate.isStopped(), false);
assert.equal(gate.noteError({ response: { status: 500 } }), false);
assert.equal(gate.isStopped(), false);
assert.equal(gate.noteError({ response: { status: 403 } }), true);
assert.equal(gate.isStopped(), true);
assert.equal(shouldPollLicensedAddon(undefined, gate.isStopped()), false);
gate.reset();
assert.equal(gate.isStopped(), false);

console.log('addon-poll.test.ts OK');
