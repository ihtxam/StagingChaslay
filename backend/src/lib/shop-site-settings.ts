import { isValidHexColor, normalizeHexColor } from "@/lib/category-colors";

export type ShopSeoLocale = "en" | "fr" | "de" | "it";

export type ShopLocalizedCopy = Partial<Record<ShopSeoLocale, string>>;

export type ShopSiteSettings = {
  brandColor: string | null;
  metaTitle: ShopLocalizedCopy;
  metaDescription: ShopLocalizedCopy;
  gaMeasurementId: string | null;
  faviconUrl: string | null;
};

const EMPTY: ShopSiteSettings = {
  brandColor: null,
  metaTitle: {},
  metaDescription: {},
  gaMeasurementId: null,
  faviconUrl: null,
};

const LOCALES: ShopSeoLocale[] = ["en", "fr", "de", "it"];

function trimCopy(raw: unknown, max: number): ShopLocalizedCopy {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: ShopLocalizedCopy = {};
  for (const loc of LOCALES) {
    const v = typeof src[loc] === "string" ? src[loc].trim() : "";
    if (v) out[loc] = v.slice(0, max);
  }
  return out;
}

export function normalizeGaMeasurementId(raw: unknown): string | null {
  const id = String(raw || "")
    .trim()
    .toUpperCase();
  if (!id) return null;
  if (!/^G-[A-Z0-9]{4,20}$/.test(id)) return null;
  return id;
}

export function normalizeShopSiteSettings(raw: unknown): ShopSiteSettings {
  if (!raw || typeof raw !== "object") return { ...EMPTY, metaTitle: {}, metaDescription: {} };
  const src = raw as Record<string, unknown>;
  const colorRaw = typeof src.brandColor === "string" ? src.brandColor.trim() : "";
  const brandColor =
    colorRaw && isValidHexColor(colorRaw) ? normalizeHexColor(colorRaw).toLowerCase() : null;
  const faviconUrl =
    typeof src.faviconUrl === "string" && src.faviconUrl.trim() ? src.faviconUrl.trim().slice(0, 500) : null;
  return {
    brandColor,
    metaTitle: trimCopy(src.metaTitle, 60),
    metaDescription: trimCopy(src.metaDescription, 160),
    gaMeasurementId: normalizeGaMeasurementId(src.gaMeasurementId),
    faviconUrl,
  };
}

export function localizedShopCopy(
  copy: ShopLocalizedCopy | undefined,
  locale: string,
  fallbackLocale = "en"
): string {
  const loc = String(locale || fallbackLocale)
    .toLowerCase()
    .slice(0, 2) as ShopSeoLocale;
  const fallback = String(fallbackLocale || "en")
    .toLowerCase()
    .slice(0, 2) as ShopSeoLocale;
  return (
    (copy?.[loc] || "").trim() ||
    (copy?.[fallback] || "").trim() ||
    (copy?.en || "").trim() ||
    ""
  );
}

/** Prefer Online Shop SEO settings; page/builder copy is fallback only. */
export function resolveShopDocumentSeo(
  site: ShopSiteSettings | null | undefined,
  locale: string,
  fallbacks?: { title?: string | null; description?: string | null }
): { title: string; description: string; faviconUrl: string | null } {
  return {
    title: localizedShopCopy(site?.metaTitle, locale) || String(fallbacks?.title || "").trim(),
    description:
      localizedShopCopy(site?.metaDescription, locale) || String(fallbacks?.description || "").trim(),
    faviconUrl: site?.faviconUrl || null,
  };
}
