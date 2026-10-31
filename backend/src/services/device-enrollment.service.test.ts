/**
 * Run: cd backend && npx tsx src/services/device-enrollment.service.test.ts
 */
import assert from "node:assert/strict";
import { terminalBelongsToProfile } from "@/lib/adyen-terminal-credentials";

assert.equal(
  terminalBelongsToProfile("profile-a", "profile-a", "profile-default"),
  true,
  "same profile"
);
assert.equal(
  terminalBelongsToProfile(null, "profile-default", "profile-default"),
  true,
  "terminal inherits default"
);
assert.equal(
  terminalBelongsToProfile("profile-b", "profile-a", "profile-default"),
  false,
  "cross-profile blocked"
);

console.log("device-enrollment.service.test.ts: ok");
