import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, schema, type AiWebSeoSettings, type AiWebSeoSuggestion } from "@/db";
import { ensureAiWebSeoAddonColumn } from "@/lib/ensure-merchant-schema";
import { merchantHasAiWebSeoLicense } from "@/lib/ai-web-seo-addon";
import { resolveShopPublicHost } from "@/lib/brand";

function normalizeSettings(raw: AiWebSeoSettings | null | undefined): AiWebSeoSettings {
  const suggestions = Array.isArray(raw?.suggestions) ? raw!.suggestions : [];
  const keywords = Array.isArray(raw?.targetKeywords)
    ? raw!.targetKeywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 20)
    : [];
  return {
    autopilotEnabled: raw?.autopilotEnabled === true,
    targetKeywords: keywords,
    metaTitle: raw?.metaTitle ? String(raw.metaTitle).slice(0, 120) : null,
    metaDescription: raw?.metaDescription ? String(raw.metaDescription).slice(0, 320) : null,
    lastScanAt: raw?.lastScanAt ? String(raw.lastScanAt) : null,
    suggestions: suggestions
      .map((s) => ({
        id: String(s.id || randomUUID()).slice(0, 64),
        title: String(s.title || "").slice(0, 200),
        detail: String(s.detail || "").slice(0, 2000),
        priority:
          s.priority === "high" || s.priority === "low" ? s.priority : ("medium" as const),
      }))
      .filter((s) => s.title && s.detail),
  };
}

export class AiWebSeoService {
  static async getSettings(merchantId: string) {
    if (!(await merchantHasAiWebSeoLicense(merchantId))) {
      throw new Error("AI website & SEO requires the AI Web SEO add-on");
    }
    await ensureAiWebSeoAddonColumn();
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { aiWebSeoSettings: true, name: true, slug: true, shopSiteSettings: true },
    });
    return normalizeSettings(merchant?.aiWebSeoSettings);
  }

  static async updateSettings(merchantId: string, input: Partial<AiWebSeoSettings>) {
    const current = await this.getSettings(merchantId);
    const next = normalizeSettings({
      ...current,
      ...input,
      suggestions: input.suggestions ?? current.suggestions,
    });
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ aiWebSeoSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return next;
  }

  static async runScan(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        name: true,
        slug: true,
        shopSiteSettings: true,
        cmsHomepageEnabled: true,
        aiWebSeoSettings: true,
      },
    });
    if (!merchant) throw new Error("Merchant not found");
    if (!(await merchantHasAiWebSeoLicense(merchantId))) {
      throw new Error("AI website & SEO requires the AI Web SEO add-on");
    }

    const shopHost = resolveShopPublicHost();
    const shopUrl = merchant.slug ? `https://${shopHost}/${merchant.slug}` : null;
    const suggestions: AiWebSeoSuggestion[] = [];

    if (!merchant.cmsHomepageEnabled) {
      suggestions.push({
        id: "cms-homepage",
        title: "Enable website builder homepage",
        detail: "Turn on the Chaslay homepage so search engines have a dedicated landing page beyond the menu.",
        priority: "high",
      });
    }

    const meta = (merchant.shopSiteSettings || {}) as { metaTitle?: string; metaDescription?: string };
    if (!meta.metaTitle || String(meta.metaTitle).trim().length < 12) {
      suggestions.push({
        id: "meta-title",
        title: "Add a descriptive meta title",
        detail: `Use your business name and city in the title (e.g. "${merchant.name} — order online").`,
        priority: "high",
      });
    }
    if (!meta.metaDescription || String(meta.metaDescription).trim().length < 40) {
      suggestions.push({
        id: "meta-description",
        title: "Expand the meta description",
        detail: "Write 1–2 sentences with cuisine, location, and a call to action for pickup or delivery.",
        priority: "medium",
      });
    }

    if (shopUrl) {
      suggestions.push({
        id: "local-keywords",
        title: "Target local keywords",
        detail: `Link your Google Business profile to ${shopUrl} and use consistent NAP (name, address, phone) on the site footer.`,
        priority: "medium",
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        id: "maintain",
        title: "SEO baseline looks good",
        detail: "Re-run this scan after menu or branding changes to refresh recommendations.",
        priority: "low",
      });
    }

    const settings = normalizeSettings(merchant.aiWebSeoSettings);
    const next: AiWebSeoSettings = {
      ...settings,
      suggestions,
      lastScanAt: new Date().toISOString(),
      metaTitle: settings.metaTitle || meta.metaTitle || `${merchant.name} — order online`,
      metaDescription:
        settings.metaDescription ||
        meta.metaDescription ||
        `Order from ${merchant.name}. Fresh food, easy pickup and delivery.`,
    };

    await db
      .update(schema.merchants)
      .set({ aiWebSeoSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));

    return next;
  }
}
