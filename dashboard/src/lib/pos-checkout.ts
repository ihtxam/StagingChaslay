import { parseRetailRegisterProfiles } from './retail-register-profile';

export type PosCheckoutDiscountPreset = {
  id: string;
  name: string;
  percent: number;
};

export type CourseSendMode = 'fire_per_course' | 'send_all_once';
export type CartSide = 'left' | 'right';
export type PostSuccessTarget = 'register' | 'tables';
export type PosMode = 'restaurant' | 'retail';
export type ActionButtonSize = 'sm' | 'md' | 'lg';
export type RetailTileSize = 'sm' | 'md' | 'lg';
export type RetailProductSortMode = 'most_sold' | 'alphabetical' | 'catalog_order';

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
  vatIncludedInPrice: boolean;
  /** Kitchen course firing mode for WebPOS / POS */
  courseSendMode: CourseSendMode;
  /** WebPOS cart panel side. Default right. */
  cartSide: CartSide;
  /** After a successful payment, navigate to this WebPOS tab. */
  postSuccessTarget: PostSuccessTarget;
  /** Restaurant (tables/kitchen) vs retail (register / barcode). */
  posMode: PosMode;
  /**
   * Restaurant only: show Tables tab + Set table.
   * Fast-food / counter service can turn this off and keep kitchen + takeaway.
   */
  tablesEnabled: boolean;
  /** Retail only: show Takeaway channel (off by default). */
  retailTakeawayEnabled: boolean;
  /** Retail only: show Delivery channel (off by default). */
  retailDeliveryEnabled: boolean;
  /** Retail only: bistro-style dine-in at counter (off by default). */
  retailDineInEnabled: boolean;
  /**
   * When true, dine-in requires a table. When false, counter ticket + dine-in VAT.
   * Default: true for restaurant, false for retail.
   */
  requireTableForDineIn: boolean;
  /** Express checkout + cart action buttons (Send, Payment, Tab). */
  actionButtonSize: ActionButtonSize;
  /** Show quick Cash/Card/Terminal bar under products on WebPOS / Android register. */
  expressCheckoutEnabled: boolean;
  /** Show POS toast notifications. Off by default. */
  showPosToasts: boolean;
  /** Retail register: three-column layout (categories | products | cart). */
  retailLayoutEnabled: boolean;
  /** Retail register: auto-focus scan/search field on register view. */
  retailScannerFirst: boolean;
  /** Retail register: product tile size in the retail layout grid. */
  retailTileSize: RetailTileSize;
  /** Retail register: Cash / Card / Pay bar at bottom of cart panel. */
  retailPaymentBar: boolean;
  /** Retail register: clear search after adding a product (barcode or tap). */
  retailClearSearchAfterAdd: boolean;
  /** Retail register: show remaining stock on product tiles. */
  retailShowStockOnTiles: boolean;
  /** Retail register: show product photos on tiles (off = name-only tiles). */
  retailShowProductPhotos: boolean;
  /** Retail register: merchant-pinned SKUs shown above the grid. */
  retailQuickTiles: string[];
  /** Retail register: default product grid sort on the till. */
  retailProductSortMode: RetailProductSortMode;
  /** Named per-till layout profiles (Phase 3). */
  retailRegisterProfiles: import('./retail-register-profile').RetailRegisterProfile[];
};

export const DEFAULT_POS_CHECKOUT: PosCheckoutSettings = {
  tipsEnabled: true,
  tipPresetsPercent: [0, 5, 10, 15],
  allowCustomTip: true,
  discountsEnabled: true,
  discountPresets: [
    { id: 'none', name: 'None', percent: 0 },
    { id: 'staff', name: 'Staff', percent: 10 },
    { id: 'vip', name: 'VIP', percent: 15 },
  ],
  roundingStep: 0.05,
  quickCashEnabled: true,
  quickCashDenominations: [10, 20, 50, 100],
  splitBillsEnabled: true,
  maxSplitParts: 8,
  vatIncludedInPrice: false,
  courseSendMode: 'fire_per_course',
  cartSide: 'right',
  postSuccessTarget: 'register',
  posMode: 'restaurant',
  tablesEnabled: true,
  retailTakeawayEnabled: false,
  retailDeliveryEnabled: false,
  retailDineInEnabled: false,
  requireTableForDineIn: true,
  actionButtonSize: 'md',
  expressCheckoutEnabled: true,
  showPosToasts: false,
  retailLayoutEnabled: true,
  retailScannerFirst: true,
  retailTileSize: 'lg',
  retailPaymentBar: true,
  retailClearSearchAfterAdd: true,
  retailShowStockOnTiles: false,
  retailShowProductPhotos: true,
  retailQuickTiles: [],
  retailProductSortMode: 'catalog_order',
  retailRegisterProfiles: [],
};

