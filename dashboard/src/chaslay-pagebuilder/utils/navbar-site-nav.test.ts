/**
 * Storefront top-nav constrain — run:
 * npx tsx dashboard/src/chaslay-pagebuilder/utils/navbar-site-nav.test.ts
 */
import assert from 'node:assert/strict';
import {
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

const constrained = constrainStorefrontTopNav(longMenu);
assert.equal(constrained.length, 0);

const fr = constrainStorefrontTopNav([
  { label: 'Accueil', link: '#home' },
  { label: 'Menu', link: '#menu' },
  { label: 'À propos', link: '#about' },
  { label: 'Avis', link: '#testimonials' },
  { label: 'Contact', link: '#contact' },
]);
assert.equal(fr.length, 0);

assert.equal(isStorefrontHomeNavItem({ label: 'Startseite', link: '/' }), true);
assert.equal(isStorefrontMenuNavItem({ label: 'Menü', link: '/shop/demo/menu' }), true);
assert.equal(isStorefrontContactNavItem({ label: 'Kontakt', link: '#contact' }), true);
assert.equal(isStorefrontHomeNavItem({ label: 'À propos', link: '#about' }), false);

const empty = constrainStorefrontTopNav([]);
assert.deepEqual(empty, []);

console.log('navbar-site-nav tests passed');
