import assert from 'node:assert/strict';
import { isPanelMobileViewportPath } from './panel-mobile-keyboard.ts';

assert.equal(isPanelMobileViewportPath('/merchant/settings'), true);
assert.equal(isPanelMobileViewportPath('/merchant/products'), true);
assert.equal(isPanelMobileViewportPath('/merchant/pos'), false);
assert.equal(isPanelMobileViewportPath('/merchant/waiter'), false);
assert.equal(isPanelMobileViewportPath('/shop/demo/menu'), false);

console.log('panel-mobile-keyboard.test.ts OK');
