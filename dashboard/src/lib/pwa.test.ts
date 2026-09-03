import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAndroidTabletBrowser,
  isPosLikePath,
  PWA_OPEN_IN_APP_MARK,
  shouldRemoveInstallManifestSync,
  shouldSuppressRebornInstallPromptSync,
} from './pwa.ts';

test('isPosLikePath matches WebPOS routes', () => {
  assert.equal(isPosLikePath('/merchant/pos'), true);
  assert.equal(isPosLikePath('/merchant/pos/'), true);
  assert.equal(isPosLikePath('/merchant/waiter'), true);
  assert.equal(isPosLikePath('/merchant/settings'), false);
});

test('isAndroidTabletBrowser detects Android user agents', () => {
  assert.equal(isAndroidTabletBrowser('Mozilla/5.0 (Linux; Android 13) Chrome/120'), true);
  assert.equal(isAndroidTabletBrowser('Mozilla/5.0 (Windows NT 10.0)'), false);
});

test('shouldSuppressRebornInstallPromptSync suppresses when PWA already installed', () => {
  assert.equal(
    shouldSuppressRebornInstallPromptSync({
      pwaInstalled: true,
    }),
    true
  );
});

test('shouldSuppressRebornInstallPromptSync allows first install on Android POS browser', () => {
  assert.equal(
    shouldSuppressRebornInstallPromptSync({
      standalone: false,
    }),
    false
  );
});

test('shouldSuppressRebornInstallPromptSync respects continue-in-Chrome preference', () => {
  assert.equal(
    shouldSuppressRebornInstallPromptSync({
      browserPreferred: true,
    }),
    true
  );
});

test('shouldSuppressRebornInstallPromptSync respects bridge installed flag', () => {
  assert.equal(
    shouldSuppressRebornInstallPromptSync({
      bridgeInstalled: true,
    }),
    true
  );
});

test('shouldSuppressRebornInstallPromptSync does not suppress kiosk install flow', () => {
  assert.equal(
    shouldSuppressRebornInstallPromptSync({
      kioskPath: true,
      pwaInstalled: true,
    }),
    false
  );
});

test('shouldRemoveInstallManifestSync keeps manifest when PWA installed for Open in app', () => {
  assert.equal(
    shouldRemoveInstallManifestSync({
      pwaInstalled: true,
      bridgeInstalled: false,
      browserPreferred: false,
    }),
    false
  );
});

test('shouldRemoveInstallManifestSync removes manifest for bridge-only Chrome users', () => {
  assert.equal(
    shouldRemoveInstallManifestSync({
      pwaInstalled: false,
      bridgeInstalled: true,
      browserPreferred: false,
    }),
    true
  );
});

test('shouldRemoveInstallManifestSync removes manifest when browser preferred', () => {
  assert.equal(
    shouldRemoveInstallManifestSync({
      browserPreferred: true,
    }),
    true
  );
});

test('staging bundle marker is present for grep verification', () => {
  assert.equal(PWA_OPEN_IN_APP_MARK, 'pwa-open-in-app-v1');
});
