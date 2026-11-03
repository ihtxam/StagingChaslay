import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  clearWebPosVisualViewport,
  isIosVisualViewportPin,
  isPanelMobileViewportPath,
  releasePanelViewportOffset,
  shouldPinPanelToVisualViewport,
  syncWebPosVisualViewport,
} from './panel-mobile-keyboard.ts';

assert.equal(isPanelMobileViewportPath('/merchant/settings'), true);
assert.equal(isPanelMobileViewportPath('/merchant/products'), true);
assert.equal(isPanelMobileViewportPath('/merchant/pos'), false);
assert.equal(isPanelMobileViewportPath('/merchant/waiter'), false);
assert.equal(isPanelMobileViewportPath('/shop/demo/menu'), false);

assert.equal(
  shouldPinPanelToVisualViewport({ ios: true, focusedTextEntry: true, insetPx: 280 }),
  true
);
assert.equal(
  shouldPinPanelToVisualViewport({ ios: false, focusedTextEntry: true, insetPx: 280 }),
  false,
  'Android must not pin the shell — that offset sticks on Settings and POS'
);
assert.equal(
  shouldPinPanelToVisualViewport({ ios: true, focusedTextEntry: false, insetPx: 280 }),
  false
);
assert.equal(
  shouldPinPanelToVisualViewport({ ios: true, focusedTextEntry: true, insetPx: 20 }),
  false
);

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
assert.equal(
  css.includes('top: var(--panel-vv-top'),
  false,
  'visual viewport offset must not shift the panel shell'
);
assert.equal(css.includes('left: var(--panel-vv-left'), false);

const cssRelease = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
assert.equal(cssRelease.includes('--webpos-vvh'), true, 'POS shell must track visual viewport height');
assert.equal(
  cssRelease.includes('.webpos-register-stack'),
  true,
  'register layout must dock express checkout under the product grid'
);
assert.equal(
  cssRelease.includes('.webpos-register-stack .webpos-product-scroll'),
  true,
  'register product grid must grow in the flex column'
);
assert.equal(
  cssRelease.includes('.webpos-register-stack .webpos-express-dock'),
  true,
  'express checkout must pin to the register column bottom'
);
assert.equal(
  cssRelease.includes('.webpos-register-tail-spacer'),
  false,
  'tail spacer must not sit between products and express checkout'
);

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('webpos-lock');
  const vv = window.visualViewport;
  if (vv) {
    Object.defineProperty(vv, 'offsetTop', { configurable: true, value: 44 });
    syncWebPosVisualViewport();
    assert.equal(
      document.documentElement.style.getPropertyValue('--webpos-vv-top'),
      isIosVisualViewportPin() ? '44px' : '',
      'non-iOS must not apply visual viewport top offset on POS'
    );
    Object.defineProperty(vv, 'offsetTop', { configurable: true, value: 0 });
  }
  document.documentElement.classList.remove('webpos-lock');
  clearWebPosVisualViewport();
}

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('panel-vv-sync', 'panel-kb-open');
  document.documentElement.style.setProperty('--panel-vvh', '480px');
  releasePanelViewportOffset();
  assert.equal(document.documentElement.classList.contains('panel-vv-sync'), false);
  assert.equal(document.documentElement.classList.contains('panel-kb-open'), false);
  assert.equal(document.documentElement.style.getPropertyValue('--panel-vvh'), '');
}

console.log('panel-mobile-keyboard.test.ts OK');
