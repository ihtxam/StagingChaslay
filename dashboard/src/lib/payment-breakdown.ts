import { roundMoney2 } from '@/lib/money';

export type PaymentTender = { method: string; amount: number };

export function normalizePaymentMethod(method: string): string {
  return String(method || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

export function parsePaymentBreakdown(
  raw: unknown,
  paymentMethod?: string | null,
  orderTotal?: number
): PaymentTender[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row) => ({
        method: normalizePaymentMethod(String((row as PaymentTender).method || '')),
        amount: roundMoney2(Number((row as PaymentTender).amount) || 0),
      }))
      .filter((t) => t.method && t.amount > 0);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .map(([method, amount]) => ({
        method: normalizePaymentMethod(method),
        amount: roundMoney2(Number(amount) || 0),
      }))
      .filter((t) => t.method && t.amount > 0);
  }
  const method = normalizePaymentMethod(String(paymentMethod || ''));
  const total = roundMoney2(Number(orderTotal) || 0);
  if (method && method !== 'mixed' && total > 0) {
    return [{ method, amount: total }];
  }
  return [];
}

export function hasTerminalPortion(tenders: PaymentTender[]): boolean {
  return tenders.some((t) => {
    const m = normalizePaymentMethod(t.method);
    return m === 'terminal' || m === 'card' || m === 'adyen_terminal';
  });
}
