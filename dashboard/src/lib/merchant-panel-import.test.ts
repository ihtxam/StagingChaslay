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
});
