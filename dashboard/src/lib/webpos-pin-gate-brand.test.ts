/**
 * PIN gate branding slots — run:
 * npx tsx dashboard/src/lib/webpos-pin-gate-brand.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  merchantPinGateInitials,
  pinGateMerchantLogoUrl,
  pinGateMerchantName,
  pinGateSessionMerchantName,
} from './webpos-pin-gate-brand';

assert.equal(merchantPinGateInitials('Brazza Pizza'), 'BP');
assert.equal(merchantPinGateInitials('  exotic  '), 'EX');
assert.equal(merchantPinGateInitials(''), '');
assert.equal(merchantPinGateInitials(null), '');
assert.equal(pinGateMerchantLogoUrl(' /logo.png '), '/logo.png');
assert.equal(pinGateMerchantLogoUrl(null), '');
assert.equal(pinGateMerchantName('Brazza', 'Session Shop'), 'Brazza');
assert.equal(pinGateMerchantName('  ', 'Brazza'), 'Brazza');
assert.equal(pinGateMerchantName(null, 'Brazza'), 'Brazza');
assert.equal(pinGateMerchantName(null, null), '');
assert.equal(pinGateSessionMerchantName({ role: 'merchant', name: 'Brazza' }), 'Brazza');
assert.equal(pinGateSessionMerchantName({ role: 'staff', name: 'Alex' }), '');
assert.equal(pinGateSessionMerchantName(null), '');

const root = dirname(fileURLToPath(import.meta.url));
const modal = readFileSync(join(root, '../components/WebPosPinModal.tsx'), 'utf8');
const css = readFileSync(join(root, '../index.css'), 'utf8');
const dashboard = readFileSync(join(root, '../pages/merchant/Dashboard.tsx'), 'utf8');
const waiter = readFileSync(join(root, '../pages/merchant/WaiterApp.tsx'), 'utf8');

assert.match(modal, /webpos-pin-gate-merchant-logo/);
assert.match(modal, /merchantPinGateInitials/);
assert.match(
  modal,
  /footerLogoUrl = REBORN_LOGO_WHITE/,
  'footer must always use the Reborn wordmark'
);
assert.equal(
  modal.includes('src={footerLogoUrl}'),
  true,
  'footer still renders the Reborn wordmark'
);
assert.equal(
  /webpos-pin-gate-merchant-logo[\s\S]{0,400}REBORN_LOGO/.test(modal),
  false,
  'top-right must not fall back to the Reborn mark'
);
assert.match(modal, /webpos-pin-gate-time/);
assert.equal(
  modal.includes('webpos-pin-gate-clock') && /webpos-pin-gate-clock[\s\S]{0,800}<img/.test(modal),
  false,
  'clock column must not show a merchant badge under the time'
);
assert.match(
  modal,
  /webpos-pin-gate-entry[\s\S]*min-\[640px\]:justify-center/,
  'desktop keypad column must sit centered with the clock'
);
assert.match(modal, /webpos-pin-gate-keypad-shell/, 'mobile keypad shell anchors to bottom');
assert.match(modal, /webpos-pin-gate-mobile-clock/, 'mobile stacks clock above PIN copy');
assert.match(
  css,
  /@media \(max-width: 639px\)[\s\S]*webpos-pin-gate-keypad-shell[\s\S]*padding-top: 30px/,
  'mobile CSS keeps 30px between copy and keypad'
);
assert.match(
  css,
  /@media \(min-width: 640px\) and \(min-height: 521px\)[\s\S]*webpos-pin-gate-entry[\s\S]*justify-content: center/,
  'wide desktop/landscape CSS must lower/center the keypad'
);
assert.match(dashboard, /pinGateMerchantName/);
assert.match(dashboard, /logoUrl=\{merchantShopLogoUrl\}/);
assert.match(waiter, /pinGateMerchantName/);
assert.match(waiter, /logoUrl=\{merchantLogoUrl\}/);

console.log('webpos-pin-gate-brand: all assertions passed');
