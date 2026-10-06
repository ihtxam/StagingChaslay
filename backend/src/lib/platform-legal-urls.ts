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

export function resolvePlatformLegalUrls(input: {
  privacyUrl?: string | null;
  termsUrl?: string | null;
  cookiesUrl?: string | null;
}): PlatformLegalUrls {
  const defaults = defaultPlatformLegalUrls();
  const pick = (stored: string | null | undefined, fallback: string) => {
    const v = String(stored || "").trim();
    return v || fallback;
  };
  const privacy = pick(input.privacyUrl, defaults.privacy);
  const terms = pick(input.termsUrl, defaults.terms);
  const cookies = pick(input.cookiesUrl, defaults.cookies);
  let origin = defaults.origin;
  try {
    origin = new URL(privacy).origin;
  } catch {
    /* keep default */
  }
  return { origin, privacy, terms, cookies };
}
