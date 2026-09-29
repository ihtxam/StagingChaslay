import { afterEach, describe, expect, it, vi } from 'vitest';

function mockMatchMedia(queries: Record<string, boolean>) {
  return vi.fn((query: string) => ({
    matches: queries[query] ?? false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function installWindow(opts: {
  userAgent: string;
  pathname?: string;
  media: Record<string, boolean>;
}) {
  const matchMedia = mockMatchMedia(opts.media);
  vi.stubGlobal('window', {
    matchMedia,
    location: { pathname: opts.pathname ?? '/merchant', search: '' },
    navigator: { userAgent: opts.userAgent },
    localStorage: {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('navigator', { userAgent: opts.userAgent });
}

describe('on-screen keyboard platform gates', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('does not auto-open on iPhone', async () => {
    installWindow({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      media: { '(pointer: coarse)': true, '(max-width: 767px)': true },
    });
    const { isMobilePhone, shouldAutoOpenOnScreenKeyboard, shouldShowOnScreenKeyboardToggle } =
      await import('./platform');
    expect(isMobilePhone()).toBe(true);
    expect(shouldAutoOpenOnScreenKeyboard()).toBe(false);
    expect(shouldShowOnScreenKeyboardToggle()).toBe(false);
  });

  it('does not show or auto-open the custom keyboard on Android', async () => {
    installWindow({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Nebullus) AppleWebKit/537.36 Chrome/128.0.0.0',
      pathname: '/merchant/pos',
      media: {
        '(pointer: coarse)': true,
        '(max-width: 767px)': false,
        '(display-mode: standalone)': false,
        '(display-mode: fullscreen)': false,
      },
    });
    const { isAndroidDevice, shouldAutoOpenOnScreenKeyboard, shouldShowOnScreenKeyboardToggle } =
      await import('./platform');
    expect(isAndroidDevice()).toBe(true);
    expect(shouldAutoOpenOnScreenKeyboard()).toBe(false);
    expect(shouldShowOnScreenKeyboardToggle()).toBe(false);
  });

  it('auto-opens on coarse pointer tablet on WebPOS path', async () => {
    installWindow({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
      pathname: '/merchant/pos',
      media: {
        '(pointer: coarse)': true,
        '(max-width: 767px)': false,
        '(display-mode: standalone)': false,
        '(display-mode: fullscreen)': false,
      },
    });
    const { isMobilePhone, shouldAutoOpenOnScreenKeyboard } = await import('./platform');
    expect(isMobilePhone()).toBe(false);
    expect(shouldAutoOpenOnScreenKeyboard()).toBe(true);
  });
});
