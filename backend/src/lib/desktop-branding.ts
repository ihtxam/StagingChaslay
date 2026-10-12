import { APP_ORIGIN } from "@/lib/brand";

export const PLATFORM_DESKTOP_KEYS = {
  splashUrl: "desktop_splash_url",
  iconUrl: "desktop_icon_url",
  appName: "desktop_app_name",
  tagline: "desktop_tagline",
  backgroundColor: "desktop_background_color",
} as const;

export const DEFAULT_DESKTOP_BRANDING = {
  splashUrl: "/brand/reborn-logo-white.png",
  iconUrl: "/brand/reborn-logo-white.png",
  appName: "RebornPOS",
  tagline: "Restaurant POS & online ordering",
  backgroundColor: "#17252b",
} as const;

export type DesktopBranding = {
  splashUrl: string;
  iconUrl: string;
  appName: string;
  tagline: string;
  backgroundColor: string;
  splashCustom: boolean;
  iconCustom: boolean;
};

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function absolutizeDesktopAssetUrl(raw: string | null | undefined, origin = APP_ORIGIN): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(origin || APP_ORIGIN).replace(/\/+$/, "");
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function normalizeDesktopHexColor(raw: string | null | undefined): string {
  const value = String(raw || "").trim();
  return HEX_COLOR.test(value) ? value : DEFAULT_DESKTOP_BRANDING.backgroundColor;
}

export function resolveDesktopBranding(input: {
  splashUrl?: string | null;
  iconUrl?: string | null;
  appName?: string | null;
  tagline?: string | null;
  backgroundColor?: string | null;
}): DesktopBranding {
  const splashCustom = Boolean(String(input.splashUrl || "").trim());
  const iconCustom = Boolean(String(input.iconUrl || "").trim());
  const splashUrl = absolutizeDesktopAssetUrl(input.splashUrl) || absolutizeDesktopAssetUrl(DEFAULT_DESKTOP_BRANDING.splashUrl);
  const iconUrl =
    absolutizeDesktopAssetUrl(input.iconUrl) ||
    splashUrl ||
    absolutizeDesktopAssetUrl(DEFAULT_DESKTOP_BRANDING.iconUrl);
  const appName = String(input.appName || "").trim() || DEFAULT_DESKTOP_BRANDING.appName;
  const tagline = String(input.tagline || "").trim() || DEFAULT_DESKTOP_BRANDING.tagline;
  return {
    splashUrl,
    iconUrl,
    appName: appName.slice(0, 80),
    tagline: tagline.slice(0, 160),
    backgroundColor: normalizeDesktopHexColor(input.backgroundColor),
    splashCustom,
    iconCustom,
  };
}
