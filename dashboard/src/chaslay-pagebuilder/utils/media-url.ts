/** Decode HTML entities that Craft.js / JSON round-trips can introduce in image URLs. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Normalize a builder image URL after paste/save so <img> and CSS backgrounds load. */
export function normalizeMediaUrl(raw: string | null | undefined): string {
  if (raw == null) return '';
  let url = String(raw).trim();
  if (!url) return '';
  url = decodeHtmlEntities(url).trim();
  const cssUrl = url.match(/^url\(\s*(['"]?)([\s\S]*?)\1\s*\)$/i);
  if (cssUrl?.[2]) url = cssUrl[2].trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  url = decodeHtmlEntities(url).trim();
  if (url.startsWith('//')) url = `https:${url}`;
  return url;
}

export function cssBackgroundImage(raw: string | null | undefined): string | undefined {
  const url = normalizeMediaUrl(raw);
  if (!url) return undefined;
  const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `url("${escaped}")`;
}
