/**
 * Notification history routing — run: npx tsx dashboard/src/lib/platform-notifications.test.ts
 */
import assert from 'node:assert/strict';
import { isPlatformNotificationsPath, platformNotificationsPath } from './platform-notifications';
import { canAccessRoute, type Permission } from './permissions';

assert.equal(platformNotificationsPath('/merchant'), '/merchant/notifications');
assert.equal(platformNotificationsPath('/merchant/orders'), '/merchant/notifications');
assert.equal(platformNotificationsPath('/reseller/merchants'), '/reseller/notifications');
assert.equal(isPlatformNotificationsPath('/merchant/notifications'), true);
assert.equal(isPlatformNotificationsPath('/merchant/notifications/'), true);
assert.equal(isPlatformNotificationsPath('/reseller/notifications'), true);
assert.equal(isPlatformNotificationsPath('/merchant/orders'), false);

const cashier: Permission[] = ['USE_WEBPOS', 'PROCESS_PAYMENTS', 'VIEW_ORDER_HISTORY'];
assert.equal(canAccessRoute('/merchant/notifications', cashier, false), true);
assert.equal(canAccessRoute('/merchant/notifications', [], true), true);

const orderCenterOnly: Permission[] = ['VIEW_ORDER_HISTORY'];
assert.equal(canAccessRoute('/merchant/notifications', orderCenterOnly, false), true);

console.log('platform-notifications.test.ts: ok');
