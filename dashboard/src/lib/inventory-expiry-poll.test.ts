/**
 * Inventory expiry 403 gate — run: npx tsx dashboard/src/lib/inventory-expiry-poll.test.ts
 */
import assert from 'node:assert/strict';
import { createAddonPollGate, isAddonForbiddenStatus } from './addon-poll';
import {
  EMPTY_EXPIRING_SOON,
  isInventoryAddonRequired,
  loadExpiringSoonIfLicensed,
} from './inventory-expiry-poll';

assert.equal(isAddonForbiddenStatus({ response: { status: 403 } }), true);
assert.equal(
  isAddonForbiddenStatus({
    response: { status: 400, data: { code: 'INVENTORY_ADDON_REQUIRED' } },
  }),
  true
);
assert.equal(isInventoryAddonRequired({ response: { status: 403 } }), true);
assert.equal(
  isInventoryAddonRequired({ data: { code: 'INVENTORY_ADDON_REQUIRED' } }),
  true
);
assert.equal(isInventoryAddonRequired({ response: { status: 401 } }), false);
assert.equal(isInventoryAddonRequired({ response: { status: 500 } }), false);

const skipped = await loadExpiringSoonIfLicensed({
  licensed: false,
  stopped: false,
  get: async () => {
    throw new Error('must not poll when unlicensed');
  },
});
assert.deepEqual(skipped, { payload: EMPTY_EXPIRING_SOON, unlicensed: true });

const stopped = await loadExpiringSoonIfLicensed({
  licensed: true,
  stopped: true,
  get: async () => {
    throw new Error('must not poll when gate stopped');
  },
});
assert.deepEqual(stopped, { payload: EMPTY_EXPIRING_SOON, unlicensed: true });

const forbidden = await loadExpiringSoonIfLicensed({
  licensed: undefined,
  stopped: false,
  get: async () => {
    const err = { response: { status: 403, data: { code: 'INVENTORY_ADDON_REQUIRED' } } };
    throw err;
  },
});
assert.equal(forbidden.unlicensed, true);
assert.deepEqual(forbidden.payload, EMPTY_EXPIRING_SOON);
assert.equal(forbidden.error, undefined);

const statusForbidden = await loadExpiringSoonIfLicensed({
  licensed: true,
  stopped: false,
  get: async () => ({ status: 403, data: { code: 'INVENTORY_ADDON_REQUIRED' } }),
});
assert.equal(statusForbidden.unlicensed, true);
assert.deepEqual(statusForbidden.payload, EMPTY_EXPIRING_SOON);

const authError = await loadExpiringSoonIfLicensed({
  licensed: true,
  stopped: false,
  get: async () => {
    throw { response: { status: 401 } };
  },
});
assert.equal(authError.unlicensed, false);
assert.ok(authError.error);

const serverError = await loadExpiringSoonIfLicensed({
  licensed: true,
  stopped: false,
  get: async () => ({ status: 500, data: { error: 'boom' } }),
});
assert.equal(serverError.unlicensed, false);
assert.ok(serverError.error);

const ok = await loadExpiringSoonIfLicensed({
  licensed: true,
  stopped: false,
  get: async () => ({
    status: 200,
    data: { leadDays: 14, lots: [{ id: 'lot-1' }] },
  }),
});
assert.equal(ok.unlicensed, false);
assert.deepEqual(ok.payload, { leadDays: 14, lots: [{ id: 'lot-1' }] });

const gate = createAddonPollGate();
assert.equal(gate.noteError({ response: { status: 401 } }), false);
assert.equal(gate.isStopped(), false);
assert.equal(gate.noteError({ response: { status: 403 } }), true);
assert.equal(gate.isStopped(), true);

console.log('inventory-expiry-poll.test.ts OK');
