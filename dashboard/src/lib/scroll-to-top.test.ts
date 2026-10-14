import assert from 'node:assert/strict';
import test from 'node:test';
import {
  capturePageScroll,
  hasLocationHash,
  isFullscreenAppRoute,
  locationKey,
  resetNestedPageScrollers,
  resolveScrollNavAction,
  restorePageScroll,
  scrollNewPageToTop,
} from './scroll-to-top.ts';

test('isFullscreenAppRoute skips POS, kiosk, and display shells', () => {
  assert.equal(isFullscreenAppRoute('/merchant/pos'), true);
  assert.equal(isFullscreenAppRoute('/merchant/pos/held'), true);
  assert.equal(isFullscreenAppRoute('/merchant/waiter'), true);
  assert.equal(isFullscreenAppRoute('/merchant/storekeeper'), true);
  assert.equal(isFullscreenAppRoute('/merchant/order-center'), true);
  assert.equal(isFullscreenAppRoute('/kiosk'), true);
  assert.equal(isFullscreenAppRoute('/kiosk/abc'), true);
  assert.equal(isFullscreenAppRoute('/kds'), true);
  assert.equal(isFullscreenAppRoute('/cds/token'), true);
  assert.equal(isFullscreenAppRoute('/tv/token'), true);
  assert.equal(isFullscreenAppRoute('/pos-embed'), true);
  assert.equal(isFullscreenAppRoute('/merchant/products'), false);
  assert.equal(isFullscreenAppRoute('/merchant/settings'), false);
  assert.equal(isFullscreenAppRoute('/shop/brazza/menu'), false);
  assert.equal(isFullscreenAppRoute('/reseller/merchants'), false);
});

test('hasLocationHash ignores empty and bare #', () => {
  assert.equal(hasLocationHash(''), false);
  assert.equal(hasLocationHash('#'), false);
  assert.equal(hasLocationHash('#   '), false);
  assert.equal(hasLocationHash('#opening-hours'), true);
  assert.equal(hasLocationHash('#contact'), true);
});

test('resolveScrollNavAction: PUSH to a new page goes to top', () => {
  assert.equal(
    resolveScrollNavAction({
      pathname: '/shop/brazza/gift-cards',
      prevPathname: '/shop/brazza/menu',
      hash: '',
      navigationType: 'PUSH',
    }),
    'top'
  );
  assert.equal(
    resolveScrollNavAction({
      pathname: '/merchant/orders',
      prevPathname: '/merchant/products',
      navigationType: 'REPLACE',
    }),
    'top'
  );
});

test('resolveScrollNavAction: hash stays on the target, not the top', () => {
  assert.equal(
    resolveScrollNavAction({
      pathname: '/shop/brazza',
      prevPathname: '/shop/brazza/menu',
      hash: '#opening-hours',
      navigationType: 'PUSH',
    }),
    'hash'
  );
  assert.equal(
    resolveScrollNavAction({
      pathname: '/merchant/settings',
      prevPathname: '/merchant/settings',
      hash: '#pos-mode',
      navigationType: 'PUSH',
    }),
    'hash'
  );
});

test('resolveScrollNavAction: POP restores; same-path query does not jump', () => {
  assert.equal(
    resolveScrollNavAction({
      pathname: '/shop/brazza/menu',
      prevPathname: '/shop/brazza/gift-cards',
      navigationType: 'POP',
    }),
    'restore'
  );
  assert.equal(
    resolveScrollNavAction({
      pathname: '/reseller/merchants',
      prevPathname: '/reseller/merchants',
      hash: '',
      navigationType: 'PUSH',
    }),
    'skip'
  );
});

test('resolveScrollNavAction: first paint (same path) and POS never reset', () => {
  assert.equal(
    resolveScrollNavAction({
      pathname: '/shop/brazza/menu',
      prevPathname: '/shop/brazza/menu',
      navigationType: 'POP',
    }),
    'skip'
  );
  assert.equal(
    resolveScrollNavAction({
      pathname: '/merchant/pos',
      prevPathname: '/merchant/products',
      navigationType: 'PUSH',
    }),
    'skip'
  );
});

test('locationKey includes search when present', () => {
  assert.equal(locationKey('/menu', ''), '/menu');
  assert.equal(locationKey('/menu', '?q=1'), '/menu?q=1');
});

test('nested page scrollers reset; sidebar-like nodes are left alone', () => {
  if (typeof document === 'undefined') return;
  const main = document.createElement('main');
  main.className = 'panel-main';
  main.scrollTop = 840;
  const settings = document.createElement('div');
  settings.setAttribute('data-settings-scroll-root', 'test');
  settings.scrollTop = 120;
  const sidebar = document.createElement('nav');
  sidebar.className = 'overflow-y-auto';
  sidebar.scrollTop = 40;
  document.body.append(main, settings, sidebar);
  try {
    resetNestedPageScrollers(document);
    assert.equal(main.scrollTop, 0);
    assert.equal(settings.scrollTop, 0);
    assert.equal(sidebar.scrollTop, 40);
  } finally {
    main.remove();
    settings.remove();
    sidebar.remove();
  }
});

test('scrollNewPageToTop zeros window scroll', () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const main = document.createElement('main');
  main.className = 'panel-main';
  main.scrollTop = 500;
  document.body.append(main);
  try {
    window.scrollTo(0, 400);
    scrollNewPageToTop(window);
    assert.equal(window.scrollY, 0);
    assert.equal(main.scrollTop, 0);
  } finally {
    main.remove();
  }
});

test('capture and restore remember window + panel-main', () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const main = document.createElement('main');
  main.className = 'panel-main';
  main.scrollTop = 222;
  document.body.append(main);
  try {
    window.scrollTo(0, 90);
    const snap = capturePageScroll(window);
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    restorePageScroll(snap, window);
    assert.equal(main.scrollTop, 222);
  } finally {
    main.remove();
  }
});
