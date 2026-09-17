/**
 * POS offers modal/tab i18n keys — run: npx tsx dashboard/src/lib/webpos-offers-i18n.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const i18n = readFileSync(join(root, 'i18n.tsx'), 'utf8');
const modal = readFileSync(join(root, '../components/webpos/WebPosOffersModal.tsx'), 'utf8');
const topBar = readFileSync(join(root, '../components/webpos/WebPosTopBar.tsx'), 'utf8');

const KEYS = [
  'webPosTabOffers',
  'webPosOffersTitle',
  'webPosOffersEmpty',
  'webPosOfferActiveToday',
  'webPosOfferScheduled',
  'webPosOfferDiscount',
  'webPosOfferTerms',
  'webPosOfferChannels',
  'webPosOfferChannelPickup',
  'webPosOfferChannelDelivery',
  'webPosOfferChannelDineIn',
  'webPosOfferAllChannels',
  'webPosOfferSchedule',
  'webPosOfferAlways',
  'webPosOfferValid',
];

for (const key of KEYS) {
  const n = i18n.split(`${key}:`).length - 1;
  assert.ok(n >= 3, `${key} must exist in en/fr/de (found ${n})`);
  assert.equal(i18n.includes(`${key}: '${key}'`), false, `${key} must not be a raw self-key`);
}

assert.match(topBar, /t\('webPosTabOffers'\)/);
assert.match(modal, /t\('webPosOffersTitle'\)/);
assert.match(modal, /t\('webPosOfferActiveToday'\)/);

console.log('webpos-offers-i18n.test.ts OK');
