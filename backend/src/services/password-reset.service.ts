import crypto from "crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthService, type JWTPayload } from "@/services/auth.service";
import { EmailService } from "@/services/email.service";

const RESET_TTL_MS = 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 8;
const MAX_PER_EMAIL = 3;
const GENERIC_SENT =
  "If an account exists for that email, we sent a reset link. Check your inbox.";

export type ResetAccountRole = "superadmin" | "reseller" | "merchant" | "staff";

type ResetAccount = {
  role: ResetAccountRole;
  accountId: string;
  email: string;
  name: string;
};

type RateBucket = { count: number; resetAt: number };

const rateByIp = new Map<string, RateBucket>();
const rateByEmail = new Map<string, RateBucket>();

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicAppBase() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.MERCHANT_DASHBOARD_URL ||
    process.env.SUPERADMIN_URL ||
    "https://app.chaslay.com"
  ).replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hitRateLimit(map: Map<string, RateBucket>, key: string, max: number): boolean {
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (existing.count >= max) return false;
  existing.count += 1;
  return true;
}

export class PasswordResetRateLimitError extends Error {
  constructor() {
    super("Too many reset requests. Please try again later.");
    this.name = "PasswordResetRateLimitError";
  }
}

export class PasswordResetService {
  static genericSentMessage() {
    return GENERIC_SENT;
  }

  static assertRequestAllowed(ip: string, email: string) {
    const ipOk = hitRateLimit(rateByIp, ip || "unknown", MAX_PER_IP);
    const emailOk = hitRateLimit(rateByEmail, email, MAX_PER_EMAIL);
    if (!ipOk || !emailOk) {
      throw new PasswordResetRateLimitError();
    }
  }

  static buildResetUrl(token: string) {
    return `${publicAppBase()}/reset-password?token=${encodeURIComponent(token)}`;
  }

