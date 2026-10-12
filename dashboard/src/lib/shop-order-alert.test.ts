/**
 * Shop new-order alert refuse-reason wiring —
 * run: npx tsx dashboard/src/lib/shop-order-alert.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const alerts = readFileSync(join(root, '../components/merchant/MerchantOrderAlerts.tsx'), 'utf8');
assert.match(alerts, /WebPosRejectOrderModal/);
assert.match(alerts, /rejectReason: reason/);

const eta = readFileSync(join(root, '../components/webpos/OrderAcceptWithEtaModal.tsx'), 'utf8');
assert.match(eta, /formatOrderAlertPaymentLine/);
const newAlert = readFileSync(join(root, '../components/webpos/WebPosNewOrderAlertModal.tsx'), 'utf8');
assert.match(newAlert, /formatOrderAlertPaymentLine/);
assert.match(newAlert, /acknowledgeOnly \? 'webPosOrderNoted' : 'webPosOrderTaken'/);
assert.match(newAlert, /if \(order && !acknowledgeOnly\)/);

const autoAccept = readFileSync(join(root, 'delivery-auto-accept.ts'), 'utf8');
assert.match(autoAccept, /shouldUseEtaAcceptModal/);
assert.match(autoAccept, /keepIncomingOrderAlert/);
assert.doesNotMatch(
  autoAccept,
  /Auto-accept on arrival applies to third-party delivery platforms only/
);

const alertsFlow = readFileSync(join(root, '../components/merchant/MerchantOrderAlerts.tsx'), 'utf8');
assert.match(alertsFlow, /persistAutoAcceptOnArrival/);
assert.match(alertsFlow, /startAutoAcceptArrivalCue/);
assert.match(alertsFlow, /acknowledgeOnly = autoAccept && !!current/);
assert.match(alertsFlow, /shouldUseEtaAcceptModal/);

const webpos = readFileSync(join(root, '../pages/merchant/WebPos.tsx'), 'utf8');
assert.match(webpos, /persistAutoAcceptOnArrival/);
assert.match(webpos, /newOrderAlertAcknowledgeOnly = deliveryAutoAccept && !!currentNewOrderAlert/);
assert.match(webpos, /shouldUseEtaAcceptModal/);

const cue = readFileSync(join(root, 'order-alert.ts'), 'utf8');
assert.match(cue, /startAutoAcceptArrivalAlert/);
assert.match(cue, /const AUTO_ACCEPT_BEEP_COUNT = 6/);
assert.match(cue, /stopAutoAcceptArrivalAlert/);

const i18n = readFileSync(join(root, 'i18n.tsx'), 'utf8');
assert.match(i18n, /webPosOrderNoted: "I've seen it"/);
assert.match(i18n, /webPosOrderNoted: 'J\\'ai pris note'/);
assert.match(i18n, /webPosOrderNoted: 'Zur Kenntnis genommen'/);

const nav = readFileSync(join(root, '../components/shop/ShopNavActions.tsx'), 'utf8');
assert.match(nav, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);
const top = readFileSync(join(root, '../components/shop/ShopTopBarActions.tsx'), 'utf8');
assert.match(top, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);
const drawer = readFileSync(join(root, '../components/shop/ShopNavbarDrawerExtras.tsx'), 'utf8');
assert.match(drawer, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);

console.log('shop-order-alert.test.ts OK');
