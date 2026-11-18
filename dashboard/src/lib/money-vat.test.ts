import assert from 'node:assert/strict';
import test from 'node:test';
import {
  channelTaxRateFromMerchant,
  merchantChargesVat,
  resolvePosTaxRate,
} from './money.ts';

test('resolvePosTaxRate honors explicit 0% channel rate', () => {
  assert.equal(resolvePosTaxRate('0', '8.1', 8.1), 0);
  assert.equal(resolvePosTaxRate(null, '0', 8.1), 0);
  assert.equal(resolvePosTaxRate('', '8.1', 8.1), 8.1);
});

test('channelTaxRateFromMerchant returns 0 when merchant rates are zero', () => {
  const merchant = {
    vatRate: '0',
    taxTakeawayRate: '0',
    taxDineInRate: '0',
    taxDeliveryRate: '0',
  };
  assert.equal(channelTaxRateFromMerchant(merchant, 'takeaway'), 0);
  assert.equal(channelTaxRateFromMerchant(merchant, 'dine_in'), 0);
  assert.equal(channelTaxRateFromMerchant(merchant, 'delivery'), 0);
  assert.equal(merchantChargesVat(merchant), false);
});

test('delivery explicit 0 does not fall back to Swiss takeaway default', () => {
  const merchant = {
    vatRate: '8.1',
    taxTakeawayRate: '2.6',
    taxDeliveryRate: '0',
  };
  assert.equal(channelTaxRateFromMerchant(merchant, 'delivery'), 0);
});

test('default vat 0% overrides stale channel rates', () => {
  const merchant = {
    vatRate: '0',
    taxTakeawayRate: '2.6',
    taxDineInRate: '8.1',
    taxDeliveryRate: '2.6',
  };
  assert.equal(channelTaxRateFromMerchant(merchant, 'takeaway'), 0);
  assert.equal(merchantChargesVat(merchant), false);
});