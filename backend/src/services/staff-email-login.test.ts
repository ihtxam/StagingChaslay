/**
 * Run: cd backend && npx tsx src/services/staff-email-login.test.ts
 */
import assert from "node:assert/strict";
import { StaffService } from "@/services/staff.service";

assert.equal(
  StaffService.emailLoginBlockedReason({ pinOnly: true, passwordHash: "x", pinHash: "y" }),
  StaffService.PIN_ONLY_LOGIN_MESSAGE,
  "pinOnly blocks even with password hash"
);
assert.equal(
  StaffService.emailLoginBlockedReason({ pinOnly: false, passwordHash: null, pinHash: "y" }),
  StaffService.PIN_ONLY_LOGIN_MESSAGE,
  "PIN without password"
);
assert.equal(
  StaffService.emailLoginBlockedReason({ pinOnly: false, passwordHash: null, pinHash: null }),
  StaffService.NO_PASSWORD_LOGIN_MESSAGE,
  "no credentials"
);
assert.equal(
  StaffService.emailLoginBlockedReason({ pinOnly: false, passwordHash: "hash", pinHash: "y" }),
  null,
  "email login allowed"
);

console.log("staff-email-login.test.ts: ok");
