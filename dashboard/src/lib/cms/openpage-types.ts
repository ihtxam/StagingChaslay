import { foodTruckStarter } from './openpage-starters';

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

/** Default CMS / shop fallback — food-truck starter (not SaaS Brand/Pricing). */
export function emptyOpenPageBlocks(title = 'Homepage'): OpenPageBlocks {
  return foodTruckStarter(title || 'Homepage');
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
 * Critical styles so OpenPage CDN exports remain readable if Tailwind Play CDN
 * is blocked (egress / offline). Uses theme CSS variables already in the export.
 */
const OPENPAGE_CDN_FALLBACK_CSS = `
html,body{height:100%;margin:0}
body{background:var(--color-bg-0,#171210);color:var(--color-text-0,#faf6f0);font-family:var(--font-sans,system-ui,sans-serif);-webkit-font-smoothing:antialiased}
a{color:inherit}
.bg-bg-0{background-color:var(--color-bg-0)!important}.bg-bg-1{background-color:var(--color-bg-1)!important}
.bg-bg-2{background-color:var(--color-bg-2)!important}.bg-bg-3{background-color:var(--color-bg-3)!important}
.bg-bg-4{background-color:var(--color-bg-4)!important}.bg-green,.bg-green\\/10{background-color:var(--color-green,#e8a838)!important}
.text-text-0{color:var(--color-text-0)!important}.text-text-1{color:var(--color-text-1)!important}
.text-text-2{color:var(--color-text-2)!important}.text-text-3{color:var(--color-text-3)!important}
.text-green{color:var(--color-green,#e8a838)!important}.text-black{color:#111!important}
.border-border-default{border-color:var(--color-border-default)!important}
.border-border-subtle{border-color:var(--color-border-subtle)!important}
.flex{display:flex}.hidden{display:none}.grid{display:grid}.inline-flex{display:inline-flex}
.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}
.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-6{gap:1.5rem}
.px-6{padding-left:1.5rem;padding-right:1.5rem}.px-8{padding-left:2rem;padding-right:2rem}
.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-4{padding-top:1rem;padding-bottom:1rem}
.py-16{padding-top:4rem;padding-bottom:4rem}.py-20{padding-top:5rem;padding-bottom:5rem}
.text-center{text-align:center}.font-semibold{font-weight:600}.font-bold{font-weight:700}
.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-full{border-radius:9999px}
.max-w-3xl{max-width:48rem}.max-w-7xl{max-width:80rem}.max-w-xl{max-width:36rem}.mx-auto{margin-left:auto;margin-right:auto}
.min-w-0{min-width:0}.shrink-0{flex-shrink:0}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.whitespace-nowrap{white-space:nowrap}
.text-4xl{font-size:2.25rem;line-height:1.1}.text-2xl{font-size:1.5rem}.text-sm{font-size:.875rem}
.w-full{width:100%}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}
.overflow-hidden{overflow:hidden}
@media (min-width:768px){
  .md\\:px-10{padding-left:2.5rem;padding-right:2.5rem}
  .md\\:text-5xl{font-size:3rem;line-height:1.1}
  .md\\:py-28{padding-top:7rem;padding-bottom:7rem}
  .md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
  .md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
  .md\\:flex-row{flex-direction:row}
}
@media (min-width:1024px){
  .lg\\:flex{display:flex}.lg\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
  .lg\\:hidden{display:none}
}
`.replace(/\n/g, '');

/**
 * Prepare OpenPage export HTML for the public shop iframe:
 * - rewrite shop routes to the merchant base path
 * - open in-page links in the parent window (not trapped in the iframe)
 * - harden Tailwind Play CDN exports with critical CSS fallback
 */
export function rewriteOpenPageHtml(html: string, basePath: string): string {
  const base = (basePath || '').replace(/\/$/, '');
  let out = html || '';

  if (/<head[\s>]/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1><base target="_parent" />');
  } else {
    out = `<base target="_parent" />${out}`;
  }

  const hardening = `
<link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin />
<link rel="dns-prefetch" href="https://cdn.tailwindcss.com" />
<style id="op-cdn-fallback">${OPENPAGE_CDN_FALLBACK_CSS}</style>
<style id="op-shop-chrome-pad">body{padding-bottom:max(5.5rem,env(safe-area-inset-bottom))}</style>
<script>
(function(){
  // If Tailwind Play CDN never boots, keep semantic theme colors via fallback CSS above.
  function mark(){ try { document.documentElement.setAttribute('data-op-tw','pending'); } catch(e){} }
  function ok(){ try { document.documentElement.setAttribute('data-op-tw','ok'); } catch(e){} }
  mark();
  var n = 0;
  var t = setInterval(function(){
    n++;
    if (typeof window.tailwind !== 'undefined') { ok(); clearInterval(t); }
    else if (n > 40) { clearInterval(t); }
  }, 250);
})();
</script>`;

  if (/<\/head>/i.test(out)) {
    if (!/id="op-cdn-fallback"/.test(out)) {
      out = out.replace(/<\/head>/i, `${hardening}</head>`);
    }
  } else if (!/html\s*,\s*body\s*\{[^}]*height\s*:\s*100%/i.test(out)) {
    out = `${hardening}${out}`;
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
