/**
 * POS activation-code normalization — run: cd backend && npx tsx src/lib/license-activation-code.test.ts
 */
import assert from "node:assert/strict";
import {
  activationCodeLookupKeys,
  canRebindLicenseDevice,
  compactActivationCode,
  formatShortActivationCode,
  isPlaceholderDeviceId,
  isUnusedIssuedDevice,
  normalizeActivationCode,
} from "./license-activation-code";

assert.equal(compactActivationCode("1758-D6DD-EF5A"), "1758D6DDEF5A");
assert.equal(compactActivationCode("1758 d6dd ef5a"), "1758D6DDEF5A");
assert.equal(compactActivationCode("1758D6DDEF5A"), "1758D6DDEF5A");
assert.equal(compactActivationCode("  1758-d6dd-ef5a  "), "1758D6DDEF5A");

assert.equal(formatShortActivationCode("1758D6DDEF5A"), "1758-D6DD-EF5A");
assert.equal(normalizeActivationCode("1758D6DDEF5A"), "1758-D6DD-EF5A");
assert.equal(normalizeActivationCode("1758 d6dd ef5a"), "1758-D6DD-EF5A");
assert.equal(normalizeActivationCode("1758-D6DD-EF5A"), "1758-D6DD-EF5A");

const keys = activationCodeLookupKeys("1758 d6dd ef5a");
assert.ok(keys.includes("1758-D6DD-EF5A"));
assert.ok(keys.includes("1758D6DDEF5A"));

assert.equal(isPlaceholderDeviceId("POS-899FF4-ABCD-1"), true);
assert.equal(isPlaceholderDeviceId("8MK3-RPQS"), false);

assert.equal(isUnusedIssuedDevice({ lastSync: null, appVersion: null }), true);
assert.equal(isUnusedIssuedDevice({ lastSync: null, appVersion: "" }), true);
assert.equal(isUnusedIssuedDevice({ lastSync: new Date(), appVersion: "1.0" }), false);

assert.equal(
  canRebindLicenseDevice({ deviceId: "8MK3-RPQS", lastSync: null, appVersion: null }, false),
  true,
  "unused pre-bound seat can be claimed by the first real tablet"
);
assert.equal(
  canRebindLicenseDevice(
    { deviceId: "8MK3-RPQS", lastSync: new Date(), appVersion: "2.1" },
    false
  ),
  false,
  "already-used device stays bound"
);
assert.equal(
  canRebindLicenseDevice({ deviceId: "POS-899FF4-ABCD-1", lastSync: null }, false),
  true
);
assert.equal(canRebindLicenseDevice({ deviceId: "8MK3-RPQS" }, true), true);

console.log("license-activation-code tests passed");
