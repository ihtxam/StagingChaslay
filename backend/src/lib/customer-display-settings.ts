import { randomBytes } from "crypto";
import { APP_ORIGIN } from "@/lib/brand";
import type { KioskPromoSlide } from "@/lib/kiosk-settings";

export type CdsTheme = "light" | "dark";

export type CustomerDisplaySettings = {
  accessToken?: string;
  /** Short numeric code for /cds/:code URLs (easier to type on a second device). */
  shortCode?: string;
  enabled?: boolean;
  promoSlides?: KioskPromoSlide[];
  slideIntervalSec?: number;
  theme?: CdsTheme;
};

export const DEFAULT_CUSTOMER_DISPLAY_SETTINGS: CustomerDisplaySettings = {
  enabled: true,
  promoSlides: [],
  slideIntervalSec: 8,
  theme: "light",
};

export function generateCdsToken(): string {
  return randomBytes(24).toString("hex");
}

export function normalizeCustomerDisplaySettings(raw: unknown): CustomerDisplaySettings {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_CUSTOMER_DISPLAY_SETTINGS,
      accessToken: generateCdsToken(),
    };
  }
  const src = raw as Record<string, unknown>;
  const slidesRaw = src.promoSlides;
  const promoSlides = Array.isArray(slidesRaw)
    ? slidesRaw
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const slide = s as Record<string, unknown>;
          return {
            imageUrl: String(slide.imageUrl || "").trim() || undefined,
            overlayText: String(slide.overlayText || "").trim() || undefined,
            title: String(slide.title || "").trim() || undefined,
            subtitle: String(slide.subtitle || "").trim() || undefined,
          };
        })
        .filter(Boolean) as KioskPromoSlide[]
    : DEFAULT_CUSTOMER_DISPLAY_SETTINGS.promoSlides;

  let accessToken = String(src.accessToken || "").trim();
  // Do not mint a new token on partial JSON — CdsService persists one when missing.

  const shortCode = String(src.shortCode || "").trim() || undefined;

  const themeRaw = String(src.theme || "light").toLowerCase();
  const theme: CdsTheme = themeRaw === "dark" ? "dark" : "light";

  const interval = Math.round(Number(src.slideIntervalSec));
  const slideIntervalSec = Number.isFinite(interval)
    ? Math.min(60, Math.max(3, interval))
    : DEFAULT_CUSTOMER_DISPLAY_SETTINGS.slideIntervalSec!;

  return {
    accessToken: accessToken || undefined,
    shortCode,
    enabled: src.enabled !== false,
    promoSlides,
    slideIntervalSec,
    theme,
  };
}

/** Stable public CDS URL — merchant slug path never rotates with access tokens. */
export function buildCdsPublicUrl(
  merchantSlug?: string | null,
  shortCode?: string | null,
  appOrigin: string = APP_ORIGIN
): string {
  const origin = String(appOrigin || APP_ORIGIN).replace(/\/+$/, "");
  const slug = String(merchantSlug || "").trim();
  if (slug) return `${origin}/cds/m/${encodeURIComponent(slug)}`;
  const code = String(shortCode || "").trim();
  if (code) return `${origin}/cds/${encodeURIComponent(code)}`;
  return `${origin}/cds/`;
}
