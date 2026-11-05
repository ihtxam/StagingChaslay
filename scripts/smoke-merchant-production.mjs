#!/usr/bin/env node
/**
 * Smoke test app.rebornsense.com merchant flows (login, settings, products).
 * Usage: DEMO_PASSWORD=... node scripts/smoke-merchant-production.mjs
 */
import { chromium } from 'playwright';

const base = 'https://app.rebornsense.com';
const email = process.env.DEMO_EMAIL || 'demo@chaslay.com';
const password = process.env.DEMO_PASSWORD || 'DemoShop123!';
const pin = process.env.DEMO_PIN || '0000';

const results = [];
const fail = (step, detail) => {
  results.push({ step, ok: false, detail });
  console.error(`FAIL ${step}:`, detail);
};
const pass = (step, detail = '') => {
  results.push({ step, ok: true, detail });
  console.log(`OK ${step}${detail ? `: ${detail}` : ''}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60_000);

const enterPinIfShown = async () => {
  const pinPrompt = page.getByText(/enter staff pin/i);
  if (!(await pinPrompt.isVisible().catch(() => false))) return;
  for (const d of pin.split('')) {
    await page
      .locator('.webpos-pin-gate-key')
      .filter({ hasText: new RegExp(`^${d}$`) })
      .first()
      .click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2000);
  await page.getByText(/enter staff pin/i).waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
};

try {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(merchant|pin|webpos)/, { timeout: 45_000 });
  await page.waitForTimeout(500);
  await enterPinIfShown();
  pass('login', page.url());

  if (!page.url().includes('/merchant')) {
    await page.goto(`${base}/merchant`, { waitUntil: 'domcontentloaded' });
  }
  await enterPinIfShown();
  pass('merchant-shell', page.url());

  await page.goto(`${base}/merchant/settings/printers`, { waitUntil: 'domcontentloaded' });
  await enterPinIfShown();
  const printersBody = await page.locator('body').innerText();
  if (/error|500|failed to load/i.test(printersBody) && !/printer/i.test(printersBody)) {
    fail('settings-printers', 'page looks broken');
  } else {
    pass('settings-printers');
  }

  await page.goto(`${base}/merchant/products`, { waitUntil: 'networkidle' });
  await enterPinIfShown();
  await page.waitForTimeout(1500);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const apiProducts = await page.evaluate(async (t) => {
    const r = await fetch('/api/merchant/products?limit=1', {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    return r.status;
  }, token);
  const productsBody = await page.locator('body').innerText();
  const productsOk =
    apiProducts === 200 ||
    (/products|product|menu|category|catalog/i.test(productsBody) &&
      !/enter staff pin/i.test(productsBody));
  if (productsOk) {
    pass('products-list', apiProducts === 200 ? 'api-200' : 'ui');
  } else {
    fail('products-list', productsBody.slice(0, 200).replace(/\s+/g, ' '));
  }

  await page.goto(`${base}/merchant/webpos`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const posBody = await page.locator('body').innerText();
  if (/pos|catalog|register|web\s*pos/i.test(posBody)) {
    pass('webpos-load');
  } else {
    fail('webpos-load', 'POS shell unclear');
  }
} catch (e) {
  fail('exception', String(e?.message || e));
} finally {
  await browser.close();
}

const ok = results.every((r) => r.ok);
console.log(JSON.stringify({ ok, base, results }, null, 2));
process.exit(ok ? 0 : 1);
