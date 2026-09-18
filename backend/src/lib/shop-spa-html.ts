export type ShopSocialSeo = {
  title: string;
  description: string;
  url: string;
  siteName: string;
  imageUrl: string | null;
  locale: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildShopSocialMetaTags(seo: ShopSocialSeo): string {
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const url = escapeHtml(seo.url);
  const siteName = escapeHtml(seo.siteName);
  const image = seo.imageUrl ? escapeHtml(seo.imageUrl) : "";
  const card = seo.imageUrl ? "summary_large_image" : "summary";
  const lines = [
    `<meta name="description" content="${description}" />`,
    `<meta name="twitter:card" content="${card}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="${siteName}" />`,
    `<meta property="og:locale" content="${escapeHtml(seo.locale)}" />`,
  ];
  if (image) {
    lines.push(`<meta name="twitter:image" content="${image}" />`);
    lines.push(`<meta property="og:image" content="${image}" />`);
    lines.push(`<meta property="og:image:alt" content="${title}" />`);
  }
  return lines.join("\n    ");
}

/** Replace default shell SEO and inject Open Graph / Twitter tags for crawlers. */
export function injectShopSocialSeo(html: string, seo: ShopSocialSeo): string {
  if (!seo.title && !seo.description) return html;
  const metaBlock = buildShopSocialMetaTags(seo);
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title || seo.siteName)}</title>`);
  if (/<meta\s+name="description"/i.test(out)) {
    out = out.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(seo.description)}" />`
    );
  } else {
    out = out.replace("</head>", `    ${metaBlock}\n  </head>`);
    return out;
  }
  out = out.replace(/<meta\s+name="twitter:[^"]+"\s+content="[^"]*"\s*\/?>\s*/gi, "");
  out = out.replace(/<meta\s+property="og:[^"]+"\s+content="[^"]*"\s*\/?>\s*/gi, "");
  out = out.replace("</head>", `    ${metaBlock}\n  </head>`);
  return out;
}
