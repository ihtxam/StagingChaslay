/** OpenPage SiteConfig stored in CMS / newsletter design JSON. */
export type OpenPageSiteConfig = {
  name: string;
  blocks: Array<{
    id: string;
    type: string;
    variant: string;
    props: Record<string, unknown>;
  }>;
  pages?: Array<{
    id: string;
    name: string;
    path: string;
    blocks: OpenPageSiteConfig['blocks'];
  }>;
  theme?: Record<string, unknown>;
};

export type CmsLocale = 'en' | 'fr' | 'de';

export type OpenPageLocaleBundle = {
  config: OpenPageSiteConfig;
  html: string;
};

/**
 * OpenPage page payload.
 * - `config` / `html` = default (or currently edited) locale
 * - `locales` = optional EN/FR/DE variants for multi-language homepages
 */
export type OpenPageBlocks = {
  engine: 'openpage';
  config: OpenPageSiteConfig;
  html: string;
  defaultLocale?: CmsLocale;
  locales?: Partial<Record<CmsLocale, OpenPageLocaleBundle>>;
};

export function isOpenPageBlocks(raw: unknown): raw is OpenPageBlocks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return (
    o.engine === 'openpage' &&
    typeof o.html === 'string' &&
    !!o.config &&
    typeof o.config === 'object' &&
    Array.isArray((o.config as OpenPageSiteConfig).blocks)
  );
}

export function emptyOpenPageBlocks(title = 'Homepage'): OpenPageBlocks {
  const safe = String(title || 'Homepage')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const blocks = [
    {
      id: 'block-hero',
      type: 'hero',
      variant: 'centered',
      props: {
        badge: 'Welcome',
        headline: title,
        subheadline: 'Order online for pickup or delivery.',
        primaryCta: 'Order now',
      },
    },
    {
      id: 'block-cta',
      type: 'cta',
      variant: 'simple',
      props: {
        headline: 'Hungry?',
        subheadline: 'Browse the menu and checkout in minutes.',
        buttonText: 'See menu',
      },
    },
    {
      id: 'block-footer',
      type: 'footer',
      variant: 'minimal',
      props: {
        copyright: `${new Date().getFullYear()} ${title}`,
        links: ['Menu', 'Contact'],
      },
    },
  ];
  const config: OpenPageSiteConfig = {
    name: title,
    blocks,
    pages: [{ id: 'page-home', name: 'Home', path: '/', blocks }],
  };
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safe}</title>
<style>html,body{margin:0;height:100%;font-family:system-ui,sans-serif;background:#0a0a0a;color:#fafafa}main{max-width:40rem;margin:0 auto;padding:4rem 1.25rem;text-align:center}a{display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;border-radius:.5rem;background:#22c55e;color:#052e16;text-decoration:none;font-weight:700}</style>
</head><body><main><h1>${safe}</h1><p>Open the website builder, design your page, click Save in the toolbar, then Publish.</p><p><a href="/menu">Order online</a></p></main></body></html>`;
  return {
    engine: 'openpage',
    config,
    html,
    defaultLocale: 'en',
    locales: {
      en: { config, html },
    },
  };
}

/** Pick HTML for the visitor language; fall back to default / primary html. */
export function resolveOpenPageHtml(
  blocks: OpenPageBlocks,
  locale: string | null | undefined
): string {
  const loc = (locale || '').toLowerCase().slice(0, 2) as CmsLocale;
  if (loc === 'en' || loc === 'fr' || loc === 'de') {
    const bundle = blocks.locales?.[loc];
    if (bundle?.html) return bundle.html;
  }
  const def = blocks.defaultLocale;
  if (def && blocks.locales?.[def]?.html) return blocks.locales[def]!.html;
  return blocks.html;
}

export function resolveOpenPageConfig(
  blocks: OpenPageBlocks,
  locale: CmsLocale
): OpenPageSiteConfig {
  return blocks.locales?.[locale]?.config || blocks.config;
}

/** Merge a saved locale into the page payload. */
export function withLocaleBundle(
  blocks: OpenPageBlocks,
  locale: CmsLocale,
  bundle: OpenPageLocaleBundle
): OpenPageBlocks {
  const locales = { ...(blocks.locales || {}), [locale]: bundle };
  const isDefault = !blocks.defaultLocale || blocks.defaultLocale === locale;
  return {
    ...blocks,
    locales,
    defaultLocale: blocks.defaultLocale || locale,
    ...(isDefault ? { config: bundle.config, html: bundle.html } : null),
  };
}

/**
 * Prepare OpenPage export HTML for the public shop iframe:
 * - rewrite shop routes to the merchant base path
 * - open in-page links in the parent window (not trapped in the iframe)
 */
export function rewriteOpenPageHtml(html: string, basePath: string): string {
  const base = (basePath || '').replace(/\/$/, '');
  let out = html || '';

  if (/<head[\s>]/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1><base target="_parent" />');
  } else {
    out = `<base target="_parent" />${out}`;
  }

  // Full-bleed page: prevent nested “letterbox” feel from default body margins
  if (!/html\s*,\s*body\s*\{[^}]*height\s*:\s*100%/i.test(out)) {
    out = out.replace(
      /<\/head>/i,
      `<style>html,body{height:100%;margin:0;}</style></head>`
    );
  }

  const menu = base ? `${base}/menu` : '/menu';
  const reservations = base ? `${base}/reservations` : '/reservations';

  out = out
    .replace(/href="\/menu"/g, `href="${menu}"`)
    .replace(/href='\/menu'/g, `href='${menu}'`)
    .replace(/href="\/reservations"/g, `href="${reservations}"`)
    .replace(/href='\/reservations'/g, `href='${reservations}'`)
    .replace(/href="\/"/g, `href="${base || '/'}"`)
    .replace(/href='\/'/g, `href='${base || '/'}'`)
    .replace(/href="#"/g, `href="${menu}"`)
    .replace(/href='#'/g, `href='${menu}'`);

  return out;
}

export function isFullHtmlDocument(html: string): boolean {
  return /<!DOCTYPE html|<html[\s>]/i.test(html || '');
}
