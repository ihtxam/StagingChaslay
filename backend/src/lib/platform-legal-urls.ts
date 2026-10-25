import {
  PLATFORM_LEGAL_HOSTED_PATHS,
  type PlatformLegalHtmlContent,
  type PlatformLegalPageId,
  normalizePlatformLegalHtml,
  platformLegalHtmlById,
} from "@/lib/platform-legal-content";

/** Default marketing site for platform legal pages (shop footer). */
export const DEFAULT_PLATFORM_LEGAL_ORIGIN = "https://rebornsense.com";

export const PLATFORM_LEGAL_SETTING_KEYS = {
  privacyUrl: "platform_legal_privacy_url",
  termsUrl: "platform_legal_terms_url",
  cookiesUrl: "platform_legal_cookies_url",
} as const;

export type PlatformLegalUrls = {
  privacy: string;
  terms: string;
  cookies: string;
  origin: string;
};

export type PlatformLegalUrlOverrides = {
  privacyUrl: string | null;
  termsUrl: string | null;
  cookiesUrl: string | null;
};

export type PlatformLegalSettings = PlatformLegalUrls &
  PlatformLegalHtmlContent & {
    urlOverrides: PlatformLegalUrlOverrides;
  };

function normalizeOrigin(raw: string | null | undefined): string {
  const trimmed = String(raw || "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_PLATFORM_LEGAL_ORIGIN;
}

export function defaultPlatformLegalUrls(origin?: string | null): PlatformLegalUrls {
  const base = normalizeOrigin(origin);
  return {
    origin: base,
    privacy: `${base}/privacy-policy`,
    terms: `${base}/terms-of-use`,
    cookies: `${base}/cookie-policy`,
  };
}

function resolveLink(
  id: PlatformLegalPageId,
  storedUrl: string | null | undefined,
  html: string,
  defaults: PlatformLegalUrls
): string {
  const override = String(storedUrl || "").trim();
  if (override) return override;
  if (normalizePlatformLegalHtml(html)) return PLATFORM_LEGAL_HOSTED_PATHS[id];
  if (id === "privacy") return defaults.privacy;
  if (id === "terms") return defaults.terms;
  return defaults.cookies;
}

export function resolvePlatformLegalUrls(input: {
  privacyUrl?: string | null;
  termsUrl?: string | null;
  cookiesUrl?: string | null;
  privacyHtml?: string | null;
  termsHtml?: string | null;
  cookiesHtml?: string | null;
}): PlatformLegalUrls {
  const defaults = defaultPlatformLegalUrls();
  const privacyHtml = normalizePlatformLegalHtml(input.privacyHtml);
  const termsHtml = normalizePlatformLegalHtml(input.termsHtml);
  const cookiesHtml = normalizePlatformLegalHtml(input.cookiesHtml);

  const privacy = resolveLink("privacy", input.privacyUrl, privacyHtml, defaults);
  const terms = resolveLink("terms", input.termsUrl, termsHtml, defaults);
  const cookies = resolveLink("cookies", input.cookiesUrl, cookiesHtml, defaults);

  let origin = defaults.origin;
  const firstAbsolute = [privacy, terms, cookies].find((href) => /^https?:\/\//i.test(href));
  if (firstAbsolute) {
    try {
      origin = new URL(firstAbsolute).origin;
    } catch {
      /* keep default */
    }
  } else if (privacyHtml || termsHtml || cookiesHtml) {
    origin = normalizeOrigin(process.env.PUBLIC_APP_URL || process.env.APP_URL);
  }

  return { origin, privacy, terms, cookies };
}

export function resolvePlatformLegalSettings(input: {
  privacyUrl?: string | null;
  termsUrl?: string | null;
  cookiesUrl?: string | null;
  privacyHtml?: string | null;
  termsHtml?: string | null;
  cookiesHtml?: string | null;
}): PlatformLegalSettings {
  const privacyHtml = normalizePlatformLegalHtml(input.privacyHtml);
  const termsHtml = normalizePlatformLegalHtml(input.termsHtml);
  const cookiesHtml = normalizePlatformLegalHtml(input.cookiesHtml);
  const urls = resolvePlatformLegalUrls({
    privacyUrl: input.privacyUrl,
    termsUrl: input.termsUrl,
    cookiesUrl: input.cookiesUrl,
    privacyHtml,
    termsHtml,
    cookiesHtml,
  });
  return {
    ...urls,
    privacyHtml,
    termsHtml,
    cookiesHtml,
    urlOverrides: {
      privacyUrl: String(input.privacyUrl || "").trim() || null,
      termsUrl: String(input.termsUrl || "").trim() || null,
      cookiesUrl: String(input.cookiesUrl || "").trim() || null,
    },
  };
}

export function hostedPlatformLegalPathForSlug(
  slug: string,
  content: PlatformLegalHtmlContent
): string | null {
  const id = slug === "privacy-policy"
    ? "privacy"
    : slug === "terms-of-use"
      ? "terms"
      : slug === "cookie-policy"
        ? "cookies"
        : null;
  if (!id) return null;
  const html = platformLegalHtmlById(content, id);
  return normalizePlatformLegalHtml(html) ? PLATFORM_LEGAL_HOSTED_PATHS[id] : null;
}
