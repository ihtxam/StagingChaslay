import assert from 'node:assert/strict';
import test from 'node:test';
import { lockPageScroll } from './useLockPageScroll.ts';

test('lockPageScroll hides overflow on html, body, and panel-main', () => {
  if (typeof document === 'undefined') return;

  const main = document.createElement('main');
  main.className = 'panel-main';
  main.style.overflowY = 'auto';
  document.body.append(main);

  try {
    const unlock = lockPageScroll();
    assert.equal(document.documentElement.style.overflow, 'hidden');
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(main.style.overflow, 'hidden');
    assert.equal(main.style.overscrollBehavior, 'none');
    unlock();
    assert.equal(main.style.overflow, '');
    assert.equal(main.style.overscrollBehavior, '');
  } finally {
    main.remove();
  }
});
