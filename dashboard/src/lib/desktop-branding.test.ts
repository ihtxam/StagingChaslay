/**
 * Superadmin desktop branding defaults.
 * Run: npx tsx dashboard/src/lib/desktop-branding.test.ts
 */
import assert from 'node:assert/strict';
import { DEFAULT_DESKTOP_BRANDING, normalizeDesktopBranding } from './desktop-branding';

const empty = normalizeDesktopBranding(null);
assert.equal(empty.appName, DEFAULT_DESKTOP_BRANDING.appName);
assert.equal(empty.splashUrl, DEFAULT_DESKTOP_BRANDING.splashUrl);

const custom = normalizeDesktopBranding({
  splashUrl: '/api/uploads/platform/desktop/a.png',
  iconUrl: '/api/uploads/platform/desktop/b.png',
  appName: 'Chaslay POS',
  tagline: 'Ready',
  backgroundColor: '#111827',
  splashCustom: true,
});
assert.equal(custom.appName, 'Chaslay POS');
assert.equal(custom.backgroundColor, '#111827');
assert.equal(custom.splashCustom, true);

console.log('desktop-branding tests passed');
