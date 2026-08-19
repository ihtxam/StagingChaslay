import { roundMoney2 } from '@/lib/money';

export type PaymentTender = { method: string; amount: number };

const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  cash: 'cash',
  express: 'cash',
  especes: 'cash',
  espece: 'cash',
  bar: 'cash',
  bargeld: 'cash',
  liquide: 'cash',
  card: 'card',
  carte: 'card',
  karte: 'card',
  credit_card: 'card',
  creditcard: 'card',
  debit: 'card',
  debit_card: 'card',
  tap_to_pay: 'card',
  taptopay: 'card',
  terminal: 'terminal',
  adyen: 'terminal',
  adyen_terminal: 'terminal',
  mixed: 'mixed',
  split: 'mixed',
  split_tender: 'mixed',
  paiement_mixte: 'mixed',
  gemischte_zahlung: 'mixed',
  gift_card: 'gift_card',
  giftcard: 'gift_card',
  gift: 'gift_card',
  carte_cadeau: 'gift_card',
  geschenkkarte: 'gift_card',
  invoice: 'invoice',
  facture: 'invoice',
  rechnung: 'invoice',
  pay_later: 'pay_later',
  paylater: 'pay_later',
  bank_transfer: 'bank_transfer',
  virement: 'bank_transfer',
  uberweisung: 'bank_transfer',
};

/** Fold case, diacritics, spaces, and known aliases into one report key. */
export function normalizePaymentMethod(method: string): string {
  const raw = String(method || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!raw) return '';
  return PAYMENT_METHOD_ALIASES[raw] || raw;
}

export function paymentMethodLabel(
  method: string,
  t: (key: string) => string
): string {
  const m = normalizePaymentMethod(method);
  if (m === 'cash') return t('webPosCash');
  if (m === 'card') return t('webPosCard');
  if (m === 'terminal') return t('webPosTerminal');
  if (m === 'gift_card') return t('giftCard');
  if (m === 'mixed') return t('webPosMixedPayment');
  if (m === 'pay_later') return t('webPosPayLater');
  if (m === 'invoice') return t('webPosInvoice');
  if (m === 'bank_transfer') return t('webPosBankTransfer');
  return method || t('reportsEmpty');
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
