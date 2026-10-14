/**
 * Run: npx tsx dashboard/src/lib/webpos-fullscreen.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  androidPwaNeedsImmersiveFullscreen,
  isPwaWindowAlreadyImmersive,
} from './webpos-fullscreen.ts';

function withMatchMedia(
  matches: (query: string) => boolean,
  ua: string,
  fn: () => void
) {
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;
  globalThis.window = {
    matchMedia: (query: string) => ({
      matches: matches(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  } as Window;
  globalThis.document = { fullscreenElement: null } as Document;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: ua, standalone: false },
  });
  try {
    fn();
  } finally {
    globalThis.window = priorWindow;
    globalThis.document = priorDocument;
  }
}

test('android standalone PWA needs immersive API even when display-mode is fullscreen', () => {
  withMatchMedia(
    (q) => q.includes('standalone') || q.includes('fullscreen'),
    'Mozilla/5.0 (Linux; Android 14; Pixel Tablet)',
    () => {
      assert.equal(androidPwaNeedsImmersiveFullscreen(), true);
      assert.equal(isPwaWindowAlreadyImmersive(), false);
    }
  );
});

test('non-android fullscreen display-mode counts as immersive', () => {
  withMatchMedia(
    (q) => q.includes('fullscreen'),
    'Mozilla/5.0 (Windows NT 10.0)',
    () => {
      assert.equal(androidPwaNeedsImmersiveFullscreen(), false);
      assert.equal(isPwaWindowAlreadyImmersive(), true);
    }
  );
});
