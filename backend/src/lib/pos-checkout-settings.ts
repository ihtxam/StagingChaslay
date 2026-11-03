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
export type RetailTileSize = "sm" | "md" | "lg";
export type RetailProductSortMode = "most_sold" | "alphabetical" | "catalog_order";

export type ExpressPayPlacement = "cart" | "product_grid";

export type PosCheckoutSettings = {
  tipsEnabled: boolean;
  /**
   * When true, card terminal payments send Adyen AskGratuity (tip screen on device).
   * Independent of Adyen Customer Area tipping presets and of POS checkout tip buttons.
   */
  terminalAskGratuityEnabled: boolean;
  tipPresetsPercent: number[];
  allowCustomTip: boolean;
  discountsEnabled: boolean;
  discountPresets: PosCheckoutDiscountPreset[];
  roundingStep: number;
  quickCashEnabled: boolean;
  quickCashDenominations: number[];
  /** Show EUR equivalent on POS/WebPOS checkout (1 CHF = checkoutChfToEurRate EUR). */
  checkoutEurDisplayEnabled: boolean;
  checkoutChfToEurRate: number | null;
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
  /**
   * When true, POS delivery orders require a selected customer before checkout.
   * When false, delivery can be sold without linking a client record.
   */
  requireCustomerForDelivery: boolean;
  /** Express checkout + cart action buttons (Send, Payment, Tab). */
  actionButtonSize: ActionButtonSize;
  /** Show quick Cash/Card/Terminal bar under products on WebPOS / Android register. */
  expressCheckoutEnabled: boolean;
  /** Express buttons under cart panel vs product grid (not both). */
  expressPayPlacement: ExpressPayPlacement;
  /** Retail: tender dialog (amount given) vs checkout keypad only. */
  retailCashTenderDialogEnabled: boolean;
  /** Show POS toast notifications. Off by default — they block the till. */
  showPosToasts: boolean;
  /** Retail register: three-column layout (categories | products | cart). */
  retailLayoutEnabled: boolean;
  /** Retail register: auto-focus scan/search field on register view. */
  retailScannerFirst: boolean;
  /** Retail register: product tile size in the retail layout grid. */
  retailTileSize: RetailTileSize;
  /** Retail register: Cash / Card / Pay bar at bottom of cart panel. */
  retailPaymentBar: boolean;
  /** Retail register: clear search after adding a product. */
  retailClearSearchAfterAdd: boolean;
  retailShowStockOnTiles: boolean;
  retailShowProductPhotos: boolean;
  retailQuickTiles: string[];
  retailProductSortMode: RetailProductSortMode;
  retailRegisterProfiles: Array<{
    id: string;
    name: string;
    cartSide: CartSide;
    retailTileSize: RetailTileSize;
    retailScannerFirst: boolean;
    retailPaymentBar: boolean;
    retailShowStockOnTiles: boolean;
    retailShowProductPhotos: boolean;
    retailQuickTiles: string[];
    retailProductSortMode: RetailProductSortMode;
  }>;
};

export const DEFAULT_POS_CHECKOUT: PosCheckoutSettings = {
  tipsEnabled: true,
  terminalAskGratuityEnabled: false,
  tipPresetsPercent: [0, 5, 10, 15],
  allowCustomTip: true,
  discountsEnabled: true,
  discountPresets: [
    { id: "none", name: "None", percent: 0 },
    { id: "staff", name: "Staff", percent: 10 },
    { id: "vip", name: "VIP", percent: 15 },
  ],
  roundingStep: 0.05,
  quickCashEnabled: true,
  quickCashDenominations: [10, 20, 50, 100],
  checkoutEurDisplayEnabled: false,
  checkoutChfToEurRate: null,
  splitBillsEnabled: true,
  maxSplitParts: 8,
  vatIncludedInPrice: false,
  courseSendMode: "fire_per_course",
  cartSide: "right",
  postSuccessTarget: "register",
  posMode: "restaurant",
  tablesEnabled: true,
  retailTakeawayEnabled: false,
  retailDeliveryEnabled: false,
  retailDineInEnabled: false,
  requireTableForDineIn: true,
  requireCustomerForDelivery: true,
  actionButtonSize: "md",
  expressCheckoutEnabled: true,
  expressPayPlacement: "product_grid",
  retailCashTenderDialogEnabled: true,
  showPosToasts: false,
  retailLayoutEnabled: true,
  retailScannerFirst: true,
  retailTileSize: "lg",
  retailPaymentBar: true,
  retailClearSearchAfterAdd: true,
  retailShowStockOnTiles: false,
  retailShowProductPhotos: true,
  retailQuickTiles: [],
  retailProductSortMode: "catalog_order",
  retailRegisterProfiles: [],
};

