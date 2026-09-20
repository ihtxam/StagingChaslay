import { describe, expect, it } from 'vitest';
import { cartModifierRows, cartModifiersCompactLabel, formatModifierTicketLine } from './cart-modifier-lines';
import type { CartLine } from '@/components/webpos/types';

const baseLine = (overrides: Partial<CartLine> = {}): CartLine => ({
  lineId: 'l1',
  productId: 'p1',
  name: 'Salmon Fish Cakes',
  quantity: 1,
  unitPrice: 17.99,
  lineTotal: 17.99,
  taxable: true,
  selectedExtras: [],
  comboSelections: [],
  ...overrides,
});

describe('cartModifierRows', () => {
  it('returns one row per extra with price only when paid', () => {
    const rows = cartModifierRows(
      baseLine({
        selectedExtras: [
          { id: '1', name: 'With Fries', price: 0 },
          { id: '2', name: 'Ext Asparagus', price: 0.49 },
        ],
      })
    );
    expect(rows).toEqual([
      { label: 'With Fries', price: null },
      { label: 'Ext Asparagus', price: 0.49 },
    ]);
  });

  it('includes combo picks and nested extras', () => {
    const rows = cartModifierRows(
      baseLine({
        comboSelections: [
          {
            slotId: 's1',
            slotName: 'Side',
            productId: 'p2',
            productName: 'Fries',
            extraPrice: 0,
            selectedExtras: [{ id: 'e1', name: 'Well done', price: 0 }],
          },
        ],
        selectedExtras: [{ id: 'e2', name: 'No onion', price: 0 }],
      })
    );
    expect(rows.map((r) => r.label)).toEqual(['Side: Fries', 'Well done', 'No onion']);
  });
});

describe('cartModifiersCompactLabel', () => {
  it('joins rows with paid extra prices', () => {
    const label = cartModifiersCompactLabel(
      baseLine({
        selectedExtras: [
          { id: '1', name: 'With Fries', price: 0 },
          { id: '2', name: 'Ext Asparagus', price: 0.49 },
        ],
      })
    );
    expect(label).toBe('With Fries, Ext Asparagus 0.49');
  });
});

describe('formatModifierTicketLine', () => {
  it('appends price for customer receipts when requested', () => {
    expect(formatModifierTicketLine({ name: 'Ext Asparagus', price: 0.49 }, true)).toBe(
      'Ext Asparagus 0.49'
    );
    expect(formatModifierTicketLine({ name: 'With Fries', price: 0 }, true)).toBe('With Fries');
    expect(formatModifierTicketLine({ name: 'With Fries', price: 0 }, false)).toBe('With Fries');
  });
});
