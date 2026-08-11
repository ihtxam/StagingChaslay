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
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head><body><main style="font-family:system-ui;padding:2rem;text-align:center"><h1>${title}</h1><p>Open the builder and click Save to publish a designed page.</p></main></body></html>`,
  };
}

/** Rewrite relative shop links in exported OpenPage HTML for the public storefront. */
export function rewriteOpenPageHtml(html: string, basePath: string): string {
  const base = (basePath || '').replace(/\/$/, '');
  if (!base) return html;
  return html
    .replace(/href="\/menu"/g, `href="${base}/menu"`)
    .replace(/href='\/menu'/g, `href='${base}/menu'`)
    .replace(/href="\/reservations"/g, `href="${base}/reservations"`)
    .replace(/href='\/reservations'/g, `href='${base}/reservations'`);
}
