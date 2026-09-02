/**
 * Staff login home routing — run: npx tsx dashboard/src/lib/auth-home.test.ts
 */
import assert from 'node:assert/strict';
import { homePathForUser } from './auth-home';
import { loginHomeFromPermissions } from './staff-login-home';
import { isRegisterFirstStaff, type Permission } from './permissions';

const CASHIER_PERMS: Permission[] = [
  'USE_WEBPOS',
  'PROCESS_PAYMENTS',
  'TAKEAWAY_ORDERS',
  'VIEW_ORDER_HISTORY',
  'OPEN_CASH_DRAWER',
  'APPLY_DISCOUNTS',
  'END_OF_DAY',
];

const MANAGER_PERMS: Permission[] = [
  'ACCESS_PANEL',
  'USE_WEBPOS',
  'VIEW_ORDER_HISTORY',
  'MANAGE_PRODUCTS',
  'MANAGE_SETTINGS',
  'VIEW_REPORTS',
];

const ORDER_CENTER_PERMS: Permission[] = ['VIEW_ORDER_HISTORY', 'END_OF_DAY'];

// Cashier template → POS login home (not panel because of order history)
{
  assert.equal(loginHomeFromPermissions(CASHIER_PERMS, true), 'pos');
  assert.equal(isRegisterFirstStaff(CASHIER_PERMS, false), true);
}

// Manager with panel access → panel
{
  assert.equal(loginHomeFromPermissions(MANAGER_PERMS, true), 'panel');
  assert.equal(isRegisterFirstStaff(MANAGER_PERMS, false), false);
}

// Order center operator → panel (order center app)
{
  assert.equal(loginHomeFromPermissions(ORDER_CENTER_PERMS, true), 'panel');
  assert.equal(isRegisterFirstStaff(ORDER_CENTER_PERMS, false), false);
}

// Email login routes cashier to WebPOS regardless of stored loginHome=panel
{
  const path = homePathForUser({
    role: 'staff',
    permissions: CASHIER_PERMS,
    isOwner: false,
    loginHome: 'panel',
  });
  assert.equal(path, '/merchant/pos');
}

// Manager staff still lands on merchant dashboard
{
  const path = homePathForUser({
    role: 'staff',
    permissions: MANAGER_PERMS,
    isOwner: false,
    loginHome: 'panel',
  });
  assert.equal(path, '/merchant');
}

console.log('auth-home: all assertions passed');
