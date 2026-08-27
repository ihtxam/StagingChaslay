/** Shared POS / WebPOS checkout settings (panel + devices). */
export type PosCheckoutDiscountPreset = {
    id: string;
    name: string;
    percent: number;
};
export type CourseSendMode = "fire_per_course" | "send_all_once";
export type CartSide = "left" | "right";
export type PostSuccessTarget = "register" | "tables";
export type PosMode = "restaurant" | "retail";
export type ActionButtonSize = "sm" | "md" | "lg";
export type PosCheckoutSettings = {
    tipsEnabled: boolean;
    tipPresetsPercent: number[];
    allowCustomTip: boolean;
    discountsEnabled: boolean;
    discountPresets: PosCheckoutDiscountPreset[];
    roundingStep: number;
    quickCashEnabled: boolean;
    quickCashDenominations: number[];
    splitBillsEnabled: boolean;
    maxSplitParts: number;
    /** Menu prices include VAT (gross); synced to POS devices. */
    vatIncludedInPrice: boolean;
    /**
     * Kitchen course firing:
     * - fire_per_course: SEND all courses, then FIRE Course N individually
     * - send_all_once: SEND all once; individual fire disabled afterwards
     */
    courseSendMode: CourseSendMode;
    /** WebPOS cart panel side. Default right. */
    cartSide: CartSide;
    /** After a successful payment, navigate to this WebPOS tab. */
    postSuccessTarget: PostSuccessTarget;
    /** Restaurant (tables/kitchen) vs retail (register / barcode). */
    posMode: PosMode;
    /**
     * Restaurant only: show Tables tab + Set table in WebPOS / Android.
     * Fast-food / counter service can turn this off and keep kitchen + takeaway.
     */
    tablesEnabled: boolean;
    /** Retail only: enable Takeaway channel (default off). */
    retailTakeawayEnabled: boolean;
    /** Retail only: enable Delivery channel (default off). */
    retailDeliveryEnabled: boolean;
    /** Retail only: enable Dine-in channel for bistro-style counter service (default off). */
    retailDineInEnabled: boolean;
    /**
     * When true, dine-in orders must pick a table (traditional restaurant).
     * When false, counter-style dine-in: auto ticket number, dine-in VAT, no table.
     * Default: true for restaurant mode, false for retail.
     */
    requireTableForDineIn: boolean;
    /** Express checkout + cart action buttons (Send, Payment, Tab). */
    actionButtonSize: ActionButtonSize;
};
export declare const DEFAULT_POS_CHECKOUT: PosCheckoutSettings;
export declare function isRetailPosMode(raw: unknown): boolean;
export declare function normalizePosCheckoutSettings(raw: unknown): PosCheckoutSettings;
//# sourceMappingURL=pos-checkout-settings.d.ts.map