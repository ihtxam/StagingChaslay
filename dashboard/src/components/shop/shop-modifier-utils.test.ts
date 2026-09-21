import { describe, expect, it } from 'vitest';
import {
  buildExtrasFromSelection,
  ensureNosTicketName,
  isNosModifierGroup,
  modifierOptionDisplayName,
  nosOptionDisplayName,
  productRequiresModifierModal,
} from './shop-modifier-utils';

describe('isNosModifierGroup', () => {
  it('detects common No/removal group titles', () => {
    expect(isNosModifierGroup("No's")).toBe(true);
    expect(isNosModifierGroup('Nos')).toBe(true);
    expect(isNosModifierGroup('Removals')).toBe(true);
    expect(isNosModifierGroup('Extras')).toBe(false);
  });
});

describe('ensureNosTicketName', () => {
  it('prefixes plain ingredient names', () => {
    expect(ensureNosTicketName('Onion')).toBe('No Onion');
  });

  it('keeps existing No prefix', () => {
    expect(ensureNosTicketName('No onion')).toBe('No onion');
    expect(ensureNosTicketName('No-onion')).toBe('No-onion');
  });
});

describe('nosOptionDisplayName', () => {
  it('strips No prefix for grid labels', () => {
    expect(nosOptionDisplayName('No Onion')).toBe('Onion');
    expect(modifierOptionDisplayName('No Onion', "No's")).toBe('Onion');
    expect(modifierOptionDisplayName('Bacon', 'Extras')).toBe('Bacon');
  });
});

describe('buildExtrasFromSelection', () => {
  it('applies No ticket names for No groups only', () => {
    const groups = [
      {
        id: 'nos',
        title: "No's",
        options: [{ id: 'n1', name: 'Onion', price: 0 }],
      },
      {
        id: 'extras',
        title: 'Extras',
        options: [{ id: 'e1', name: 'Bacon', price: 2 }],
      },
    ];
    const extras = buildExtrasFromSelection(groups, { nos: ['n1'], extras: ['e1'] });
    expect(extras).toEqual([
      { id: 'n1', name: 'No Onion', price: 0, groupId: 'nos', groupTitle: "No's" },
      { id: 'e1', name: 'Bacon', price: 2, groupId: 'extras', groupTitle: 'Extras' },
    ]);
  });
});

describe('productRequiresModifierModal', () => {
  it('is true for optional modifier groups', () => {
    expect(
      productRequiresModifierModal({
        id: 'p1',
        name: 'Pizza',
        price: 12,
        modifierGroups: [
          {
            id: 'extras',
            title: 'Extras',
            selectionType: 'optional',
            minSelectable: 0,
            maxSelectable: 3,
            options: [{ id: 'e1', name: 'Olives', price: 1 }],
          },
        ],
      })
    ).toBe(true);
  });
});
