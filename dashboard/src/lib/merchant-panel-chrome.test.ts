/**
 * Merchant panel chrome — store name in the shared header, settings gear stays mounted.
 * Run: npx tsx dashboard/src/lib/merchant-panel-chrome.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { displaySidebarShopName } from './brand';
import { pinGateSessionMerchantName } from './webpos-pin-gate-brand';

const root = dirname(fileURLToPath(import.meta.url));
const header = readFileSync(join(root, '../components/Header.tsx'), 'utf8');
const sidebar = readFileSync(join(root, '../components/Sidebar.tsx'), 'utf8');
const dashboard = readFileSync(join(root, '../pages/merchant/Dashboard.tsx'), 'utf8');
const settings = readFileSync(join(root, '../pages/merchant/Settings.tsx'), 'utf8');
const productEdit = readFileSync(join(root, '../components/products/ProductEditFullPage.tsx'), 'utf8');
const modifiers = readFileSync(join(root, '../pages/merchant/Modifiers.tsx'), 'utf8');

assert.equal(displaySidebarShopName('Brazza Pizza'), 'Brazza Pizza');
assert.equal(displaySidebarShopName('  exotic  '), 'exotic');
assert.equal(pinGateSessionMerchantName({ role: 'merchant', name: 'Brazza' }), 'Brazza');
assert.equal(pinGateSessionMerchantName({ role: 'staff', name: 'Alex' }), '');

assert.match(header, /storeName\?:/);
assert.match(header, /displaySidebarShopName/);
assert.match(header, /pinGateSessionMerchantName/);
assert.match(
  header,
  /storeLabel \? \([\s\S]*truncate text-sm font-semibold/,
  'compact header must render the store name next to the hamburger'
);

assert.match(dashboard, /storeName=\{merchantShopName\}/);
assert.match(dashboard, /settings\?\.businessName/);
assert.match(
  dashboard,
  /isSettingsRoute[\s\S]*panel-main flex min-h-0 flex-1 flex-col overflow-hidden p-0/,
  'settings route keeps panel-main flush; horizontal inset lives only on merchant-settings-shell'
);
assert.doesNotMatch(settings, /RebornPoweredByFooter/);
assert.match(settings, /merchant-settings-shell[\s\S]*max-w-none/);
assert.match(sidebar, /panelBuildLabel/);

assert.match(
  sidebar,
  /profileMenu\?\.settingsPath \? \(/,
  'settings gear must stay mounted whenever a settings path exists'
);
assert.equal(
  /!isPathActive\(location\.pathname, profileMenu\.settingsPath/.test(sidebar),
  false,
  'must not unmount the settings gear on /merchant/settings'
);
assert.match(sidebar, /aria-pressed=\{settingsActive/);
assert.match(sidebar, /<Settings \/>/);

assert.match(
  settings,
  /merchant-settings-shell[\s\S]*sm:px-4/,
  'settings shell owns horizontal padding (panel-main p-0)'
);
assert.match(
  settings,
  /merchant-settings-scroll/,
  'settings scroll root should get scrollbar styling'
);
assert.match(
  modifiers,
  /merchant-dialog-surface[\s\S]*bg-\[var\(--bg-elevated\)\]/,
  'link-products picker must not be transparent'
);
assert.match(
  productEdit,
  /formProductType[\s\S]*onProductTypeChange/,
  'edit product must expose product type like create flow'
);
assert.match(modifiers, /modifier-field/, 'modifiers drawer inputs must not use global `.field`');

console.log('merchant-panel-chrome: all assertions passed');
