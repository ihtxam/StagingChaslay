import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSettingsSearchIndex,
  filterAccessibleSettingsSearch,
  formatSettingsSearchSectionLabel,
  hasSettingsSearchMatchesOnTab,
  matchSettingsSearch,
  normalizeSettingsSearchQuery,
  pickSettingsSearchMatch,
  resolveSettingsContentTab,
  SETTINGS_SEARCH_STAY_ON_TAB_MARK,
  settingsSearchView,
  shouldDimSettingsSectionDuringSearch,
  tokenizeSettingsSearchQuery,
  type SettingsSearchContext,
} from './settingsSearch.ts';

const t = (key: string) => key;

const allTabs = new Set(
  [
    'business',
    'taxes',
    'tables',
    'shop',
    'delivery',
    'delivery-map',
    'hours',
    'reservations',
    'pos',
    'payments',
    'receipt',
    'kds',
    'ods',
    'signage',
    'kiosk',
    'email',
    'language',
    'users',
  ] as const
);

function openContext(overrides: Partial<SettingsSearchContext> = {}): SettingsSearchContext {
  return {
    visibleTabIds: allTabs,
    canOpenTab: () => true,
    isSectionRendered: () => true,
    ...overrides,
  };
}

test('normalizeSettingsSearchQuery trims and lowercases', () => {
  assert.equal(normalizeSettingsSearchQuery('  Express  '), 'express');
});

test('tokenizeSettingsSearchQuery drops empty second word and trailing space', () => {
  assert.deepEqual(tokenizeSettingsSearchQuery('express '), ['express']);
  assert.deepEqual(tokenizeSettingsSearchQuery('express  '), ['express']);
  assert.deepEqual(tokenizeSettingsSearchQuery('kitchen printer'), ['kitchen', 'printer']);
  assert.deepEqual(tokenizeSettingsSearchQuery('  kitchen   printer  '), ['kitchen', 'printer']);
  assert.deepEqual(tokenizeSettingsSearchQuery('   '), []);
});

test('matchSettingsSearch two words matches across separate keywords (not phrase-only)', () => {
  const index = buildSettingsSearchIndex(t);
  const matches = matchSettingsSearch(index, 'kitchen printer');
  assert.ok(matches.some((entry) => entry.id === 'receipt-print'));
});

test('matchSettingsSearch trailing space and empty second token still returns first-word hits', () => {
  const index = buildSettingsSearchIndex(t);
  const withSpace = matchSettingsSearch(index, 'express ');
  const emptySecond = matchSettingsSearch(index, 'express  checkout'.replace('checkout', ''));
  assert.ok(withSpace.some((entry) => entry.id === 'pos-checkout'));
  assert.ok(emptySecond.some((entry) => entry.id === 'pos-checkout'));
  assert.deepEqual(
    matchSettingsSearch(index, 'express ').map((e) => e.id).sort(),
    matchSettingsSearch(index, 'express').map((e) => e.id).sort()
  );
});

test('matchSettingsSearch whitespace-only never matches all sections ([] .every trap)', () => {
  const index = buildSettingsSearchIndex(t);
  assert.equal(matchSettingsSearch(index, '   ').length, 0);
  assert.equal(matchSettingsSearch(index, '\t').length, 0);
});

test('matchSettingsSearch never throws on regex-like or incomplete tokens', () => {
  const index = buildSettingsSearchIndex(t);
  for (const query of ['foo (', 'foo [', '*', '.*', 'express|', '(express', 'kitchen printer', 'a b']) {
    assert.doesNotThrow(() => matchSettingsSearch(index, query));
  }
  assert.ok(Array.isArray(matchSettingsSearch(null as unknown as [], 'two words')));
});

test('formatSettingsSearchSectionLabel handles empty and dashed ids', () => {
  assert.equal(formatSettingsSearchSectionLabel('pos-checkout'), 'Pos Checkout');
  assert.equal(formatSettingsSearchSectionLabel(''), 'Setting');
  assert.equal(formatSettingsSearchSectionLabel(null), 'Setting');
});

test('filterAccessibleSettingsSearch drops hidden tables sections', () => {
  const index = buildSettingsSearchIndex(t);
  const raw = matchSettingsSearch(index, 'tables');
  const filtered = filterAccessibleSettingsSearch(raw, openContext({ isSectionRendered: () => false }));
  assert.equal(filtered.length, 0);
});

