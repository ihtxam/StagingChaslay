/**
 * Como settings helpers — run: npx tsx backend/src/lib/como-settings.test.ts
 */
import assert from "node:assert/strict";
import {
  getComoPublic,
  mergeComoSettings,
  normalizeComoSettings,
  isComoReady,
} from "./como-settings.ts";

const empty = normalizeComoSettings(null);
assert.equal(empty.enabled, false);
assert.equal(empty.environment, "live");
assert.equal(empty.apiKey, undefined);

const ready = normalizeComoSettings({ enabled: true, apiKey: "abcd1234efgh5678", branchId: "67" });
assert.equal(isComoReady(ready), true);
const pub = getComoPublic(ready);
assert.equal(pub.apiKeySet, true);
assert.equal(pub.configured, true);
assert.ok(pub.apiKeyMasked && !pub.apiKeyMasked.includes("1234efgh"));
assert.ok(pub.apiKeyMasked.includes("••••"));

const mergedKeep = mergeComoSettings(ready, { enabled: true, apiKey: "abcd••••5678", branchId: "1001" });
assert.equal(mergedKeep.apiKey, "abcd1234efgh5678");
assert.equal(mergedKeep.branchId, "1001");

const mergedReplace = mergeComoSettings(ready, { apiKey: "new-secret-key" });
assert.equal(mergedReplace.apiKey, "new-secret-key");

assert.equal(isComoReady({ enabled: true }), false);
assert.equal(isComoReady({ enabled: false, apiKey: "x" }), false);

console.log("como-settings.test.ts: ok");
