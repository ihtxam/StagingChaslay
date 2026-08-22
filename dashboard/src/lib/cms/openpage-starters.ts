/**
 * Food-truck-first OpenPage starters for CMS create + shop fallback.
 * Self-contained HTML (inline CSS, no Tailwind CDN) so homepages look right
 * before the merchant opens the builder and even if CDN egress fails.
 */
import type { OpenPageBlocks, OpenPageSiteConfig } from './openpage-types';

export type CmsStarterKey = 'blank' | 'restaurant' | 'food_truck' | 'cafe_classic' | 'bistro_light';

type Block = OpenPageSiteConfig['blocks'][number];

const YEAR = () => new Date().getFullYear();

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function withPages(name: string, blocks: Block[], theme?: Record<string, unknown>): OpenPageSiteConfig {
  return {
    name,
    blocks,
    pages: [{ id: 'page-home', name: 'Home', path: '/', blocks }],
    ...(theme ? { theme } : null),
  };
}

/** White background + blue accent — default for new CMS pages. */
export const CLASSIC_BLUE_THEME = {
  bg0: '#ffffff',
  bg1: '#f8fafc',
  bg2: '#f1f5f9',
  bg3: '#e2e8f0',
  bg4: '#cbd5e1',
  bg5: '#94a3b8',
  text0: '#0f172a',
  text1: '#334155',
  text2: '#64748b',
  text3: '#94a3b8',
  accent: '#2563eb',
  accentDim: '#1d4ed8',
  borderDefault: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  borderHover: '#cbd5e1',
  fontSans: 'DM Sans',
  fontDisplay: 'DM Sans',
  fontMono: 'JetBrains Mono',
  radius: 8,
  radiusLg: 12,
  presetId: 'classic-blue',
};

/** Amber food-truck theme (legacy). */
const AMBER_THEME = {
  bg0: '#171210',
  bg1: '#1e1816',
  bg2: '#26201c',
  bg3: '#302925',
  bg4: '#3d3530',
  bg5: '#504640',
  text0: '#faf6f0',
  text1: '#d4c8b8',
  text2: '#a89a88',
  text3: '#7d7062',
  accent: '#e8a838',
  accentDim: '#cc8f20',
  borderDefault: '#352e28',
  borderSubtle: '#28211b',
  borderHover: '#443c35',
  fontSans: 'Outfit',
  fontDisplay: 'Outfit',
  fontMono: 'JetBrains Mono',
  radius: 6,
  radiusLg: 10,
};

function foodTruckBlocks(name: string): Block[] {
  return [
    {
      id: 'block-navbar',
      type: 'navbar',
      variant: 'default',
      props: {
        logo: name,
        links: ['Menu', 'About', 'Find us'],
        ctaText: 'Order now',
        ctaUrl: '/menu',
      },
    },
    {
      id: 'block-hero',
      type: 'hero',
      variant: 'gradient',
      props: {
        badge: 'Food truck',
        headline: name,
        subheadline: 'Street food with real flavor. Order ahead for pickup — or find us on the road.',
        primaryCta: 'See the menu',
        primaryCtaUrl: '/menu',
        secondaryCta: 'Order online',
        secondaryCtaUrl: '/menu',
      },
    },
    {
      id: 'block-features',
      type: 'features',
      variant: 'list',
      props: {
        label: 'Why us',
        title: 'Made for the street',
        subtitle: 'Same kitchen as our truck — order ahead and skip the queue.',
        items: [
          {
            icon: 'Flame',
            title: 'Cooked fresh',
            description: 'Hot off the grill, never sitting under a lamp.',
          },
          {
            icon: 'MapPin',
            title: 'Find the truck',
            description: 'Check our stops, then order ahead so it’s ready when you arrive.',
          },
          {
            icon: 'Zap',
            title: 'Order in minutes',
            description: 'Pickup or delivery — checkout on your phone.',
          },
        ],
      },
    },
    {
      id: 'block-stats',
      type: 'stats',
      variant: 'bar',
      props: {
        items: [
          { value: 'Daily', label: 'Fresh prep' },
          { value: 'Local', label: 'Ingredients' },
          { value: 'Fast', label: 'Pickup' },
          { value: '5★', label: 'Regulars' },
        ],
      },
    },
    {
      id: 'block-testimonials',
      type: 'testimonials',
      variant: 'cards',
      props: {
        title: 'From the line',
        items: [
          {
            name: 'Jordan',
            role: 'Regular',
            quote: 'Best stop on my lunch route. Ordering ahead is a game changer.',
            rating: 5,
          },
          {
            name: 'Samira',
            role: 'Office crew',
            quote: 'We order for the whole team — always hot, always on time.',
            rating: 5,
          },
        ],
      },
    },
    {
      id: 'block-cta',
      type: 'cta',
      variant: 'simple',
      props: {
        headline: 'Hungry now?',
        subheadline: 'Browse the menu and we’ll have it ready.',
        buttonText: 'Start your order',
        buttonUrl: '/menu',
      },
    },
    {
      id: 'block-footer',
      type: 'footer',
      variant: 'simple',
      props: {
        logo: name,
        copyright: `${YEAR()} ${name}. All rights reserved.`,
        links: ['Menu', 'Reservations'],
      },
    },
  ];
}

