import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapWebPosLocationFromPanel } from './webpos-terminal-location';

const SESSION_KEY = 'webpos_terminal_location_id';

function mockBrowserSession() {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
  vi.stubGlobal('window', {
    location: { href: 'http://localhost/merchant/pos', pathname: '/merchant/pos', search: '' },
    history: { replaceState: () => undefined },
  });
  return store;
}

describe('bootstrapWebPosLocationFromPanel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers panel branch over stale terminal session', () => {
    const store = mockBrowserSession();
    store.set(SESSION_KEY, 'stale-bar-loc');
    const id = bootstrapWebPosLocationFromPanel('kiosk-retail-loc');
    expect(id).toBe('kiosk-retail-loc');
    expect(store.get(SESSION_KEY)).toBe('kiosk-retail-loc');
  });

  it('keeps terminal session when panel has no branch (HQ view)', () => {
    const store = mockBrowserSession();
    store.set(SESSION_KEY, 'saved-terminal');
    expect(bootstrapWebPosLocationFromPanel(null)).toBe('saved-terminal');
  });
});