  static async ensureTable() {
    const db = getDb();
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        role varchar(20) NOT NULL,
        account_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `));
    await db.execute(
      sql.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON password_reset_tokens(token_hash)`
      )
    );
  }

  /**
   * Look up an email across merchant owner, staff, reseller, then superadmin
   * (same order as unified login).
   */
  static async findAccountByEmail(email: string): Promise<ResetAccount | null> {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) return null;

    const db = getDb();

    const merchants = await db
      .select({
        id: schema.merchants.id,
        email: schema.merchants.email,
        name: schema.merchants.name,
      })
      .from(schema.merchants)
      .where(sql`lower(${schema.merchants.email}) = ${normalized}`)
      .limit(1);
    if (merchants[0]) {
      return {
        role: "merchant",
        accountId: merchants[0].id,
        email: merchants[0].email,
        name: merchants[0].name,
      };
    }

    const staffRows = await db
      .select({
        id: schema.merchantStaff.id,
        email: schema.merchantStaff.email,
        name: schema.merchantStaff.name,
        canAccessPanel: schema.merchantStaff.canAccessPanel,
        isActive: schema.merchantStaff.isActive,
      })
      .from(schema.merchantStaff)
      .where(
        and(
          sql`lower(${schema.merchantStaff.email}) = ${normalized}`,
          eq(schema.merchantStaff.isActive, true)
        )
      )
      .limit(1);
    if (staffRows[0]?.email) {
      return {
        role: "staff",
        accountId: staffRows[0].id,
        email: staffRows[0].email,
        name: staffRows[0].name,
      };
    }

    const resellers = await db
      .select({
        id: schema.resellers.id,
        email: schema.resellers.email,
        name: schema.resellers.name,
        status: schema.resellers.status,
      })
      .from(schema.resellers)
      .where(sql`lower(${schema.resellers.email}) = ${normalized}`)
      .limit(1);
    if (resellers[0]) {
      return {
        role: "reseller",
        accountId: resellers[0].id,
        email: resellers[0].email,
        name: resellers[0].name,
      };
    }

    const admins = await db
      .select({
        id: schema.superadmins.id,
        email: schema.superadmins.email,
        name: schema.superadmins.name,
        isActive: schema.superadmins.isActive,
      })
      .from(schema.superadmins)
      .where(sql`lower(${schema.superadmins.email}) = ${normalized}`)
      .limit(1);
    if (admins[0]?.isActive) {
      return {
        role: "superadmin",
        accountId: admins[0].id,
        email: admins[0].email,
        name: admins[0].name,
      };
    }

    return null;
  }

  static async requestReset(email: string, ip: string) {
    const normalized = String(email || "").trim().toLowerCase();
    this.assertRequestAllowed(ip, normalized || "invalid");

    if (!normalized || !normalized.includes("@")) {
      return { success: true, message: GENERIC_SENT };
    }

    try {
      await this.ensureTable();
    } catch (error) {
      console.warn("[password-reset] failed to ensure table:", error);
    }

    const account = await this.findAccountByEmail(normalized);
    if (!account) {
      return { success: true, message: GENERIC_SENT };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    const db = getDb();

    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.passwordResetTokens.accountId, account.accountId),
          eq(schema.passwordResetTokens.role, account.role),
          isNull(schema.passwordResetTokens.usedAt)
        )
      );

    await db.insert(schema.passwordResetTokens).values({
      email: account.email,
      role: account.role,
      accountId: account.accountId,
      tokenHash: hashToken(token),
      expiresAt,
    });

    const resetUrl = this.buildResetUrl(token);
    await this.sendResetEmail(account, resetUrl, expiresAt);

    return { success: true, message: GENERIC_SENT };
  }

  static async previewToken(token: string) {
    const row = await this.findValidToken(token);
    if (!row) throw new Error("Invalid or expired reset link");
    return {
      email: row.email,
      role: row.role as ResetAccountRole,
      expiresAt: row.expiresAt,
    };
  }

  static async applyReset(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const row = await this.findValidToken(token);
    if (!row) throw new Error("Invalid or expired reset link");

    await this.setPassword(row.role as ResetAccountRole, row.accountId, newPassword);

    const db = getDb();
    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.passwordResetTokens.accountId, row.accountId),
          eq(schema.passwordResetTokens.role, row.role),
          isNull(schema.passwordResetTokens.usedAt)
        )
      );

    return { success: true, email: row.email, role: row.role };
  }

  static async changeOwnPassword(
    user: JWTPayload,
    currentPassword: string,
    newPassword: string
  ) {
    if (!currentPassword) throw new Error("Current password is required");
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const db = getDb();

    if (user.role === "superadmin") {
      const admin = await db.query.superadmins.findFirst({
        where: eq(schema.superadmins.id, user.id),
      });
      if (!admin) throw new Error("Account not found");
      const ok = await AuthService.comparePassword(currentPassword, admin.passwordHash);
      if (!ok) throw new Error("Current password is incorrect");
      await this.setPassword("superadmin", admin.id, newPassword);
      return { success: true };
    }

    if (user.role === "reseller" && user.resellerId) {
      const reseller = await db.query.resellers.findFirst({
        where: eq(schema.resellers.id, user.resellerId),
      });
      if (!reseller) throw new Error("Account not found");
      const ok = await AuthService.comparePassword(currentPassword, reseller.passwordHash);
      if (!ok) throw new Error("Current password is incorrect");
      await this.setPassword("reseller", reseller.id, newPassword);
      return { success: true };
    }

    if (user.role === "staff" && user.staffId) {
      const staff = await db.query.merchantStaff.findFirst({
        where: eq(schema.merchantStaff.id, user.staffId),
      });
      if (!staff?.passwordHash) throw new Error("Account not found");
      const ok = await AuthService.comparePassword(currentPassword, staff.passwordHash);
      if (!ok) throw new Error("Current password is incorrect");
      await this.setPassword("staff", staff.id, newPassword);
      return { success: true };
    }

    if (user.role === "merchant") {
      const merchantId = user.merchantId || user.id;
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      if (!merchant) throw new Error("Account not found");
      const ok = await AuthService.comparePassword(currentPassword, merchant.passwordHash);
      if (!ok) throw new Error("Current password is incorrect");
      await this.setPassword("merchant", merchant.id, newPassword);
      return { success: true };
    }

    throw new Error("Password change is not available for this account");
  }

  private static async setPassword(role: ResetAccountRole, accountId: string, newPassword: string) {
    const db = getDb();
    const passwordHash = await AuthService.hashPassword(newPassword);

    if (role === "merchant") {
      await db
        .update(schema.merchants)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.merchants.id, accountId));
      return;
    }
    if (role === "staff") {
      await db
        .update(schema.merchantStaff)
        .set({ passwordHash, canAccessPanel: true, updatedAt: new Date() })
        .where(eq(schema.merchantStaff.id, accountId));
      return;
    }
    if (role === "reseller") {
      const { ResellerService } = await import("@/services/reseller.service");
      await ResellerService.update(accountId, { password: newPassword });
      return;
    }
    await db
      .update(schema.superadmins)
      .set({ passwordHash, isActive: true, updatedAt: new Date() })
      .where(eq(schema.superadmins.id, accountId));
  }

  private static async findValidToken(token: string) {
    if (!token || token.length < 20) return null;
    try {
      await this.ensureTable();
    } catch {
      /* continue */
    }
    const db = getDb();
    const now = new Date();
    return (
      (await db.query.passwordResetTokens.findFirst({
        where: and(
          eq(schema.passwordResetTokens.tokenHash, hashToken(token)),
          isNull(schema.passwordResetTokens.usedAt),
          gt(schema.passwordResetTokens.expiresAt, now)
        ),
      })) || null
    );
  }

  private static async sendResetEmail(account: ResetAccount, resetUrl: string, expiresAt: Date) {
    const subject = "Reset your Chaslay password";
    const html = `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Reset your password</h2>
        <p>Hi ${escapeHtml(account.name || "")},</p>
        <p>
          We received a request to reset the password for
          <strong>${escapeHtml(account.email)}</strong>.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background:#0f766e;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block;">
            Set a new password
          </a>
        </p>
        <p style="font-size: 13px; color: #555;">
          Or open this link:<br/>
          <a href="${resetUrl}">${escapeHtml(resetUrl)}</a>
        </p>
        <p style="font-size: 13px; color: #555;">
          This link expires in 1 hour (${expiresAt.toUTCString()}).
          If you did not request this, you can ignore this email.
        </p>
      </div>
    `;

    if (!(await EmailService.isConfigured())) {
      console.warn(
        `[password-reset] email not configured (Brevo). Reset requested for ${account.email} (${account.role}).`
      );
      return;
    }

    try {
      await EmailService.send({
        to: account.email,
        subject,
        html,
        text: `Reset your Chaslay password: ${resetUrl}`,
      });
    } catch (error) {
      console.error("[password-reset] Brevo send failed:", error);
    }
  }
}
