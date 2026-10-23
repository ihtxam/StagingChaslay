import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('merchant panel import graph (no App init-order TDZ)', () => {
  it('App lazy-loads merchant dashboard instead of a top-level import', () => {
    const src = readSrc('App.tsx');
    expect(src).toMatch(/lazy\(\(\) => import\('@\/pages\/merchant\/Dashboard'\)\)/);
    expect(src).not.toMatch(/import MerchantDashboard from '@\/pages\/merchant\/Dashboard'/);
    expect(src).toContain('MerchantPanelRoute');
  });

  it('merchant shell still wraps I18n inside Dashboard (not duplicated in App)', () => {
    const src = readSrc('pages/merchant/Dashboard.tsx');
    expect(src).toContain('export default function MerchantDashboard');
    expect(src).toMatch(/<I18nProvider>/);
  });

  it('Dashboard defers route modules via merchant-lazy-routes (no eager page imports)', () => {
    const dash = readSrc('pages/merchant/Dashboard.tsx');
    const lazyRoutes = readSrc('pages/merchant/merchant-lazy-routes.tsx');
    expect(dash).toContain("from './merchant-lazy-routes'");
    expect(dash).not.toMatch(/import Overview from '\.\/Overview'/);
    expect(dash).not.toMatch(/import WaiterApp from '\.\/WaiterApp'/);
    expect(dash).not.toMatch(/from '@\/lib\/webpos-print-relay'/);
    expect(lazyRoutes).toMatch(/merchantLazy\(\(\) => import\('\.\/WebPos'\)\)/);
    expect(lazyRoutes).toMatch(/merchantLazy\(\(\) => import\('@\/components\/Header'\)\)/);
  });

  it('Dashboard shell does not import useTillPrintHub at module init', () => {
    const src = readSrc('pages/merchant/Dashboard.tsx');
    expect(src).not.toMatch(/useTillPrintHub/);
    expect(src).toContain('MerchantTillPrintHub');
  });

  it('Header keeps keyboard toggle isolated from OnScreenKeyboard barrel', () => {
    const src = readSrc('components/Header.tsx');
    expect(src).toContain("from '@/components/OnScreenKeyboardToggle'");
    expect(src).not.toMatch(/from '@\/components\/OnScreenKeyboard'/);
  });

  it('Dashboard declares panelChromeRestricted before merchantSettingsPath (no shell TDZ)', () => {
    const src = readSrc('pages/merchant/Dashboard.tsx');
    const restrictedIdx = src.indexOf('const panelChromeRestricted');
    const settingsPathIdx = src.indexOf('const merchantSettingsPath');
    expect(restrictedIdx).toBeGreaterThan(-1);
    expect(settingsPathIdx).toBeGreaterThan(-1);
    expect(restrictedIdx).toBeLessThan(settingsPathIdx);
  });
});
