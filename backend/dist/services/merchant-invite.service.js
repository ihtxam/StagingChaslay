"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantInviteService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const auth_service_1 = require("@/services/auth.service");
const email_service_1 = require("@/services/email.service");
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function publicAppBase() {
    return (process.env.PUBLIC_APP_URL ||
        process.env.MERCHANT_DASHBOARD_URL ||
        process.env.SUPERADMIN_URL ||
        "https://app.chaslay.com").replace(/\/$/, "");
}
class MerchantInviteService {
    static buildInviteUrl(token) {
        return `${publicAppBase()}/set-password?token=${encodeURIComponent(token)}`;
    }
    /**
     * Create a fresh invite token for a merchant. Returns raw token (show once / email once).
     */
    static async createInviteToken(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const token = crypto_1.default.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
        await db
            .update(db_1.schema.merchants)
            .set({
            inviteTokenHash: hashToken(token),
            inviteTokenExpiresAt: expiresAt,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return {
            token,
            expiresAt,
            inviteUrl: this.buildInviteUrl(token),
            merchant,
        };
    }
    static async sendInviteEmail(merchantId) {
        const { token, expiresAt, inviteUrl, merchant } = await this.createInviteToken(merchantId);
        const subject = `Set up your ${merchant.name} merchant account`;
        const html = `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Welcome to your merchant panel</h2>
        <p>Hi,</p>
        <p>
          An account was created for <strong>${escapeHtml(merchant.name)}</strong>
          (${escapeHtml(merchant.email)}).
        </p>
        <p>Click the button below to create your password and sign in:</p>
        <p style="margin: 24px 0;">
          <a href="${inviteUrl}"
             style="background:#0f172a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block;">
            Create password
          </a>
        </p>
        <p style="font-size: 13px; color: #555;">
          Or open this link:<br/>
          <a href="${inviteUrl}">${inviteUrl}</a>
        </p>
        <p style="font-size: 13px; color: #555;">
          This link expires on ${expiresAt.toUTCString()}.
        </p>
      </div>
    `;
        let emailed = false;
        let emailError;
        if (await email_service_1.EmailService.isConfigured()) {
            try {
                await email_service_1.EmailService.send({
                    to: merchant.email,
                    subject,
                    html,
                    text: `Create your password: ${inviteUrl}`,
                    emailType: "merchant_invite",
                });
                emailed = true;
            }
            catch (error) {
                emailError = error instanceof Error ? error.message : "Failed to send email";
                console.error("Invite email send failed:", error);
            }
        }
        else {
            emailError =
                "Email is not configured. Add Brevo in Superadmin → Settings (or BREVO_API_KEY / BREVO_FROM_EMAIL). Copy the invite link instead.";
            console.warn(`Invite email skipped (Brevo/SendGrid not configured). Link: ${inviteUrl}`);
        }
        const db = (0, db_1.getDb)();
        if (emailed) {
            await db
                .update(db_1.schema.merchants)
                .set({ inviteSentAt: new Date(), updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        }
        return {
            emailed,
            emailError,
            inviteUrl,
            expiresAt,
            email: merchant.email,
            merchantName: merchant.name,
        };
    }
    static async getInvitePreview(token) {
        const merchant = await this.findByInviteToken(token);
        if (!merchant)
            throw new Error("Invalid or expired invite link");
        return {
            email: merchant.email,
            name: merchant.name,
            expiresAt: merchant.inviteTokenExpiresAt,
        };
    }
    static async acceptInvite(token, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error("Password must be at least 8 characters");
        }
        const merchant = await this.findByInviteToken(token);
        if (!merchant)
            throw new Error("Invalid or expired invite link");
        const passwordHash = await auth_service_1.AuthService.hashPassword(newPassword);
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({
            passwordHash,
            passwordSetAt: new Date(),
            inviteTokenHash: null,
            inviteTokenExpiresAt: null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchant.id));
        return {
            email: merchant.email,
            name: merchant.name,
            id: merchant.id,
        };
    }
    static async findByInviteToken(token) {
        if (!token || token.length < 20)
            return null;
        const db = (0, db_1.getDb)();
        const now = new Date();
        return ((await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchants.inviteTokenHash, hashToken(token)), (0, drizzle_orm_1.isNotNull)(db_1.schema.merchants.inviteTokenExpiresAt), (0, drizzle_orm_1.gt)(db_1.schema.merchants.inviteTokenExpiresAt, now)),
        })) || null);
    }
}
exports.MerchantInviteService = MerchantInviteService;
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
//# sourceMappingURL=merchant-invite.service.js.map