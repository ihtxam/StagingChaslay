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
export declare const DEFAULT_CUSTOMER_DISPLAY_SETTINGS: CustomerDisplaySettings;
export declare function generateCdsToken(): string;
export declare function normalizeCustomerDisplaySettings(raw: unknown): CustomerDisplaySettings;
/** Stable public CDS URL — merchant slug path never rotates with access tokens. */
export declare function buildCdsPublicUrl(merchantSlug?: string | null, shortCode?: string | null, appOrigin?: string): string;
//# sourceMappingURL=customer-display-settings.d.ts.map