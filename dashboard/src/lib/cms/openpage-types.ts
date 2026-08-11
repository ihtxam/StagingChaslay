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

export type OpenPageBlocks = {
  engine: 'openpage';
  config: OpenPageSiteConfig;
  html: string;
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
  return {
    engine: 'openpage',
    config,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safe}</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fafaf9;color:#1c1917}main{max-width:40rem;margin:0 auto;padding:3rem 1.25rem;text-align:center}a{display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;border-radius:.5rem;background:#0f766e;color:#fff;text-decoration:none;font-weight:700}</style>
</head><body><main><h1>${safe}</h1><p>Open the website builder, design your page, click Save in the toolbar, then Publish.</p><p><a href="/menu">Order online</a></p></main></body></html>`,
  };
}

/**
 * Prepare OpenPage export HTML for the public shop iframe:
 * - rewrite shop routes to the merchant base path
 * - open in-page links in the parent window (not trapped in the iframe)
 * - map common CTA labels without hrefs to /menu
 */
export function rewriteOpenPageHtml(html: string, basePath: string): string {
  const base = (basePath || '').replace(/\/$/, '');
  let out = html || '';

  // Prefer parent navigation so Order / Menu links leave the preview iframe.
  if (/<head[\s>]/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1><base target="_parent" />');
  } else {
    out = `<base target="_parent" />${out}`;
  }

  const menu = base ? `${base}/menu` : '/menu';
  const reservations = base ? `${base}/reservations` : '/reservations';

  out = out
    .replace(/href="\/menu"/g, `href="${menu}"`)
    .replace(/href='\/menu'/g, `href='${menu}'`)
    .replace(/href="\/reservations"/g, `href="${reservations}"`)
    .replace(/href='\/reservations'/g, `href='${reservations}'`)
    .replace(/href="\/"/g, `href="${base || '/'}"`)
    .replace(/href='\/'/g, `href='${base || '/'}'`);

  // Buttons exported as <span> (no URL) stay non-clickable — leave as-is.
  // When export used href="#", send guests to the menu.
  out = out
    .replace(/href="#"/g, `href="${menu}"`)
    .replace(/href='#'/g, `href='${menu}'`);

  return out;
}

export function isFullHtmlDocument(html: string): boolean {
  return /<!DOCTYPE html|<html[\s>]/i.test(html || '');
}
