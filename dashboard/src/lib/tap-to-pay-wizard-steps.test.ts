/**
 * Run: npx tsx dashboard/src/lib/tap-to-pay-wizard-steps.test.ts
 */
import assert from 'node:assert/strict';
import {
  bridgeNeedsUpdate,
  buildTapToPayWizardSteps,
  tapToPayWizardComplete,
  tapToPayErrorMessageKey,
} from './tap-to-pay-wizard-steps';

assert.equal(bridgeNeedsUpdate('0.4.0', '0.4.1'), true);
assert.equal(bridgeNeedsUpdate('0.4.1', '0.4.0'), false);
assert.equal(bridgeNeedsUpdate('1.0.0', '0.4.0'), false);

const offline = buildTapToPayWizardSteps({
  bridgeHealth: { ok: false },
  adyenReady: true,
  tapToPayEnabled: true,
});
assert.equal(offline.find((s) => s.id === 'bridgeRunning')?.status, 'error');

const ready = buildTapToPayWizardSteps({
  bridgeHealth: {
    ok: true,
    version: '0.4.1',
    hasAdyenSdk: true,
    tapToPayRegistered: true,
    tapToPayReady: true,
  },
  serverBridgeVersion: '0.4.1',
  adyenReady: true,
  tapToPayEnabled: true,
});
assert.equal(tapToPayWizardComplete(ready), true);
assert.equal(ready.find((s) => s.id === 'register')?.status, 'ok');

const stubApk = buildTapToPayWizardSteps({
  bridgeHealth: { ok: true, version: '0.4.0', hasAdyenSdk: false },
  serverBridgeVersion: '0.4.0',
  adyenReady: true,
  tapToPayEnabled: true,
});
assert.equal(stubApk.find((s) => s.id === 'bridgeInstall')?.status, 'error');

assert.equal(
  tapToPayErrorMessageKey('com.google.android.gms.common.api.ApiException: AuthenticationServiceNotFound'),
  'tapToPayErrAuthService'
);

console.log('tap-to-pay-wizard-steps.test.ts: ok');