function restaurantBlocks(name: string): Block[] {
  return [
    {
      id: 'block-navbar',
      type: 'navbar',
      variant: 'centered',
      props: {
        logo: name,
        links: ['Menu', 'About', 'Reservations'],
        ctaText: 'Book a table',
        ctaUrl: '/reservations',
      },
    },
    {
      id: 'block-hero',
      type: 'hero',
      variant: 'centered',
      props: {
        badge: 'Restaurant',
        headline: `Welcome to ${name}`,
        subheadline: 'Fresh dishes, crafted with care. Order online for pickup or delivery.',
        primaryCta: 'Order now',
        primaryCtaUrl: '/menu',
        secondaryCta: 'Reservations',
        secondaryCtaUrl: '/reservations',
      },
    },
    {
      id: 'block-features',
      type: 'features',
      variant: 'grid',
      props: {
        title: 'Why guests come back',
        items: [
          { icon: 'Utensils', title: 'Kitchen fresh', description: 'Same menu as our POS — cooked to order.' },
          { icon: 'Clock', title: 'Order ahead', description: 'Pickup or delivery when you want it.' },
          { icon: 'Heart', title: 'Local favourite', description: 'Crafted with care for the neighborhood.' },
        ],
      },
    },
    {
      id: 'block-cta',
      type: 'cta',
      variant: 'simple',
      props: {
        headline: 'Hungry?',
        subheadline: 'Order online in minutes.',
        buttonText: 'Order online',
        buttonUrl: '/menu',
      },
    },
    {
      id: 'block-footer',
      type: 'footer',
      variant: 'simple',
      props: {
        logo: name,
        copyright: `${YEAR()} ${name}`,
        links: ['Menu', 'Reservations'],
      },
    },
  ];
}

function blankBlocks(name: string): Block[] {
  return [
    {
      id: 'block-hero',
      type: 'hero',
      variant: 'centered',
      props: {
        badge: 'Welcome',
        headline: name,
        subheadline: 'Order online for pickup or delivery.',
        primaryCta: 'Order now',
        primaryCtaUrl: '/menu',
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
        buttonUrl: '/menu',
      },
    },
    {
      id: 'block-footer',
      type: 'footer',
      variant: 'minimal',
      props: {
        copyright: `${YEAR()} ${name}`,
        links: ['Menu', 'Contact'],
      },
    },
  ];
}

