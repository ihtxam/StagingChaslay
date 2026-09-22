import { describe, expect, it } from 'vitest';
import { SHOP_LANG_KEY, shopLangStorageKey } from './i18n';

describe('shopLangStorageKey', () => {
  it('scopes locale storage per shop slug', () => {
    expect(shopLangStorageKey('brazza')).toBe(`${SHOP_LANG_KEY}:brazza`);
    expect(shopLangStorageKey('  BraZZa  ')).toBe(`${SHOP_LANG_KEY}:brazza`);
    expect(shopLangStorageKey('')).toBe(SHOP_LANG_KEY);
  });
});