test('filterAccessibleSettingsSearch drops tabs that are not visible', () => {
  const index = buildSettingsSearchIndex(t);
  const raw = matchSettingsSearch(index, 'printer');
  const visible = new Set(['pos'] as const);
  const filtered = filterAccessibleSettingsSearch(
    raw,
    openContext({ visibleTabIds: visible })
  );
  assert.equal(filtered.length, 0);
});

test('pickSettingsSearchMatch prefers current tab when it has a hit', () => {
  const index = buildSettingsSearchIndex(t);
  const matches = matchSettingsSearch(index, 'terminal');
  const picked = pickSettingsSearchMatch(matches, 'pos');
  assert.equal(picked?.id, 'pos-payments');
});

test('signage addon stays on pos tab in search index', () => {
  const index = buildSettingsSearchIndex(t);
  const signage = index.find((entry) => entry.id === 'signage-addon');
  assert.equal(signage?.tab, 'pos');
});

test('settingsSearchView never idles on a non-empty query (failsafe)', () => {
  assert.equal(settingsSearchView('', 0), 'idle');
  assert.equal(settingsSearchView('kitchen', 2), 'results');
  assert.equal(settingsSearchView('kitchen printer', 1), 'results');
  assert.equal(settingsSearchView('zzzz nohit', 0), 'empty');
  assert.equal(settingsSearchView('a b', 0), 'empty');
  assert.equal(SETTINGS_SEARCH_STAY_ON_TAB_MARK, 'stay-on-tab-v4');
});

test('resolveSettingsContentTab never leaves the current tab while typing', () => {
  const index = buildSettingsSearchIndex(t);
  const query = 'adyen';
  const raw = matchSettingsSearch(index, query);
  const matches = filterAccessibleSettingsSearch(raw, openContext());
  assert.ok(matches.some((entry) => entry.tab === 'payments'));
  assert.equal(resolveSettingsContentTab('pos', query, matches), 'pos');
});

test('second word that matches another tab still keeps current tab (kitchen printer)', () => {
  const index = buildSettingsSearchIndex(t);
  const first = filterAccessibleSettingsSearch(matchSettingsSearch(index, 'kitchen'), openContext());
  const second = filterAccessibleSettingsSearch(
    matchSettingsSearch(index, 'kitchen printer'),
    openContext()
  );
  assert.ok(first.some((entry) => entry.tab === 'pos'));
  assert.ok(second.some((entry) => entry.tab === 'receipt'));
  assert.ok(!second.some((entry) => entry.id === 'pos-courses'));
  assert.equal(resolveSettingsContentTab('pos', 'kitchen', first), 'pos');
  assert.equal(resolveSettingsContentTab('pos', 'kitchen printer', second), 'pos');
});

test('resolveSettingsContentTab stays on pos when match is on pos', () => {
  const index = buildSettingsSearchIndex(t);
  const query = 'express';
  const raw = matchSettingsSearch(index, query);
  const matches = filterAccessibleSettingsSearch(raw, openContext());
  assert.equal(resolveSettingsContentTab('pos', query, matches), 'pos');
});

test('hasSettingsSearchMatchesOnTab detects cross-tab matches', () => {
  const index = buildSettingsSearchIndex(t);
  const matches = filterAccessibleSettingsSearch(matchSettingsSearch(index, 'adyen'), openContext());
  assert.equal(hasSettingsSearchMatchesOnTab(matches, 'pos'), false);
  assert.equal(hasSettingsSearchMatchesOnTab(matches, 'payments'), true);
});

test('shouldDimSettingsSectionDuringSearch is always false (no blank panel regression)', () => {
  assert.equal(shouldDimSettingsSectionDuringSearch(), false);
});

test('pos tab with only off-tab matches still shows POS (no auto-jump)', () => {
  const index = buildSettingsSearchIndex(t);
  const query = 'smtp';
  const matches = filterAccessibleSettingsSearch(matchSettingsSearch(index, query), openContext());
  const contentTab = resolveSettingsContentTab('pos', query, matches);
  assert.equal(contentTab, 'pos');
  assert.equal(hasSettingsSearchMatchesOnTab(matches, 'pos'), false);
  assert.equal(settingsSearchView(query, matches.length), 'results');
});
