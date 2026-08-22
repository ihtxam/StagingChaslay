/** Cloud POS / WebPOS receipt + printer settings (shared with Android later). */
/** Per-category kitchen print destination (WebPOS + print agent). */
export type KitchenPrintDestination = "kitchen1" | "kitchen2" | "receipt" | "none";
export declare const KITCHEN_PRINT_DESTINATIONS: KitchenPrintDestination[];
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
export declare const DEFAULT_POS_PRINT_SETTINGS: Required<Omit<PosPrintSettings, "receiptLogoUrl" | "printers" | "kitchenPrintRouting" | "kitchenExcludedCategoryIds">> & {
    receiptLogoUrl: string | null;
    printers: PosPrinterProfile[];
};
export declare function normalizePosPrintSettings(raw: unknown): PosPrintSettings;
/** One-time migration: category→destination map → per-printer linkedCategoryIds (Android-aligned). */
export declare function migrateKitchenPrintRoutingToPrinters(printers: PosPrinterProfile[], routing?: Record<string, KitchenPrintDestination>, existingExcluded?: string[]): {
    printers: PosPrinterProfile[];
    routing?: Record<string, KitchenPrintDestination>;
    excludedCategoryIds?: string[];
};
export declare const POS_CANCEL_REASONS: readonly [{
    readonly id: "kitchen_busy";
    readonly en: "Kitchen too busy";
    readonly fr: "Cuisine trop occupée";
    readonly de: "Küche überlastet";
}, {
    readonly id: "client_cancel";
    readonly en: "Client cancellation";
    readonly fr: "Annulation client";
    readonly de: "Stornierung durch Gast";
}, {
    readonly id: "out_of_stock";
    readonly en: "Out of stock";
    readonly fr: "Rupture de stock";
    readonly de: "Nicht vorrätig";
}, {
    readonly id: "wrong_order";
    readonly en: "Wrong order entered";
    readonly fr: "Mauvaise commande saisie";
    readonly de: "Falsche Bestellung erfasst";
}, {
    readonly id: "could_not_process";
    readonly en: "Could not process order";
    readonly fr: "Impossible de traiter la commande";
    readonly de: "Bestellung konnte nicht verarbeitet werden";
}, {
    readonly id: "other";
    readonly en: "Other";
    readonly fr: "Autre";
    readonly de: "Sonstiges";
}];
export declare function resolvePosCancelReason(reason: string): string;
export declare const POS_REFUND_REASONS: readonly [{
    readonly id: "didnt_like_food";
    readonly en: "Client didn't like the food";
    readonly fr: "Le client n'a pas aimé le plat";
    readonly de: "Gast mochte das Essen nicht";
}, {
    readonly id: "service_slow";
    readonly en: "Service was slow";
    readonly fr: "Service trop lent";
    readonly de: "Service war zu langsam";
}, {
    readonly id: "wrong_order";
    readonly en: "Wrong order";
    readonly fr: "Mauvaise commande";
    readonly de: "Falsche Bestellung";
}, {
    readonly id: "change_of_mind";
    readonly en: "Change of mind";
    readonly fr: "Changement d'avis";
    readonly de: "Meinungsänderung";
}, {
    readonly id: "quality_issue";
    readonly en: "Quality / preparation issue";
    readonly fr: "Problème de qualité / préparation";
    readonly de: "Qualitäts- / Zubereitungsproblem";
}, {
    readonly id: "other";
    readonly en: "Other (custom)";
    readonly fr: "Autre (personnalisé)";
    readonly de: "Sonstiges (frei)";
}];
export declare function resolvePosRefundReason(reason: string): string;
//# sourceMappingURL=pos-print-settings.d.ts.map