/** Compact POS scan payload: REBORN:O:{heldOrderUuid} */
export function buildOrderLabelBarcode(heldId: string): string {
  const id = String(heldId || '').trim();
  if (!id) throw new Error('Held order id required');
  return `REBORN:O:${id}`;
}

/** Parse order label barcode from POS wedge / handheld scanner. */
export function parseOrderLabelBarcode(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const compact = trimmed.match(/^REBORN:O:([a-f0-9-]{8,})$/i);
  if (compact) return compact[1]!;
  return null;
}

export type OrderLabelLine = {
  name: string;
  lineTotal: number;
  weightKg?: number | null;
  isWeighed?: boolean;
};

export type OrderLabelData = {
  heldId: string;
  barcode: string;
  productName: string;
  price: number;
  weightKg: number | null;
};

export function formatOrderLabelWeightKg(weightKg: number | null | undefined): string {
  const kg = Number(weightKg);
  if (!Number.isFinite(kg) || kg <= 0) return '';
  return `${kg.toFixed(3)} kg`;
}

export function formatOrderLabelPrice(value: number, currency = 'CHF'): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

/** Build label fields from cart lines and persisted held order id. */
export function buildOrderLabelData(
  heldId: string,
  lines: OrderLabelLine[],
  opts?: { currency?: string }
): OrderLabelData {
  const id = String(heldId || '').trim();
  if (!id) throw new Error('Held order id required');
  const cart = Array.isArray(lines) ? lines : [];
  if (!cart.length) throw new Error('Cart is empty');

  const total = cart.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0);
  let weightSum = 0;
  let hasWeight = false;
  for (const line of cart) {
    if (!line.isWeighed) continue;
    const kg = Number(line.weightKg);
    if (Number.isFinite(kg) && kg > 0) {
      weightSum += kg;
      hasWeight = true;
    }
  }

  const names = cart.map((l) => String(l.name || '').trim()).filter(Boolean);
  let productName = names[0] || 'Order';
  if (names.length > 1) {
    productName = `${productName} +${names.length - 1}`;
  }

  return {
    heldId: id,
    barcode: buildOrderLabelBarcode(id),
    productName: productName.slice(0, 40),
    price: total,
    weightKg: hasWeight ? Math.round(weightSum * 1000) / 1000 : null,
  };
}

export function orderLabelMetaLine(data: OrderLabelData, currency = 'CHF'): string {
  const parts: string[] = [];
  const price = formatOrderLabelPrice(data.price, currency);
  if (price) parts.push(price);
  const weight = formatOrderLabelWeightKg(data.weightKg);
  if (weight) parts.push(weight);
  return parts.join(' · ');
}
