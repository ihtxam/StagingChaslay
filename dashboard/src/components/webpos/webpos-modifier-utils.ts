import {
  buildExtrasFromSelection,
  effectiveGroups,
  groupMin,
  initialSelection,
  toggleGroupOption,
  validateModifierGroups,
  type ShopModifierGroup,
  type ShopProductForModifiers,
} from '@/components/shop/shop-modifier-utils';

export {
  buildExtrasFromSelection,
  effectiveGroups,
  groupMin,
  initialSelection,
  toggleGroupOption,
  type ShopModifierGroup,
  type ShopProductForModifiers,
};

/** @deprecated use effectiveGroups */
export const effectiveModifierGroups = effectiveGroups;

/** @deprecated use initialSelection */
export const initialGroupSelection = initialSelection;

export function validateGroupSelection(
  groups: ShopModifierGroup[],
  selection: Record<string, string[]>,
  messages: {
    chooseOne: (name: string) => string;
    chooseAtLeast: (n: number, name: string) => string;
    tooMany: (name: string) => string;
    groupTitle: (title: string) => string;
  }
) {
  return validateModifierGroups(groups, selection, messages);
}

const GROUP_TITLE_KEYS: Record<string, string> = {
  Extras: 'shopExtras',
  Sizes: 'sizes',
  Additions: 'webPosModAdditions',
  Removals: 'webPosModRemovals',
  'Bread Choice': 'webPosModBreadChoice',
  Drinks: 'webPosModDrinks',
};

export function translateModifierGroupTitle(title: string, t: (key: string) => string): string {
  const key = GROUP_TITLE_KEYS[title];
  return key ? t(key) : title;
}
