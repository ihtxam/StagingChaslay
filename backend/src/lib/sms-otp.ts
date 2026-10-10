import crypto from "crypto";

export const SMS_OTP_TTL_MS = 10 * 60 * 1000;
export const SMS_OTP_LENGTH = 6;
export const SMS_OTP_MAX_ATTEMPTS = 5;
export const SMS_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const SMS_OTP_PHONE_HOURLY_LIMIT = 5;
export const SMS_OTP_IP_HOURLY_LIMIT = 10;

export type OtpPurpose = "login" | "signup";

export function generateSmsOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(SMS_OTP_LENGTH, "0");
}

export function smsOtpPepper(): string {
  return (
    process.env.SMS_OTP_PEPPER ||
    process.env.ESENDEX_OTP_PEPPER ||
    process.env.JWT_SECRET ||
    "reborn-sms-otp-dev"
  );
}

/** SHA-256 of pepper + E.164 + purpose + code. Never store or log the raw code. */
export function hashSmsOtp(input: {
  code: string;
  phoneE164: string;
  purpose: OtpPurpose;
  pepper?: string;
}): string {
  const pepper = input.pepper || smsOtpPepper();
  return crypto
    .createHash("sha256")
    .update(`${pepper}|${input.phoneE164}|${input.purpose}|${input.code}`)
    .digest("hex");
}

export function otpExpiresAt(now = Date.now(), ttlMs = SMS_OTP_TTL_MS): Date {
  return new Date(now + ttlMs);
}

export function isOtpExpired(expiresAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return true;
  const t = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return !Number.isFinite(t) || t <= now;
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "mismatch" | "expired" | "consumed" | "locked" };

export function verifySmsOtpHash(input: {
  code: string;
  phoneE164: string;
  purpose: OtpPurpose;
  storedHash: string;
  expiresAt: Date | string;
  consumedAt?: Date | string | null;
  attempts?: number;
  pepper?: string;
  now?: number;
}): VerifyOtpResult {
  if (input.consumedAt) return { ok: false, reason: "consumed" };
  if (isOtpExpired(input.expiresAt, input.now ?? Date.now())) {
    return { ok: false, reason: "expired" };
  }
  if ((input.attempts ?? 0) >= SMS_OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "locked" };
  }
  const expected = hashSmsOtp({
    code: String(input.code || "").replace(/\D/g, "").slice(0, SMS_OTP_LENGTH),
    phoneE164: input.phoneE164,
    purpose: input.purpose,
    pepper: input.pepper,
  });
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(input.storedHash || ""), "hex");
  if (a.length !== b.length || a.length === 0) return { ok: false, reason: "mismatch" };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

export function canResendOtp(lastCreatedAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastCreatedAt) return true;
  const t = lastCreatedAt instanceof Date ? lastCreatedAt.getTime() : new Date(lastCreatedAt).getTime();
  return now - t >= SMS_OTP_RESEND_COOLDOWN_MS;
}
