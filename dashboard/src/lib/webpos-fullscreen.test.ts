// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  androidPwaNeedsImmersiveFullscreen,
  isPwaWindowAlreadyImmersive,
} from './webpos-fullscreen';

describe('webpos-fullscreen', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36',
      standalone: false,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.unstubAllGlobals();
  });

  it('android standalone PWA needs immersive API even when display-mode is fullscreen', () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('standalone') || query.includes('fullscreen'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as typeof window.matchMedia;

    expect(androidPwaNeedsImmersiveFullscreen()).toBe(true);
    expect(isPwaWindowAlreadyImmersive()).toBe(false);
  });

  it('desktop browser tab does not need android immersive override', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      standalone: false,
    });
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('fullscreen'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as typeof window.matchMedia;

    expect(androidPwaNeedsImmersiveFullscreen()).toBe(false);
    expect(isPwaWindowAlreadyImmersive()).toBe(true);
  });
});
