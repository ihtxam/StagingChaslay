/**
 * SMS tier remaining-count — run: npx tsx backend/src/lib/sms-tiers.test.ts
 */
import assert from "node:assert/strict";
import {
  canConsumeSms,
  remainingSmsCount,
  SMS_TIERS,
  smsQuotaSnapshot,
  smsTierAllowance,
  normalizeSmsTier,
} from "./sms-tiers";

assert.equal(normalizeSmsTier("GROWTH"), "growth");
assert.equal(normalizeSmsTier("nope"), "starter");
assert.equal(smsTierAllowance("starter"), 100);
assert.equal(smsTierAllowance("growth"), 500);
assert.equal(smsTierAllowance("pro"), 2000);
assert.equal(smsTierAllowance("starter", 250), 250);

assert.equal(remainingSmsCount(0, 100), 100);
assert.equal(remainingSmsCount(40, 100), 60);
assert.equal(remainingSmsCount(100, 100), 0);
assert.equal(remainingSmsCount(140, 100), 0);
assert.equal(canConsumeSms(99, 100), true);
assert.equal(canConsumeSms(100, 100), false);

const snap = smsQuotaSnapshot({ tier: "growth", sent: 480 });
assert.equal(snap.allowance, SMS_TIERS.growth.monthlyAllowance);
assert.equal(snap.remaining, 20);
assert.equal(snap.overQuota, false);

const full = smsQuotaSnapshot({ tier: "starter", sent: 100 });
assert.equal(full.remaining, 0);
assert.equal(full.overQuota, true);

console.log("sms-tiers.test.ts: ok");
