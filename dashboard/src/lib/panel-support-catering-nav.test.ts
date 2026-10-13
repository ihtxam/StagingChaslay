/**
 * Merchant left nav: Support lives in the account menu; catering guide only when licensed.
 * run: npx tsx dashboard/src/lib/panel-support-catering-nav.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dash = readFileSync(join(root, '../pages/merchant/Dashboard.tsx'), 'utf8');
const editions = readFileSync(join(root, '../pages/superadmin/Editions.tsx'), 'utf8');
const reseller = readFileSync(join(root, '../pages/reseller/Dashboard.tsx'), 'utf8');
const products = readFileSync(join(root, '../pages/merchant/Products.tsx'), 'utf8');

assert.doesNotMatch(dash, /label: t\('support'\), path: '\/merchant\/support'/);
assert.match(dash, /supportPath:/);
assert.doesNotMatch(dash, /cateringGuideNav.*catering-guide/);
assert.match(dash, /cateringLicensed \? \(/);
assert.match(dash, /path="products\/catering-guide"/);

assert.match(products, /cateringLicensed \?/);
assert.match(products, /cateringGuideNav/);

assert.match(editions, /posVersionDeleteConfirm/);
assert.match(editions, /window.confirm/);
assert.match(editions, /t\('copy'\)/);
assert.match(editions, /t\('edit'\)/);
assert.match(editions, /t\('delete'\)/);
assert.match(editions, /\/superadmin\/editions\/\$\{ed.id\}\/clone/);
assert.doesNotMatch(editions, /Deactivate/);
assert.doesNotMatch(editions, /posVersionCustomize/);

assert.doesNotMatch(reseller, /posVersionCustomize/);
assert.match(reseller, /copyVersion/);
assert.match(reseller, /t\('copy'\)/);
assert.match(reseller, /t\('delete'\)/);
assert.match(reseller, /t\('edit'\)/);
assert.match(reseller, /window.confirm/);
assert.match(reseller, /posVersionNew/);

console.log('panel-support-catering-nav.test.ts OK');
