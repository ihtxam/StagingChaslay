/** Cloud POS / WebPOS receipt + printer settings (shared with Android later). */

/** Per-category kitchen print destination (WebPOS + print agent). */
export type KitchenPrintDestination = "kitchen1" | "kitchen2" | "receipt" | "none";

export const KITCHEN_PRINT_DESTINATIONS: KitchenPrintDestination[] = [
  "kitchen1",
  "kitchen2",
  "receipt",
  "none",
];

export type PosPrinterProfile = {
  id: string;
  /** Windows printer name (print-agent) or device label */
  name: string;
  enabled?: boolean;
  paperWidthMm?: 58 | 80;
  printReceipts?: boolean;
  printKitchenTickets?: boolean;
  printEndOfDayReports?: boolean;
  /** Product barcode labels (Code128) */
  printLabels?: boolean;
  printAllProducts?: boolean;
  linkedCategoryIds?: string[];
  linkedProductIds?: string[];
};

export type PosPrintSettings = {
  receiptHeader?: string;
  receiptFooter?: string;
  kitchenTicketHeader?: string;
  kitchenTicketFooter?: string;
  /** Kitchen item text scale: 1=normal (plain), 2=double height, 3=double width+height */
  kitchenItemTextScale?: 1 | 2 | 3;
  /** Kitchen header text scale: 1=normal (plain), 2=double height, 3=double width+height */
  kitchenHeaderTextScale?: 1 | 2 | 3;
  /** Bold kitchen item/header text (default false for plain tickets) */
  kitchenBoldText?: boolean;
  receiptShowVatTable?: boolean;
  receiptShowStaffLine?: boolean;
  receiptShowQrCode?: boolean;
  /** When true, delivery order receipts include a Google Maps navigation QR at the bottom. */
  receiptDeliveryDirectionsQr?: boolean;
  /** When true, Adyen card payment receipt is available via QR only (not printed on thermal). */
  adyenReceiptDigitalOnly?: boolean;
  /** Default paper width when printer profile has none */
  paperWidthMm?: 58 | 80;
  /** Receipt language; "panel" follows panelLanguage */
  receiptLanguage?: "en" | "fr" | "de" | "panel";
  /** Override logo; empty/null falls back to shopLogoUrl */
  receiptLogoUrl?: string | null;
  autoPrintReceipt?: boolean;
  autoPrintKitchen?: boolean;
  /** Auto-retry failed kitchen prints before showing an error (WebPOS local queue). */
  kitchenPrintRetryEnabled?: boolean;
  /** Total print attempts before marking kitchen job failed (default 5). */
  kitchenPrintRetryAttempts?: number;
  /** Seconds between kitchen print retries (default 5). */
  kitchenPrintRetryIntervalSec?: number;
  /** WebPOS / Print Agent USB scale COM port (e.g. COM3). Skips port discovery when set. */
  scaleComPort?: string | null;
  /** Android USB scale stable address synced from panel (optional). */
  scaleUsbAddress?: string | null;
  scaleEnabled?: boolean;
  printers?: PosPrinterProfile[];
  /**
   * @deprecated Migrated to printer-level linkedCategoryIds. Kept for one-time migration only.
   * categoryId → kitchen1 | kitchen2 | receipt | none.
   */
  kitchenPrintRouting?: Record<string, KitchenPrintDestination>;
  /**
   * Categories excluded from all kitchen printers (migrated from kitchenPrintRouting "none").
   * Cleared once merchants save printer profiles from the panel.
   */
  kitchenExcludedCategoryIds?: string[];
  /** Barcode label paper width (thermal / label printer) */
  labelWidthMm?: 40 | 58;
  /** Barcode label height presets */
  labelHeightMm?: 20 | 25 | 30 | 40;
  labelShowStoreName?: boolean;
  labelShowProductName?: boolean;
  labelShowBarcodeNumber?: boolean;
  labelShowPrice?: boolean;
  labelShowSku?: boolean;
};

export const DEFAULT_POS_PRINT_SETTINGS: Required<
  Omit<PosPrintSettings, "receiptLogoUrl" | "printers" | "kitchenPrintRouting" | "kitchenExcludedCategoryIds">
