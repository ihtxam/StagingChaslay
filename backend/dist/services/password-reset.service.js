"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetService = exports.PasswordResetRateLimitError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const auth_service_1 = require("@/services/auth.service");
const email_service_1 = require("@/services/email.service");
const RESET_TTL_MS = 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 8;
const MAX_PER_EMAIL = 3;
const GENERIC_SENT = "If an account exists for that email, we sent a reset link. Check your inbox.";
const rateByIp = new Map();
const rateByEmail = new Map();
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function publicAppBase() {
    return (process.env.PUBLIC_APP_URL ||
        process.env.MERCHANT_DASHBOARD_URL ||
        process.env.SUPERADMIN_URL ||
        "https://app.rebornsense.com").replace(/\/$/, "");
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function hitRateLimit(map, key, max) {
    const now = Date.now();
    const existing = map.get(key);
    if (!existing || existing.resetAt <= now) {
        map.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (existing.count >= max)
        return false;
    existing.count += 1;
    return true;
}
class PasswordResetRateLimitError extends Error {
    constructor() {
        super("Too many reset requests. Please try again later.");
        this.name = "PasswordResetRateLimitError";
    }
}
exports.PasswordResetRateLimitError = PasswordResetRateLimitError;
class PasswordResetService {
    static genericSentMessage() {
        return GENERIC_SENT;
    }
    static assertRequestAllowed(ip, email) {
        const ipOk = hitRateLimit(rateByIp, ip || "unknown", MAX_PER_IP);
        const emailOk = hitRateLimit(rateByEmail, email, MAX_PER_EMAIL);
        if (!ipOk || !emailOk) {
            throw new PasswordResetRateLimitError();
        }
    }
    static buildResetUrl(token) {
        return `${publicAppBase()}/reset-password?token=${encodeURIComponent(token)}`;
    }
    static async ensureTable() {
        const db = (0, db_1.getDb)();
        await db.execute(drizzle_orm_1.sql.raw(`
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
        await db.execute(drizzle_orm_1.sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON password_reset_tokens(token_hash)`));
    }
    /**
     * Look up an email across merchant owner, staff, reseller, then superadmin
     * (same order as unified login).
     */
    static async findAccountByEmail(email) {
        const normalized = String(email || "").trim().toLowerCase();
        if (!normalized || !normalized.includes("@"))
            return null;
        const db = (0, db_1.getDb)();
        const merchants = await db
            .select({
            id: db_1.schema.merchants.id,
            email: db_1.schema.merchants.email,
            name: db_1.schema.merchants.name,
        })
            .from(db_1.schema.merchants)
            .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.merchants.email}) = ${normalized}`)
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
            id: db_1.schema.merchantStaff.id,
            email: db_1.schema.merchantStaff.email,
            name: db_1.schema.merchantStaff.name,
            canAccessPanel: db_1.schema.merchantStaff.canAccessPanel,
            isActive: db_1.schema.merchantStaff.isActive,
        })
            .from(db_1.schema.merchantStaff)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `lower(${db_1.schema.merchantStaff.email}) = ${normalized}`, (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)))
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
            id: db_1.schema.resellers.id,
            email: db_1.schema.resellers.email,
            name: db_1.schema.resellers.name,
            status: db_1.schema.resellers.status,
        })
            .from(db_1.schema.resellers)
            .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.resellers.email}) = ${normalized}`)
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
            id: db_1.schema.superadmins.id,
            email: db_1.schema.superadmins.email,
            name: db_1.schema.superadmins.name,
            isActive: db_1.schema.superadmins.isActive,
        })
            .from(db_1.schema.superadmins)
            .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.superadmins.email}) = ${normalized}`)
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
    static async requestReset(email, ip) {
        const normalized = String(email || "").trim().toLowerCase();
        this.assertRequestAllowed(ip, normalized || "invalid");
        if (!normalized || !normalized.includes("@")) {
            return { success: true, message: GENERIC_SENT };
        }
        try {
            await this.ensureTable();
        }
        catch (error) {
            console.warn("[password-reset] failed to ensure table:", error);
        }
        const account = await this.findAccountByEmail(normalized);
        if (!account) {
            return { success: true, message: GENERIC_SENT };
        }
        const token = crypto_1.default.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + RESET_TTL_MS);
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.passwordResetTokens)
            .set({ usedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.passwordResetTokens.accountId, account.accountId), (0, drizzle_orm_1.eq)(db_1.schema.passwordResetTokens.role, account.role), (0, drizzle_orm_1.isNull)(db_1.schema.passwordResetTokens.usedAt)));
        await db.insert(db_1.schema.passwordResetTokens).values({
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
    static async previewToken(token) {
        const row = await this.findValidToken(token);
        if (!row)
            throw new Error("Invalid or expired reset link");
        return {
            email: row.email,
            role: row.role,
            expiresAt: row.expiresAt,
        };
    }
    static async applyReset(token, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error("Password must be at least 8 characters");
        }
        const row = await this.findValidToken(token);
        if (!row)
            throw new Error("Invalid or expired reset link");
        await this.setPassword(row.role, row.accountId, newPassword);
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.passwordResetTokens)
            .set({ usedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.passwordResetTokens.accountId, row.accountId), (0, drizzle_orm_1.eq)(db_1.schema.passwordResetTokens.role, row.role), (0, drizzle_orm_1.isNull)(db_1.schema.passwordResetTokens.usedAt)));
        return { success: true, email: row.email, role: row.role };
    }
    static async changeOwnPassword(user, currentPassword, newPassword) {
        if (!currentPassword)
            throw new Error("Current password is required");
        if (!newPassword || newPassword.length < 8) {
            throw new Error("Password must be at least 8 characters");
        }
        const db = (0, db_1.getDb)();
        if (user.role === "superadmin") {
            const admin = await db.query.superadmins.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.superadmins.id, user.id),
            });
            if (!admin)
                throw new Error("Account not found");
            const ok = await auth_service_1.AuthService.comparePassword(currentPassword, admin.passwordHash);
            if (!ok)
                throw new Error("Current password is incorrect");
            await this.setPassword("superadmin", admin.id, newPassword);
            return { success: true };
        }
        if (user.role === "reseller" && user.resellerId) {
            const reseller = await db.query.resellers.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.id, user.resellerId),
            });
            if (!reseller)
                throw new Error("Account not found");
            const ok = await auth_service_1.AuthService.comparePassword(currentPassword, reseller.passwordHash);
            if (!ok)
                throw new Error("Current password is incorrect");
            await this.setPassword("reseller", reseller.id, newPassword);
            return { success: true };
        }
        if (user.role === "staff" && user.staffId) {
            const staff = await db.query.merchantStaff.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, user.staffId),
            });
            if (!staff?.passwordHash)
                throw new Error("Account not found");
            const ok = await auth_service_1.AuthService.comparePassword(currentPassword, staff.passwordHash);
            if (!ok)
                throw new Error("Current password is incorrect");
            await this.setPassword("staff", staff.id, newPassword);
            return { success: true };
        }
        if (user.role === "merchant") {
            const merchantId = user.merchantId || user.id;
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            if (!merchant)
                throw new Error("Account not found");
            const ok = await auth_service_1.AuthService.comparePassword(currentPassword, merchant.passwordHash);
            if (!ok)
                throw new Error("Current password is incorrect");
            await this.setPassword("merchant", merchant.id, newPassword);
            return { success: true };
        }
        throw new Error("Password change is not available for this account");
    }
    static async setPassword(role, accountId, newPassword) {
        const db = (0, db_1.getDb)();
        const passwordHash = await auth_service_1.AuthService.hashPassword(newPassword);
        if (role === "merchant") {
            await db
                .update(db_1.schema.merchants)
                .set({ passwordHash, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, accountId));
            return;
        }
        if (role === "staff") {
            await db
                .update(db_1.schema.merchantStaff)
                .set({ passwordHash, canAccessPanel: true, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, accountId));
            return;
        }
        if (role === "reseller") {
            const { ResellerService } = await Promise.resolve().then(() => __importStar(require("@/services/reseller.service")));
            await ResellerService.update(accountId, { password: newPassword });
            return;
        }
        await db
            .update(db_1.schema.superadmins)
            .set({ passwordHash, isActive: true, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.superadmins.id, accountId));
    }
    static async findValidToken(token) {
        if (!token || token.length < 20)
            return null;
        try {
            await this.ensureTable();
        }
        catch {
            /* continue */
        }
        const db = (0, db_1.getDb)();
        const now = new Date();
        return ((await db.query.passwordResetTokens.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.passwordResetTokens.tokenHash, hashToken(token)), (0, drizzle_orm_1.isNull)(db_1.schema.passwordResetTokens.usedAt), (0, drizzle_orm_1.gt)(db_1.schema.passwordResetTokens.expiresAt, now)),
        })) || null);
    }
    static async sendResetEmail(account, resetUrl, expiresAt) {
        const subject = "Reset your Reborn password";
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
        if (!(await email_service_1.EmailService.isConfigured())) {
            console.warn(`[password-reset] email not configured (Brevo). Reset requested for ${account.email} (${account.role}).`);
            return;
        }
        try {
            await email_service_1.EmailService.send({
                to: account.email,
                subject,
                html,
                text: `Reset your Reborn password: ${resetUrl}`,
                emailType: "password_reset",
            });
        }
        catch (error) {
            console.error("[password-reset] Brevo send failed:", error);
        }
    }
}
exports.PasswordResetService = PasswordResetService;
//# sourceMappingURL=password-reset.service.js.map