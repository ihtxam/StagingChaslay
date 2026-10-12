import { describe, expect, it } from 'vitest';
import {
  adyenDropinCreateConfig,
  merchantBillingUserMessage,
  normalizeAdyenPaymentSession,
} from './adyen-checkout';

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

describe('merchantBillingUserMessage', () => {
  const fallback = 'Billing is temporarily unavailable. Please try again later.';

  it('hides Superadmin Adyen recipes from merchants', () => {
    const recipe =
      'Adyen POST /sessions rejected the platform credentials (Unauthorized, TEST). In Superadmin → Settings → Payment (Adyen), set all three from the same TEST Adyen account.';
    expect(merchantBillingUserMessage(new Error(recipe), fallback)).toBe(fallback);
    expect(
      merchantBillingUserMessage(
        { response: { data: { code: 'BILLING_UNAVAILABLE', error: recipe } } },
        fallback
      )
    ).toBe(fallback);
  });

  it('keeps unrelated billing errors', () => {
    expect(
      merchantBillingUserMessage(new Error('This plan is not available for purchase'), fallback)
    ).toBe('This plan is not available for purchase');
  });
});
