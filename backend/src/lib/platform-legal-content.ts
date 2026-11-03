export const PLATFORM_LEGAL_HTML_KEYS = {
  privacy: "platform_legal_privacy_html",
  terms: "platform_legal_terms_html",
  cookies: "platform_legal_cookies_html",
} as const;

export type PlatformLegalPageId = keyof typeof PLATFORM_LEGAL_HTML_KEYS;

export const PLATFORM_LEGAL_PAGE_SLUGS: Record<PlatformLegalPageId, string> = {
  privacy: "privacy-policy",
  terms: "terms-of-use",
  cookies: "cookie-policy",
};

export const PLATFORM_LEGAL_SLUG_TO_ID: Record<string, PlatformLegalPageId> = {
  "privacy-policy": "privacy",
  "terms-of-use": "terms",
  "cookie-policy": "cookies",
};

export const PLATFORM_LEGAL_HOSTED_PATHS: Record<PlatformLegalPageId, string> = {
  privacy: "/legal/privacy-policy",
  terms: "/legal/terms-of-use",
  cookies: "/legal/cookie-policy",
};

export type PlatformLegalHtmlContent = {
  privacyHtml: string;
  termsHtml: string;
  cookiesHtml: string;
};

export function normalizePlatformLegalHtml(raw: unknown): string {
  return String(raw ?? "").trim();
}

export function platformLegalHtmlById(
  content: PlatformLegalHtmlContent,
  id: PlatformLegalPageId
): string {
  if (id === "privacy") return content.privacyHtml;
  if (id === "terms") return content.termsHtml;
  return content.cookiesHtml;
}

export function defaultPlatformLegalPageTitle(id: PlatformLegalPageId): string {
  if (id === "privacy") return "Privacy policy";
  if (id === "terms") return "Terms of use";
  return "Cookie policy";
}
