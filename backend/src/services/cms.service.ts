import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema, type CmsTheme } from "@/db";
import { randomUUID } from "crypto";

function slugify(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return cleaned || `page-${Date.now().toString(36)}`;
}

function bid() {
  return randomUUID();
}

export type OpenPageBlock = {
  id: string;
  type: string;
  variant: string;
  props: Record<string, unknown>;
};

export type OpenPageSiteConfig = {
  name: string;
  blocks: OpenPageBlock[];
  pages?: Array<{ id: string; name: string; path: string; blocks: OpenPageBlock[] }>;
  theme?: Record<string, unknown>;
};

export type CmsOpenPageData = {
  engine: "openpage";
  config: OpenPageSiteConfig;
  html: string;
  defaultLocale?: "en" | "fr" | "de";
  locales?: Partial<
    Record<"en" | "fr" | "de", { config: OpenPageSiteConfig; html: string }>
  >;
};

function openPageScaffold(title: string, blocks: OpenPageBlock[]): CmsOpenPageData {
  const config: OpenPageSiteConfig = {
    name: title,
    blocks,
    pages: [{ id: "page-home", name: "Home", path: "/", blocks }],
  };
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title></head><body style="margin:0;font-family:system-ui,sans-serif"><main style="padding:3rem 1.5rem;text-align:center"><h1>${escapeHtml(title)}</h1><p>Open the OpenPage builder and click Save to publish your design.</p><p><a href="/menu">Order online</a></p></main></body></html>`;
  return { engine: "openpage", config, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emptyData(title = ""): CmsOpenPageData {
  const name = title || "Homepage";
  return openPageScaffold(name, [
    {
      id: bid(),
      type: "hero",
      variant: "centered",
      props: {
        badge: "Welcome",
        headline: name,
        subheadline: "Order online for pickup or delivery.",
        primaryCta: "Order now",
      },
    },
    {
      id: bid(),
      type: "cta",
      variant: "simple",
      props: {
        headline: "Hungry?",
        subheadline: "Browse the menu and checkout in minutes.",
        buttonText: "See menu",
      },
    },
    {
      id: bid(),
      type: "footer",
      variant: "minimal",
      props: { copyright: `${new Date().getFullYear()} ${name}`, links: ["Menu", "Contact"] },
    },
  ]);
}

function restaurantData(shopName: string): CmsOpenPageData {
  return openPageScaffold(shopName, [
    {
      id: bid(),
      type: "hero",
      variant: "centered",
      props: {
        badge: "Restaurant",
        headline: shopName,
        subheadline: "Fresh dishes, crafted with care. Order online for pickup or delivery.",
        primaryCta: "Order now",
        secondaryCta: "Reservations",
      },
    },
    {
      id: bid(),
      type: "features",
      variant: "grid",
      props: {
        title: "Why guests come back",
        items: [
          { icon: "Utensils", title: "Kitchen fresh", description: "Same menu as our POS." },
          { icon: "Clock", title: "Order ahead", description: "Pickup or delivery when you want." },
          { icon: "Heart", title: "Local favourite", description: "Crafted with care." },
        ],
      },
    },
    {
      id: bid(),
      type: "cta",
      variant: "simple",
      props: {
        headline: "Hungry?",
        subheadline: "Order online in minutes.",
        buttonText: "Order online",
      },
    },
    {
      id: bid(),
      type: "footer",
      variant: "simple",
      props: { logo: shopName, copyright: `${new Date().getFullYear()} ${shopName}`, links: ["Menu", "Reservations"] },
    },
  ]);
}

function foodTruckData(shopName: string): CmsOpenPageData {
  return openPageScaffold(shopName, [
    {
      id: bid(),
      type: "hero",
      variant: "gradient",
      props: {
        badge: "Food truck",
        headline: shopName,
        subheadline: "Street food. Real flavor. Find us or order ahead.",
        primaryCta: "See the menu",
      },
    },
    {
      id: bid(),
      type: "cta",
      variant: "split",
      props: {
        headline: "Order ahead",
        subheadline: "Skip the queue — we will have it ready.",
        buttonText: "Start order",
      },
    },
    {
      id: bid(),
      type: "footer",
      variant: "minimal",
      props: { copyright: `${new Date().getFullYear()} ${shopName}`, links: ["Menu"] },
    },
  ]);
}

export type CmsTemplateKey = "blank" | "restaurant" | "food_truck";

export const CMS_TEMPLATES: Array<{
  key: CmsTemplateKey;
  name: string;
  description: string;
  data: (shopName: string) => CmsOpenPageData;
}> = [
  {
    key: "blank",
    name: "Blank",
    description: "Empty OpenPage canvas — design in the builder",
    data: (name) => emptyData(name),
  },
  {
    key: "restaurant",
    name: "Restaurant",
    description: "Hero, features, order CTA (OpenPage)",
    data: restaurantData,
  },
  {
    key: "food_truck",
    name: "Food truck",
    description: "Bold hero and CTA (OpenPage)",
    data: foodTruckData,
  },
];

/** Accept OpenPage payloads; migrate legacy Puck/Chai into a starter OpenPage page. */
export function normalizeCmsBlocks(raw: unknown, fallbackTitle = ""): CmsOpenPageData {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (
      o.engine === "openpage" &&
      o.config &&
      typeof o.config === "object" &&
      Array.isArray((o.config as OpenPageSiteConfig).blocks) &&
      typeof o.html === "string"
    ) {
      const next: CmsOpenPageData = {
        engine: "openpage",
        config: o.config as OpenPageSiteConfig,
        html: o.html as string,
      };
      if (o.defaultLocale === "en" || o.defaultLocale === "fr" || o.defaultLocale === "de") {
        next.defaultLocale = o.defaultLocale;
      }
      if (o.locales && typeof o.locales === "object") {
        next.locales = o.locales as CmsOpenPageData["locales"];
      }
      return next;
    }
    // Legacy Puck `{ content, root }` → OpenPage starter (rebuild in editor)
    if (Array.isArray((o as { content?: unknown }).content)) {
      const title =
        String((o as { root?: { props?: { title?: string } } }).root?.props?.title || fallbackTitle) ||
        "Homepage";
      return emptyData(title);
    }
  }
  return emptyData(fallbackTitle);
}

/** @deprecated alias */
export const normalizePuckData = normalizeCmsBlocks;

export class CmsService {
  static listTemplates() {
    return CMS_TEMPLATES.map(({ key, name, description }) => ({ key, name, description }));
  }

  static async listPages(merchantId: string) {
    const db = getDb();
    return db.query.cmsPages.findMany({
      where: eq(schema.cmsPages.merchantId, merchantId),
      orderBy: [desc(schema.cmsPages.isHomepage), asc(schema.cmsPages.title)],
    });
  }

  static async getPage(merchantId: string, pageId: string) {
    const db = getDb();
    const page = await db.query.cmsPages.findFirst({
      where: and(eq(schema.cmsPages.id, pageId), eq(schema.cmsPages.merchantId, merchantId)),
    });
    if (!page) throw new Error("Page not found");
    return {
      ...page,
      blocks: normalizeCmsBlocks(page.blocks, page.title),
    };
  }

  static async createPage(
    merchantId: string,
    input: {
      title: string;
      slug?: string;
      isHomepage?: boolean;
      templateKey?: CmsTemplateKey;
      blocks?: CmsOpenPageData | unknown;
      theme?: CmsTheme | null;
      seoTitle?: string;
      seoDescription?: string;
      status?: "draft" | "published";
    }
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const template = CMS_TEMPLATES.find((t) => t.key === (input.templateKey || "blank"));
    const title = (input.title || "Homepage").trim().slice(0, 200);
    let slug = slugify(input.slug || (input.isHomepage ? "home" : title));

    const existing = await db.query.cmsPages.findFirst({
      where: and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.slug, slug)),
    });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const isHomepage = !!input.isHomepage;
    if (isHomepage) {
      await db
        .update(schema.cmsPages)
        .set({ isHomepage: false, updatedAt: new Date() })
        .where(and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.isHomepage, true)));
    }

    const status = input.status === "published" ? "published" : "draft";
    const blocks =
      input.blocks !== undefined
        ? normalizeCmsBlocks(input.blocks, title)
        : template
          ? template.data(merchant.name)
          : emptyData(title);

    const [page] = await db
      .insert(schema.cmsPages)
      .values({
        merchantId,
        title,
        slug,
        isHomepage,
        status,
        templateKey: template?.key || input.templateKey || null,
        blocks,
        theme: input.theme || null,
        seoTitle: input.seoTitle?.slice(0, 200) || null,
        seoDescription: input.seoDescription || null,
        publishedAt: status === "published" ? new Date() : null,
      })
      .returning();

    if (isHomepage && status === "published") {
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: true, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }

    return { ...page, blocks: normalizeCmsBlocks(page.blocks, page.title) };
  }

  static async updatePage(
    merchantId: string,
    pageId: string,
    input: {
      title?: string;
      slug?: string;
      isHomepage?: boolean;
      blocks?: CmsOpenPageData | unknown;
      theme?: CmsTheme | null;
      seoTitle?: string | null;
      seoDescription?: string | null;
      status?: "draft" | "published";
      templateKey?: string | null;
    }
  ) {
    const db = getDb();
    const current = await this.getPage(merchantId, pageId);
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.title !== undefined) patch.title = input.title.trim().slice(0, 200);
    if (input.slug !== undefined) {
      const slug = slugify(input.slug);
      const clash = await db.query.cmsPages.findFirst({
        where: and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.slug, slug)),
      });
      if (clash && clash.id !== pageId) throw new Error("Slug already in use");
      patch.slug = slug;
    }
    if (input.blocks !== undefined) {
      patch.blocks = normalizeCmsBlocks(input.blocks, String(patch.title || current.title));
    }
    if (input.theme !== undefined) patch.theme = input.theme;
    if (input.seoTitle !== undefined) patch.seoTitle = input.seoTitle ? input.seoTitle.slice(0, 200) : null;
    if (input.seoDescription !== undefined) patch.seoDescription = input.seoDescription;
    if (input.templateKey !== undefined) patch.templateKey = input.templateKey;

    if (input.isHomepage === true) {
      await db
        .update(schema.cmsPages)
        .set({ isHomepage: false, updatedAt: new Date() })
        .where(and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.isHomepage, true)));
      patch.isHomepage = true;
    } else if (input.isHomepage === false) {
      patch.isHomepage = false;
    }

    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "published") {
        patch.publishedAt = current.publishedAt || new Date();
      }
    }

    const [page] = await db
      .update(schema.cmsPages)
      .set(patch)
      .where(and(eq(schema.cmsPages.id, pageId), eq(schema.cmsPages.merchantId, merchantId)))
      .returning();

    if (page.isHomepage) {
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: page.status === "published", updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }

    return { ...page, blocks: normalizeCmsBlocks(page.blocks, page.title) };
  }

  static async deletePage(merchantId: string, pageId: string) {
    const db = getDb();
    const page = await this.getPage(merchantId, pageId);
    await db
      .delete(schema.cmsPages)
      .where(and(eq(schema.cmsPages.id, pageId), eq(schema.cmsPages.merchantId, merchantId)));

    if (page.isHomepage) {
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: false, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }
    return { ok: true };
  }

  static async getPublishedHomepage(merchantId: string) {
    const db = getDb();
    const page = await db.query.cmsPages.findFirst({
      where: and(
        eq(schema.cmsPages.merchantId, merchantId),
        eq(schema.cmsPages.isHomepage, true),
        eq(schema.cmsPages.status, "published")
      ),
    });
    if (!page) return null;
    return { ...page, blocks: normalizeCmsBlocks(page.blocks, page.title) };
  }

  static async getPublishedBySlug(merchantId: string, slug: string) {
    const db = getDb();
    const page = await db.query.cmsPages.findFirst({
      where: and(
        eq(schema.cmsPages.merchantId, merchantId),
        eq(schema.cmsPages.slug, slugify(slug)),
        eq(schema.cmsPages.status, "published")
      ),
    });
    if (!page) return null;
    return { ...page, blocks: normalizeCmsBlocks(page.blocks, page.title) };
  }

  static async updateSiteSettings(
    merchantId: string,
    input: { customDomain?: string | null; cmsHomepageEnabled?: boolean }
  ) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.customDomain !== undefined) {
      patch.customDomain = input.customDomain ? String(input.customDomain).trim().toLowerCase() : null;
    }
    if (input.cmsHomepageEnabled !== undefined) {
      patch.cmsHomepageEnabled = !!input.cmsHomepageEnabled;
    }
    const [merchant] = await db
      .update(schema.merchants)
      .set(patch)
      .where(eq(schema.merchants.id, merchantId))
      .returning();
    return {
      customDomain: merchant.customDomain,
      cmsHomepageEnabled: merchant.cmsHomepageEnabled,
      shopEnabled: merchant.shopEnabled,
      slug: merchant.slug,
      subdomain: merchant.subdomain,
      name: merchant.name,
      shopCustomDomainUrl: merchant.customDomain ? `https://${merchant.customDomain}` : null,
    };
  }

  static async getSiteSettings(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");
    return {
      customDomain: merchant.customDomain,
      cmsHomepageEnabled: merchant.cmsHomepageEnabled,
      shopEnabled: merchant.shopEnabled,
      slug: merchant.slug,
      subdomain: merchant.subdomain,
      name: merchant.name,
      shopCustomDomainUrl: merchant.customDomain ? `https://${merchant.customDomain}` : null,
    };
  }
}
