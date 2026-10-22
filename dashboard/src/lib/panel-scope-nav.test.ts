/**
 * Panel HQ vs branch nav — run: npx tsx dashboard/src/lib/panel-scope-nav.test.ts
 */
import assert from 'node:assert/strict';
import {
  isHqPanelPath,
  panelCatalogListParams,
  panelOverviewScopeParams,
  shouldRedirectFromHqPanelPath,
  shouldShowHqCatalogBadges,
  shouldShowHqPanelNav,
  shouldHideMerchantSettingsInHqView,
  shouldShowPanelPosQuickAction,
  shouldUseBranchCatalogPanel,
} from './panel-scope-nav';

const multi = { locationCount: 3, maxLocations: 5, isHqView: false };
const multiHq = { ...multi, isHqView: true };
const single = { locationCount: 1, maxLocations: 1, isHqView: false };

assert.equal(isHqPanelPath('/merchant/hq'), true);
assert.equal(isHqPanelPath('/merchant/hq/bulk-pricing'), true);
assert.equal(isHqPanelPath('/merchant/products'), false);

assert.equal(shouldShowHqPanelNav({ ...multi, hqNavLicensed: true }), false);
assert.equal(shouldShowHqPanelNav({ ...multiHq, hqNavLicensed: true }), true);
assert.equal(
  shouldShowHqPanelNav({ ...multiHq, hqNavLicensed: true, pinRestrictsHq: true }),
  false
);
assert.equal(shouldShowHqPanelNav({ ...single, hqNavLicensed: true }), true);
assert.equal(shouldShowHqPanelNav({ ...multiHq, hqNavLicensed: false }), false);

assert.equal(shouldUseBranchCatalogPanel(multi), true);
assert.equal(shouldUseBranchCatalogPanel(multiHq), false);
assert.equal(shouldUseBranchCatalogPanel(single), false);

assert.deepEqual(panelCatalogListParams(multi), { posLocationCatalog: '1' });
assert.deepEqual(panelCatalogListParams({ ...multi, locationId: 'kiosk-1' }), {
  posLocationCatalog: '1',
  locationId: 'kiosk-1',
});
assert.deepEqual(panelCatalogListParams(multiHq), {});

assert.deepEqual(panelOverviewScopeParams(multi), { scope: 'location' });
assert.deepEqual(panelOverviewScopeParams(multiHq), {});
assert.deepEqual(panelOverviewScopeParams(single), {});

assert.equal(shouldShowHqCatalogBadges(multi), false);
assert.equal(shouldShowHqCatalogBadges(multiHq), true);

assert.equal(
  shouldRedirectFromHqPanelPath('/merchant/hq', multi),
  true
);
assert.equal(
  shouldRedirectFromHqPanelPath('/merchant/hq', multiHq),
  false
);

assert.equal(
  shouldShowPanelPosQuickAction({ ...multi, baseAllowed: true }),
  true
);
assert.equal(
  shouldShowPanelPosQuickAction({ ...multiHq, baseAllowed: true }),
  false
);
assert.equal(
  shouldShowPanelPosQuickAction({ ...multiHq, baseAllowed: false }),
  false
);

assert.equal(shouldHideMerchantSettingsInHqView(multi), false);
assert.equal(shouldHideMerchantSettingsInHqView(multiHq), true);
assert.equal(shouldHideMerchantSettingsInHqView(single), false);

console.log('panel-scope-nav.test.ts OK');
