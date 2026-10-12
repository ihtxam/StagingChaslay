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

console.log('merchant-panel-chrome: all assertions passed');
