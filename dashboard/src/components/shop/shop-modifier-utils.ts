import type { ShopSelectedExtra } from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';

export interface ShopModifierOption {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
  image?: string | null;
}

export interface ShopModifierGroup {
  id: string;
  title: string;
  pricingType?: string;
  selectionType?: 'optional' | 'required' | string;
  minSelectable?: number;
  maxSelectable?: number;
  options: ShopModifierOption[];
}

/** Catalogue size/spec row (Small / Regular / Large, each with its own price). */
export interface ShopProductSpec {
  id: string;
  name: string;
  price: number;
  saleStatus?: 'in_stock' | 'out_of_stock';
  isDefault?: boolean;
  sortOrder?: number;
}

export interface ShopProductForModifiers {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  allowExtras?: boolean;
  extras?: ShopModifierOption[];
  modifierGroups?: ShopModifierGroup[];
  specifications?: ShopProductSpec[];
}

/** Synthetic modifier group id for catalogue size rows. */
export const SIZE_MODIFIER_GROUP_ID = '__sizes__';

export function inStockSpecifications(product: ShopProductForModifiers): ShopProductSpec[] {
  return (product.specifications || [])
    .filter((s) => s.name?.trim() && (s.saleStatus || 'in_stock') !== 'out_of_stock')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function productHasSizeChoice(product: ShopProductForModifiers): boolean {
  return inStockSpecifications(product).length > 1;
}

function sizeGroupFromSpecifications(product: ShopProductForModifiers): ShopModifierGroup | null {
  const specs = inStockSpecifications(product);
  if (specs.length <= 1) return null;
  const base = roundMoney2(Number(product.price) || 0);
  return {
    id: SIZE_MODIFIER_GROUP_ID,
    title: 'Sizes',
    selectionType: 'required',
    minSelectable: 1,
    maxSelectable: 1,
    options: specs.map((s) => ({
      id: s.id,
      name: s.name.trim(),
      price: roundMoney2(Number(s.price) - base),
      isDefault: !!s.isDefault,
    })),
  };
}

function legacyExtrasGroups(product: ShopProductForModifiers): ShopModifierGroup[] {
  if (product.modifierGroups?.length) return product.modifierGroups;
  if (product.allowExtras && product.extras?.length) {
    return [
      {
        id: '__legacy__',
        title: 'Extras',
        selectionType: 'optional',
        minSelectable: 0,
        maxSelectable: product.extras.length,
        options: product.extras,
      },
    ];
  }
  return [];
}

export function effectiveGroups(product: ShopProductForModifiers): ShopModifierGroup[] {
  const sizeGroup = sizeGroupFromSpecifications(product);
  const groups = legacyExtrasGroups(product);
  return sizeGroup ? [sizeGroup, ...groups] : groups;
}

export function groupMin(g: ShopModifierGroup) {
  if (g.selectionType === 'required') return Math.max(1, Number(g.minSelectable) || 1);
  return Math.max(0, Number(g.minSelectable) || 0);
}

export function groupMax(g: ShopModifierGroup) {
  const min = groupMin(g);
  return Math.max(min, Number(g.maxSelectable) || 1);
}

export function selectionFromExtras(
  groups: ShopModifierGroup[],
  extras: ShopSelectedExtra[]
): Record<string, string[]> {
  const sel: Record<string, string[]> = {};
  for (const g of groups) {
    sel[g.id] = [];
  }
  for (const extra of extras) {
    const groupId = extra.groupId || groups.find((g) => g.options.some((o) => o.id === extra.id))?.id;
    if (!groupId) continue;
    if (!sel[groupId]) sel[groupId] = [];
    if (!sel[groupId].includes(extra.id)) sel[groupId].push(extra.id);
  }
  return sel;
}

export function initialSelection(groups: ShopModifierGroup[]): Record<string, string[]> {
  const sel: Record<string, string[]> = {};
  for (const g of groups) {
    const defaults = g.options.filter((o) => o.isDefault).map((o) => o.id);
    const max = groupMax(g);
    sel[g.id] = defaults.slice(0, max);
  }
  return sel;
}

export function buildExtrasFromSelection(
  groups: ShopModifierGroup[],
  selection: Record<string, string[]>
): ShopSelectedExtra[] {
  const extras: ShopSelectedExtra[] = [];
  for (const g of groups) {
    for (const id of selection[g.id] || []) {
      const opt = g.options.find((o) => o.id === id);
      if (!opt) continue;
      extras.push({
        id: opt.id,
        name: opt.name,
        price: Number(opt.price) || 0,
        groupId: g.id,
        groupTitle: g.title,
      });
    }
  }
  return extras;
}

export function selectionSummary(
  groups: ShopModifierGroup[],
  selection: Record<string, string[]>,
  defaultLabel: string
): string {
  const names: string[] = [];
  for (const g of groups) {
    const ids = selection[g.id] || [];
    if (ids.length) {
      for (const id of ids) {
        const opt = g.options.find((o) => o.id === id);
        if (opt) names.push(opt.name);
      }
    } else {
      for (const opt of g.options.filter((o) => o.isDefault)) {
        names.push(opt.name);
      }
    }
  }
  if (!names.length) return defaultLabel;
  return names.join(', ');
}

export function toggleGroupOption(
  group: ShopModifierGroup,
  optionId: string,
  prev: Record<string, string[]>
): Record<string, string[]> {
  const max = groupMax(group);
  const current = prev[group.id] || [];
  const has = current.includes(optionId);
  if (max === 1) {
    return { ...prev, [group.id]: has ? [] : [optionId] };
  }
  if (has) {
    return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
  }
  if (current.length >= max) {
    return { ...prev, [group.id]: [...current.slice(1), optionId] };
  }
  return { ...prev, [group.id]: [...current, optionId] };
}

export function validateModifierGroups(
  groups: ShopModifierGroup[],
  selection: Record<string, string[]>,
  messages: {
    chooseOne: (name: string) => string;
    chooseAtLeast: (n: number, name: string) => string;
    tooMany: (name: string) => string;
    groupTitle: (title: string) => string;
  }
): string | null {
  for (const g of groups) {
    const count = (selection[g.id] || []).length;
    const min = groupMin(g);
    const title = messages.groupTitle(g.title);
    if (count < min) {
      return min === 1
        ? messages.chooseOne(title)
        : messages.chooseAtLeast(min, title);
    }
    if (count > groupMax(g)) return messages.tooMany(title);
  }
  return null;
}

export function effectiveGroupsForComboOption(opt: {
  productId: string;
  name: string;
  extraPrice: number;
  allowExtras?: boolean;
  extras?: ShopModifierOption[];
  modifierGroups?: ShopModifierGroup[];
}): ShopModifierGroup[] {
  return effectiveGroups({
    id: opt.productId,
    name: opt.name,
    price: opt.extraPrice,
    allowExtras: opt.allowExtras,
    extras: opt.extras,
    modifierGroups: opt.modifierGroups,
  });
}

export function productHasModifiers(product: ShopProductForModifiers) {
  return (
    productHasSizeChoice(product) ||
    (product.modifierGroups?.some((g) => g.options?.length) ?? false) ||
    !!(product.allowExtras && product.extras?.length)
  );
}

export function productRequiresModifierModal(product: ShopProductForModifiers) {
  const groups = effectiveGroups(product);
  if (!groups.length) return false;
  return groups.some((g) => groupMin(g) > 0);
}

export function defaultConfiguredAdd(product: ShopProductForModifiers): {
  selectedExtras: ShopSelectedExtra[];
  unitPrice: number;
} {
  const groups = effectiveGroups(product);
  const selection = initialSelection(groups);
  const selectedExtras = buildExtrasFromSelection(groups, selection);
  const extrasTotal = roundMoney2(selectedExtras.reduce((s, e) => s + e.price, 0));
  return {
    selectedExtras,
    unitPrice: roundMoney2(Number(product.price) + extrasTotal),
  };
}
