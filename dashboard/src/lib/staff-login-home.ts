export type StaffLoginHome = 'auto' | 'panel' | 'pos';

export function normalizeStaffLoginHome(raw: unknown): StaffLoginHome {
  if (raw === 'panel' || raw === 'pos') return raw;
  return 'auto';
}

function hasRegisterAccess(permissions: string[]): boolean {
  return permissions.includes('USE_WEBPOS') || permissions.includes('MANAGE_TABLES');
}

function hasBackendPanelPermissions(permissions: string[]): boolean {
  return (
    permissions.includes('ACCESS_PANEL') ||
    permissions.includes('MANAGE_PRODUCTS') ||
    permissions.includes('MANAGE_INVENTORY')
  );
}

function hasOrderCenterPanelAccess(permissions: string[]): boolean {
  return permissions.includes('VIEW_ORDER_HISTORY') && !hasRegisterAccess(permissions);
}

export function loginHomeFromPermissions(
  permissions: string[],
  _canAccessPanel: boolean
): StaffLoginHome {
  const hasPos = hasRegisterAccess(permissions);
  if (hasPos && !hasBackendPanelPermissions(permissions)) return 'pos';
  if (hasBackendPanelPermissions(permissions)) return 'panel';
  if (hasOrderCenterPanelAccess(permissions)) return 'panel';
  if (permissions.includes('STOREKEEPER_INTAKE') || permissions.includes('DELIVERY_ORDERS')) {
    return 'pos';
  }
  if (permissions.includes('MANAGE_KIOSK')) return 'panel';
  return hasPos ? 'pos' : 'panel';
}