/** Self-contained homepage HTML — works without Tailwind Play CDN. */
export function renderSelfContainedStarterHtml(
  name: string,
  opts: {
    badge: string;
    headline: string;
    subheadline: string;
    features?: Array<{ title: string; description: string }>;
    ctaHeadline: string;
    ctaSub: string;
  },
  theme: Record<string, string | number> = CLASSIC_BLUE_THEME
): string {
  const t = theme;
  const safeName = escapeHtml(name);
  const features = opts.features || [];
  const featureCards = features
    .map(
      (f) => `<article class="card">
  <h3>${escapeHtml(f.title)}</h3>
  <p>${escapeHtml(f.description)}</p>
</article>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: ${t.bg0};
      --bg-card: ${t.bg2};
      --text: ${t.text0};
      --muted: ${t.text2};
      --accent: ${t.accent};
      --accent-dim: ${t.accentDim};
      --border: ${t.borderDefault};
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      background: radial-gradient(1200px 480px at 50% -10%, rgba(232,168,56,0.16), transparent 60%), var(--bg);
      color: var(--text);
      font-family: Outfit, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    a { color: inherit; text-decoration: none; }
    .wrap { max-width: 72rem; margin: 0 auto; padding: 0 1.25rem; }
    header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.1rem 0; gap: 1rem;
    }
    .logo { font-weight: 700; letter-spacing: -0.02em; font-size: 1.05rem; }
    .nav { display: none; gap: 1.25rem; color: var(--muted); font-size: 0.9rem; }
    @media (min-width: 768px) { .nav { display: flex; } }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0.7rem 1.15rem; border-radius: 0.55rem;
      background: var(--accent); color: #171210; font-weight: 700; font-size: 0.9rem;
    }
    .btn:hover { background: var(--accent-dim); }
    .btn-ghost {
      background: transparent; color: var(--text);
      border: 1px solid var(--border);
    }
    .hero { text-align: center; padding: 4.5rem 0 3.5rem; }
    .badge {
      display: inline-block; margin-bottom: 1rem; padding: 0.3rem 0.75rem;
      border-radius: 999px; border: 1px solid rgba(232,168,56,0.35);
      background: rgba(232,168,56,0.12); color: var(--accent);
      font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    }
    h1 {
      margin: 0 auto 0.85rem; max-width: 18ch;
      font-size: clamp(2.2rem, 5vw, 3.4rem); line-height: 1.05; letter-spacing: -0.03em;
    }
    .lead { margin: 0 auto 1.75rem; max-width: 36rem; color: var(--muted); font-size: 1.05rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
    .features {
      display: grid; gap: 0.9rem;
      grid-template-columns: 1fr;
      padding: 1rem 0 2.5rem;
    }
    @media (min-width: 768px) { .features { grid-template-columns: repeat(3, 1fr); } }
    .card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 0.85rem; padding: 1.15rem 1.2rem;
    }
    .card h3 { margin: 0 0 0.35rem; font-size: 1rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.9rem; }
    .cta {
      margin: 1rem 0 2.5rem; padding: 2rem 1.25rem; text-align: center;
      border-radius: 1rem; border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(232,168,56,0.1), transparent);
    }
    .cta h2 { margin: 0 0 0.4rem; font-size: 1.55rem; letter-spacing: -0.02em; }
    .cta p { margin: 0 0 1.1rem; color: var(--muted); }
    footer {
      border-top: 1px solid var(--border);
      padding: 1.25rem 0 2rem; display: flex; flex-wrap: wrap;
      gap: 0.75rem; justify-content: space-between; color: var(--muted); font-size: 0.8rem;
    }
    footer .links { display: flex; gap: 1rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="logo">${safeName}</div>
      <nav class="nav" aria-label="Primary">
        <a href="/menu">Menu</a>
        <a href="/menu">Order</a>
        <a href="/reservations">Reservations</a>
      </nav>
      <a class="btn" href="/menu">Order now</a>
    </header>

    <section class="hero">
      <div class="badge">${escapeHtml(opts.badge)}</div>
      <h1>${escapeHtml(opts.headline)}</h1>
      <p class="lead">${escapeHtml(opts.subheadline)}</p>
      <div class="actions">
        <a class="btn" href="/menu">See the menu</a>
        <a class="btn btn-ghost" href="/menu">Order online</a>
      </div>
    </section>

    ${
      featureCards
        ? `<section class="features" aria-label="Highlights">
${featureCards}
    </section>`
        : ''
    }

    <section class="cta">
      <h2>${escapeHtml(opts.ctaHeadline)}</h2>
      <p>${escapeHtml(opts.ctaSub)}</p>
      <a class="btn" href="/menu">Start your order</a>
    </section>

    <footer>
      <span>© ${YEAR()} ${safeName}</span>
      <div class="links">
        <a href="/menu">Menu</a>
        <a href="/reservations">Reservations</a>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

function bundle(config: OpenPageSiteConfig, html: string): OpenPageBlocks {
  return {
    engine: 'openpage',
    config,
    html,
    defaultLocale: 'en',
    locales: { en: { config, html } },
  };
}

export function foodTruckStarter(title = 'Food truck'): OpenPageBlocks {
  const name = String(title || 'Food truck').trim() || 'Food truck';
  const blocks = foodTruckBlocks(name);
  const config = withPages(name, blocks, CLASSIC_BLUE_THEME);
  const html = renderSelfContainedStarterHtml(name, {
    badge: 'Food truck',
    headline: name,
    subheadline: 'Street food with real flavor. Order ahead for pickup — or find us on the road.',
    features: [
      { title: 'Cooked fresh', description: 'Hot off the grill, never sitting under a lamp.' },
      { title: 'Find the truck', description: 'Order ahead so it’s ready when you arrive.' },
      { title: 'Order in minutes', description: 'Pickup or delivery — checkout on your phone.' },
    ],
    ctaHeadline: 'Hungry now?',
    ctaSub: 'Browse the menu and we’ll have it ready.',
  }, CLASSIC_BLUE_THEME);
  return bundle(config, html);
}

export function restaurantStarter(title = 'Restaurant'): OpenPageBlocks {
  const name = String(title || 'Restaurant').trim() || 'Restaurant';
  const blocks = restaurantBlocks(name);
  const config = withPages(name, blocks, { ...AMBER_THEME, presetId: 'amber' });
  const html = renderSelfContainedStarterHtml(name, {
    badge: 'Restaurant',
    headline: `Welcome to ${name}`,
    subheadline: 'Fresh dishes, crafted with care. Order online for pickup or delivery.',
    features: [
      { title: 'Kitchen fresh', description: 'Same menu as our POS — cooked to order.' },
      { title: 'Order ahead', description: 'Pickup or delivery when you want it.' },
      { title: 'Local favourite', description: 'Crafted with care for the neighborhood.' },
    ],
    ctaHeadline: 'Hungry?',
    ctaSub: 'Order online in minutes.',
  });
  return bundle(config, html);
}

export function blankStarter(title = 'Homepage'): OpenPageBlocks {
  const name = String(title || 'Homepage').trim() || 'Homepage';
  const blocks = blankBlocks(name);
  const config = withPages(name, blocks);
  const html = renderSelfContainedStarterHtml(name, {
    badge: 'Welcome',
    headline: name,
    subheadline: 'Order online for pickup or delivery.',
    ctaHeadline: 'Hungry?',
    ctaSub: 'Browse the menu and checkout in minutes.',
  });
  return bundle(config, html);
}

const CAFE_LIGHT_THEME = {
  bg0: '#ffffff',
  bg1: '#fafafa',
  bg2: '#f5f5f4',
  bg3: '#e7e5e4',
  bg4: '#d6d3d1',
  bg5: '#a8a29e',
  text0: '#171717',
  text1: '#404040',
  text2: '#737373',
  text3: '#a3a3a3',
  accent: '#171717',
  accentDim: '#404040',
  borderDefault: '#e5e5e5',
  borderSubtle: '#f0f0f0',
  borderHover: '#d4d4d4',
  fontSans: 'DM Sans',
  fontDisplay: 'DM Sans',
  fontMono: 'JetBrains Mono',
  radius: 8,
  radiusLg: 16,
  presetId: 'clean',
};

function cafeClassicBlocks(name: string): Block[] {
  return [
    {
      id: 'block-navbar',
      type: 'navbar',
      variant: 'pill',
      props: {
        logo: name,
        links: ['Menu', 'Catering', 'Our Story', 'Location', 'FAQs'],
        ctaText: 'Order online →',
        ctaUrl: '/menu',
        signInText: 'Sign in',
      },
    },
    {
      id: 'block-hero',
      type: 'hero',
      variant: 'overlay',
      props: {
        badge: 'Best cafe in the neighborhood',
        headline: 'Where Every Meal Feels Like Home, Served Fresh Daily',
        subheadline: 'Craft coffee, brunch, and comfort food made from scratch every morning.',
        primaryCta: 'Order online →',
        primaryCtaUrl: '/menu',
      },
    },
    {
      id: 'block-featured',
      type: 'featured',
      variant: 'row',
      props: {
        title: 'Featured',
        viewAllText: 'View menu →',
        viewAllUrl: '/menu',
        items: [
          { title: 'Morning croissant' },
          { title: 'Avocado toast' },
          { title: 'Seasonal latte' },
          { title: 'House sandwich' },
          { title: 'Chef special' },
        ],
      },
    },
    {
      id: 'block-footer',
      type: 'footer',
      variant: 'minimal',
      props: {
        copyright: `${YEAR()} ${name}`,
        links: ['Menu', 'Gift cards', 'Contact'],
      },
    },
  ];
}

function renderCafeLightHtml(name: string, headline: string, subheadline: string, badge: string): string {
  const safeName = escapeHtml(name);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safeName}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>body{margin:0;font-family:"DM Sans",sans-serif;background:#fff;color:#171717}.wrap{max-width:72rem;margin:0 auto;padding:0 1.25rem}
header{display:flex;align-items:center;justify-content:space-between;padding:1rem 0;border-bottom:1px solid #eee}
.btn{padding:.65rem 1.25rem;border-radius:999px;background:#171717;color:#fff;font-weight:600;text-decoration:none;font-size:.85rem}
.hero{min-height:380px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;background:linear-gradient(135deg,#78716c,#44403c);margin:0 -1.25rem;padding:3rem 1.25rem;position:relative}
.hero::before{content:"";position:absolute;inset:0;background:rgba(0,0,0,.4)}.hero>div{position:relative;z-index:1;max-width:40rem}
.hero h1{font-size:clamp(1.75rem,4vw,2.75rem);margin:0 0 .75rem;line-height:1.1}.featured{padding:2rem 0;display:flex;gap:1rem;overflow-x:auto}
.card{flex:0 0 10rem;height:13rem;border-radius:1rem;background:#f5f5f4;border:1px solid #e5e5e5}
a{color:inherit;text-decoration:none}</style></head><body><div class="wrap">
<header><strong>${safeName}</strong><a class="btn" href="/menu">Order online →</a></header>
<section class="hero"><div><p>${escapeHtml(badge)}</p><h1>${escapeHtml(headline)}</h1><p>${escapeHtml(subheadline)}</p><a class="btn" href="/menu">Order online →</a></div></section>
<section class="featured"><div class="card"></div><div class="card"></div><div class="card"></div><div class="card"></div></section>
</div></body></html>`;
}

export function cafeClassicStarter(title = 'Cafe'): OpenPageBlocks {
  const name = String(title || 'Cafe').trim() || 'Cafe';
  const blocks = cafeClassicBlocks(name);
  const config = withPages(name, blocks, CAFE_LIGHT_THEME);
  const html = renderCafeLightHtml(
    name,
    'Where Every Meal Feels Like Home, Served Fresh Daily',
    'Craft coffee, brunch, and comfort food made from scratch every morning.',
    'Best cafe in the neighborhood'
  );
  return bundle(config, html);
}

export function bistroLightStarter(title = 'Bistro'): OpenPageBlocks {
  const name = String(title || 'Bistro').trim() || 'Bistro';
  const blocks = cafeClassicBlocks(name).map((b) =>
    b.type === 'hero'
      ? {
          ...b,
          props: {
            ...b.props,
            headline: `Welcome to ${name}`,
            subheadline: 'Neighborhood bistro — order pickup or delivery online.',
            badge: 'Neighborhood bistro',
          },
        }
      : b
  );
  const config = withPages(name, blocks, CAFE_LIGHT_THEME);
  const html = renderCafeLightHtml(
    name,
    `Welcome to ${name}`,
    'Neighborhood bistro — order pickup or delivery online.',
    'Neighborhood bistro'
  );
  return bundle(config, html);
}

export function starterForTemplate(key: string | null | undefined, title: string): OpenPageBlocks {
  switch (key) {
    case 'restaurant':
      return restaurantStarter(title);
    case 'blank':
      return blankStarter(title);
    case 'cafe_classic':
      return cafeClassicStarter(title);
    case 'bistro_light':
      return bistroLightStarter(title);
    case 'food_truck':
    default:
      return foodTruckStarter(title);
  }
}
