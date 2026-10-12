import { describe, expect, it } from 'vitest';
import {
  createEmptyPizzaTemplate,
  findTemplateForProduct,
  pricePizzaSelection,
  recommendedCapacityForSize,
} from './pizza-builder';

describe('pizza-builder', () => {
  it('recommends size capacity', () => {
    expect(recommendedCapacityForSize('Small')).toBe(6);
    expect(recommendedCapacityForSize('large')).toBe(10);
  });

  it('finds a linked product template', () => {
    const tpl = createEmptyPizzaTemplate();
    tpl.linkedProductIds = ['pizza-1'];
    expect(findTemplateForProduct([tpl], 'pizza-1')?.id).toBe(tpl.id);
    expect(findTemplateForProduct([tpl], 'other')).toBeNull();
  });

  it('applies lowest-priced free topping on a half pizza', () => {
    const tpl = createEmptyPizzaTemplate();
    tpl.portionType = 'half';
    tpl.freeToppingEnabled = true;
    tpl.freeToppingCount = 1;
    tpl.applyDiscount = 'lowest';
    const extra = tpl.quantityLevels.find((q) => q.multiplier === 2)!;
    const priced = pricePizzaSelection(tpl, 10, [
      {
        itemId: 'a',
        name: 'Onion',
        basePrice: 1,
        quantityLevelId: extra.id,
        multiplier: 1,
        portion: 'left',
      },
      {
        itemId: 'b',
        name: 'Ham',
        basePrice: 3,
        quantityLevelId: extra.id,
        multiplier: extra.multiplier,
        portion: 'right',
      },
    ]);
    expect(priced.extras.map((e) => e.price)).toEqual([0, 3]);
    expect(priced.unitPrice).toBe(13);
  });
});
