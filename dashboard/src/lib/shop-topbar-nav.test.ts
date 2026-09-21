/**
 * Shop topbar nav — run: npx tsx dashboard/src/lib/shop-topbar-nav.test.ts
 */
import assert from 'node:assert/strict';
import { buildShopTopbarNav } from './shop-topbar-nav';

const labels = {
  home: 'Home',
  menu: 'Menu',
  giftCard: 'Gift card',
  reservations: 'Reservations',
  contact: 'Contact',
  storeInfo: 'Store info',
};

{
  const nav = buildShopTopbarNav({
    basePath: '/polacafe',
    showGiftCards: true,
    labels,
  });
  assert.equal(nav.topbarLinks.length, 3);
  assert.deepEqual(
    nav.drawerLinks.map((l) => l.label),
    ['Contact']
  );
}

{
  let opened = false;
  const nav = buildShopTopbarNav({
    basePath: '/polacafe',
    showGiftCards: true,
    onStoreInfo: () => {
      opened = true;
    },
    labels,
  });
  assert.deepEqual(
    nav.drawerLinks.map((l) => l.label),
    ['Store info', 'Contact']
  );
  nav.drawerLinks[0]?.onClick?.();
  assert.equal(opened, true);
  assert.equal(nav.topbarLinks.some((l) => l.label === 'Home'), true);
  assert.equal(nav.drawerLinks.some((l) => l.label === 'Home'), false);
}

console.log('shop-topbar-nav: all assertions passed');
