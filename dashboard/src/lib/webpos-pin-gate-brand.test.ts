/**
 * PIN gate branding slots — run:
 * npx tsx dashboard/src/lib/webpos-pin-gate-brand.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merchantPinGateInitials, pinGateMerchantLogoUrl } from './webpos-pin-gate-brand';

assert.equal(merchantPinGateInitials('Brazza Pizza'), 'BP');
assert.equal(merchantPinGateInitials('  exotic  '), 'EX');
assert.equal(merchantPinGateInitials(''), '');
assert.equal(merchantPinGateInitials(null), '');
assert.equal(pinGateMerchantLogoUrl(' /logo.png '), '/logo.png');
assert.equal(pinGateMerchantLogoUrl(null), '');

const root = dirname(fileURLToPath(import.meta.url));
const modal = readFileSync(join(root, '../components/WebPosPinModal.tsx'), 'utf8');

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
const clockSection = modal.match(
  /<section className="webpos-pin-gate-clock[\s\S]*?<\/section>/
)?.[0] || '';
assert.match(clockSection, /webpos-pin-gate-time/);
assert.equal(
  clockSection.includes('<img'),
  false,
  'clock column must not show a merchant badge under the time'
);

console.log('webpos-pin-gate-brand: all assertions passed');
