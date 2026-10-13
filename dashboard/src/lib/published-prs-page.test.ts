/**
 * Superadmin Published PRs: private-repo 404 must not blank the page.
 * run: npx tsx dashboard/src/lib/published-prs-page.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(root, '../pages/superadmin/PublishedPrsAdmin.tsx'), 'utf8');
const service = readFileSync(join(root, '../../../backend/src/services/published-pr.service.ts'), 'utf8');

assert.match(page, /setWarning/);
assert.match(page, /res\.data\.warning/);
assert.match(page, /border-amber-200/);
assert.doesNotMatch(service, /GitHub repo not found/);
assert.match(service, /githubRepoAccessError/);
assert.match(service, /fetchMergedPullsFallback/);
assert.match(service, /warning/);

console.log('published-prs-page.test.ts OK');
