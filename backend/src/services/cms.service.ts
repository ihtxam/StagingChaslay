import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema, type CmsTheme } from "@/db";
import { normalizeCustomDomain } from "@/lib/domain";
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Self-contained starter HTML — no Tailwind Play CDN dependency. */
function selfContainedHtml(
  title: string,
  opts: {
    badge: string;
    headline: string;
    subheadline: string;
    features?: Array<{ title: string; description: string }>;
    ctaHeadline: string;
    ctaSub: string;
  }
): string {
  const year = new Date().getFullYear();
  const safe = escapeHtml(title);
  const features = (opts.features || [])
    .map(
      (f) =>
        `<article style="background:#26201c;border:1px solid #352e28;border-radius:14px;padding:1.1rem 1.2rem"><h3 style="margin:0 0 .35rem;font-size:1rem">${escapeHtml(f.title)}</h3><p style="margin:0;color:#a89a88;font-size:.9rem">${escapeHtml(f.description)}</p></article>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safe}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
html,body{height:100%;margin:0}body{background:radial-gradient(1200px 480px at 50% -10%,rgba(232,168,56,.16),transparent 60%),#171210;color:#faf6f0;font-family:Outfit,system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5}
a{color:inherit;text-decoration:none}.wrap{max-width:72rem;margin:0 auto;padding:0 1.25rem}
header{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 0;gap:1rem}
.logo{font-weight:700;letter-spacing:-.02em}.btn{display:inline-flex;align-items:center;justify-content:center;padding:.7rem 1.15rem;border-radius:.55rem;background:#e8a838;color:#171210;font-weight:700;font-size:.9rem}
.btn-ghost{background:transparent;color:#faf6f0;border:1px solid #352e28}.hero{text-align:center;padding:4.5rem 0 3.5rem}
.badge{display:inline-block;margin-bottom:1rem;padding:.3rem .75rem;border-radius:999px;border:1px solid rgba(232,168,56,.35);background:rgba(232,168,56,.12);color:#e8a838;font-size:.72rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
h1{margin:0 auto .85rem;max-width:18ch;font-size:clamp(2.2rem,5vw,3.4rem);line-height:1.05;letter-spacing:-.03em}
.lead{margin:0 auto 1.75rem;max-width:36rem;color:#a89a88;font-size:1.05rem}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center}
.features{display:grid;gap:.9rem;grid-template-columns:1fr;padding:1rem 0 2.5rem}
@media(min-width:768px){.features{grid-template-columns:repeat(3,1fr)}}
.cta{margin:1rem 0 2.5rem;padding:2rem 1.25rem;text-align:center;border-radius:1rem;border:1px solid #352e28;background:linear-gradient(180deg,rgba(232,168,56,.1),transparent)}
.cta h2{margin:0 0 .4rem;font-size:1.55rem} .cta p{margin:0 0 1.1rem;color:#a89a88}
footer{border-top:1px solid #352e28;padding:1.25rem 0 2rem;display:flex;flex-wrap:wrap;gap:.75rem;justify-content:space-between;color:#a89a88;font-size:.8rem}
</style></head><body><div class="wrap">
<header><div class="logo">${safe}</div><a class="btn" href="/menu">Order now</a></header>
<section class="hero"><div class="badge">${escapeHtml(opts.badge)}</div><h1>${escapeHtml(opts.headline)}</h1>
<p class="lead">${escapeHtml(opts.subheadline)}</p>
<div class="actions"><a class="btn" href="/menu">See the menu</a><a class="btn btn-ghost" href="/menu">Order online</a></div></section>
${features ? `<section class="features">${features}</section>` : ""}
<section class="cta"><h2>${escapeHtml(opts.ctaHeadline)}</h2><p>${escapeHtml(opts.ctaSub)}</p><a class="btn" href="/menu">Start your order</a></section>
<footer><span>© ${year} ${safe}</span><div><a href="/menu">Menu</a> · <a href="/reservations">Reservations</a></div></footer>
</div></body></html>`;
}

function openPageScaffold(
  title: string,
  blocks: OpenPageBlock[],
  html: string,
  theme?: Record<string, unknown>
): CmsOpenPageData {
  const config: OpenPageSiteConfig = {
    name: title,
    blocks,
    pages: [{ id: "page-home", name: "Home", path: "/", blocks }],
    ...(theme ? { theme } : null),
  };
  const data: CmsOpenPageData = {
    engine: "openpage",
    config,
    html,
    defaultLocale: "en",
    locales: { en: { config, html } },
  };
  return data;
}

const AMBER_THEME = {
  presetId: "amber",
  bg0: "#171210",
  accent: "#e8a838",
  fontSans: "Outfit",
  fontDisplay: "Outfit",
};

function emptyData(title = ""): CmsOpenPageData {
  const name = title || "Homepage";
  return openPageScaffold(
    name,
    [
      {
        id: bid(),
        type: "hero",
        variant: "centered",
        props: {
          badge: "Welcome",
          headline: name,
          subheadline: "Order online for pickup or delivery.",
          primaryCta: "Order now",
          primaryCtaUrl: "/menu",
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
          buttonUrl: "/menu",
        },
      },
      {
        id: bid(),
        type: "footer",
        variant: "minimal",
        props: { copyright: `${new Date().getFullYear()} ${name}`, links: ["Menu", "Contact"] },
      },
    ],
    selfContainedHtml(name, {
      badge: "Welcome",
      headline: name,
      subheadline: "Order online for pickup or delivery.",
      ctaHeadline: "Hungry?",
      ctaSub: "Browse the menu and checkout in minutes.",
    })
  );
}

function restaurantData(shopName: string): CmsOpenPageData {
  return openPageScaffold(
    shopName,
    [
      {
        id: bid(),
        type: "navbar",
        variant: "centered",
        props: {
          logo: shopName,
          links: ["Menu", "About", "Reservations"],
          ctaText: "Book a table",
          ctaUrl: "/reservations",
        },
      },
      {
        id: bid(),
        type: "hero",
        variant: "centered",
        props: {
          badge: "Restaurant",
          headline: `Welcome to ${shopName}`,
          subheadline: "Fresh dishes, crafted with care. Order online for pickup or delivery.",
          primaryCta: "Order now",
          primaryCtaUrl: "/menu",
          secondaryCta: "Reservations",
          secondaryCtaUrl: "/reservations",
        },
      },
      {
        id: bid(),
        type: "features",
        variant: "grid",
        props: {
          title: "Why guests come back",
          items: [
            { icon: "Utensils", title: "Kitchen fresh", description: "Same menu as our POS — cooked to order." },
            { icon: "Clock", title: "Order ahead", description: "Pickup or delivery when you want it." },
            { icon: "Heart", title: "Local favourite", description: "Crafted with care for the neighborhood." },
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
          buttonUrl: "/menu",
        },
      },
      {
        id: bid(),
        type: "footer",
        variant: "simple",
        props: { logo: shopName, copyright: `${new Date().getFullYear()} ${shopName}`, links: ["Menu", "Reservations"] },
      },
    ],
    selfContainedHtml(shopName, {
      badge: "Restaurant",
      headline: `Welcome to ${shopName}`,
      subheadline: "Fresh dishes, crafted with care. Order online for pickup or delivery.",
      features: [
        { title: "Kitchen fresh", description: "Same menu as our POS — cooked to order." },
        { title: "Order ahead", description: "Pickup or delivery when you want it." },
        { title: "Local favourite", description: "Crafted with care for the neighborhood." },
      ],
      ctaHeadline: "Hungry?",
      ctaSub: "Order online in minutes.",
    }),
    AMBER_THEME
  );
}

function foodTruckData(shopName: string): CmsOpenPageData {
  return openPageScaffold(
    shopName,
    [
      {
        id: bid(),
        type: "navbar",
        variant: "default",
        props: {
          logo: shopName,
          links: ["Menu", "About", "Find us"],
          ctaText: "Order now",
          ctaUrl: "/menu",
        },
      },
      {
        id: bid(),
        type: "hero",
        variant: "gradient",
        props: {
          badge: "Food truck",
          headline: shopName,
          subheadline: "Street food with real flavor. Order ahead for pickup — or find us on the road.",
          primaryCta: "See the menu",
          primaryCtaUrl: "/menu",
          secondaryCta: "Order online",
          secondaryCtaUrl: "/menu",
        },
      },
      {
        id: bid(),
        type: "features",
        variant: "list",
        props: {
          label: "Why us",
          title: "Made for the street",
          subtitle: "Same kitchen as our truck — order ahead and skip the queue.",
          items: [
            { icon: "Flame", title: "Cooked fresh", description: "Hot off the grill, never sitting under a lamp." },
            { icon: "MapPin", title: "Find the truck", description: "Order ahead so it’s ready when you arrive." },
            { icon: "Zap", title: "Order in minutes", description: "Pickup or delivery — checkout on your phone." },
          ],
        },
      },
      {
        id: bid(),
        type: "stats",
        variant: "bar",
        props: {
          items: [
            { value: "Daily", label: "Fresh prep" },
            { value: "Local", label: "Ingredients" },
            { value: "Fast", label: "Pickup" },
            { value: "5★", label: "Regulars" },
          ],
        },
      },
      {
        id: bid(),
        type: "testimonials",
        variant: "cards",
        props: {
          title: "From the line",
          items: [
            {
              name: "Jordan",
              role: "Regular",
              quote: "Best stop on my lunch route. Ordering ahead is a game changer.",
              rating: 5,
            },
            {
              name: "Samira",
              role: "Office crew",
              quote: "We order for the whole team — always hot, always on time.",
              rating: 5,
            },
          ],
        },
      },
      {
        id: bid(),
        type: "cta",
        variant: "simple",
        props: {
          headline: "Hungry now?",
          subheadline: "Browse the menu and we’ll have it ready.",
          buttonText: "Start your order",
          buttonUrl: "/menu",
        },
      },
      {
        id: bid(),
        type: "footer",
        variant: "simple",
        props: {
          logo: shopName,
          copyright: `${new Date().getFullYear()} ${shopName}. All rights reserved.`,
          links: ["Menu", "Reservations"],
        },
      },
    ],
    selfContainedHtml(shopName, {
      badge: "Food truck",
      headline: shopName,
      subheadline: "Street food with real flavor. Order ahead for pickup — or find us on the road.",
      features: [
        { title: "Cooked fresh", description: "Hot off the grill, never sitting under a lamp." },
        { title: "Find the truck", description: "Order ahead so it’s ready when you arrive." },
        { title: "Order in minutes", description: "Pickup or delivery — checkout on your phone." },
      ],
      ctaHeadline: "Hungry now?",
      ctaSub: "Browse the menu and we’ll have it ready.",
    }),
    AMBER_THEME
  );
}

const CAFE_LIGHT_THEME = {
  presetId: "clean",
  bg0: "#ffffff",
  bg1: "#fafafa",
  bg2: "#f5f5f4",
  bg3: "#e7e5e4",
  bg4: "#d6d3d1",
  bg5: "#a8a29e",
  text0: "#171717",
  text1: "#404040",
  text2: "#737373",
  text3: "#a3a3a3",
  accent: "#171717",
  accentDim: "#404040",
  borderDefault: "#e5e5e5",
  borderSubtle: "#f0f0f0",
  borderHover: "#d4d4d4",
  fontSans: "DM Sans",
  fontDisplay: "DM Sans",
  fontMono: "JetBrains Mono",
  radius: 8,
  radiusLg: 16,
};

function cafeLightHtml(
  title: string,
  opts: { badge: string; headline: string; subheadline: string }
): string {
  const year = new Date().getFullYear();
  const safe = escapeHtml(title);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safe}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
html,body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:#fff;color:#171717;-webkit-font-smoothing:antialiased}
.wrap{max-width:72rem;margin:0 auto;padding:0 1.25rem}
header{display:flex;align-items:center;justify-content:space-between;padding:1rem 0;gap:1rem;border-bottom:1px solid #eee}
.logo{font-weight:700}.nav{display:none;gap:1.5rem;font-size:.85rem;color:#525252}@media(min-width:900px){.nav{display:flex}}
.btn{display:inline-flex;align-items:center;padding:.65rem 1.25rem;border-radius:999px;background:#171717;color:#fff;font-weight:600;font-size:.85rem;text-decoration:none}
.hero{position:relative;min-height:420px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;background:linear-gradient(135deg,#78716c,#44403c);margin:0 -1.25rem;padding:3rem 1.25rem}
.hero::before{content:"";position:absolute;inset:0;background:rgba(0,0,0,.4)}
.hero-inner{position:relative;z-index:1;max-width:40rem}
.hero h1{font-size:clamp(1.75rem,4vw,2.75rem);line-height:1.1;margin:0 0 .75rem;font-weight:700}
.hero p{opacity:.92;margin:0 0 1.25rem;font-size:1.05rem}
.featured{padding:2.5rem 0}
.featured-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
.featured-head h2{margin:0;font-size:1.35rem}
.featured-row{display:flex;gap:1rem;overflow-x:auto;padding-bottom:.5rem}
.card{flex:0 0 11rem;height:14rem;border-radius:1rem;background:#f5f5f4;border:1px solid #e5e5e5}
footer{border-top:1px solid #eee;padding:1.25rem 0 2rem;color:#737373;font-size:.8rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.75rem}
a{color:inherit;text-decoration:none}
</style></head><body><div class="wrap">
<header><div class="logo">${safe}</div><nav class="nav"><a href="/menu">Menu</a><a href="/menu">Catering</a><a href="/menu">Our Story</a></nav><a class="btn" href="/menu">Order online →</a></header>
<section class="hero"><div class="hero-inner"><p style="font-size:.9rem;margin-bottom:.75rem">${escapeHtml(opts.badge)}</p><h1>${escapeHtml(opts.headline)}</h1><p>${escapeHtml(opts.subheadline)}</p><a class="btn" href="/menu">Order online →</a></div></section>
<section class="featured"><div class="featured-head"><h2>Featured</h2><a href="/menu">View menu →</a></div><div class="featured-row"><div class="card"></div><div class="card"></div><div class="card"></div><div class="card"></div><div class="card"></div></div></section>
<footer><span>© ${year} ${safe}</span><a href="/menu">Menu</a></footer>
</div></body></html>`;
}

function cafeClassicData(shopName: string): CmsOpenPageData {
  return openPageScaffold(
    shopName,
    [
      {
        id: bid(),
        type: "navbar",
        variant: "pill",
        props: {
          logo: shopName,
          links: ["Menu", "Catering", "Our Story", "Location", "FAQs"],
          ctaText: "Order online →",
          ctaUrl: "/menu",
          signInText: "Sign in",
        },
      },
      {
        id: bid(),
        type: "hero",
        variant: "overlay",
        props: {
          badge: "Best cafe in the neighborhood",
          headline: "Where Every Meal Feels Like Home, Served Fresh Daily",
          subheadline: "Craft coffee, brunch, and comfort food made from scratch every morning.",
          primaryCta: "Order online →",
          primaryCtaUrl: "/menu",
        },
      },
      {
        id: bid(),
        type: "featured",
        variant: "row",
        props: {
          title: "Featured",
          viewAllText: "View menu →",
          viewAllUrl: "/menu",
          items: [
            { title: "Morning croissant" },
            { title: "Avocado toast" },
            { title: "Seasonal latte" },
            { title: "House sandwich" },
            { title: "Chef special" },
          ],
        },
      },
      {
        id: bid(),
        type: "footer",
        variant: "minimal",
        props: {
          copyright: `${new Date().getFullYear()} ${shopName}`,
          links: ["Menu", "Gift cards", "Contact"],
        },
      },
    ],
    cafeLightHtml(shopName, {
      badge: "Best cafe in the neighborhood",
      headline: "Where Every Meal Feels Like Home, Served Fresh Daily",
      subheadline: "Craft coffee, brunch, and comfort food made from scratch every morning.",
    }),
    CAFE_LIGHT_THEME
  );
}

function bistroLightData(shopName: string): CmsOpenPageData {
  const data = cafeClassicData(shopName);
  const blocks = data.config.blocks.map((b) =>
    b.type === "hero"
      ? {
          ...b,
          props: {
            ...b.props,
            headline: `Welcome to ${shopName}`,
            subheadline: "Neighborhood bistro — order pickup or delivery online.",
          },
        }
      : b
  );
  return {
    ...data,
    config: { ...data.config, blocks, pages: [{ id: "page-home", name: "Home", path: "/", blocks }] },
    html: cafeLightHtml(shopName, {
      badge: "Neighborhood bistro",
      headline: `Welcome to ${shopName}`,
      subheadline: "Order pickup or delivery online.",
    }),
  };
}

export type CmsTemplateKey = "blank" | "restaurant" | "food_truck" | "cafe_classic" | "bistro_light";

export const CMS_TEMPLATES: Array<{
  key: CmsTemplateKey;
  name: string;
  description: string;
  data: (shopName: string) => CmsOpenPageData;
}> = [
  {
    key: "food_truck",
    name: "Food truck",
    description: "Street-food homepage — menu CTAs, no Brand/Pricing fluff",
    data: foodTruckData,
  },
  {
    key: "restaurant",
    name: "Restaurant",
    description: "Hero, features, order + reservations CTAs",
    data: restaurantData,
  },
  {
    key: "cafe_classic",
    name: "Café Classic",
    description: "Light Ashley-style cafe — hero overlay, featured row, pill nav",
    data: cafeClassicData,
  },
  {
    key: "bistro_light",
    name: "Bistro Light",
    description: "Clean white bistro theme with featured highlights",
    data: bistroLightData,
  },
  {
    key: "blank",
    name: "Blank",
    description: "Minimal starter — design freely in the builder",
    data: (name) => emptyData(name),
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

    const template = CMS_TEMPLATES.find((t) => t.key === (input.templateKey || "food_truck"));
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

  /** Theme tokens from published homepage (for shop / menu / reservations styling). */
  static getThemeFromBlocks(blocks: unknown): Record<string, unknown> | null {
    if (!blocks || typeof blocks !== "object") return null;
    const raw = blocks as Record<string, unknown>;
    if (raw.engine === "openpage" && raw.config && typeof raw.config === "object") {
      const theme = (raw.config as Record<string, unknown>).theme;
      if (theme && typeof theme === "object") return theme as Record<string, unknown>;
    }
    return null;
  }

  static async getPublishedTheme(merchantId: string): Promise<Record<string, unknown> | null> {
    const page = await this.getPublishedHomepage(merchantId);
    if (!page) return null;
    return (
      CmsService.getThemeFromBlocks(page.blocks) ||
      (page.theme as Record<string, unknown> | null) ||
      null
    );
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
      patch.customDomain = normalizeCustomDomain(input.customDomain);
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
