import { roundMoney2 } from "@/lib/money";
import {
  normalizeProductTimeSlotPrices,
  type ProductTimeSlotPrices,
  type TimeSlotPricingSlot,
} from "@/lib/time-slot-pricing";

const SLOT_PRICE_PREFIX = "price_slot_";
const PRICE_ALIAS_PREFIX = "price_";

export function slugifySlotLabel(label: string): string {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Canonical export/import column: price_slot_<slotId> */
export function slotPriceColumnName(slot: TimeSlotPricingSlot): string {
  return `${SLOT_PRICE_PREFIX}${slot.id}`;
}

/** Optional alias column: price_<slug> from label or id (e.g. price_night). */
export function slotPriceAliasColumnName(slot: TimeSlotPricingSlot): string {
  const slug = slugifySlotLabel(slot.label || slot.id);
  return slug ? `${PRICE_ALIAS_PREFIX}${slug}` : `${PRICE_ALIAS_PREFIX}${slot.id}`;
}

export function columnKeysForSlot(slot: TimeSlotPricingSlot): string[] {
  const keys = [slotPriceColumnName(slot), slotPriceAliasColumnName(slot)];
  const idSlug = slugifySlotLabel(slot.id);
  if (idSlug && !keys.includes(`${PRICE_ALIAS_PREFIX}${idSlug}`)) {
    keys.push(`${PRICE_ALIAS_PREFIX}${idSlug}`);
  }
  return keys;
}

function normalizeHeaderKey(key: string): string {
  return String(key || "").trim().toLowerCase();
}

function getRowValueCaseInsensitive(row: Record<string, unknown>, key: string): unknown {
  const target = normalizeHeaderKey(key);
  if (target in row || Object.prototype.hasOwnProperty.call(row, key)) {
    return row[key];
  }
  for (const [k, v] of Object.entries(row)) {
    if (normalizeHeaderKey(k) === target) return v;
  }
  return undefined;
}

function rowHasKeyCaseInsensitive(row: Record<string, unknown>, key: string): boolean {
  const target = normalizeHeaderKey(key);
  return Object.keys(row).some((k) => normalizeHeaderKey(k) === target);
}

/** True if any row uses a known slot price column header. */
export function workbookHasSlotPriceColumns(
  rows: Record<string, unknown>[],
  slots: TimeSlotPricingSlot[]
): boolean {
  if (!slots.length || !rows.length) return false;
  const aliasKeys = new Set<string>();
  for (const slot of slots) {
    for (const k of columnKeysForSlot(slot)) {
      aliasKeys.add(normalizeHeaderKey(k));
    }
  }
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (aliasKeys.has(normalizeHeaderKey(k))) return true;
    }
  }
  return false;
}

export type SlotPriceCell = {
  present: boolean;
  raw: unknown;
  columnKey: string | null;
};

export function getSlotPriceCell(
  row: Record<string, unknown>,
  slot: TimeSlotPricingSlot
): SlotPriceCell {
  for (const key of columnKeysForSlot(slot)) {
    if (rowHasKeyCaseInsensitive(row, key)) {
      return {
        present: true,
        raw: getRowValueCaseInsensitive(row, key),
        columnKey: key,
      };
    }
  }
  return { present: false, raw: undefined, columnKey: null };
}

function parseSlotPriceRaw(raw: unknown): number | null | "invalid" {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return roundMoney2(n);
}

/**
 * Parse slot override prices from a product row.
 * Blank cell → no override for that slot (use base catalog price).
 */
export function parseProductTimeSlotPricesFromImportRow(
  row: Record<string, unknown>,
  slots: TimeSlotPricingSlot[],
  opts?: { onlyPresentColumns?: boolean }
): { prices: ProductTimeSlotPrices; errors: string[] } {
  const errors: string[] = [];
  const prices: ProductTimeSlotPrices = {};
  const onlyPresent = opts?.onlyPresentColumns !== false;

  for (const slot of slots) {
    const cell = getSlotPriceCell(row, slot);
    if (onlyPresent && !cell.present) continue;
    const parsed = parseSlotPriceRaw(cell.raw);
    if (parsed === "invalid") {
      errors.push(
        `Invalid ${cell.columnKey || slotPriceColumnName(slot)} (must be a number ≥ 0)`
      );
      continue;
    }
    if (parsed === null) continue;
    prices[slot.id] = { price: parsed };
  }

  return { prices, errors };
}

/** Export columns for configured slots (canonical price_slot_<id> only). */
export function exportSlotPriceColumns(
  timeSlotPrices: unknown,
  slots: TimeSlotPricingSlot[]
): Record<string, number | string> {
  const map = normalizeProductTimeSlotPrices(timeSlotPrices);
  const out: Record<string, number | string> = {};
  for (const slot of slots) {
    const entry = map[slot.id];
    const col = slotPriceColumnName(slot);
    if (entry?.price != null && Number.isFinite(entry.price)) {
      out[col] = entry.price;
    } else {
      out[col] = "";
    }
  }
  return out;
}

export function buildCatalogImportReadMeRows(slots: TimeSlotPricingSlot[]): Array<Record<string, string>> {
  const examples = slots.length
    ? slots.map((s) => slotPriceColumnName(s)).join(", ")
    : "price_slot_day, price_slot_night (or price_day, price_night when labels match)";
  return [
    {
      topic: "Slot prices (optional)",
      en: `Columns ${examples}. Leave blank to use the default catalog price in that window.`,
      fr: `Colonnes ${examples}. Laissez vide pour utiliser le prix catalogue par défaut sur ce créneau.`,
    },
    {
      topic: "Aliases",
      en: "You may also use price_<label> (e.g. price_night) when it matches a slot label or id.",
      fr: "Vous pouvez aussi utiliser price_<libellé> (ex. price_night) si le libellé ou l'id correspond.",
    },
  ];
}
