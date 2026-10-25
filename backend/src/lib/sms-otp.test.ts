/**
 * OTP hash / TTL — run: npx tsx backend/src/lib/sms-otp.test.ts
 */
import assert from "node:assert/strict";
import {
  canResendOtp,
  generateSmsOtpCode,
  hashSmsOtp,
  isOtpExpired,
  otpExpiresAt,
  SMS_OTP_TTL_MS,
  verifySmsOtpHash,
} from "./sms-otp";

const code = generateSmsOtpCode();
assert.match(code, /^\d{6}$/);

const hash = hashSmsOtp({
  code: "123456",
  phoneE164: "41791234567",
  purpose: "login",
  pepper: "test-pepper",
});
assert.equal(hash.length, 64);
assert.notEqual(hash, "123456");

const other = hashSmsOtp({
  code: "123456",
  phoneE164: "41791234567",
  purpose: "signup",
  pepper: "test-pepper",
});
assert.notEqual(hash, other);

const now = Date.now();
const expires = otpExpiresAt(now, SMS_OTP_TTL_MS);
assert.equal(isOtpExpired(expires, now), false);
assert.equal(isOtpExpired(expires, now + SMS_OTP_TTL_MS + 1), true);

assert.equal(
  verifySmsOtpHash({
    code: "123456",
    phoneE164: "41791234567",
    purpose: "login",
    storedHash: hash,
    expiresAt: expires,
    pepper: "test-pepper",
    now,
  }).ok,
  true
);

assert.equal(
  verifySmsOtpHash({
    code: "000000",
    phoneE164: "41791234567",
    purpose: "login",
    storedHash: hash,
    expiresAt: expires,
    pepper: "test-pepper",
    now,
  }).reason,
  "mismatch"
);

assert.equal(
  verifySmsOtpHash({
    code: "123456",
    phoneE164: "41791234567",
    purpose: "login",
    storedHash: hash,
    expiresAt: new Date(now - 1),
    pepper: "test-pepper",
    now,
  }).reason,
  "expired"
);

assert.equal(
  verifySmsOtpHash({
    code: "123456",
    phoneE164: "41791234567",
    purpose: "login",
    storedHash: hash,
    expiresAt: expires,
    consumedAt: new Date(),
    pepper: "test-pepper",
    now,
  }).reason,
  "consumed"
);

assert.equal(
  verifySmsOtpHash({
    code: "123456",
    phoneE164: "41791234567",
    purpose: "login",
    storedHash: hash,
    expiresAt: expires,
    attempts: 5,
    pepper: "test-pepper",
    now,
  }).reason,
  "locked"
);

assert.equal(canResendOtp(new Date(now), now), false);
assert.equal(canResendOtp(new Date(now - 61_000), now), true);

console.log("sms-otp.test.ts: ok");
