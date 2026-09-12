import assert from 'node:assert/strict';
import {
  isValidAdyenClientKey,
  shopAdyenCardReady,
  shopOrderPaymentReturnUrl,
  shopPublicBaseUrl,
} from './shop-public-url.ts';

assert.equal(isValidAdyenClientKey('test_ABC123'), true);
assert.equal(isValidAdyenClientKey('live_XYZ'), true);
assert.equal(isValidAdyenClientKey('AQE1234567890'), false);
assert.equal(isValidAdyenClientKey(null), false);

assert.equal(
  shopAdyenCardReady({
    adyenMerchantAccount: 'MyAccount',
    adyenApiKey: 'AQEabc',
    adyenClientId: 'test_client',
  }),
  true
);
assert.equal(
  shopAdyenCardReady({
    adyenMerchantAccount: 'MyAccount',
    adyenApiKey: 'AQEabc',
    adyenClientId: 'AQEwrong',
  }),
  false
);

assert.equal(
  shopPublicBaseUrl({ slug: 'demo', subdomain: null, customDomain: 'www.cliavo.com' }),
  'https://www.cliavo.com'
);

assert.match(
  shopOrderPaymentReturnUrl({ slug: 'demo', subdomain: null, customDomain: 'www.cliavo.com' }, 'ord-1'),
  /^https:\/\/www\.cliavo\.com\/order\/ord-1\?paid=1$/
);

console.log('shop-public-url.test.ts OK');
