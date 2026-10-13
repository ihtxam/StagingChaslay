/**
 * Reseller packages: hard delete + confirm, not deactivate-only.
 * run: npx tsx dashboard/src/lib/reseller-package-delete.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const catalog = readFileSync(join(root, '../components/subscription/SubscriptionCatalog.tsx'), 'utf8');
const packagesPage = readFileSync(join(root, '../pages/reseller/Packages.tsx'), 'utf8');

assert.match(packagesPage, /apiPrefix="reseller"/);
assert.match(catalog, /const deletePlan = async/);
assert.match(catalog, /Delete package "\$\{plan\.name\}"\? This cannot be undone\./);
assert.match(catalog, /void deletePlan\(plan\)/);
assert.match(catalog, /const deleteAddon = async/);
assert.match(catalog, /Delete add-on "\$\{addon\.name\}"\? This cannot be undone\./);
assert.doesNotMatch(catalog, /deactivatePlan/);
assert.doesNotMatch(catalog, /Deactivate add-on/);
assert.doesNotMatch(catalog, /Add-on deactivated/);

console.log('reseller-package-delete.test.ts OK');
