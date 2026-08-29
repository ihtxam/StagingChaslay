import { randomBytes } from "crypto";

export type KioskPromoSlide = {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
};

export type KioskTableMode = "table" | "badge" | "both";

export type KioskSettings = {
  accessToken?: string;
  name?: string;
  /** Hero slider images/text — editable from merchant panel. */
  promoSlides?: KioskPromoSlide[];
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
};

export function generateKioskToken(): string {
  return randomBytes(24).toString("hex");
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
  };
}

function clampIdleSeconds(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_KIOSK_SETTINGS.idleTimeoutSeconds!;
  return Math.min(600, Math.max(30, n));
}
