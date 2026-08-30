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
  /** Show quick Cash/Card/Terminal bar under products on WebPOS register. */
  expressCheckoutEnabled: boolean;
};

export const DEFAULT_POS_CHECKOUT: PosCheckoutSettings = {
  tipsEnabled: true,
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
  actionButtonSize: "md",
  expressCheckoutEnabled: true,
};

function asNumberArray(v: unknown, fallback: number[]): number[] {
  if (!Array.isArray(v)) return fallback;
  const nums = v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0);
  return nums.length ? nums : fallback;
}

export function isRetailPosMode(raw: unknown): boolean {
  return normalizePosCheckoutSettings(raw).posMode === "retail";
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
    tipPresetsPercent: tipPresets.length ? tipPresets : DEFAULT_POS_CHECKOUT.tipPresetsPercent,
    allowCustomTip: src.allowCustomTip !== false,
    discountsEnabled: src.discountsEnabled !== false,
    discountPresets,
    roundingStep,
    quickCashEnabled: src.quickCashEnabled !== false,
    quickCashDenominations: dens.length ? dens : DEFAULT_POS_CHECKOUT.quickCashDenominations,
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
    actionButtonSize:
      src.actionButtonSize === "sm" || src.actionButtonSize === "lg"
        ? src.actionButtonSize
        : DEFAULT_POS_CHECKOUT.actionButtonSize,
    expressCheckoutEnabled: src.expressCheckoutEnabled !== false,
  };
}
