/**
 * Panel access regression tests — run: npx tsx dashboard/src/lib/permissions.panel-access.test.ts
 */
import assert from 'node:assert/strict';
import {
  getEffectivePanelAccess,
  type Permission,
  type WebPosStaffSession,
} from './permissions';

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

const cashierPin: WebPosStaffSession = {
  id: 'cashier-1',
  name: 'Cashier',
  roleId: 'role-cashier',
  roleName: 'Cashier',
  permissions: CASHIER_PERMS,
};

const managerPin: WebPosStaffSession = {
  id: 'mgr-1',
  name: 'Manager',
  roleId: 'role-mgr',
  roleName: 'Manager',
  permissions: MANAGER_PERMS,
};

// Owner JWT + cashier PIN on POS floor → restricted
{
  const access = getEffectivePanelAccess({
    jwtPermissions: MANAGER_PERMS,
    isOwner: true,
    authRole: 'merchant',
    hasStaffPins: true,
    pinSession: cashierPin,
    pathname: '/merchant/pos',
  });
  assert.equal(access.isOwner, false);
  assert.equal(access.canOpenPanel, false);
  assert.equal(access.canOpenOrders, true);
  assert.equal(access.canOpenCatalog, false);
  assert.equal(access.pinActive, true);
}

// Owner JWT + cashier PIN in back office → still restricted (main bug fix)
{
  const access = getEffectivePanelAccess({
    jwtPermissions: MANAGER_PERMS,
    isOwner: true,
    authRole: 'merchant',
    hasStaffPins: true,
    pinSession: cashierPin,
    pathname: '/merchant/customers',
  });
  assert.equal(access.isOwner, false);
  assert.equal(access.canOpenPanel, false);
  assert.equal(access.canOpenCatalog, false);
  assert.equal(access.canOpenOrders, true);
  assert.equal(access.pinActive, true);
}

// Manager staff JWT + manager PIN off POS floor → full panel restored
{
  const access = getEffectivePanelAccess({
    jwtPermissions: MANAGER_PERMS,
    isOwner: false,
    authRole: 'staff',
    hasStaffPins: true,
    pinSession: managerPin,
    pathname: '/merchant/products',
  });
  assert.equal(access.isOwner, false);
  assert.equal(access.canOpenPanel, true);
  assert.equal(access.canOpenCatalog, true);
  assert.equal(access.pinActive, true);
}

// Manager staff JWT + cashier PIN off POS floor → cashier scope only
{
  const access = getEffectivePanelAccess({
    jwtPermissions: MANAGER_PERMS,
    isOwner: false,
    authRole: 'staff',
    hasStaffPins: true,
    pinSession: cashierPin,
    pathname: '/merchant/settings',
  });
  assert.equal(access.canOpenPanel, false);
  assert.equal(access.canOpenCatalog, false);
  assert.equal(access.canOpenOrders, true);
}

// No PIN session → owner has full access
{
  const access = getEffectivePanelAccess({
    jwtPermissions: MANAGER_PERMS,
    isOwner: true,
    authRole: 'merchant',
    hasStaffPins: true,
    pinSession: null,
    pathname: '/merchant',
  });
  assert.equal(access.isOwner, true);
  assert.equal(access.canOpenPanel, true);
}

console.log('permissions.panel-access: all assertions passed');
