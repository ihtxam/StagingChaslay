/**
 * Shop ordering block + header dedupe —
 * run: npx tsx dashboard/src/lib/shop-ordering-status.test.ts
 */
import assert from 'node:assert/strict';
import {
  formatShopVacationMessage,
  formatShopVacationReturnLine,
  resolveShopOrderingBlock,
  shouldShowDeliveryChannelStatus,
} from './shop-ordering-status.ts';

const strings: Record<string, string> = {
  shopVacationTitle: 'We are closed due to vacations',
  shopVacationOrdersBlocked: 'We are closed due to vacations',
  shopVacationReturn: 'We will be back on {date} at {time}',
  shopVacationReturnDateOnly: 'We will be back on {date}',
  shopNotAcceptingOrders: 'We are not accepting orders at the moment, please call us',
};

const t = (key: string, params?: Record<string, string | number>) => {
  let text = strings[key] || key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
};

const vacationReturn = { returnDate: '2026-01-15', returnTime: '09:00' };

const vacationCart = resolveShopOrderingBlock({
  vacationActive: true,
  vacationReturn,
  acceptingOrders: true,
  t,
  variant: 'cart',
});
assert.equal(vacationCart.blocked, true);
assert.equal(vacationCart.reason, 'vacation');
assert.equal(
  vacationCart.message,
  'We are closed due to vacations. We will be back on 15-01-2026 at 09:00'
);

const vacationHeader = resolveShopOrderingBlock({
  vacationActive: true,
  vacationReturn,
  acceptingOrders: true,
  t,
  variant: 'header',
});
assert.equal(
  vacationHeader.message,
  'We are closed due to vacations. We will be back on 15-01-2026 at 09:00'
);

const vacationNoReturn = resolveShopOrderingBlock({
  vacationActive: true,
  acceptingOrders: true,
  t,
  variant: 'header',
});
assert.equal(vacationNoReturn.message, 'We are closed due to vacations');

assert.equal(
  formatShopVacationReturnLine(t, vacationReturn),
  'We will be back on 15-01-2026 at 09:00'
);
assert.equal(
  formatShopVacationMessage(t, 'cart', vacationReturn),
  'We are closed due to vacations. We will be back on 15-01-2026 at 09:00'
);

const paused = resolveShopOrderingBlock({
  vacationActive: false,
  acceptingOrders: false,
  t,
});
assert.equal(paused.reason, 'orders_paused');
assert.equal(paused.message, 'We are not accepting orders at the moment, please call us');

assert.equal(
  resolveShopOrderingBlock({ vacationActive: false, acceptingOrders: true, t }).blocked,
  false
);

assert.equal(vacationCart.blocked, true, 'vacation overrides acceptingOrders=false');
assert.equal(
  resolveShopOrderingBlock({ vacationActive: true, acceptingOrders: false, t }).reason,
  'vacation'
);

assert.equal(shouldShowDeliveryChannelStatus('Open now', 'Open now'), false);
assert.equal(shouldShowDeliveryChannelStatus('Open now', 'Delivery closed'), true);
assert.equal(shouldShowDeliveryChannelStatus('Open now', null), false);

console.log('shop-ordering-status.test.ts: ok');
