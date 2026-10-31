/**
 * Panel location chrome — run: npx tsx dashboard/src/lib/panel-location-header.test.ts
 */
import assert from 'node:assert/strict';
import { buildPanelLocationHeaderLabels } from './panel-location-header';

const merchant = 'Café Röschibach';
const multiBranch = {
  merchantName: merchant,
  locationCount: 3,
  maxLocations: 5,
  isHqView: false,
  location: { name: 'Kiosk Café Röschibach', businessCategory: 'retail' },
};

assert.deepEqual(buildPanelLocationHeaderLabels(multiBranch), {
  primary: 'Kiosk Café Röschibach',
  secondary: merchant,
  showHqBadge: false,
  scopeTag: 'Retail',
});

assert.deepEqual(
  buildPanelLocationHeaderLabels({ ...multiBranch, isHqView: true, location: null }),
  {
    primary: merchant,
    secondary: null,
    showHqBadge: true,
    scopeTag: null,
  }
);

assert.deepEqual(
  buildPanelLocationHeaderLabels({
    merchantName: merchant,
    locationCount: 1,
    maxLocations: 1,
    isHqView: false,
    location: { name: 'Only', businessCategory: 'restaurant' },
  }),
  {
    primary: merchant,
    secondary: null,
    showHqBadge: false,
    scopeTag: null,
  }
);

console.log('panel-location-header.test.ts OK');
