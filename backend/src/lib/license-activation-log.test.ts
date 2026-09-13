/**
 * License activation error sanitizer + device-id matching.
 * Run: cd backend && npx tsx src/lib/license-activation-log.test.ts
 */
import assert from "node:assert/strict";
import { publicLicenseActivationError } from "./license-activation-log";
import {
  normalizeActivationCode,
  posDeviceIdsMatch,
} from "../services/chaslay-compat.service";

assert.equal(
  publicLicenseActivationError(
    new Error(
      "Failed query: select `licenses`.`id`, json_build_array(`licenses.merchant`.`webpos_errors_enabled`, `licenses.merchant`.`webpos_crash_enabled`)"
    )
  ),
  "Activation failed. Please try again or contact support."
);
assert.equal(
  publicLicenseActivationError(new Error("License expired or inactive")),
  "License expired or inactive"
);
assert.equal(
  publicLicenseActivationError(new Error("column \"webpos_errors_enabled\" does not exist")),
  "Activation failed. Please try again or contact support."
);

assert.equal(normalizeActivationCode(" 1758-d6dd-ef5a "), "1758-D6DD-EF5A");
assert.equal(posDeviceIdsMatch("8MK3-RPQ5", "8MK3-RPQ5"), true);
assert.equal(posDeviceIdsMatch("8MK3RPQ5", "8MK3-RPQ5"), true);
assert.equal(posDeviceIdsMatch("8MK3-RPQ5", "AAAA-BBBB"), false);

console.log("license-activation-log.test.ts: ok");
