/**
 * Phone-ordering settings helpers — run: npx tsx backend/src/lib/phone-ordering-settings.test.ts
 */
import assert from "node:assert/strict";
import {
  getPhoneOrderingPublic,
  isPhoneOrderingReady,
  mergePhoneOrderingSettings,
  normalizePhoneOrderingSettings,
  timingSafeEqualSecret,
} from "./phone-ordering-settings.ts";

const empty = normalizePhoneOrderingSettings(null);
assert.equal(empty.enabled, false);
assert.equal(empty.phoneNumber, undefined);
assert.equal(isPhoneOrderingReady(empty), false);

const ready = normalizePhoneOrderingSettings({
  enabled: true,
  phoneNumber: "+41 21 555 0101",
  hours: "11:00-21:00",
  webhookSecret: "super-secret-token",
});
assert.equal(isPhoneOrderingReady(ready), true);
const pub = getPhoneOrderingPublic(ready);
assert.equal(pub.enabled, true);
assert.equal(pub.phoneNumber, "+41 21 555 0101");
assert.equal(pub.webhookSecretSet, true);
assert.ok(pub.webhookSecretMasked && !pub.webhookSecretMasked.includes("secret-token"));
assert.ok(pub.webhookSecretMasked.includes("••••"));

const mergedKeep = mergePhoneOrderingSettings(ready, {
  enabled: true,
  webhookSecret: "supe••••oken",
  hours: "12:00-22:00",
});
assert.equal(mergedKeep.webhookSecret, "super-secret-token");
assert.equal(mergedKeep.hours, "12:00-22:00");

const mergedReplace = mergePhoneOrderingSettings(ready, { webhookSecret: "new-secret" });
assert.equal(mergedReplace.webhookSecret, "new-secret");

assert.equal(timingSafeEqualSecret("abc", "abc"), true);
assert.equal(timingSafeEqualSecret("abc", "abd"), false);
assert.equal(timingSafeEqualSecret("abc", "ab"), false);
assert.equal(timingSafeEqualSecret("", ""), false);

console.log("phone-ordering-settings.test.ts: ok");
