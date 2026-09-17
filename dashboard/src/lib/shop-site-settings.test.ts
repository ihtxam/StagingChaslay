/**
 * Shop SEO resolution — run: npx tsx dashboard/src/lib/shop-site-settings.test.ts
 */
import assert from 'node:assert/strict';
import { resolveShopDocumentSeo } from './shop-site-settings.ts';

const site = {
  brandColor: '#e11d48',
  metaTitle: { en: 'Brazza Pizza', de: 'Brazza' },
  metaDescription: { en: 'Pizza in Pieterlen' },
  gaMeasurementId: null,
  faviconUrl: '/uploads/icon.png',
};

const seo = resolveShopDocumentSeo(site, 'de', {
  title: 'Builder Home',
  description: 'Page copy',
});
assert.equal(seo.title, 'Brazza');
assert.equal(seo.description, 'Pizza in Pieterlen');
assert.equal(seo.faviconUrl, '/uploads/icon.png');

const fallback = resolveShopDocumentSeo(null, 'en', {
  title: 'Builder Home',
  description: 'Page copy',
  logoUrl: '/logo.png',
});
assert.equal(fallback.title, 'Builder Home');
assert.equal(fallback.description, 'Page copy');
assert.equal(fallback.faviconUrl, '/logo.png');

console.log('shop-site-settings.test.ts OK');
