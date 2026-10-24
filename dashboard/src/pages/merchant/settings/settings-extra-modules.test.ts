import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isComoLicensed,
  isFiskalyLicensed,
  isLicensedSettingsAddonTab,
  listInactiveExtraModules,
} from './settings-extra-modules.ts';

test('listInactiveExtraModules includes kiosk when not licensed', () => {
  const inactive = listInactiveExtraModules(
    { kioskAddonEnabled: false, editionFeatures: [] },
    { isRetailMerchant: false }
  );
  assert.ok(inactive.some((m) => m.id === 'kiosk'));
});

test('listInactiveExtraModules omits kiosk when licensed', () => {
  const inactive = listInactiveExtraModules(
    { kioskAddonEnabled: true },
    { isRetailMerchant: false }
  );
  assert.ok(!inactive.some((m) => m.id === 'kiosk'));
});

test('isLicensedSettingsAddonTab gates fiscal and como', () => {
  const ctx = { isRetailMerchant: false };
  assert.equal(isLicensedSettingsAddonTab('fiscal', { fiskalySettings: { enabled: false } }, ctx), false);
  assert.equal(isLicensedSettingsAddonTab('fiscal', { fiskalySettings: { enabled: true } }, ctx), true);
  assert.equal(isLicensedSettingsAddonTab('como', { comoSettings: { enabled: false } }, ctx), false);
  assert.equal(isLicensedSettingsAddonTab('como', { comoSettings: { configured: true } }, ctx), true);
});

test('isComoLicensed and isFiskalyLicensed', () => {
  assert.equal(isComoLicensed(null), false);
  assert.equal(isComoLicensed({ comoSettings: { enabled: true } }), true);
  assert.equal(isFiskalyLicensed({ fiskalySettings: { enabled: true } }), true);
});
