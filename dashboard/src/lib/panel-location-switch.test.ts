import { describe, expect, it } from 'vitest';
import {
  canSwitchPanelLocationFromUser,
  effectiveCanSwitchPanelLocation,
} from '@/lib/panel-location-switch';

describe('canSwitchPanelLocationFromUser', () => {
  it('allows owners and manager roles', () => {
    expect(
      canSwitchPanelLocationFromUser({ role: 'merchant', isOwner: true, name: 'x', email: 'a', id: '1' })
    ).toBe(true);
    expect(
      canSwitchPanelLocationFromUser({
        role: 'staff',
        roleName: 'Manager',
        name: 'x',
        email: 'a',
        id: '1',
      })
    ).toBe(true);
  });

  it('owner JWT stays locked when a waiter PIN is active', () => {
    expect(
      effectiveCanSwitchPanelLocation({
        jwtUser: { role: 'merchant', isOwner: true },
        pinRoleName: 'Waiter',
        pinPermissions: ['USE_WEBPOS', 'VIEW_ORDER_HISTORY'],
        pinActive: true,
      })
    ).toBe(false);
    expect(
      effectiveCanSwitchPanelLocation({
        jwtUser: { role: 'merchant', isOwner: true },
        pinRoleName: 'Manager',
        pinPermissions: ['ACCESS_PANEL', 'USE_WEBPOS'],
        pinActive: true,
      })
    ).toBe(true);
  });

  it('denies waiter and cashier panel users', () => {
    expect(
      canSwitchPanelLocationFromUser({
        role: 'staff',
        roleName: 'Waiter + menu editor',
        name: 'x',
        email: 'a',
        id: '1',
      })
    ).toBe(false);
    expect(
      canSwitchPanelLocationFromUser({
        role: 'staff',
        roleName: 'Cashier',
        name: 'x',
        email: 'a',
        id: '1',
      })
    ).toBe(false);
  });
});
