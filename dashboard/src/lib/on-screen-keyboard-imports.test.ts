import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('on-screen keyboard import graph (no TDZ cycle)', () => {
  it('useSoftKeyboardLayout imports the hook from context, not OnScreenKeyboard.tsx', () => {
    const src = readSrc('lib/useSoftKeyboardLayout.ts');
    expect(src).toContain("from '@/lib/on-screen-keyboard-context'");
    expect(src).not.toMatch(/from '@\/components\/OnScreenKeyboard'/);
  });

  it('LoginPage does not import the full OnScreenKeyboard module', () => {
    const src = readSrc('pages/LoginPage.tsx');
    expect(src).toContain("from '@/components/OnScreenKeyboardToggle'");
    expect(src).not.toMatch(/from '@\/components\/OnScreenKeyboard'/);
  });

  it('useModalKeyboardScroll imports the hook from context', () => {
    const src = readSrc('lib/useModalKeyboardScroll.ts');
    expect(src).toContain("from '@/lib/on-screen-keyboard-context'");
    expect(src).not.toMatch(/from '@\/components\/OnScreenKeyboard'/);
  });

  it('App boots keyboard provider without importing LoginPage or OnScreenKeyboard barrel', () => {
    const src = readSrc('App.tsx');
    expect(src).toContain("from '@/components/OnScreenKeyboardProvider'");
    expect(src).not.toMatch(/import LoginPage from/);
    expect(src).not.toMatch(/from '@\/components\/OnScreenKeyboard'/);
  });

  it('App lazy-loads merchant dashboard (avoids init-order TDZ with keyboard graph)', () => {
    const src = readSrc('App.tsx');
    expect(src).toMatch(/lazy\(\(\) => import\('@\/pages\/merchant\/Dashboard'\)\)/);
    expect(src).not.toMatch(/import MerchantDashboard from '@\/pages\/merchant\/Dashboard'/);
  });
});
