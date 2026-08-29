import { randomBytes } from "crypto";

export type KioskPromoSlide = {
  imageUrl?: string;
  /** Large text displayed on top of the slide image. */
  overlayText?: string;
  title?: string;
  subtitle?: string;
};

export type KioskTableMode = "table" | "badge" | "both";

export type KioskSettings = {
  accessToken?: string;
  name?: string;
  /** Hero slider images/text — editable from merchant panel. */
  promoSlides?: KioskPromoSlide[];
  /** Optional banner above the slider on customer kiosk. */
  slideBannerText?: string;
  enabledLanguages?: string[];
  defaultLanguage?: string;
  terminalId?: string | null;
  locationSlug?: string | null;
  tableMode?: KioskTableMode;
  membershipScanEnabled?: boolean;
  /** Card/terminal orders auto-accepted (default true). */
  kioskAutoAcceptCard?: boolean;
  /** Cash orders need manual approval in Order Hub (default true). */
  kioskCashNeedsApproval?: boolean;
  idleTimeoutSeconds?: number;
  /** 4–8 digit PIN to open back panel from fullscreen kiosk. */
  adminPin?: string;
  cashPaymentEnabled?: boolean;
  cardPaymentEnabled?: boolean;
  /** Attract screen — show takeaway button. */
  takeawayEnabled?: boolean;
  /** Attract screen — show delivery button. */
  deliveryEnabled?: boolean;
  /** Attract screen — show dine-in (table/badge) button. */
  dineInEnabled?: boolean;
  attractHeadline?: string;
  attractSubheadline?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandButtonTextColor?: string;
  /** Print kitchen ticket from kiosk tablet after order (via Print Bridge). */
  autoPrintKitchen?: boolean;
  /** Print guest receipt from kiosk tablet after order. */
  autoPrintReceipt?: boolean;
};

export const DEFAULT_KIOSK_SETTINGS: KioskSettings = {
  promoSlides: [],
  enabledLanguages: ["en", "fr", "de"],
  defaultLanguage: "en",
  tableMode: "both",
  membershipScanEnabled: true,
  kioskAutoAcceptCard: true,
  kioskCashNeedsApproval: true,
  idleTimeoutSeconds: 120,
  adminPin: "1234",
  cashPaymentEnabled: true,
  cardPaymentEnabled: true,
  takeawayEnabled: true,
  deliveryEnabled: false,
  dineInEnabled: true,
  brandPrimaryColor: "#059669",
  brandSecondaryColor: "#047857",
  brandButtonTextColor: "#ffffff",
  autoPrintKitchen: true,
  autoPrintReceipt: false,
};

export function generateKioskToken(): string {
  return randomBytes(24).toString("hex");
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const raw = String(value ?? fallback).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const h = raw.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return fallback;
}

export function normalizeKioskSettings(raw: unknown): KioskSettings {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_KIOSK_SETTINGS,
      accessToken: generateKioskToken(),
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
    : DEFAULT_KIOSK_SETTINGS.promoSlides;

  const langsRaw = src.enabledLanguages;
  const enabledLanguages = Array.isArray(langsRaw)
    ? langsRaw.map((l) => String(l).trim().toLowerCase()).filter(Boolean)
    : [...(DEFAULT_KIOSK_SETTINGS.enabledLanguages || [])];

  const tableModeRaw = String(src.tableMode || "both").toLowerCase();
  const tableMode: KioskTableMode =
    tableModeRaw === "table" || tableModeRaw === "badge" ? tableModeRaw : "both";

  let accessToken = String(src.accessToken || "").trim();
  if (!accessToken) accessToken = generateKioskToken();

  return {
    accessToken,
    name: String(src.name || "Self-order kiosk").trim() || "Self-order kiosk",
    promoSlides,
    slideBannerText: String(src.slideBannerText || "").trim() || undefined,
    enabledLanguages: enabledLanguages.length ? enabledLanguages : ["en"],
    defaultLanguage: String(src.defaultLanguage || enabledLanguages[0] || "en")
      .trim()
      .toLowerCase(),
    terminalId: src.terminalId == null ? null : String(src.terminalId).trim() || null,
    locationSlug:
      src.locationSlug == null ? null : String(src.locationSlug).trim().toLowerCase() || null,
    tableMode,
    membershipScanEnabled: src.membershipScanEnabled !== false,
    kioskAutoAcceptCard: src.kioskAutoAcceptCard !== false,
    kioskCashNeedsApproval: src.kioskCashNeedsApproval !== false,
    idleTimeoutSeconds: clampIdleSeconds(src.idleTimeoutSeconds),
    adminPin: normalizeAdminPin(src.adminPin),
    cashPaymentEnabled: src.cashPaymentEnabled !== false,
    cardPaymentEnabled: src.cardPaymentEnabled !== false,
    takeawayEnabled: src.takeawayEnabled !== false,
    deliveryEnabled: src.deliveryEnabled === true,
    dineInEnabled: src.dineInEnabled !== false,
    attractHeadline: String(src.attractHeadline || "").trim() || undefined,
    attractSubheadline: String(src.attractSubheadline || "").trim() || undefined,
    brandPrimaryColor: normalizeHexColor(src.brandPrimaryColor, DEFAULT_KIOSK_SETTINGS.brandPrimaryColor!),
    brandSecondaryColor: normalizeHexColor(
      src.brandSecondaryColor,
      DEFAULT_KIOSK_SETTINGS.brandSecondaryColor!
    ),
    brandButtonTextColor: normalizeHexColor(
      src.brandButtonTextColor,
      DEFAULT_KIOSK_SETTINGS.brandButtonTextColor!
    ),
    autoPrintKitchen: src.autoPrintKitchen !== false,
    autoPrintReceipt: src.autoPrintReceipt === true,
  };
}

function normalizeAdminPin(value: unknown): string {
  const pin = String(value ?? DEFAULT_KIOSK_SETTINGS.adminPin ?? "1234").replace(/\D/g, "");
  if (pin.length >= 4 && pin.length <= 8) return pin;
  return DEFAULT_KIOSK_SETTINGS.adminPin!;
}

function clampIdleSeconds(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_KIOSK_SETTINGS.idleTimeoutSeconds!;
  return Math.min(600, Math.max(30, n));
}