export function isRetailPosMode(raw: unknown): boolean {
  return normalizePosCheckoutSettings(raw).posMode === 'retail';
}

function resolveExpressCheckoutEnabled(src: Record<string, unknown>): boolean {
  if (src.expressCheckoutEnabled !== undefined) return src.expressCheckoutEnabled !== false;
  if (src.webposExpressEnabled !== undefined) return src.webposExpressEnabled !== false;
  return true;
}

export function normalizePosCheckoutSettings(raw: unknown): PosCheckoutSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const tipPresets = Array.isArray(src.tipPresetsPercent)
    ? src.tipPresetsPercent.map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    : DEFAULT_POS_CHECKOUT.tipPresetsPercent;
  const dens = Array.isArray(src.quickCashDenominations)
    ? src.quickCashDenominations.map(Number).filter((n) => n > 0)
    : DEFAULT_POS_CHECKOUT.quickCashDenominations;
  const presets = Array.isArray(src.discountPresets)
    ? src.discountPresets.map((p, i) => {
        const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        return {
          id: String(o.id || `d${i}`),
          name: String(o.name || `${Number(o.percent) || 0}%`),
          percent: Math.max(0, Math.min(100, Number(o.percent) || 0)),
        };
      })
    : DEFAULT_POS_CHECKOUT.discountPresets;
  let roundingStep = Number(src.roundingStep);
  if (![0, 0.05, 0.1, 0.5, 1].includes(roundingStep)) roundingStep = 0.05;
  const posMode: PosMode = src.posMode === 'retail' ? 'retail' : 'restaurant';
  const requireTableForDineIn =
    src.requireTableForDineIn === undefined
      ? posMode !== 'retail'
      : src.requireTableForDineIn !== false;
  return {
    tipsEnabled: src.tipsEnabled !== false,
    tipPresetsPercent: tipPresets.length ? tipPresets : DEFAULT_POS_CHECKOUT.tipPresetsPercent,
    allowCustomTip: src.allowCustomTip !== false,
    discountsEnabled: src.discountsEnabled !== false,
    discountPresets: presets,
    roundingStep,
    quickCashEnabled: src.quickCashEnabled !== false,
    quickCashDenominations: dens.length ? dens : DEFAULT_POS_CHECKOUT.quickCashDenominations,
    splitBillsEnabled: src.splitBillsEnabled !== false,
    maxSplitParts: Math.max(2, Math.min(20, Number(src.maxSplitParts) || 8)),
    vatIncludedInPrice: src.vatIncludedInPrice === true,
    courseSendMode: src.courseSendMode === 'send_all_once' ? 'send_all_once' : 'fire_per_course',
    cartSide: src.cartSide === 'left' ? 'left' : 'right',
    postSuccessTarget: src.postSuccessTarget === 'tables' ? 'tables' : 'register',
    posMode,
    tablesEnabled: src.tablesEnabled !== false,
    retailTakeawayEnabled: src.retailTakeawayEnabled === true,
    retailDeliveryEnabled: src.retailDeliveryEnabled === true,
    retailDineInEnabled: src.retailDineInEnabled === true,
    requireTableForDineIn,
    actionButtonSize:
      src.actionButtonSize === 'sm' || src.actionButtonSize === 'lg'
        ? src.actionButtonSize
        : DEFAULT_POS_CHECKOUT.actionButtonSize,
    expressCheckoutEnabled: resolveExpressCheckoutEnabled(src),
    showPosToasts: src.showPosToasts === true,
    retailLayoutEnabled:
      src.retailLayoutEnabled === undefined ? posMode === 'retail' : src.retailLayoutEnabled !== false,
    retailScannerFirst: src.retailScannerFirst !== false,
    retailTileSize:
      src.retailTileSize === 'sm' || src.retailTileSize === 'md' || src.retailTileSize === 'lg'
        ? src.retailTileSize
        : DEFAULT_POS_CHECKOUT.retailTileSize,
    retailPaymentBar: src.retailPaymentBar !== false,
    retailClearSearchAfterAdd: src.retailClearSearchAfterAdd !== false,
    retailShowStockOnTiles: src.retailShowStockOnTiles === true,
    retailShowProductPhotos: src.retailShowProductPhotos !== false,
    retailQuickTiles: Array.isArray(src.retailQuickTiles)
      ? src.retailQuickTiles.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 24)
      : [],
    retailProductSortMode:
      src.retailProductSortMode === 'most_sold' ||
      src.retailProductSortMode === 'alphabetical' ||
      src.retailProductSortMode === 'catalog_order'
        ? src.retailProductSortMode
        : DEFAULT_POS_CHECKOUT.retailProductSortMode,
    retailRegisterProfiles: parseRetailRegisterProfiles(src.retailRegisterProfiles),
  };
}
