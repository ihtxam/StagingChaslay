import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthService } from "@/services/auth.service";
import { SmsService } from "@/services/sms.service";
import { ShopCustomerService } from "@/services/shop-customer.service";
import { normalizeE164 } from "@/lib/sms-phone";
import {
  canResendOtp,
  generateSmsOtpCode,
  hashSmsOtp,
  otpExpiresAt,
  SMS_OTP_IP_HOURLY_LIMIT,
  SMS_OTP_PHONE_HOURLY_LIMIT,
  verifySmsOtpHash,
  type OtpPurpose,
} from "@/lib/sms-otp";

export type PendingSignupMeta = {
  email?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  marketingSmsOptIn?: boolean;
};

function clientIp(ip?: string | null): string | null {
  const v = String(ip || "").trim().slice(0, 64);
  return v || null;
}

export class SmsOtpService {
  static async request(input: {
    merchantId: string;
    phone: string;
    purpose: OtpPurpose;
    ip?: string | null;
    signup?: PendingSignupMeta;
    shopName?: string;
  }) {
    await SmsService.ensureSchema();
    const licensed = await SmsService.isLicensed(input.merchantId);
    if (!licensed) throw new Error("SMS login is not enabled for this shop");

    const settings = await SmsService.settingsFor(input.merchantId);
    const phone = normalizeE164(input.phone, settings.defaultCountry);
    if (!phone.ok) throw new Error(phone.error);

    const db = getDb();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [phoneCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.smsOtps)
      .where(
        and(
          eq(schema.smsOtps.merchantId, input.merchantId),
          eq(schema.smsOtps.phoneE164, phone.e164),
          gte(schema.smsOtps.createdAt, hourAgo)
        )
      );
    if (Number(phoneCount?.n || 0) >= SMS_OTP_PHONE_HOURLY_LIMIT) {
      throw new Error("Too many codes sent to this number. Try again later.");
    }
    const ip = clientIp(input.ip);
    if (ip) {
      const [ipCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.smsOtps)
        .where(
          and(
            eq(schema.smsOtps.merchantId, input.merchantId),
            eq(schema.smsOtps.ip, ip),
            gte(schema.smsOtps.createdAt, hourAgo)
          )
        );
      if (Number(ipCount?.n || 0) >= SMS_OTP_IP_HOURLY_LIMIT) {
        throw new Error("Too many verification requests from this network.");
      }
    }

    const last = await db.query.smsOtps.findFirst({
      where: and(
        eq(schema.smsOtps.merchantId, input.merchantId),
        eq(schema.smsOtps.phoneE164, phone.e164),
        eq(schema.smsOtps.purpose, input.purpose)
      ),
      orderBy: [desc(schema.smsOtps.createdAt)],
    });
    if (last && !canResendOtp(last.createdAt)) {
      throw new Error("Please wait a minute before requesting another code");
    }

    if (input.purpose === "login") {
      const existing = await this.findCustomerByPhone(input.merchantId, phone.e164);
      if (!existing) throw new Error("No account found for this phone number");
    }

    const code = generateSmsOtpCode();
    const codeHash = hashSmsOtp({
      code,
      phoneE164: phone.e164,
      purpose: input.purpose,
    });
    const meta =
      input.purpose === "signup"
        ? {
            email: input.signup?.email || null,
            passwordHash: input.signup?.passwordHash || null,
            firstName: input.signup?.firstName || null,
            lastName: input.signup?.lastName || null,
            marketingSmsOptIn: input.signup?.marketingSmsOptIn === true,
          }
        : null;

    await db.insert(schema.smsOtps).values({
      merchantId: input.merchantId,
      phoneE164: phone.e164,
      purpose: input.purpose,
      codeHash,
      meta,
      ip,
      expiresAt: otpExpiresAt(),
    });

    const sent = await SmsService.send({
      merchantId: input.merchantId,
      to: phone.e164,
      type: "otp",
      event: input.purpose === "signup" ? "otpSignup" : "otpLogin",
      templateKey: input.purpose === "signup" ? "otpSignup" : "otpLogin",
      vars: { code, shopName: input.shopName },
      skipEventToggle: true,
    });
    if (!sent.ok && sent.reason === "quota_exceeded") {
      throw new Error("This shop has used its SMS allowance for the month");
    }
    if (!sent.ok && sent.reason === "esendex_not_configured") {
      throw new Error("SMS is not configured");
    }
    if (!sent.ok && sent.status === "failed") {
      throw new Error("Could not send the verification SMS");
    }

    return { success: true, phone: phone.display, expiresInSec: 600 };
  }

