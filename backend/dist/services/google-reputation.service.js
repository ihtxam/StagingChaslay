"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleReputationService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const google_reputation_addon_1 = require("@/lib/google-reputation-addon");
const TONE_INTROS = {
    professional: "Thank you for sharing your experience with us.",
    friendly: "Thanks so much for your review — we really appreciate it!",
    warm: "We are grateful you took the time to visit us and leave a review.",
};
function normalizeSettings(raw) {
    const reviews = Array.isArray(raw?.reviews) ? raw.reviews : [];
    return {
        googlePlaceId: raw?.googlePlaceId ? String(raw.googlePlaceId).slice(0, 128) : null,
        autoReplyEnabled: raw?.autoReplyEnabled === true,
        replyTone: raw?.replyTone === "friendly" || raw?.replyTone === "warm" ? raw.replyTone : "professional",
        managerEmail: raw?.managerEmail ? String(raw.managerEmail).slice(0, 255) : null,
        notifyOnNewReview: raw?.notifyOnNewReview !== false,
        reviews: reviews
            .map((r) => ({
            id: String(r.id || (0, crypto_1.randomUUID)()).slice(0, 64),
            authorName: String(r.authorName || "Guest").slice(0, 120),
            rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
            text: String(r.text || "").slice(0, 4000),
            createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
            replyDraft: r.replyDraft ? String(r.replyDraft).slice(0, 4000) : null,
            replyPostedAt: r.replyPostedAt ? String(r.replyPostedAt) : null,
            status: r.status === "replied" || r.status === "skipped"
                ? r.status
                : "pending",
        }))
            .filter((r) => r.text || r.rating),
    };
}
function draftReply(review, tone, businessName) {
    const intro = TONE_INTROS[tone || "professional"];
    const stars = review.rating >= 4 ? "We are delighted you enjoyed your visit." : "We are sorry we missed the mark this time.";
    const signOff = `— The team at ${businessName}`;
    if (review.rating >= 4) {
        return `${intro} ${stars} We hope to welcome you back soon.\n\n${signOff}`;
    }
    return `${intro} ${stars} Please reach out to us directly so we can make it right.\n\n${signOff}`;
}
class GoogleReputationService {
    static async getSettings(merchantId) {
        if (!(await (0, google_reputation_addon_1.merchantHasGoogleReputationLicense)(merchantId))) {
            throw new Error("Google reputation requires the Google Reputation add-on");
        }
        await (0, ensure_merchant_schema_1.ensureGoogleReputationAddonColumn)();
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { googleReputationSettings: true, name: true },
        });
        return normalizeSettings(merchant?.googleReputationSettings);
    }
    static async updateSettings(merchantId, input) {
        const current = await this.getSettings(merchantId);
        const next = normalizeSettings({ ...current, ...input, reviews: input.reviews ?? current.reviews });
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ googleReputationSettings: next, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return next;
    }
    static async addReview(merchantId, input) {
        const settings = await this.getSettings(merchantId);
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { name: true, email: true },
        });
        const review = {
            id: (0, crypto_1.randomUUID)().slice(0, 64),
            authorName: String(input.authorName || "Guest").slice(0, 120),
            rating: Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5))),
            text: String(input.text || "").slice(0, 4000),
            createdAt: new Date().toISOString(),
            status: "pending",
            replyDraft: null,
            replyPostedAt: null,
        };
        if (settings.autoReplyEnabled) {
            review.replyDraft = draftReply(review, settings.replyTone, merchant?.name || "our restaurant");
        }
        const reviews = [review, ...(settings.reviews || [])].slice(0, 200);
        const next = await this.updateSettings(merchantId, { reviews });
        return { review, settings: next };
    }
    static async draftReplyForReview(merchantId, reviewId) {
        const settings = await this.getSettings(merchantId);
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { name: true },
        });
        const reviews = (settings.reviews || []).map((r) => {
            if (r.id !== reviewId)
                return r;
            const replyDraft = draftReply(r, settings.replyTone, merchant?.name || "our restaurant");
            return { ...r, replyDraft };
        });
        return this.updateSettings(merchantId, { reviews });
    }
    static async markReplied(merchantId, reviewId) {
        const settings = await this.getSettings(merchantId);
        const reviews = (settings.reviews || []).map((r) => r.id === reviewId
            ? { ...r, status: "replied", replyPostedAt: new Date().toISOString() }
            : r);
        return this.updateSettings(merchantId, { reviews });
    }
}
exports.GoogleReputationService = GoogleReputationService;
//# sourceMappingURL=google-reputation.service.js.map