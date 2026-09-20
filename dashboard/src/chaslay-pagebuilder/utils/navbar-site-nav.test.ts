/**
 * Storefront top-nav constrain — run:
 * npx tsx dashboard/src/chaslay-pagebuilder/utils/navbar-site-nav.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildStorefrontDrawerExtras,
  buildStorefrontTopbarItems,
  constrainStorefrontTopNav,
  isStorefrontContactNavItem,
  isStorefrontHomeNavItem,
  isStorefrontMenuNavItem,
} from './navbar-site-nav';

const longMenu = [
  { label: 'Home', link: '#home' },
  { label: 'Menu', link: '#menu' },
  { label: 'About Us', link: '#about' },
  { label: 'Gallery', link: '#gallery' },
  { label: 'Testimonials', link: '#testimonials' },
  { label: 'Opening Hours', link: '#opening-hours' },
  { label: 'Contact', link: '#contact' },
];

const constrained = buildStorefrontTopbarItems(longMenu);
assert.equal(constrained.length, 2);
assert.deepEqual(
  constrained.map((i) => i.link),
  ['#home', '#menu']
);
assert.ok(
  !constrained.some((i) => i.link === '#gallery' || i.link === '#contact'),
  'topbar drops extra builder sections and contact'
);

const withFeatures = buildStorefrontTopbarItems(longMenu, {
  showGiftCards: true,
  showReservations: true,
});
assert.equal(withFeatures.length, 4);
assert.deepEqual(
  withFeatures.map((i) => i.link),
  ['#home', '#menu', '/gift-cards', '/reservations']
);

const drawer = buildStorefrontDrawerExtras(longMenu, constrained);
assert.ok(drawer.some(isStorefrontContactNavItem), 'contact stays in drawer');
assert.ok(drawer.some((i) => i.link === '#about'), 'about stays in drawer');
assert.ok(!drawer.some((i) => i.link === '#menu'), 'menu not duplicated in drawer');

const fr = buildStorefrontTopbarItems([
  { label: 'Accueil', link: '#home' },
  { label: 'Menu', link: '#menu' },
  { label: 'À propos', link: '#about' },
  { label: 'Avis', link: '#testimonials' },
  { label: 'Contact', link: '#contact' },
]);
assert.equal(fr.length, 2);
assert.equal(fr[0].label, 'Accueil');
assert.equal(fr[1].label, 'Menu');
assert.ok(!fr.some((i) => /propos|avis|about|testimonial|contact/i.test(`${i.label} ${i.link}`)));

assert.equal(isStorefrontHomeNavItem({ label: 'Startseite', link: '/' }), true);
assert.equal(isStorefrontMenuNavItem({ label: 'Menü', link: '/shop/demo/menu' }), true);
assert.equal(isStorefrontContactNavItem({ label: 'Kontakt', link: '#contact' }), true);
assert.equal(isStorefrontHomeNavItem({ label: 'À propos', link: '#about' }), false);

const empty = constrainStorefrontTopNav([]);
assert.deepEqual(
  empty.map((i) => i.label),
  ['Home', 'Menu']
);

console.log('navbar-site-nav tests passed');
