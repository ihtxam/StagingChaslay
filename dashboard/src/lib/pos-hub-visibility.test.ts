/**
 * POS hub visibility — run: npx tsx dashboard/src/lib/pos-hub-visibility.test.ts
 */
import assert from 'node:assert/strict';
import {
  shouldShowLocationSwitcher,
  shouldShowOnlineReservationsToggle,
  shouldShowPosOptionChooser,
  shouldShowReservationsSettings,
} from './pos-hub-visibility';

assert.equal(
  shouldShowOnlineReservationsToggle({
    isRetail: false,
    reservationsEnabled: false,
    editionFeatures: null,
  }),
  false,
  'module off hides hub toggle even for legacy editions'
);

assert.equal(
  shouldShowOnlineReservationsToggle({
    isRetail: false,
    reservationsEnabled: true,
    editionFeatures: null,
  }),
  true,
  'legacy catalog + module on shows toggle'
);

assert.equal(
  shouldShowOnlineReservationsToggle({
    isRetail: false,
    reservationsEnabled: true,
    editionFeatures: ['pos_tables', 'online_shop'],
  }),
  false,
  'edition without reservations hides toggle'
);

assert.equal(
  shouldShowOnlineReservationsToggle({
    isRetail: false,
    reservationsEnabled: true,
    editionFeatures: ['reservations'],
  }),
  true,
  'licensed + module on shows toggle'
);

assert.equal(
  shouldShowOnlineReservationsToggle({
    isRetail: true,
    reservationsEnabled: true,
    editionFeatures: ['reservations'],
  }),
  false,
  'retail never shows reservations toggle'
);

assert.equal(
  shouldShowReservationsSettings({
    isRetail: false,
    reservationsEnabled: false,
    editionFeatures: ['reservations'],
  }),
  true,
  'licensed restaurant can open reservations settings while module is off'
);

assert.equal(
  shouldShowReservationsSettings({
    isRetail: false,
    reservationsEnabled: false,
    editionFeatures: ['online_shop'],
  }),
  false,
  'unlicensed restaurant hides reservations settings'
);

assert.equal(shouldShowPosOptionChooser(0), false);
assert.equal(shouldShowPosOptionChooser(1), false);
assert.equal(shouldShowPosOptionChooser(2), true);
assert.equal(
  shouldShowPosOptionChooser(3, 1),
  false,
  'maxPosPosts=1 hides chooser even with extra options'
);
assert.equal(shouldShowPosOptionChooser(2, 0), true, 'unlimited posts keep the chooser');
assert.equal(shouldShowPosOptionChooser(2, 2), true);

assert.equal(
  shouldShowLocationSwitcher({ locationCount: 1, maxLocations: 0 }),
  false,
  'single location hides switcher even when HQ is licensed'
);
assert.equal(
  shouldShowLocationSwitcher({ locationCount: 2, maxLocations: 1 }),
  true,
  'existing multi-branch merchants always get the switcher'
);
assert.equal(
  shouldShowLocationSwitcher({ locationCount: 2, maxLocations: 0 }),
  true
);
assert.equal(
  shouldShowLocationSwitcher({ locationCount: 2, maxLocations: 1, maxPosPosts: 1 }),
  false
);
assert.equal(
  shouldShowLocationSwitcher({ locationCount: 2 }),
  true,
  'count>1 with unknown license still shows'
);

console.log('pos-hub-visibility.test.ts OK');
