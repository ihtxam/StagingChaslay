/**
 * Auto-accept arrival rules —
 * run: npx tsx dashboard/src/lib/delivery-auto-accept.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, 'delivery-auto-accept.ts'), 'utf8');

assert.match(src, /onlineShopAutoAccept/);
assert.match(src, /if \(src === 'kiosk' \|\| src === 'qr_table'\) return false/);
assert.match(src, /if \(src === 'justeat' \|\| src === 'ubereats'\) return true/);
assert.match(src, /return isOnlineShopOrder\(o\) \|\| isDeliveryOrPickupShopOrder\(o\)/);
assert.match(src, /export function shouldUseEtaAcceptModal/);
assert.match(src, /if \(autoAccept\) return false;/);
assert.match(src, /export function keepIncomingOrderAlert/);
assert.match(src, /if \(autoAccept\) return true;/);
assert.match(src, /export function shouldSeedUnactionedAlert/);
assert.doesNotMatch(src, /Online shop delivery\/pickup must use the ETA accept modal/);

const arrival = readFileSync(join(root, 'auto-accept-order-arrival.ts'), 'utf8');
assert.match(arrival, /action: 'accept'/);
assert.match(arrival, /maybePrintOnlineOrderOnArrival/);
assert.match(arrival, /startAutoAcceptArrivalAlert/);
assert.match(arrival, /speakDeliveryAlert/);

const alerts = readFileSync(join(root, '../components/merchant/MerchantOrderAlerts.tsx'), 'utf8');
assert.doesNotMatch(alerts, /printKitchenForAutoAcceptedOrder/);
const center = readFileSync(join(root, '../pages/merchant/OrderCenterApp.tsx'), 'utf8');
assert.doesNotMatch(center, /printKitchenForAutoAcceptedOrder/);

const alert = readFileSync(join(root, 'order-alert.ts'), 'utf8');
assert.match(alert, /const AUTO_ACCEPT_BEEP_COUNT = 6/);
assert.match(alert, /export function startAutoAcceptArrivalAlert/);
assert.match(alert, /export function stopAutoAcceptArrivalAlert/);
assert.match(alert, /speechSynthesis\?\.cancel/);

console.log('delivery-auto-accept.test.ts OK');
