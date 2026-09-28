import assert from 'node:assert/strict';
import { isMerchantPaymentSetupComplete } from './merchant-payment-setup';

assert.equal(isMerchantPaymentSetupComplete({ webposCashEnabled: true }), true);
assert.equal(isMerchantPaymentSetupComplete({ webposCardEnabled: true }), true);
assert.equal(isMerchantPaymentSetupComplete({}), true, 'defaults: cash/card on');
assert.equal(
  isMerchantPaymentSetupComplete({
    webposCashEnabled: false,
    webposCardEnabled: false,
    webposTerminalEnabled: false,
    webposInvoiceEnabled: false,
    webposGiftCardEnabled: false,
  }),
  false,
  'all POS methods off'
);
assert.equal(
  isMerchantPaymentSetupComplete({
    webposCashEnabled: false,
    webposCardEnabled: false,
    webposTerminalEnabled: true,
  }),
  true,
  'terminal only'
);
assert.equal(isMerchantPaymentSetupComplete({ adyenMerchantAccount: 'TestMerchant' }), true);

console.log('merchant-payment-setup.test.ts: ok');
