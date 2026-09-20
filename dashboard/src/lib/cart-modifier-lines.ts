import type { ShopSelectedExtra } from '@/lib/shop-cart';
import { repairCatalogText } from '@/lib/text-encoding';
import type { CartLine } from '@/components/webpos/types';

export type CartModifierRow = {
  label: string;
  /** Shown right-aligned when > 0 (free/included modifiers omit price). */
  price: number | null;
};

function modifierRow(extra: ShopSelectedExtra): CartModifierRow | null {
  const label = repairCatalogText(extra.name || '').trim();
  if (!label) return null;
  const price = Number(extra.price) || 0;
  return { label, price: price > 0 ? price : null };
}

/** Indented modifier rows for cart / CDS-style displays (Simphony-like). */
export function cartModifierRows(line: CartLine): CartModifierRow[] {
  const rows: CartModifierRow[] = [];
  const combos = line.comboSelections || [];
  const extras = line.selectedExtras || [];

  for (const combo of combos) {
    const productName = repairCatalogText(combo.productName || '').trim();
    const slotLabel = combo.slotName?.trim();
    const head = slotLabel && productName ? `${slotLabel}: ${productName}` : productName || slotLabel;
    if (head) rows.push({ label: head, price: null });
    for (const extra of combo.selectedExtras || []) {
      const row = modifierRow(extra);
      if (row) rows.push(row);
    }
  }

  if (!combos.length && extras.length) {
    for (const extra of extras) {
      const row = modifierRow(extra);
      if (row) rows.push(row);
    }
  } else if (combos.length && extras.length) {
    for (const extra of extras) {
      const row = modifierRow(extra);
      if (row) rows.push(row);
    }
  }

  return rows;
}

/** Flat comma label for compact surfaces (CDS, order lists). */
export function cartModifiersCompactLabel(line: CartLine): string {
  return cartModifierRows(line)
    .map((row) => {
      if (row.price != null && row.price > 0) {
        return `${row.label} ${row.price.toFixed(2)}`;
      }
      return row.label;
    })
    .join(', ');
}

/** Kitchen / receipt modifier text (optional price suffix for customer tickets). */
export function formatModifierTicketLine(
  extra: { name?: string | null; price?: number | null },
  showPrice = false
): string {
  const name = repairCatalogText(String(extra.name || '')).trim();
  if (!name) return '';
  const price = Number(extra.price) || 0;
  if (showPrice && price > 0) return `${name} ${price.toFixed(2)}`;
  return name;
}
