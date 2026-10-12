import { describe, expect, it } from 'vitest';
import {
  formatOrderAlertPaymentLine,
  orderAlertFulfillmentKey,
  orderAlertFulfillmentLabel,
  orderAlertPaidLabel,
} from './order-management';

const labels: Record<string, string> = {
  invoiceStatusPaid: 'Paid',
  invoiceStatusUnpaid: 'Unpaid',
  orderAlertTakeaway: 'TAKEAWAY',
  orderAlertDelivery: 'DELIVERY',
  orderAlertDineIn: 'DINE-IN',
  orderAlertPaid: 'PAID',
  orderAlertUnpaid: 'UNPAID',
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

describe('order alert header type / paid', () => {
  it('uses fulfillmentChannel then channel', () => {
    expect(orderAlertFulfillmentKey({ fulfillmentChannel: 'delivery' })).toBe('delivery');
    expect(orderAlertFulfillmentKey({ fulfillmentChannel: 'takeaway' })).toBe('takeaway');
    expect(orderAlertFulfillmentKey({ fulfillmentChannel: 'dine_in' })).toBe('dine_in');
    expect(orderAlertFulfillmentKey({ channel: 'delivery' })).toBe('delivery');
    expect(orderAlertFulfillmentKey({})).toBe('takeaway');
    expect(orderAlertFulfillmentLabel({ fulfillmentChannel: 'takeaway' }, t)).toBe('TAKEAWAY');
    expect(orderAlertFulfillmentLabel({ fulfillmentChannel: 'delivery' }, t)).toBe('DELIVERY');
  });

  it('marks paid only when paymentStatus is completed or paid', () => {
    expect(orderAlertPaidLabel({ paymentStatus: 'completed' }, t)).toBe('PAID');
    expect(orderAlertPaidLabel({ paymentStatus: 'paid' }, t)).toBe('PAID');
    expect(orderAlertPaidLabel({ paymentStatus: 'cash' }, t)).toBe('UNPAID');
    expect(orderAlertPaidLabel({ paymentStatus: 'awaiting_payment' }, t)).toBe('UNPAID');
  });
});