function asNumberArray(v: unknown, fallback: number[]): number[] {
  if (!Array.isArray(v)) return fallback;
  const nums = v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0);
  return nums.length ? nums : fallback;
}

export function isRetailPosMode(raw: unknown): boolean {
  return normalizePosCheckoutSettings(raw).posMode === "retail";
}

function resolveExpressCheckoutEnabled(src: Record<string, unknown>): boolean {
  if (src.expressCheckoutEnabled !== undefined) return src.expressCheckoutEnabled !== false;
  if (src.webposExpressEnabled !== undefined) return src.webposExpressEnabled !== false;
  return true;
}

export function normalizePosCheckoutSettings(raw: unknown): PosCheckoutSettings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const presetsRaw = Array.isArray(src.discountPresets) ? src.discountPresets : null;
  const discountPresets: PosCheckoutDiscountPreset[] = presetsRaw
    ? presetsRaw
        .map((p, i) => {
          const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
          const percent = Math.max(0, Math.min(100, Number(o.percent) || 0));
          const name = String(o.name || `${percent}%`).trim().slice(0, 40) || `${percent}%`;
          const id = String(o.id || `d${i}`).trim().slice(0, 40) || `d${i}`;
          return { id, name, percent };
        })
        .slice(0, 20)
    : DEFAULT_POS_CHECKOUT.discountPresets;

  const tipPresets = asNumberArray(src.tipPresetsPercent, DEFAULT_POS_CHECKOUT.tipPresetsPercent)
    .map((n) => Math.max(0, Math.min(100, n)))
    .slice(0, 8);

  const dens = asNumberArray(src.quickCashDenominations, DEFAULT_POS_CHECKOUT.quickCashDenominations)
    .filter((n) => n > 0)
    .slice(0, 12);

  let roundingStep = Number(src.roundingStep);
  if (![0, 0.05, 0.1, 0.5, 1].includes(roundingStep)) {
    roundingStep = DEFAULT_POS_CHECKOUT.roundingStep;
  }

  const maxSplitParts = Math.max(
    2,
    Math.min(20, Number(src.maxSplitParts) || DEFAULT_POS_CHECKOUT.maxSplitParts)
  );

  const courseSendMode: CourseSendMode =
    src.courseSendMode === "send_all_once" ? "send_all_once" : "fire_per_course";

  const cartSide: CartSide = src.cartSide === "left" ? "left" : "right";
  const postSuccessTarget: PostSuccessTarget =
    src.postSuccessTarget === "tables" ? "tables" : "register";
  const posMode: PosMode = src.posMode === "retail" ? "retail" : "restaurant";
  const requireTableForDineIn =
    src.requireTableForDineIn === undefined
      ? posMode !== "retail"
      : src.requireTableForDineIn !== false;

  return {
    tipsEnabled: src.tipsEnabled !== false,
    terminalAskGratuityEnabled: src.terminalAskGratuityEnabled === true,
    tipPresetsPercent: tipPresets.length ? tipPresets : DEFAULT_POS_CHECKOUT.tipPresetsPercent,
    allowCustomTip: src.allowCustomTip !== false,
    discountsEnabled: src.discountsEnabled !== false,
    discountPresets,
    roundingStep,
    quickCashEnabled: src.quickCashEnabled !== false,
    quickCashDenominations: dens.length ? dens : DEFAULT_POS_CHECKOUT.quickCashDenominations,
    checkoutEurDisplayEnabled: src.checkoutEurDisplayEnabled === true,
    checkoutChfToEurRate: (() => {
      const raw = Number(src.checkoutChfToEurRate);
      if (!Number.isFinite(raw) || raw <= 0) return null;
      return Math.min(2, Math.round(raw * 10000) / 10000);
    })(),
    splitBillsEnabled: src.splitBillsEnabled !== false,
    maxSplitParts,
    vatIncludedInPrice: src.vatIncludedInPrice === true,
    courseSendMode,
    cartSide,
    postSuccessTarget,
    posMode,
    tablesEnabled: src.tablesEnabled !== false,
    retailTakeawayEnabled: src.retailTakeawayEnabled === true,
    retailDeliveryEnabled: src.retailDeliveryEnabled === true,
    retailDineInEnabled: src.retailDineInEnabled === true,
    requireTableForDineIn,
    requireCustomerForDelivery: src.requireCustomerForDelivery !== false,
    actionButtonSize:
      src.actionButtonSize === "sm" || src.actionButtonSize === "lg"
        ? src.actionButtonSize
        : DEFAULT_POS_CHECKOUT.actionButtonSize,
    expressCheckoutEnabled: resolveExpressCheckoutEnabled(src),
    expressPayPlacement: src.expressPayPlacement === "cart" ? "cart" : "product_grid",
    retailCashTenderDialogEnabled: src.retailCashTenderDialogEnabled !== false,
    showPosToasts: src.showPosToasts === true,
    retailLayoutEnabled:
      src.retailLayoutEnabled === undefined ? posMode === "retail" : src.retailLayoutEnabled !== false,
    retailScannerFirst: src.retailScannerFirst !== false,
    retailTileSize:
      src.retailTileSize === "sm" || src.retailTileSize === "md" || src.retailTileSize === "lg"
        ? src.retailTileSize
        : DEFAULT_POS_CHECKOUT.retailTileSize,
    retailPaymentBar: src.retailPaymentBar !== false,
    retailClearSearchAfterAdd: src.retailClearSearchAfterAdd !== false,
    retailShowStockOnTiles: src.retailShowStockOnTiles === true,
    retailShowProductPhotos: src.retailShowProductPhotos !== false,
    retailQuickTiles: Array.isArray(src.retailQuickTiles)
      ? src.retailQuickTiles.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 24)
      : [],
    retailProductSortMode:
      src.retailProductSortMode === "most_sold" ||
      src.retailProductSortMode === "alphabetical" ||
      src.retailProductSortMode === "catalog_order"
        ? src.retailProductSortMode
        : DEFAULT_POS_CHECKOUT.retailProductSortMode,
    retailRegisterProfiles: Array.isArray(src.retailRegisterProfiles)
      ? src.retailRegisterProfiles
          .map((row, i) => {
            const o = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
            return {
              id: String(o.id || `reg-${i + 1}`).trim().slice(0, 40) || `reg-${i + 1}`,
              name: String(o.name || `Register ${i + 1}`).trim().slice(0, 40) || `Register ${i + 1}`,
              cartSide: o.cartSide === "left" ? ("left" as const) : ("right" as const),
              retailTileSize: (
                o.retailTileSize === "sm" || o.retailTileSize === "md" || o.retailTileSize === "lg"
                  ? o.retailTileSize
                  : "lg"
              ) as RetailTileSize,
              retailScannerFirst: o.retailScannerFirst !== false,
              retailPaymentBar: o.retailPaymentBar !== false,
              retailShowStockOnTiles: o.retailShowStockOnTiles === true,
              retailShowProductPhotos: o.retailShowProductPhotos !== false,
              retailQuickTiles: Array.isArray(o.retailQuickTiles)
                ? o.retailQuickTiles.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 24)
                : [],
              retailProductSortMode:
                o.retailProductSortMode === "most_sold" ||
                o.retailProductSortMode === "alphabetical" ||
                o.retailProductSortMode === "catalog_order"
                  ? o.retailProductSortMode
                  : DEFAULT_POS_CHECKOUT.retailProductSortMode,
            };
          })
          .slice(0, 12)
      : [],
  };
}

/** Whether to send Adyen Terminal API AskGratuity for this payment. */
export function shouldAskGratuityOnTerminal(
  checkout: PosCheckoutSettings,
  opts?: { askGratuity?: boolean; posTipAmount?: number }
): boolean {
  const posTip = Math.round(Math.max(0, Number(opts?.posTipAmount) || 0) * 100) / 100;
  if (posTip > 0.001) return false;
  if (opts?.askGratuity === false) return false;
  if (opts?.askGratuity === true) return true;
  return checkout.terminalAskGratuityEnabled === true;
}