> & { receiptLogoUrl: string | null; printers: PosPrinterProfile[] } = {
  receiptHeader: "",
  receiptFooter: "Merci / Danke / Thank you",
  kitchenTicketHeader: "",
  kitchenTicketFooter: "",
  kitchenItemTextScale: 1,
  kitchenHeaderTextScale: 1,
  kitchenBoldText: false,
  receiptShowVatTable: true,
  receiptShowStaffLine: true,
  receiptShowQrCode: true,
  receiptDeliveryDirectionsQr: true,
  adyenReceiptDigitalOnly: false,
  paperWidthMm: 80,
  receiptLanguage: "panel",
  receiptLogoUrl: null,
    autoPrintReceipt: true,
    autoPrintKitchen: true,
    kitchenPrintRetryEnabled: true,
    kitchenPrintRetryAttempts: 5,
    kitchenPrintRetryIntervalSec: 5,
    scaleComPort: null,
    scaleUsbAddress: null,
    scaleEnabled: false,
    printers: [],
    labelWidthMm: 40,
    labelHeightMm: 20,
    labelShowStoreName: true,
    labelShowProductName: true,
    labelShowBarcodeNumber: true,
    labelShowPrice: false,
    labelShowSku: false,
  };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizePosPrintSettings(raw: unknown): PosPrintSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const paper = Number(src.paperWidthMm) === 58 ? 58 : 80;
  const lang = String(src.receiptLanguage || "panel").toLowerCase();
  const receiptLanguage = (["en", "fr", "de", "panel"] as const).includes(lang as "en")
    ? (lang as PosPrintSettings["receiptLanguage"])
    : "panel";

  const printersRaw = Array.isArray(src.printers) ? src.printers : [];
  const printers: PosPrinterProfile[] = printersRaw
    .map((p, i) => {
      if (!p || typeof p !== "object") return null;
      const row = p as Record<string, unknown>;
      const name = String(row.name || "").trim().slice(0, 200);
      if (!name) return null;
      return {
        id: String(row.id || `p-${i}-${Date.now()}`).slice(0, 64),
        name,
        enabled: row.enabled !== false,
        paperWidthMm: Number(row.paperWidthMm) === 58 ? 58 : 80,
        printReceipts: !!row.printReceipts,
        printKitchenTickets: !!row.printKitchenTickets,
        printEndOfDayReports: !!row.printEndOfDayReports,
        printLabels: !!row.printLabels,
        printAllProducts: row.printAllProducts !== false,
        linkedCategoryIds: Array.isArray(row.linkedCategoryIds)
          ? row.linkedCategoryIds.map(String).slice(0, 200)
          : [],
        linkedProductIds: Array.isArray(row.linkedProductIds)
          ? row.linkedProductIds.map(String).slice(0, 500)
          : [],
      } as PosPrinterProfile;
    })
    .filter(Boolean) as PosPrinterProfile[];

  const routingDests = new Set<string>(KITCHEN_PRINT_DESTINATIONS);
  let kitchenPrintRouting: Record<string, KitchenPrintDestination> | undefined;
  if (src.kitchenPrintRouting && typeof src.kitchenPrintRouting === "object") {
    const rawRouting = src.kitchenPrintRouting as Record<string, unknown>;
    const next: Record<string, KitchenPrintDestination> = {};
    for (const [catId, dest] of Object.entries(rawRouting)) {
      const id = String(catId || "").trim().slice(0, 64);
      const d = String(dest || "").trim();
      if (id && routingDests.has(d)) {
        next[id] = d as KitchenPrintDestination;
      }
    }
    if (Object.keys(next).length) kitchenPrintRouting = next;
  }

  let kitchenExcludedCategoryIds: string[] | undefined;
  if (Array.isArray(src.kitchenExcludedCategoryIds)) {
    const ids = src.kitchenExcludedCategoryIds.map(String).filter(Boolean).slice(0, 200);
    if (ids.length) kitchenExcludedCategoryIds = ids;
  }

  const migrated = migrateKitchenPrintRoutingToPrinters(
    printers,
    kitchenPrintRouting,
    kitchenExcludedCategoryIds
  );

  const labelWidthMm = Number(src.labelWidthMm) === 58 ? 58 : 40;
  const rawH = Number(src.labelHeightMm);
  const labelHeightMm = (rawH === 25 || rawH === 30 || rawH === 40 ? rawH : 20) as 20 | 25 | 30 | 40;

  const itemScale = Number(src.kitchenItemTextScale);
  const headerScale = Number(src.kitchenHeaderTextScale);
  let kitchenItemTextScale = (itemScale === 1 || itemScale === 2 || itemScale === 3 ? itemScale : 1) as
    | 1
    | 2
    | 3;
  let kitchenHeaderTextScale = (headerScale === 1 || headerScale === 2 || headerScale === 3
    ? headerScale
    : 1) as 1 | 2 | 3;
  let kitchenBoldText = src.kitchenBoldText === true;

  // Legacy default was double-height (2) + bold — migrate to plain full-width tickets.
  if (kitchenItemTextScale === 2 && kitchenHeaderTextScale === 2 && src.kitchenBoldText !== false) {
    kitchenItemTextScale = 1;
    kitchenHeaderTextScale = 1;
    kitchenBoldText = false;
  }

  return {
    receiptHeader: String(src.receiptHeader ?? "").slice(0, 2000),
    receiptFooter: String(src.receiptFooter ?? DEFAULT_POS_PRINT_SETTINGS.receiptFooter).slice(0, 2000),
    kitchenTicketHeader: String(src.kitchenTicketHeader ?? "").slice(0, 2000),
    kitchenTicketFooter: String(src.kitchenTicketFooter ?? "").slice(0, 2000),
    kitchenItemTextScale,
    kitchenHeaderTextScale,
    kitchenBoldText,
    receiptShowVatTable: src.receiptShowVatTable !== false,
    receiptShowStaffLine: src.receiptShowStaffLine !== false,
    receiptShowQrCode: src.receiptShowQrCode !== false,
    receiptDeliveryDirectionsQr: src.receiptDeliveryDirectionsQr !== false,
    adyenReceiptDigitalOnly: src.adyenReceiptDigitalOnly === true,
    paperWidthMm: paper,
    receiptLanguage,
    receiptLogoUrl:
      src.receiptLogoUrl === null || src.receiptLogoUrl === undefined
        ? null
        : String(src.receiptLogoUrl).trim().slice(0, 500) || null,
    autoPrintReceipt: src.autoPrintReceipt !== false,
    autoPrintKitchen: src.autoPrintKitchen !== false,
    kitchenPrintRetryEnabled: src.kitchenPrintRetryEnabled !== false,
    kitchenPrintRetryAttempts: clampInt(src.kitchenPrintRetryAttempts, 1, 20, 5),
    kitchenPrintRetryIntervalSec: clampInt(src.kitchenPrintRetryIntervalSec, 2, 60, 5),
    scaleComPort:
      src.scaleComPort === null || src.scaleComPort === undefined
        ? null
        : String(src.scaleComPort).trim().slice(0, 32) || null,
    scaleUsbAddress:
      src.scaleUsbAddress === null || src.scaleUsbAddress === undefined
        ? null
        : String(src.scaleUsbAddress).trim().slice(0, 120) || null,
    scaleEnabled: src.scaleEnabled === true,
    printers: migrated.printers,
    kitchenPrintRouting: migrated.routing,
    kitchenExcludedCategoryIds: migrated.excludedCategoryIds,
    labelWidthMm,
    labelHeightMm,
    labelShowStoreName: src.labelShowStoreName !== false,
    labelShowProductName: src.labelShowProductName !== false,
    labelShowBarcodeNumber: src.labelShowBarcodeNumber !== false,
    labelShowPrice: src.labelShowPrice === true,
    labelShowSku: src.labelShowSku === true,
  };
}

