import { describe, expect, it } from 'vitest';
import { canEditPayment, type MerchantOrder } from './order-management';

function order(partial: Partial<MerchantOrder>): MerchantOrder {
  return { status: 'completed', refundAmount: 0, ...partial } as MerchantOrder;
}

describe('canEditPayment', () => {
  it('allows completed POS sales', () => {
    expect(canEditPayment(order({ status: 'completed', paymentStatus: 'completed' }))).toBe(true);
  });

  it('allows paid sales even when kitchen status is still open', () => {
    expect(canEditPayment(order({ status: 'preparing', paymentStatus: 'paid' }))).toBe(true);
    expect(canEditPayment(order({ status: 'ready', paymentStatus: 'completed' }))).toBe(true);
  });

  it('blocks cancelled and refunded sales', () => {
    expect(canEditPayment(order({ status: 'cancelled', paymentStatus: 'completed' }))).toBe(false);
    expect(canEditPayment(order({ status: 'completed', paymentStatus: 'refunded' }))).toBe(false);
  });

  it('blocks unpaid tickets', () => {
    expect(canEditPayment(order({ status: 'preparing', paymentStatus: 'awaiting_payment' }))).toBe(
      false
    );
  });
});
