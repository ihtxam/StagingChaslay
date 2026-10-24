import assert from 'node:assert/strict';
import { channelTaxRateFromMerchant } from './money';

const merchant = {
  vatRate: '8.1',
  taxTakeawayRate: '2.6',
  taxDineInRate: '8.1',
  taxDeliveryRate: '2.6',
};

assert.equal(channelTaxRateFromMerchant(merchant, 'in_store'), 8.1);
assert.equal(channelTaxRateFromMerchant(merchant, 'takeaway'), 2.6);
assert.equal(channelTaxRateFromMerchant(merchant, 'dine_in'), 8.1);

console.log('money-channel-tax: ok');
