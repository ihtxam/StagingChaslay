import { describe, expect, it } from 'vitest';
import { formatOrderAlertPaymentLine } from './order-management';

const labels: Record<string, string> = {
  invoiceStatusPaid: 'Paid',
  invoiceStatusUnpaid: 'Unpaid',
  webPosCash: 'Cash',
  webPosCard: 'Card',
  webPosTwint: 'TWINT',
  webPosTerminal: 'Terminal',
  giftCard: 'Gift card',
  webPosMixedPayment: 'Mixed',
  webPosPayLater: 'Pay later',
  webPosInvoice: 'Invoice',
  webPosBankTransfer: 'Bank transfer',
  reportsEmpty: '—',
};
const t = (k: string) => labels[k] || k;

describe('formatOrderAlertPaymentLine', () => {
  it('shows paid TWINT from payment breakdown', () => {
    expect(
      formatOrderAlertPaymentLine(
        {
          paymentStatus: 'completed',
          paymentMethod: 'card',
          paymentBreakdown: [{ method: 'twint', amount: 3.8 }],
          total: 3.8,
        },
        t
      )
    ).toBe('Paid · TWINT');
  });

  it('shows unpaid cash on pickup', () => {
    expect(
      formatOrderAlertPaymentLine({ paymentStatus: 'cash', paymentMethod: 'cash', total: 12 }, t)
    ).toBe('Unpaid · Cash');
  });

  it('shows unpaid card while awaiting Adyen', () => {
    expect(
      formatOrderAlertPaymentLine(
        { paymentStatus: 'awaiting_payment', paymentMethod: 'card', total: 3.8 },
        t
      )
    ).toBe('Unpaid · Card');
  });
});
