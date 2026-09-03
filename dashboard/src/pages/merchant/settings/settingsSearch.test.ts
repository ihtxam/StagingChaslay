import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSettingsSearchIndex,
  filterAccessibleSettingsSearch,
  matchSettingsSearch,
  normalizeSettingsSearchQuery,
  pickSettingsSearchMatch,
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

test('matchSettingsSearch finds express checkout on pos tab', () => {
  const index = buildSettingsSearchIndex(t);
  const matches = matchSettingsSearch(index, 'express');
  assert.ok(matches.some((entry) => entry.id === 'pos-checkout' && entry.tab === 'pos'));
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
