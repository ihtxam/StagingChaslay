/**
 * POS toast pref — run: npx tsx dashboard/src/lib/pos-toast-pref.test.ts
 */
import assert from 'node:assert/strict';
import { shouldShowPosToast } from './pos-toast-pref';

assert.equal(shouldShowPosToast({ showPosToasts: true, toastType: 'success' }), true);
assert.equal(shouldShowPosToast({ showPosToasts: true, toastType: 'error' }), true);
assert.equal(shouldShowPosToast({ showPosToasts: false, toastType: 'success' }), false);
assert.equal(shouldShowPosToast({ showPosToasts: false, toastType: 'blank' }), false);
assert.equal(shouldShowPosToast({ showPosToasts: false, toastType: 'error' }), true);

console.log('pos-toast-pref.test.ts OK');
