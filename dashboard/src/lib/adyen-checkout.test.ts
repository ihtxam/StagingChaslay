import { describe, expect, it } from 'vitest';
import { adyenDropinCreateConfig, normalizeAdyenPaymentSession } from './adyen-checkout';

describe('normalizeAdyenPaymentSession', () => {
  it('passes storePaymentMethod for logged-in shop sessions', () => {
    const out = normalizeAdyenPaymentSession({
      id: 'sess_1',
      sessionData: 'data',
      clientKey: 'test_abc',
      environment: 'test',
      storePaymentMethod: true,
    });
    expect(out?.storePaymentMethod).toBe(true);
  });

  it('defaults storePaymentMethod off for guest sessions', () => {
    const out = normalizeAdyenPaymentSession({
      id: 'sess_1',
      sessionData: 'data',
      clientKey: 'test_abc',
    });
    expect(out?.storePaymentMethod).toBe(false);
  });
});

describe('adyenDropinCreateConfig', () => {
  it('does not enable store details for guests except blocking TWINT save', () => {
    const out = adyenDropinCreateConfig({ storePaymentMethod: false });
    expect(out.paymentMethodsConfiguration).toEqual({
      twint: { enableStoreDetails: false },
    });
  });

  it('enables card store details when the session tokenized the shopper', () => {
    const out = adyenDropinCreateConfig({ storePaymentMethod: true });
    expect(out.paymentMethodsConfiguration).toEqual({
      twint: { enableStoreDetails: false },
      card: {
        enableStoreDetails: true,
        hasHolderName: true,
        holderNameRequired: false,
      },
      scheme: {
        enableStoreDetails: true,
        hasHolderName: true,
        holderNameRequired: false,
      },
    });
  });
});
