/**
 * Order Center vs WebPOS home routing — run:
 * npx tsx dashboard/src/lib/merchant-app-home.test.ts
 */
import assert from 'node:assert/strict';
import {
  allowOrderCenterRoute,
  resolveDeniedRouteFallback,
  resolveMissingPosRedirect,
  sanitizeBridgeWebAppPath,
} from './merchant-app-home.ts';

{
  assert.equal(
    resolveDeniedRouteFallback({
      currentPath: '/merchant/order-center',
      homePath: '/merchant/order-center',
    }),
    null
  );
  assert.equal(
    resolveDeniedRouteFallback({
      currentPath: '/merchant/order-center',
      homePath: '/merchant',
    }),
    '/merchant'
  );
  assert.equal(
    resolveDeniedRouteFallback({
      currentPath: '/merchant/pos',
      homePath: '/merchant/order-center',
    }),
    '/merchant/order-center'
  );
}

{
  assert.equal(
    allowOrderCenterRoute({
      showOrderCenter: false,
      productFlagsReady: false,
      isOrderCenterOnlyStaff: false,
    }),
    true
  );
  assert.equal(
    allowOrderCenterRoute({
      showOrderCenter: false,
      productFlagsReady: true,
      isOrderCenterOnlyStaff: true,
    }),
    true
  );
  assert.equal(
    allowOrderCenterRoute({
      showOrderCenter: false,
      productFlagsReady: true,
      isOrderCenterOnlyStaff: false,
    }),
    false
  );
  assert.equal(
    allowOrderCenterRoute({
      showOrderCenter: true,
      productFlagsReady: true,
      isOrderCenterOnlyStaff: false,
    }),
    true
  );
}

{
  assert.equal(
    resolveMissingPosRedirect({
      hasPos: true,
      showOrderCenter: false,
      productFlagsReady: true,
    }),
    null
  );
  assert.equal(
    resolveMissingPosRedirect({
      hasPos: false,
      showOrderCenter: true,
      productFlagsReady: false,
    }),
    null
  );
  assert.equal(
    resolveMissingPosRedirect({
      hasPos: false,
      showOrderCenter: true,
      productFlagsReady: true,
    }),
    '/merchant/order-center'
  );
  assert.equal(
    resolveMissingPosRedirect({
      hasPos: false,
      showOrderCenter: false,
      productFlagsReady: true,
    }),
    '/merchant'
  );
}

{
  assert.equal(sanitizeBridgeWebAppPath('/merchant/order-center'), '/merchant/order-center');
  assert.equal(sanitizeBridgeWebAppPath('/merchant/order-center?x=1'), '/merchant/order-center');
  assert.equal(sanitizeBridgeWebAppPath('/merchant/pos'), '/merchant/pos');
  assert.equal(sanitizeBridgeWebAppPath('/login'), '/merchant/pos');
  assert.equal(sanitizeBridgeWebAppPath('https://evil.example/merchant/pos'), '/merchant/pos');
}

console.log('merchant-app-home: all assertions passed');
