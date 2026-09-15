export type KioskPromoSlide = {
    imageUrl?: string;
    /** Large text displayed on top of the slide image. */
    overlayText?: string;
    title?: string;
    subtitle?: string;
};
export type KioskTableMode = "table" | "badge" | "both";
/** Restaurant: left (default) or top. Grocery: bottom (default) or left. */
export type KioskCategoryNav = "left" | "top" | "bottom";
/** Restaurant combo/wizard layout vs grocery / retail scan-and-browse. */
export type KioskLayout = "restaurant" | "grocery";
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
    /** Send kitchen ticket to main till (kitchen routing) — not printed locally on kiosk. */
    autoPrintKitchen?: boolean;
    /** Print guest receipt from kiosk tablet after order. */
    autoPrintReceipt?: boolean;
    /** Portrait touch screen diagonal in inches — scales UI for 23" or 27" kiosks. */
    screenSizeIn?: 23 | 27;
    /** Restaurant self-order vs grocery / retail browse + scan. */
    kioskLayout?: KioskLayout;
    /** Category bar position. Restaurant: left|top. Grocery: bottom|left. */
    categoryNav?: KioskCategoryNav;
};
export declare const DEFAULT_KIOSK_SETTINGS: KioskSettings;
export declare function generateKioskToken(): string;
export declare function normalizeKioskSettings(raw: unknown): KioskSettings;
//# sourceMappingURL=kiosk-settings.d.ts.map