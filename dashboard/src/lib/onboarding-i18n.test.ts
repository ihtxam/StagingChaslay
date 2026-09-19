/**
 * Merchant onboarding tutorial i18n — run: npx tsx dashboard/src/lib/onboarding-i18n.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onboardingDe, onboardingEn, onboardingFr } from './onboarding-i18n';

const root = dirname(fileURLToPath(import.meta.url));
const drawer = readFileSync(join(root, '../components/onboarding/SetupChecklistDrawer.tsx'), 'utf8');
const pill = readFileSync(join(root, '../components/onboarding/SetupProgressPill.tsx'), 'utf8');
const progress = readFileSync(
  join(root, '../components/onboarding/useMerchantSetupProgress.ts'),
  'utf8'
);

const KEYS = Object.keys(onboardingEn);

assert.deepEqual(Object.keys(onboardingFr).sort(), KEYS.slice().sort(), 'fr keys must match en');
assert.deepEqual(Object.keys(onboardingDe).sort(), KEYS.slice().sort(), 'de keys must match en');

for (const key of KEYS) {
  assert.ok(onboardingEn[key].trim(), `${key} en must not be empty`);
  assert.ok(onboardingFr[key].trim(), `${key} fr must not be empty`);
  assert.ok(onboardingDe[key].trim(), `${key} de must not be empty`);
  assert.notEqual(onboardingFr[key], onboardingEn[key], `${key} fr must differ from en`);
  assert.notEqual(onboardingDe[key], onboardingEn[key], `${key} de must differ from en`);
}

assert.match(drawer, /t\('onboardingSetupTitle'\)/);
assert.match(drawer, /t\('onboardingSetupSubtitle'\)/);
assert.match(drawer, /t\('onboardingGetStarted'\)/);
assert.match(drawer, /t\('onboardingCompletedOf'/);
assert.match(drawer, /t\('onboardingStepLabel'/);
assert.match(pill, /t\('onboardingPillTitle'\)/);
assert.match(progress, /t\('onboardingStepBusinessTitle'\)/);
assert.match(progress, /t\('onboardingStepShopTitle'\)/);
assert.equal(drawer.includes('Complete Your Setup'), false, 'drawer must not hardcode English title');
assert.equal(
  progress.includes('Business Information'),
  false,
  'progress hook must not hardcode English step titles'
);

const i18n = readFileSync(join(root, 'i18n.tsx'), 'utf8');
assert.match(i18n, /from '@\/lib\/onboarding-i18n'/);
assert.match(i18n, /\.\.\.onboardingEn,/);
assert.match(i18n, /\.\.\.onboardingFr,/);
assert.match(i18n, /\.\.\.onboardingDe,/);

console.log(`onboarding-i18n.test.ts: ${KEYS.length} keys ok in en/fr/de`);
