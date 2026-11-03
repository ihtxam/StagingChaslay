#!/usr/bin/env node
/**
 * Headless Chromium check: loading /merchant must not throw TDZ (before initialization).
 * Usage: node scripts/verify-merchant-dashboard-tdz.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:4173
 */
import { chromium } from 'playwright';

const baseUrl = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');

const mockUser = {
  id: 'verify-user',
  email: 'verify@example.com',
  role: 'merchant',
  name: 'Verify Merchant',
  merchantId: 'verify-merchant',
  isOwner: true,
  permissions: ['MANAGE_ORDERS', 'MANAGE_PRODUCTS', 'MANAGE_SETTINGS'],
};

const tdzPattern = /before initialization|ReferenceError.*Cannot access/i;
const errors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => {
  errors.push(String(err?.message || err));
});

await page.route('**/api/**', async (route) => {
  const url = route.request().url();
  let body = '{}';
  if (url.includes('/auth/me') || url.includes('/merchants/me')) {
    body = JSON.stringify({ user: mockUser, merchant: { id: mockUser.merchantId, name: 'Test' } });
  }
  if (url.includes('/locations')) {
    body = JSON.stringify({ locations: [] });
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body,
  });
});

await page.addInitScript((user) => {
  localStorage.setItem('token', 'verify-tdz-token');
  localStorage.setItem('user', JSON.stringify(user));
}, mockUser);

await page.goto(`${baseUrl}/merchant`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(2000);

const dashboardChunk = await page.evaluate(() => {
  return performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((n) => /Dashboard-/.test(n))
    .pop();
});

await browser.close();

const tdzHits = errors.filter((e) => tdzPattern.test(e));
if (tdzHits.length) {
  console.error('FAIL: TDZ or init-order errors:', tdzHits);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      dashboardChunk: dashboardChunk || null,
      otherConsoleErrors: errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e)),
    },
    null,
    2
  )
);