/** One-time migration: category→destination map → per-printer linkedCategoryIds (Android-aligned). */
export function migrateKitchenPrintRoutingToPrinters(
  printers: PosPrinterProfile[],
  routing?: Record<string, KitchenPrintDestination>,
  existingExcluded?: string[]
): {
  printers: PosPrinterProfile[];
  routing?: Record<string, KitchenPrintDestination>;
  excludedCategoryIds?: string[];
} {
  if (!routing || !Object.keys(routing).length) {
    return { printers, routing, excludedCategoryIds: existingExcluded };
  }

  const result = printers.map((p) => ({ ...p }));
  const kitchenIndices = result
    .map((p, i) => (p.printKitchenTickets ? i : -1))
    .filter((i) => i >= 0);
  const receiptIndices = result
    .map((p, i) => (p.printReceipts ? i : -1))
    .filter((i) => i >= 0);

  const byDest: Record<KitchenPrintDestination, string[]> = {
    kitchen1: [],
    kitchen2: [],
    receipt: [],
    none: [],
  };
  for (const [catId, dest] of Object.entries(routing)) {
    byDest[dest]?.push(catId);
  }

  const excluded = new Set([...(existingExcluded || []), ...byDest.none]);

  if (kitchenIndices[1] !== undefined && byDest.kitchen2.length) {
    const idx = kitchenIndices[1];
    result[idx] = {
      ...result[idx],
      printAllProducts: false,
      linkedCategoryIds: [...new Set(byDest.kitchen2)],
    };
  }

  if (byDest.receipt.length && receiptIndices.length) {
    for (const idx of receiptIndices) {
      const p = result[idx];
      result[idx] = {
        ...p,
        printKitchenTickets: true,
        printAllProducts: false,
        linkedCategoryIds: [...new Set([...(p.linkedCategoryIds || []), ...byDest.receipt])],
      };
    }
  }

  const migratedExplicitly =
    byDest.kitchen2.length > 0 || byDest.receipt.length > 0 || byDest.none.length > 0;

  return {
    printers: result,
    routing: migratedExplicitly ? undefined : routing,
    excludedCategoryIds: excluded.size ? [...excluded] : existingExcluded,
  };
}

