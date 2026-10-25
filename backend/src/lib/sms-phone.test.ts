/**
 * Phone / STOP helpers — run: npx tsx backend/src/lib/sms-phone.test.ts
 */
import assert from "node:assert/strict";
import { isSmsStopKeyword, normalizeE164, phonesEqual } from "./sms-phone";

const ch = normalizeE164("079 123 45 67", "CH");
assert.equal(ch.ok, true);
if (ch.ok) {
  assert.equal(ch.e164, "41791234567");
  assert.equal(ch.display, "+41791234567");
}

const plus = normalizeE164("+41 79 123 45 67");
assert.equal(plus.ok && plus.e164, "41791234567");

const intl00 = normalizeE164("0041791234567");
assert.equal(intl00.ok && intl00.e164, "41791234567");

assert.equal(normalizeE164("").ok, false);
assert.equal(normalizeE164("12").ok, false);
assert.equal(phonesEqual("0791234567", "+41791234567", "CH"), true);
assert.equal(isSmsStopKeyword("stop"), true);
assert.equal(isSmsStopKeyword("ARRET"), true);
assert.equal(isSmsStopKeyword("Stopp."), true);
assert.equal(isSmsStopKeyword("hello"), false);

console.log("sms-phone.test.ts: ok");
