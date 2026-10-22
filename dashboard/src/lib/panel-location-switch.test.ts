import { describe, expect, it } from 'vitest';
import { canSwitchPanelLocationFromUser } from '@/lib/panel-location-switch';

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
