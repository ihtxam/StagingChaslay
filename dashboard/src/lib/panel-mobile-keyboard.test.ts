import assert from 'node:assert/strict';
import {
  isPanelMobileViewportPath,
  shouldPinPanelToVisualViewport,
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

console.log('panel-mobile-keyboard.test.ts OK');
