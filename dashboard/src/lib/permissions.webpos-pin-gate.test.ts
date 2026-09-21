/**
 * WebPOS PIN gate after email login — run: cd dashboard && npx tsx src/lib/permissions.webpos-pin-gate.test.ts
 */
import assert from 'node:assert/strict';
import {
  resolveWebPosStaffSession,
  webPosPinGateRequired,
  type StaffRosterRow,
} from './permissions';

const staffRow: StaffRosterRow = {
  id: 'staff-1',
  name: 'Cashier',
  roleId: 'role-1',
  roleName: 'Cashier',
  permissions: ['USE_WEBPOS'],
  isActive: true,
};

// Staff email login must not auto-bind a PIN session.
{
  const session = resolveWebPosStaffSession({ staffList: [staffRow] });
  assert.equal(session, null);
}

// PIN gate applies whenever staff PINs exist and no PIN session is active.
{
  assert.equal(
    webPosPinGateRequired({ hasStaffPins: true, pinSession: null }),
    true
  );
  assert.equal(
    webPosPinGateRequired({
      hasStaffPins: true,
      pinSession: {
        id: 'staff-1',
        name: 'Cashier',
        roleId: 'role-1',
        roleName: 'Cashier',
        permissions: ['USE_WEBPOS'],
      },
    }),
    false
  );
  assert.equal(
    webPosPinGateRequired({ hasStaffPins: false, pinSession: null }),
    false
  );
}

console.log('permissions.webpos-pin-gate: all assertions passed');