  static async verify(input: {
    merchantId: string;
    phone: string;
    code: string;
    purpose: OtpPurpose;
  }) {
    await SmsService.ensureSchema();
    const settings = await SmsService.settingsFor(input.merchantId);
    const phone = normalizeE164(input.phone, settings.defaultCountry);
    if (!phone.ok) throw new Error(phone.error);

    const db = getDb();
    const row = await db.query.smsOtps.findFirst({
      where: and(
        eq(schema.smsOtps.merchantId, input.merchantId),
        eq(schema.smsOtps.phoneE164, phone.e164),
        eq(schema.smsOtps.purpose, input.purpose)
      ),
      orderBy: [desc(schema.smsOtps.createdAt)],
    });
    if (!row) throw new Error("No verification code found. Request a new one.");

    const check = verifySmsOtpHash({
      code: input.code,
      phoneE164: phone.e164,
      purpose: input.purpose,
      storedHash: row.codeHash,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      attempts: row.attempts,
    });
    if (!check.ok) {
      await db
        .update(schema.smsOtps)
        .set({ attempts: (row.attempts || 0) + 1 })
        .where(eq(schema.smsOtps.id, row.id));
      if (check.reason === "expired") throw new Error("This code has expired");
      if (check.reason === "consumed") throw new Error("This code was already used");
      if (check.reason === "locked") throw new Error("Too many incorrect attempts");
      throw new Error("Invalid verification code");
    }

    await db
      .update(schema.smsOtps)
      .set({ consumedAt: new Date() })
      .where(eq(schema.smsOtps.id, row.id));

    if (input.purpose === "login") {
      const customer = await this.findCustomerByPhone(input.merchantId, phone.e164);
      if (!customer) throw new Error("No account found for this phone number");
      await db
        .update(schema.customers)
        .set({ phoneVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.customers.id, customer.id));
      return ShopCustomerService.tokenForPublic(customer);
    }

    const meta = (row.meta || {}) as PendingSignupMeta;
    const existing = await this.findCustomerByPhone(input.merchantId, phone.e164);
    if (existing) {
      await db
        .update(schema.customers)
        .set({
          phoneVerifiedAt: new Date(),
          passwordHash: meta.passwordHash || existing.passwordHash,
          firstName: meta.firstName || existing.firstName,
          lastName: meta.lastName || existing.lastName,
          marketingSmsOptIn: meta.marketingSmsOptIn === true ? true : existing.marketingSmsOptIn,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, existing.id));
      return ShopCustomerService.tokenForPublic({
        ...existing,
        passwordHash: meta.passwordHash || existing.passwordHash,
        marketingSmsOptIn: meta.marketingSmsOptIn === true ? true : existing.marketingSmsOptIn,
      });
    }

    const email = String(meta.email || "").trim().toLowerCase();
    if (email) {
      const byEmail = await db.query.customers.findFirst({
        where: and(eq(schema.customers.merchantId, input.merchantId), eq(schema.customers.email, email)),
      });
      if (byEmail) {
        const [upgraded] = await db
          .update(schema.customers)
          .set({
            passwordHash: meta.passwordHash || byEmail.passwordHash,
            firstName: meta.firstName || byEmail.firstName,
            lastName: meta.lastName || byEmail.lastName,
            phone: phone.display,
            marketingSmsOptIn: meta.marketingSmsOptIn === true ? true : byEmail.marketingSmsOptIn,
            phoneVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.customers.id, byEmail.id))
          .returning();
        return ShopCustomerService.tokenForPublic(upgraded);
      }
    }

    const [created] = await db
      .insert(schema.customers)
      .values({
        merchantId: input.merchantId,
        email: email || null,
        passwordHash: meta.passwordHash || null,
        firstName: meta.firstName || null,
        lastName: meta.lastName || null,
        phone: phone.display,
        marketingSmsOptIn: meta.marketingSmsOptIn === true,
        phoneVerifiedAt: new Date(),
      })
      .returning();
    return ShopCustomerService.tokenForPublic(created);
  }

  static async findCustomerByPhone(merchantId: string, phoneE164: string) {
    const db = getDb();
    const rows = await db.query.customers.findMany({
      where: eq(schema.customers.merchantId, merchantId),
      columns: {
        id: true,
        merchantId: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        defaultAddress: true,
        defaultZip: true,
        defaultCity: true,
        loyaltyPoints: true,
        marketingOptIn: true,
        marketingSmsOptIn: true,
        phoneVerifiedAt: true,
        lastOrderAt: true,
        lastReorderReminderAt: true,
        crmTags: true,
        totalSpent: true,
        allergies: true,
        habits: true,
        membershipPlanId: true,
        photoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return (
      rows.find((c) => {
        const n = normalizeE164(c.phone);
        return n.ok && n.e164 === phoneE164;
      }) || null
    );
  }

  static async hashSignupPassword(password: string) {
    return AuthService.hashPassword(password);
  }
}
