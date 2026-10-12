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
assert.match(eta, /max-w-2xl/);
assert.match(eta, /NewOrderAlertHeader/);
assert.match(eta, /fulfillmentChannel=\{order\.fulfillmentChannel\}/);
assert.match(eta, /paymentStatus=\{order\.paymentStatus\}/);
const newAlert = readFileSync(join(root, '../components/webpos/WebPosNewOrderAlertModal.tsx'), 'utf8');
assert.match(newAlert, /formatOrderAlertPaymentLine/);
assert.match(newAlert, /max-w-2xl/);
assert.match(newAlert, /NewOrderAlertHeader/);
const header = readFileSync(join(root, '../components/webpos/NewOrderAlertHeader.tsx'), 'utf8');
assert.match(header, /orderAlertFulfillmentLabel/);
assert.match(header, /orderAlertPaidLabel/);
const i18n = readFileSync(join(root, 'i18n.tsx'), 'utf8');
assert.match(i18n, /orderAlertTakeaway: 'TAKEAWAY'/);
assert.match(i18n, /orderAlertTakeaway: 'À EMPORTER'/);
assert.match(i18n, /orderAlertTakeaway: 'ZUM MITNEHMEN'/);
assert.match(i18n, /orderAlertDelivery: 'LIVRAISON'/);
assert.match(i18n, /orderAlertPaid: 'PAYÉ'/);
assert.match(i18n, /orderAlertUnpaid: 'IMPAYÉ'/);
assert.match(i18n, /orderAlertUnpaid: 'UNBEZAHLT'/);

const nav = readFileSync(join(root, '../components/shop/ShopNavActions.tsx'), 'utf8');
assert.match(nav, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);
const top = readFileSync(join(root, '../components/shop/ShopTopBarActions.tsx'), 'utf8');
assert.match(top, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);
const drawer = readFileSync(join(root, '../components/shop/ShopNavbarDrawerExtras.tsx'), 'utf8');
assert.match(drawer, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);

console.log('shop-order-alert.test.ts OK');
