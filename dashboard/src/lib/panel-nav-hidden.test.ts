/**
 * Reseller-hidden merchant sidebar keys must hide the matching menu.
 * Run: npx tsx dashboard/src/lib/panel-nav-hidden.test.ts
 */
import assert from 'node:assert/strict';
import {
  isPanelNavGroupHidden,
  isPanelNavHidden,
  isPanelNavOptionChecked,
  parsePanelNavHidden,
  togglePanelNavOption,
} from './panel-nav-hidden';

assert.deepEqual(parsePanelNavHidden(['cms', 'products']), ['cms', 'products']);
assert.deepEqual(parsePanelNavHidden('["cms","customers"]'), ['cms', 'customers']);
assert.deepEqual(parsePanelNavHidden('cms,sales'), ['cms', 'sales']);
assert.deepEqual(parsePanelNavHidden(null), []);
assert.deepEqual(parsePanelNavHidden(undefined), []);
assert.deepEqual(parsePanelNavHidden(''), []);

assert.equal(isPanelNavGroupHidden('cms', ['cms']), true);
assert.equal(isPanelNavGroupHidden('cms', '["cms"]'), true);
assert.equal(isPanelNavHidden('/merchant/online-shop', ['cms']), true);
assert.equal(isPanelNavHidden('/merchant/website', ['cms']), true);
assert.equal(isPanelNavHidden('/merchant/chaslay-page-builder', ['cms']), true);
assert.equal(isPanelNavHidden('/merchant/chaslay-page-builder/edit', ['cms']), true);
assert.equal(isPanelNavHidden('/merchant/shop-seo-footer', ['cms']), true);
assert.equal(isPanelNavHidden('/merchant/orders', ['cms']), false);

assert.equal(isPanelNavHidden('/merchant/online-shop', ['/merchant/online-shop']), true);
assert.equal(isPanelNavGroupHidden('cms', ['/merchant/online-shop']), false);

assert.equal(isPanelNavGroupHidden('products', ['products']), true);
assert.equal(isPanelNavGroupHidden('products', ['catalog']), true);
assert.equal(isPanelNavHidden('/merchant/products', ['products']), true);
assert.equal(isPanelNavHidden('/merchant/products/catering-guide', ['catalog']), true);
assert.equal(isPanelNavHidden('/merchant/inventory', ['products']), false);
assert.equal(isPanelNavHidden('/merchant/reports', ['products']), false);

assert.equal(isPanelNavGroupHidden('inventory', ['inventory']), true);
assert.equal(isPanelNavHidden('/merchant/inventory/list', ['inventory']), true);
assert.equal(isPanelNavHidden('/merchant/storekeeper', ['inventory']), true);

assert.equal(isPanelNavGroupHidden('hq', ['hq']), true);
assert.equal(isPanelNavHidden('/merchant/hq/bulk-pricing', ['hq']), true);

assert.equal(isPanelNavGroupHidden('sales', ['sales']), true);
assert.equal(isPanelNavHidden('/merchant/orders', ['sales']), true);

assert.equal(isPanelNavGroupHidden('customers', ['customers']), true);
assert.equal(isPanelNavHidden('/merchant/loyalty', ['customers']), true);

assert.equal(isPanelNavHidden('/merchant/platform-shop', ['platform-shop']), true);

assert.equal(
  isPanelNavGroupHidden('cms', ['/merchant/online-shop', '/merchant/website', '/merchant/chaslay-page-builder', '/merchant/shop-seo-footer']),
  true
);

assert.equal(isPanelNavOptionChecked('products', ['catalog']), true);
assert.equal(isPanelNavOptionChecked('cms', ['cms']), true);
assert.deepEqual(togglePanelNavOption(['catalog'], 'products', false), []);
assert.deepEqual(togglePanelNavOption([], 'cms', true), ['cms']);

console.log('panel-nav-hidden tests passed');
