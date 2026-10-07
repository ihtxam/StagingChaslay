import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  getDb,
  schema,
  type GoogleReputationReview,
  type GoogleReputationSettings,
} from "@/db";
import { ensureGoogleReputationAddonColumn } from "@/lib/ensure-merchant-schema";
import { merchantHasGoogleReputationLicense } from "@/lib/google-reputation-addon";

const TONE_INTROS: Record<NonNullable<GoogleReputationSettings["replyTone"]>, string> = {
  professional: "Thank you for sharing your experience with us.",
  friendly: "Thanks so much for your review — we really appreciate it!",
  warm: "We are grateful you took the time to visit us and leave a review.",
};

function normalizeSettings(
  raw: GoogleReputationSettings | null | undefined
): GoogleReputationSettings {
  const reviews = Array.isArray(raw?.reviews) ? raw!.reviews : [];
  return {
    googlePlaceId: raw?.googlePlaceId ? String(raw.googlePlaceId).slice(0, 128) : null,
    autoReplyEnabled: raw?.autoReplyEnabled === true,
    replyTone:
      raw?.replyTone === "friendly" || raw?.replyTone === "warm" ? raw.replyTone : "professional",
    managerEmail: raw?.managerEmail ? String(raw.managerEmail).slice(0, 255) : null,
    notifyOnNewReview: raw?.notifyOnNewReview !== false,
    reviews: reviews
      .map((r) => ({
        id: String(r.id || randomUUID()).slice(0, 64),
        authorName: String(r.authorName || "Guest").slice(0, 120),
        rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
        text: String(r.text || "").slice(0, 4000),
        createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
        replyDraft: r.replyDraft ? String(r.replyDraft).slice(0, 4000) : null,
        replyPostedAt: r.replyPostedAt ? String(r.replyPostedAt) : null,
        status:
          r.status === "replied" || r.status === "skipped"
            ? r.status
            : ("pending" as const),
      }))
      .filter((r) => r.text || r.rating),
  };
}

function draftReply(
  review: GoogleReputationReview,
  tone: GoogleReputationSettings["replyTone"],
  businessName: string
): string {
  const intro = TONE_INTROS[tone || "professional"];
  const stars = review.rating >= 4 ? "We are delighted you enjoyed your visit." : "We are sorry we missed the mark this time.";
  const signOff = `— The team at ${businessName}`;
  if (review.rating >= 4) {
    return `${intro} ${stars} We hope to welcome you back soon.\n\n${signOff}`;
  }
  return `${intro} ${stars} Please reach out to us directly so we can make it right.\n\n${signOff}`;
}

export class GoogleReputationService {
  static async getSettings(merchantId: string) {
    if (!(await merchantHasGoogleReputationLicense(merchantId))) {
      throw new Error("Google reputation requires the Google Reputation add-on");
    }
    await ensureGoogleReputationAddonColumn();
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { googleReputationSettings: true, name: true },
    });
    return normalizeSettings(merchant?.googleReputationSettings);
  }

  static async updateSettings(merchantId: string, input: Partial<GoogleReputationSettings>) {
    const current = await this.getSettings(merchantId);
    const next = normalizeSettings({ ...current, ...input, reviews: input.reviews ?? current.reviews });
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ googleReputationSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return next;
  }

  static async addReview(
    merchantId: string,
    input: { authorName?: string; rating?: number; text: string }
  ) {
    const settings = await this.getSettings(merchantId);
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { name: true, email: true },
    });
    const review: GoogleReputationReview = {
      id: randomUUID().slice(0, 64),
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

  static async draftReplyForReview(merchantId: string, reviewId: string) {
    const settings = await this.getSettings(merchantId);
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { name: true },
    });
    const reviews = (settings.reviews || []).map((r) => {
      if (r.id !== reviewId) return r;
      const replyDraft = draftReply(r, settings.replyTone, merchant?.name || "our restaurant");
      return { ...r, replyDraft };
    });
    return this.updateSettings(merchantId, { reviews });
  }

  static async markReplied(merchantId: string, reviewId: string) {
    const settings = await this.getSettings(merchantId);
    const reviews = (settings.reviews || []).map((r) =>
      r.id === reviewId
        ? { ...r, status: "replied" as const, replyPostedAt: new Date().toISOString() }
        : r
    );
    return this.updateSettings(merchantId, { reviews });
  }
}
