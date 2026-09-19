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

const nav = readFileSync(join(root, '../components/shop/ShopNavActions.tsx'), 'utf8');
assert.match(nav, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);
const top = readFileSync(join(root, '../components/shop/ShopTopBarActions.tsx'), 'utf8');
assert.match(top, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);
const drawer = readFileSync(join(root, '../components/shop/ShopNavbarDrawerExtras.tsx'), 'utf8');
assert.match(drawer, /loggedIn \? t\('shopMyAccount'\) : t\('shopLogIn'\)/);

console.log('shop-order-alert.test.ts OK');
