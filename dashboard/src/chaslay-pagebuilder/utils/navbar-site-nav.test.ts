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
assert.equal(constrained.length, 3);
assert.deepEqual(
  constrained.map((i) => i.link),
  ['#home', '#menu', '#contact']
);

const fr = constrainStorefrontTopNav([
  { label: 'Accueil', link: '#home' },
  { label: 'Menu', link: '#menu' },
  { label: 'À propos', link: '#about' },
  { label: 'Avis', link: '#testimonials' },
  { label: 'Contact', link: '#contact' },
]);
assert.equal(fr.length, 3);
assert.equal(fr[0].label, 'Accueil');
assert.equal(fr[1].label, 'Menu');
assert.equal(fr[2].label, 'Contact');
assert.ok(!fr.some((i) => /propos|avis|about|testimonial/i.test(`${i.label} ${i.link}`)));

assert.equal(isStorefrontHomeNavItem({ label: 'Startseite', link: '/' }), true);
assert.equal(isStorefrontMenuNavItem({ label: 'Menü', link: '/shop/demo/menu' }), true);
assert.equal(isStorefrontContactNavItem({ label: 'Kontakt', link: '#contact' }), true);
assert.equal(isStorefrontHomeNavItem({ label: 'À propos', link: '#about' }), false);

const empty = constrainStorefrontTopNav([]);
assert.deepEqual(
  empty.map((i) => i.label),
  ['Home', 'Menu', 'Contact']
);

console.log('navbar-site-nav tests passed');
