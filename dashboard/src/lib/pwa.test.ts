import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAndroidTabletBrowser,
  isPosLikePath,
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

test('shouldSuppressRebornInstallPromptSync suppresses Android POS browser tabs', () => {
  assert.equal(
    shouldSuppressRebornInstallPromptSync({
      androidPosBrowser: true,
    }),
    true
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
      androidPosBrowser: true,
      pwaInstalled: true,
    }),
    false
  );
});

test('shouldSuppressRebornInstallPromptSync does not suppress fresh Windows browser POS', () => {
  assert.equal(
    shouldSuppressRebornInstallPromptSync({
      androidPosBrowser: false,
      standalone: false,
    }),
    false
  );
});
