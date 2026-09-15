/**
 * Media URL + section copy tests — run:
 * npx tsx dashboard/src/chaslay-pagebuilder/utils/builder-i18n-media.test.ts
 */
import assert from 'node:assert/strict';
import { cssBackgroundImage, normalizeMediaUrl } from './media-url';
import { translateSectionCopy } from './section-copy';
import { resolveTranslatedProp } from './resolve-translated-prop';

const url = 'https://images.example.com/hero.jpg?w=800&q=80';

assert.equal(normalizeMediaUrl(`url(${url})`), url);
assert.equal(normalizeMediaUrl(`"${url}"`), url);
assert.equal(normalizeMediaUrl(url.replace('&', '&amp;')), url);
assert.equal(normalizeMediaUrl('  https://cdn.example.com/logo.png  '), 'https://cdn.example.com/logo.png');
assert.equal(normalizeMediaUrl('//cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
assert.equal(cssBackgroundImage(url), `url("${url}")`);
assert.equal(cssBackgroundImage(''), undefined);

assert.equal(translateSectionCopy('Order Now', 'fr'), 'Commander');
assert.equal(translateSectionCopy('Order Now', 'de'), 'Jetzt bestellen');
assert.equal(translateSectionCopy('Order Now', 'it'), 'Ordina ora');
assert.equal(translateSectionCopy('Book Now', 'fr'), 'Réserver');
assert.equal(translateSectionCopy('Opening Hours', 'de'), 'Öffnungszeiten');
assert.equal(translateSectionCopy('Our Menu', 'it'), 'Il nostro menu');
assert.equal(translateSectionCopy('All rights reserved.', 'fr'), 'Tous droits réservés.');
assert.equal(
  translateSectionCopy('© 2024 Restaurant Name. All rights reserved.', 'fr'),
  '© 2024 Restaurant Name. Tous droits réservés.'
);
assert.equal(translateSectionCopy('Home', 'fr'), 'Accueil');
assert.equal(translateSectionCopy('Order Now', 'en'), 'Order Now');
assert.equal(translateSectionCopy('Order Now', 'fr', 'fr'), 'Order Now');

const props = { title: 'Our Menu', title_fr: 'La carte', buttonText: 'Order Now' };
assert.equal(resolveTranslatedProp(props, 'title', 'fr'), 'La carte');
assert.equal(resolveTranslatedProp(props, 'buttonText', 'fr'), 'Order Now');
assert.equal(resolveTranslatedProp(props, 'title', 'en'), 'Our Menu');

assert.equal(translateSectionCopy('Customer Reviews', 'fr'), 'Avis clients');
assert.equal(translateSectionCopy('What Our Guests Say', 'de'), 'Was unsere Gäste sagen');
assert.equal(
  resolveTranslatedProp(
    { testimonials_0_text: 'Great food', testimonials_0_text_fr: 'Excellente cuisine' },
    'testimonials_0_text',
    'fr'
  ),
  'Excellente cuisine'
);

console.log('builder-i18n-media tests passed');
