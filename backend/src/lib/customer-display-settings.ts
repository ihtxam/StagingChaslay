import { randomBytes } from "crypto";
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
  if (!accessToken) accessToken = generateCdsToken();

  const shortCode = String(src.shortCode || "").trim() || undefined;

  const themeRaw = String(src.theme || "light").toLowerCase();
  const theme: CdsTheme = themeRaw === "dark" ? "dark" : "light";

  const interval = Math.round(Number(src.slideIntervalSec));
  const slideIntervalSec = Number.isFinite(interval)
    ? Math.min(60, Math.max(3, interval))
    : DEFAULT_CUSTOMER_DISPLAY_SETTINGS.slideIntervalSec!;

  return {
    accessToken,
    shortCode,
    enabled: src.enabled !== false,
    promoSlides,
    slideIntervalSec,
    theme,
  };
}