export const POS_CANCEL_REASONS = [
  { id: "kitchen_busy", en: "Kitchen too busy", fr: "Cuisine trop occupée", de: "Küche überlastet" },
  { id: "client_cancel", en: "Client cancellation", fr: "Annulation client", de: "Stornierung durch Gast" },
  { id: "out_of_stock", en: "Out of stock", fr: "Rupture de stock", de: "Nicht vorrätig" },
  { id: "wrong_order", en: "Wrong order entered", fr: "Mauvaise commande saisie", de: "Falsche Bestellung erfasst" },
  { id: "could_not_process", en: "Could not process order", fr: "Impossible de traiter la commande", de: "Bestellung konnte nicht verarbeitet werden" },
  { id: "other", en: "Other", fr: "Autre", de: "Sonstiges" },
] as const;

export function resolvePosCancelReason(reason: string): string {
  const raw = String(reason || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const matched = POS_CANCEL_REASONS.find(
    (r) =>
      r.id === lower ||
      r.en.toLowerCase() === lower ||
      r.fr.toLowerCase() === lower ||
      r.de.toLowerCase() === lower
  );
  return (matched ? matched.en : raw).slice(0, 500);
}

export const POS_REFUND_REASONS = [
  {
    id: "didnt_like_food",
    en: "Client didn't like the food",
    fr: "Le client n'a pas aimé le plat",
    de: "Gast mochte das Essen nicht",
  },
  {
    id: "service_slow",
    en: "Service was slow",
    fr: "Service trop lent",
    de: "Service war zu langsam",
  },
  {
    id: "wrong_order",
    en: "Wrong order",
    fr: "Mauvaise commande",
    de: "Falsche Bestellung",
  },
  {
    id: "change_of_mind",
    en: "Change of mind",
    fr: "Changement d'avis",
    de: "Meinungsänderung",
  },
  {
    id: "quality_issue",
    en: "Quality / preparation issue",
    fr: "Problème de qualité / préparation",
    de: "Qualitäts- / Zubereitungsproblem",
  },
  { id: "other", en: "Other (custom)", fr: "Autre (personnalisé)", de: "Sonstiges (frei)" },
] as const;

export function resolvePosRefundReason(reason: string): string {
  const raw = String(reason || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const matched = POS_REFUND_REASONS.find(
    (r) =>
      r.id === lower ||
      r.en.toLowerCase() === lower ||
      r.fr.toLowerCase() === lower ||
      r.de.toLowerCase() === lower
  );
  // Custom messages keep the typed text; presets normalize to English.
  if (matched && matched.id !== "other") return matched.en.slice(0, 500);
  return raw.slice(0, 500);
}
