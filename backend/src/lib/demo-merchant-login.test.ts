/**
 * Demo owner login slug + alias resolution.
 * Run: cd backend && npx tsx src/lib/demo-merchant-login.test.ts
 */
import assert from "node:assert/strict";
import {
  demoMerchantSlugs,
  demoMerchantOwnerEmailAliases,
  isDemoMerchantOwnerEmail,
} from "./demo-merchant-login";

const prevSlug = process.env.SEED_DEMO_SLUG;
const prevAliases = process.env.SEED_DEMO_SLUG_ALIASES;
const prevEmail = process.env.SEED_DEMO_MERCHANT_EMAIL;

try {
  delete process.env.SEED_DEMO_SLUG;
  delete process.env.SEED_DEMO_SLUG_ALIASES;
  assert.deepEqual(demoMerchantSlugs(), ["demo", "polacafe"]);
  assert.equal(isDemoMerchantOwnerEmail("demo@chaslay.com"), true);
  assert.equal(isDemoMerchantOwnerEmail("shami@example.com"), false);

  process.env.SEED_DEMO_SLUG = "polacafe";
  process.env.SEED_DEMO_SLUG_ALIASES = "demo";
  assert.deepEqual(demoMerchantSlugs(), ["polacafe", "demo"]);

  process.env.SEED_DEMO_MERCHANT_EMAIL = "demo@chaslay.com";
  assert.ok(demoMerchantOwnerEmailAliases().includes("demo@rebornsense.com"));
} finally {
  if (prevSlug === undefined) delete process.env.SEED_DEMO_SLUG;
  else process.env.SEED_DEMO_SLUG = prevSlug;
  if (prevAliases === undefined) delete process.env.SEED_DEMO_SLUG_ALIASES;
  else process.env.SEED_DEMO_SLUG_ALIASES = prevAliases;
  if (prevEmail === undefined) delete process.env.SEED_DEMO_MERCHANT_EMAIL;
  else process.env.SEED_DEMO_MERCHANT_EMAIL = prevEmail;
}

console.log("demo-merchant-login tests passed");
