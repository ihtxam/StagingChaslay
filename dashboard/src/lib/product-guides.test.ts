/**
 * Product guides must ship EN / FR / DE bodies — no leftover English when locale is FR/DE.
 * Help search must still match chapter titles (from #730).
 * Run: npx tsx dashboard/src/lib/product-guides.test.ts
 */
import assert from 'node:assert/strict';
import { guidesForAudience, PRODUCT_GUIDE_CHAPTERS, searchGuideChapters } from './product-guides';
import { getHelpCategories } from './help-center/chaslay-help';

const merchantEn = guidesForAudience('merchant', 'en');
const merchantFr = guidesForAudience('merchant', 'fr');
const merchantDe = guidesForAudience('merchant', 'de');
const resellerFr = guidesForAudience('reseller', 'fr');
const resellerDe = guidesForAudience('reseller', 'de');

assert.ok(merchantEn.length > 0, 'merchant EN chapters');
assert.equal(merchantFr.length, merchantEn.length, 'FR merchant chapter count');
assert.equal(merchantDe.length, merchantEn.length, 'DE merchant chapter count');
assert.ok(PRODUCT_GUIDE_CHAPTERS.length >= merchantEn.length);

for (let i = 0; i < merchantEn.length; i++) {
  assert.equal(merchantFr[i].id, merchantEn[i].id);
  assert.notEqual(merchantFr[i].title, merchantEn[i].title, `FR title ${merchantEn[i].id}`);
  assert.notEqual(merchantDe[i].title, merchantEn[i].title, `DE title ${merchantEn[i].id}`);
  assert.notEqual(merchantFr[i].summary, merchantEn[i].summary, `FR summary ${merchantEn[i].id}`);
  assert.notEqual(merchantDe[i].summary, merchantEn[i].summary, `DE summary ${merchantEn[i].id}`);
  assert.ok(merchantFr[i].steps.length === merchantEn[i].steps.length);
  for (let s = 0; s < merchantEn[i].steps.length; s++) {
    assert.notEqual(
      merchantFr[i].steps[s].detail,
      merchantEn[i].steps[s].detail,
      `FR detail ${merchantEn[i].id}/${s}`
    );
    assert.notEqual(
      merchantDe[i].steps[s].detail,
      merchantEn[i].steps[s].detail,
      `DE detail ${merchantEn[i].id}/${s}`
    );
  }
}

assert.ok(resellerFr.some((c) => c.title !== guidesForAudience('reseller', 'en')[0].title));
assert.ok(resellerDe.every((c) => c.steps.every((s) => s.detail.trim().length > 20)));

const helpEn = getHelpCategories('en');
const helpFr = getHelpCategories('fr');
const helpDe = getHelpCategories('de');
assert.equal(helpFr.length, helpEn.length);
assert.equal(helpDe.length, helpEn.length);

for (let i = 0; i < helpEn.length; i++) {
  assert.equal(helpFr[i].id, helpEn[i].id);
  assert.notEqual(helpFr[i].title, helpEn[i].title, `FR help cat ${helpEn[i].id}`);
  assert.notEqual(helpDe[i].title, helpEn[i].title, `DE help cat ${helpEn[i].id}`);
  assert.equal(helpFr[i].articles.length, helpEn[i].articles.length);
  for (let a = 0; a < helpEn[i].articles.length; a++) {
    const enA = helpEn[i].articles[a];
    const frA = helpFr[i].articles[a];
    const deA = helpDe[i].articles[a];
    assert.equal(frA.id, enA.id);
    assert.notEqual(frA.title, enA.title, `FR article ${enA.id}`);
    assert.notEqual(deA.title, enA.title, `DE article ${enA.id}`);
    assert.notEqual(frA.body, enA.body, `FR body ${enA.id}`);
    assert.notEqual(deA.body, enA.body, `DE body ${enA.id}`);
    assert.ok(frA.body.trim().length > 40, `FR body length ${enA.id}`);
    assert.ok(deA.body.trim().length > 40, `DE body length ${enA.id}`);
  }
}

const firstDay = searchGuideChapters('merchant', 'first day');
assert.ok(firstDay.length >= 1, 'merchant guides should match first-day search');

const empty = searchGuideChapters('merchant', '   ');
assert.deepEqual(empty, []);

const none = searchGuideChapters('merchant', 'zzzz-no-such-guide-term');
assert.deepEqual(none, []);

const agency = searchGuideChapters('reseller', 'price book');
assert.ok(agency.length >= 1, 'reseller guides should match price book');

console.log('product-guides + help-center i18n tests passed');
