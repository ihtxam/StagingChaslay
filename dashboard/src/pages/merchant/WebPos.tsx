import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { repairCatalogText } from '@/lib/text-encoding';
import { useI18n } from '@/lib/i18n';
import { roundMoney2, roundTo005, roundingAdjustment, computeMerchandiseTotals, scaleLinesByFactor, extractVatFromGross, resolvePosTaxRate } from '@/lib/money';
import { APP_NAME } from '@/lib/brand';
import {
  buildKitchenPrintJobs,
  buildKitchenTicketItemFromLine,
  generateKitchenTicketEscPos,
  generateKitchenTicketText,
  generateKitchenMessageTicketEscPos,
  generateKitchenMessageTicketText,
  resolveKitchenPaperWidthMm,
  generateWebPosReceiptText,
  generateGiftCardSaleReceiptText,
  giftCardSaleReceiptEscPos,
  computeGiftCardSaleVat,
  logoUrlToEscPos,
  encodeOrderMetaNotes,
  nextWebPosTicketNumber,
  nextDineInCounterNumber,
  printersForRole,
  resolveReceiptLanguage,
  buildReceiptEscPos,
  uint8ToBase64,
  posOrderToWebPosReceipt,
  deliveryDirectionsUrlForReceipt,
  generateEodReportText,
  generateShiftReportText,
  type PosOrderForReceipt,
  type PosPrintSettingsClient,
  type WebPosReceipt,
} from '@/lib/webpos-receipt';
import {
  normalizeAdyenTerminalReceipt,
  type AdyenTerminalReceipt,
} from '@/lib/adyen-receipt';
import {
  normalizePosCheckoutSettings,
  type PosCheckoutSettings,
} from '@/lib/pos-checkout';
import WebPosFulfillmentModal, {
  type FulfillmentWhen,
} from '@/components/WebPosFulfillmentModal';
import WebPosCustomerPicker, {
  type WebPosCustomer,
} from '@/components/WebPosCustomerPicker';
import WebPosCheckoutModal, {
  type CheckoutResult,
} from '@/components/WebPosCheckoutModal';
import WebPosSplitBillModal, {
  type SplitPart,
} from '@/components/WebPosSplitBillModal';
import { localDateTimeToIso, type StoreHours } from '@/lib/shop-hours';
import {
  browserPrintText,
  isPrintAgentAvailable,
  isUnsuitableRawPrinter,
  listAgentPrinters,
  printViaAgent,
  unsuitableRawPrinterMessage,
  type AgentPrinter,
} from '@/lib/print-agent';
import {
  printViaAgentOrQueue,
  processPendingEscPosPrintJobs,
} from '@/lib/webpos-print-relay';
import { buildReceiptUrl, resolvePublishedReceiptRef, normalizeScannedPayload, parseTableQrPayload } from '@/lib/qr';
import WebPosMembershipSellModal from '@/components/webpos/WebPosMembershipSellModal';
import { membershipDiscountPercent } from '@/lib/membership-plans';
import type { MembershipPlan } from '@/lib/membership-plans';
import {
  lineSignature,
  type ShopComboSelection,
  type ShopSelectedExtra,
} from '@/lib/shop-cart';
import WebPosProductModifiersModal, {
  productHasModifiers,
  type ShopModifierGroup,
  type ShopProductForModifiers,
} from '@/components/webpos/WebPosProductModifiersModal';
import WebPosComboModal, {
  productHasComboSlots,
  type ComboSlot,
  type ShopComboProduct,
} from '@/components/webpos/WebPosComboModal';
import WebPosPaymentModal, { type WebPosPaymentPhase } from '@/components/WebPosPaymentModal';
import WebPosPinModal from '@/components/WebPosPinModal';
import WebPosOrdersPanel from '@/components/WebPosOrdersPanel';
import WebPosTipKeypad from '@/components/WebPosTipKeypad';
import WebPosWeightModal from '@/components/webpos/WebPosWeightModal';
import WebPosCustomAmountModal from '@/components/webpos/WebPosCustomAmountModal';
import WebPosOnlineOrdersPanel, {
  type OnlineOrder,
} from '@/components/WebPosOnlineOrdersPanel';
import WebPosNewOrderAlertModal from '@/components/webpos/WebPosNewOrderAlertModal';
import WebPosRejectOrderModal from '@/components/webpos/WebPosRejectOrderModal';
import WebPosTopBar, {
  WebPosSettingsDropdown,
  WEBPOS_COLOR_THEMES,
  WEBPOS_TEXT_SIZES,
  enterWebPosFullscreenOnLoad,
  type WebPosColorTheme,
  type WebPosTextSize,
} from '@/components/webpos/WebPosTopBar';

const WEBPOS_TEXT_SIZE_KEY = 'webpos_text_size';
const WEBPOS_APPEARANCE_KEY = 'webpos_appearance';
const WEBPOS_GRID_SHOW_IMAGES_KEY = 'webpos.grid.showImages';
const WEBPOS_GRID_TILE_SIZE_KEY = 'webpos.grid.tileSize';
const WEBPOS_GRID_SORT_KEY = 'webpos.grid.sort';

export type WebPosAppearance = 'light' | 'night';

function readStoredTextSize(): WebPosTextSize {
  try {
    const v = localStorage.getItem(WEBPOS_TEXT_SIZE_KEY);
    if (v && (WEBPOS_TEXT_SIZES as string[]).includes(v)) return v as WebPosTextSize;
  } catch {
    /* ignore */
  }
  return 'md';
}

function readStoredAppearance(): WebPosAppearance {
  try {
    const v = localStorage.getItem(WEBPOS_APPEARANCE_KEY);
    if (v === 'night' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

function readStoredGridShowImages(): boolean {
  try {
    return localStorage.getItem(WEBPOS_GRID_SHOW_IMAGES_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredGridTileSize(): 'sm' | 'md' | 'lg' {
  try {
    const v = localStorage.getItem(WEBPOS_GRID_TILE_SIZE_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore */
  }
  return 'md';
}

function readStoredGridSort(): 'default' | 'alpha' | 'bestseller' {
  try {
    const v = localStorage.getItem(WEBPOS_GRID_SORT_KEY);
    if (v === 'alpha' || v === 'bestseller' || v === 'default') return v;
  } catch {
    /* ignore */
  }
  return 'default';
}

function blurPosInputs() {
  const el = document.activeElement;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    el.blur();
  }
}
import {
  clearPersistedWebPosCarts,
  draftsMapToRecord,
  loadPersistedWebPosCarts,
  recordToDraftsMap,
  savePersistedWebPosCarts,
  type PersistedWebPosCarts,
} from '@/lib/webpos-cart-persist';
import {
  canCompleteSaleOffline,
  cartHasOfflineUnsafeLines,
  enqueueOutboxSale,
  flushOfflineOutbox,
  isBrowserOnline,
  isNetworkError,
  WEBPOS_CATALOG_FETCH_TIMEOUT_MS,
  isWebPosCurrentlyOffline,
  isWebPosOfflineEnabled,
  loadWebPosOfflineSnapshot,
  onOfflineSaleSynced,
  saveWebPosOfflineSnapshot,
  startOfflineSyncEngine,
  subscribeOfflineSync,
  type OfflineSyncState,
} from '@/lib/webpos-offline';
import {
  WebPosStartShiftModal,
  WebPosCloseShiftModal,
  WebPosShiftClosedModal,
} from '@/components/webpos/WebPosShiftModals';
import WebPosCashMovementModal from '@/components/webpos/WebPosCashMovementModal';
import {
  EodIncludeProductsCheckbox,
  useEodIncludeProductsSold,
} from '@/components/EodIncludeProductsCheckbox';
import { printRefundReceipt } from '@/lib/print-order-receipt';
import WebPosCartPanel from '@/components/webpos/WebPosCartPanel';
import WebPosProductArea, {
  type ProductGridSort,
  type ProductGridTileSize,
} from '@/components/webpos/WebPosProductArea';
import WebPosCheckoutView from '@/components/webpos/WebPosCheckoutView';
import WebPosSuccessView from '@/components/webpos/WebPosSuccessView';
import WebPosSendReceiptModal from '@/components/webpos/WebPosSendReceiptModal';
import WebPosPrintChooserModal from '@/components/webpos/WebPosPrintChooserModal';
import WebPosTablesView from '@/components/webpos/WebPosTablesView';
import WebPosBookingsView from '@/components/webpos/WebPosBookingsView';
import WebPosKitchenMessageModal from '@/components/webpos/WebPosKitchenMessageModal';
import WebPosOrderNoteModal from '@/components/webpos/WebPosOrderNoteModal';
import WebPosSetTableModal from '@/components/webpos/WebPosSetTableModal';
import WebPosSetTabModal from '@/components/webpos/WebPosSetTabModal';
import WebPosCancelModal, {
  type CancelScope,
} from '@/components/webpos/WebPosCancelModal';
import WebPosLicenseGate, {
  type WebPosEntitlement,
} from '@/components/webpos/WebPosLicenseGate';
import WebPosGiftCardModal, {
  type GiftCardCartMeta,
  type GiftCardPayResult,
  type GiftCardSettingsClient,
} from '@/components/webpos/WebPosGiftCardModal';
import {
  computeCashDiscount,
  computeEarnPoints,
  maxRedeemablePoints,
  normalizeRfidUid,
  REDEEM_THRESHOLD_POINTS,
  type AttachedMembership,
} from '@/lib/loyalty-math';
import type { AppliedPayment } from '@/components/webpos/WebPosCheckoutView';
import {
  collectPaymentAction,
  customerFromOrder,
  orderItemsToCartLines,
} from '@/lib/order-to-cart';
import type { MerchantOrder } from '@/lib/order-management';

type SplitReceiptPart = {
  id: string;
  label: string;
  text: string;
  url?: string;
  deliveryQrUrl?: string;
  amount: number;
  orderNumber?: string;
};

type CollectOrderRef = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  returnView: 'orders' | 'register';
};
import type {
  BillDiscount,
  GiftCardLineMeta,
  KeypadMode,
  OpenCartDraft,
  PosCategoryId,
  PosChannel,
  PosTab,
  PosView,
} from '@/components/webpos/types';
import { openCartDraftKey, POS_GIFT_CARDS_CATEGORY, POS_MOST_SOLD_CATEGORY } from '@/components/webpos/types';
import {
  applyBillDiscountToTotals,
  merchandiseBase,
  resolveBillDiscountAmount,
} from '@/lib/webpos-bill-discount';
import {
  playOrderAlertOnce,
  startOrderAlertLoop,
  startOrderAlertForDuration,
  stopOrderAlertLoop,
} from '@/lib/order-alert';
import {
  getEffectivePanelAccess,
  hasPermission,
  clearWebPosStaffSession,
  loadWebPosStaffSession,
  resolveWebPosStaffSession,
  saveWebPosStaffSession,
  type Permission,
  type StaffRosterRow,
  type WebPosStaffSession,
} from '@/lib/permissions';
import { useAuthStore } from '@/store/auth';
import { openCashDrawerViaAgent } from '@/lib/print-agent';

type Channel = PosChannel;

type Product = {
  id: string;
  name: string;
  price: number | string;
  categoryId?: string | null;
  isTaxable?: boolean;
  isOpenPrice?: boolean;
  soldByWeight?: boolean;
  weightUnit?: string | null;
  stock?: number;
  productType?: string;
  sku?: string | null;
  barcode?: string | null;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: ShopModifierGroup[];
  comboSlots?: ComboSlot[];
};

type Category = { id: string; name: string; color?: string | null };

type CartLine = {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxable: boolean;
  categoryId?: string | null;
  selectedExtras: ShopSelectedExtra[];
  comboSelections: ShopComboSelection[];
  isOpenPrice?: boolean;
  /** Sold by weight: quantity = kg, unitPrice = CHF/kg */
  isWeighed?: boolean;
  weightKg?: number;
  courseNumber?: number;
  lineDiscountPercent?: number;
  sentToKitchen?: boolean;
  sentToKitchenAt?: number;
  lineNote?: string;
  giftCard?: GiftCardLineMeta;
};

function lineExtrasLabel(l: CartLine) {
  const parts: string[] = [];
  if (l.comboSelections.length) {
    parts.push(
      ...l.comboSelections.map((c) => {
        const productName = repairCatalogText(c.productName || '');
        const extras = (c.selectedExtras || []).map((e) => repairCatalogText(e.name || ''));
        return extras.length ? `${productName} (${extras.join(', ')})` : productName;
      })
    );
  }
  if (!l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => repairCatalogText(e.name || '')));
  } else if (l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => repairCatalogText(e.name || '')));
  }
  return parts.join(', ');
}

/** Kitchen delta only — skip lines already fired via Send / tab draft. */
function unsentKitchenLines(lines: CartLine[]): CartLine[] {
  return lines.filter((l) => !l.sentToKitchen);
}

type SaleRecord = {
  id: string;
  orderNumber?: string;
  backendOrderId?: string;
  total: number;
  paymentMethod: string;
  channel: Channel;
  completedAt: number;
  synced: boolean;
};

type PosPaymentMethod = 'cash' | 'card' | 'terminal' | 'pay_later' | 'gift_card';

type WebPosTerminal = {
  id: string;
  terminalId: string;
  terminalName: string | null;
  status: string;
};

type WebPosPaymentConfig = {
  methods: {
    express: boolean;
    cash: boolean;
    card: boolean;
    terminal: boolean;
    giftCard?: boolean;
  };
  terminalReady: boolean;
  adyenConfigured: boolean;
  defaultTerminalId: string | null;
  terminals: WebPosTerminal[];
  posPrintSettings?: PosPrintSettingsClient | null;
  posCheckoutSettings?: PosCheckoutSettings | null;
  giftCardSettings?: GiftCardSettingsClient | null;
  shopLogoUrl?: string | null;
  panelLanguage?: string | null;
  shiftsEnabled?: boolean;
  posColorTheme?: string;
  coursesEnabled?: boolean;
  /** null/undefined = legacy full access */
  editionFeatures?: string[] | null;
};

type CheckoutExtras = CheckoutResult;

type TablePickerPurpose = 'set' | 'move_table' | 'move_dish';

function money(n: number) {
  return `CHF ${n.toFixed(2)}`;
}

function mergeBillDiscounts(
  source?: BillDiscount | null,
  target?: BillDiscount | null
): BillDiscount {
  const empty: BillDiscount = { percent: 0, amount: 0 };
  const src = source || empty;
  const tgt = target || empty;
  const srcHas = src.percent > 0 || src.amount > 0;
  const tgtHas = tgt.percent > 0 || tgt.amount > 0;
  if (!srcHas) return { percent: tgt.percent, amount: tgt.amount };
  if (!tgtHas) return { percent: src.percent, amount: src.amount };
  if (src.percent > 0 || tgt.percent > 0) {
    return { percent: Math.max(src.percent, tgt.percent), amount: 0 };
  }
  return { percent: 0, amount: roundMoney2(src.amount + tgt.amount) };
}

export default function WebPos({ appMode = true }: { appMode?: boolean }) {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  const authUser = useAuthStore((s) => s.user);
  /** One-time hydrate from sessionStorage so refresh keeps an open cart. */
  const bootCartRef = useRef<PersistedWebPosCarts | null | undefined>(undefined);
  if (bootCartRef.current === undefined) {
    bootCartRef.current = loadPersistedWebPosCarts();
  }
  const bootCart = bootCartRef.current;
  const bootActive = bootCart?.active || null;

  const [loading, setLoading] = useState(true);
  const [entitlement, setEntitlement] = useState<WebPosEntitlement | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bestsellerIds, setBestsellerIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<PosCategoryId>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>(() => bootActive?.cart || []);
  const [channel, setChannel] = useState<Channel | null>(() => bootActive?.channel ?? 'takeaway');
  const effectiveChannel: Channel = channel ?? 'takeaway';
  const [posTab, setPosTab] = useState<PosTab>('register');
  const [posView, setPosView] = useState<PosView>('register');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(
    () => bootActive?.selectedLineId ?? null
  );
  const [keypadMode, setKeypadMode] = useState<KeypadMode>('qty');
  const [keypadBuffer, setKeypadBuffer] = useState(() => bootActive?.keypadBuffer || '');
  const [activeCourse, setActiveCourse] = useState(() => bootActive?.activeCourse || 1);
  const [orderSent, setOrderSent] = useState(() => !!bootActive?.orderSent);
  const [coursesBulkSent, setCoursesBulkSent] = useState(() => !!bootActive?.coursesBulkSent);
  const [orderNote, setOrderNote] = useState(() => bootActive?.orderNote || '');
  const [tableId, setTableId] = useState<string | null>(() => bootActive?.tableId ?? null);
  const [tableLabel, setTableLabel] = useState<string | null>(() => bootActive?.tableLabel ?? null);
  const [tabNumber, setTabNumber] = useState<string | null>(() => bootActive?.tabNumber ?? null);
  /** Stable arbitrary kitchen/takeaway # + opaque receipt id for the open cart. */
  const [ticketDisplay, setTicketDisplay] = useState<string | null>(
    () => bootActive?.ticketDisplay ?? null
  );
  const [ticketOrderNumber, setTicketOrderNumber] = useState<string | null>(
    () => bootActive?.ticketOrderNumber ?? null
  );
  const [expressSuccessOpen, setExpressSuccessOpen] = useState(false);
  const [shiftsEnabled, setShiftsEnabled] = useState(false);
  const [posColorTheme, setPosColorTheme] = useState<WebPosColorTheme>('teal');
  const [posTextSize, setPosTextSize] = useState<WebPosTextSize>(() => readStoredTextSize());
  const [posAppearance, setPosAppearance] = useState<WebPosAppearance>(() => readStoredAppearance());
  const [gridShowImages, setGridShowImages] = useState(() => readStoredGridShowImages());
  const [gridTileSize, setGridTileSize] = useState<ProductGridTileSize>(() => readStoredGridTileSize());
  const [gridSort, setGridSort] = useState<ProductGridSort>(() => readStoredGridSort());
  const [openShift, setOpenShift] = useState<{
    id: string;
    openingCash: number;
    openedAt: string;
  } | null>(null);
  const [shiftLive, setShiftLive] = useState<{
    cashSales: number;
    cashIn?: number;
    cashOut?: number;
    cardSales: number;
    terminalSales: number;
    totalSales: number;
    orderCount: number;
    expectedCash: number;
  } | null>(null);
  const [startShiftOpen, setStartShiftOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [cashMovementOpen, setCashMovementOpen] = useState(false);
  const [shiftClosedOpen, setShiftClosedOpen] = useState(false);
  const [shiftBalanced, setShiftBalanced] = useState(true);
  const [shiftBusy, setShiftBusy] = useState(false);
  const pendingAfterShift = useRef<(() => void) | null>(null);
  const [lastClosedShift, setLastClosedShift] = useState<{
    openingCash: number;
    closingCashCounted: number;
    expectedCash: number;
    cashSales: number;
    cardSales: number;
    terminalSales: number;
    otherSales: number;
    orderCount: number;
    variance: number | null;
    reportPeriod: { from: string; to: string };
  } | null>(null);
  const [kitchenMsgOpen, setKitchenMsgOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [setTableOpen, setSetTableOpen] = useState(false);
  const [tablePickerPurpose, setTablePickerPurpose] = useState<TablePickerPurpose>('set');
  const [moveSourceTable, setMoveSourceTable] = useState<{ id: string; label: string } | null>(
    null
  );
  const [moveLineId, setMoveLineId] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ id: string; label: string } | null>(null);
  const [billDiscount, setBillDiscount] = useState<BillDiscount>(
    () => bootActive?.billDiscount || { percent: 0, amount: 0 }
  );
  const [billDiscountOpen, setBillDiscountOpen] = useState(false);
  const [setTabOpen, setSetTabOpen] = useState(false);
  const [newOrderConfirmOpen, setNewOrderConfirmOpen] = useState(false);
  const resumedHeldIdRef = useRef<string | null>(null);
  const [postSuccessTarget, setPostSuccessTarget] = useState<'register' | 'tables'>(() => {
    const stored = localStorage.getItem('manupos_webpos_post_success');
    return stored === 'tables' || stored === 'register' ? stored : 'register';
  });
  const [successInfo, setSuccessInfo] = useState<{ amount: number; changeDue: number | null } | null>(
    null
  );
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [paymentConfig, setPaymentConfig] = useState<WebPosPaymentConfig | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<WebPosPaymentPhase>('processing');
  const [paymentMessage, setPaymentMessage] = useState('');
  const paymentAbortRef = useRef<AbortController | null>(null);
  const terminalPaymentRef = useRef<{
    reference: string;
    poiTransactionTimestamp: string;
    customerReceipt?: AdyenTerminalReceipt | null;
    cashierReceipt?: AdyenTerminalReceipt | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [agentOk, setAgentOk] = useState(false);
  const [offlineSync, setOfflineSync] = useState<OfflineSyncState>({
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    syncing: false,
    pendingCount: 0,
    failedCount: 0,
    lastSyncAt: null,
    lastError: null,
    catalogCachedAt: null,
  });
  const [loadedFromOfflineCache, setLoadedFromOfflineCache] = useState(false);
  const [printers, setPrinters] = useState<AgentPrinter[]>([]);
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('manupos_webpos_printer') || '');
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('manupos_webpos_autoprint') !== '0');
  const [lastReceipt, setLastReceipt] = useState<string>('');
  const [lastReceiptUrl, setLastReceiptUrl] = useState<string>('');
  const [lastDeliveryQrUrl, setLastDeliveryQrUrl] = useState<string>('');
  const [lastReceiptOrderId, setLastReceiptOrderId] = useState<string>('');
  const [lastReceiptOrderNumber, setLastReceiptOrderNumber] = useState<string>('');
  const [lastSplitReceipts, setLastSplitReceipts] = useState<SplitReceiptPart[]>([]);
  const splitReceiptsRef = useRef<SplitReceiptPart[]>([]);
  /** Cache receipt logo ESC/POS so checkout print is not waiting on image decode. */
  const logoEscPosCacheRef = useRef<{ key: string; bytes: Uint8Array | null } | null>(null);
  const [sendReceiptOpen, setSendReceiptOpen] = useState(false);
  const [sendReceiptBusy, setSendReceiptBusy] = useState(false);
  const [sendReceiptPrefillEmail, setSendReceiptPrefillEmail] = useState('');
  const [printChooserOpen, setPrintChooserOpen] = useState(false);
  const [printChooserBusy, setPrintChooserBusy] = useState(false);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const [tablesRefreshToken, setTablesRefreshToken] = useState(0);
  const [heldTableIds, setHeldTableIds] = useState<string[]>([]);
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  const [ordersChannelPref, setOrdersChannelPref] = useState<'online' | null>(null);
  const [collectOrderRef, setCollectOrderRef] = useState<CollectOrderRef | null>(null);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const knownOnlineIdsRef = useRef<Set<string> | null>(null);
  const unactionedOrderIdsRef = useRef<Set<string>>(new Set());
  const [unactionedOrderCount, setUnactionedOrderCount] = useState(0);
  const [newOrderAlertQueue, setNewOrderAlertQueue] = useState<OnlineOrder[]>([]);
  const [alertRejectOrder, setAlertRejectOrder] = useState<OnlineOrder | null>(null);
  const [alertActionBusy, setAlertActionBusy] = useState(false);
  const knownReservationIdsRef = useRef<Set<string> | null>(null);
  const onlinePanelOpenRef = useRef(false);
  const [reservationPendingCount, setReservationPendingCount] = useState(0);
  const [reservationAlertUntil, setReservationAlertUntil] = useState(0);
  const splitMasterIdRef = useRef<string | null>(null);
  const [fulfillmentWhen, setFulfillmentWhen] = useState<FulfillmentWhen | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<WebPosCustomer | null>(() => {
    const c = bootCart?.customer;
    if (!c?.id) return null;
    return c as WebPosCustomer;
  });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [provisionalPrinted, setProvisionalPrinted] = useState(false);
  const [cancelModal, setCancelModal] = useState<{
    scope: CancelScope;
    lineId?: string;
  } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSeedMethod, setCheckoutSeedMethod] = useState<
    PosPaymentMethod | 'express'
  >('cash');
  const [checkoutExtras, setCheckoutExtras] = useState<CheckoutExtras | null>(null);
  const [giftCardOpsOpen, setGiftCardOpsOpen] = useState(false);
  const [membershipSellOpen, setMembershipSellOpen] = useState(false);
  const [giftCardPayOpen, setGiftCardPayOpen] = useState(false);
  const [giftCardPayDue, setGiftCardPayDue] = useState(0);
  const [giftPayInject, setGiftPayInject] = useState<AppliedPayment | null>(null);
  const [attachedMembership, setAttachedMembership] = useState<AttachedMembership | null>(null);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [payWithPoints, setPayWithPoints] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitQueue, setSplitQueue] = useState<SplitPart[]>([]);
  const [splitIndex, setSplitIndex] = useState(0);
  const [pendingPayMethod, setPendingPayMethod] = useState<PosPaymentMethod | 'express' | null>(
    null
  );
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [pendingCombo, setPendingCombo] = useState<ShopComboProduct | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [pendingOpenPrice, setPendingOpenPrice] = useState<Product | null>(null);
  const [pendingWeighed, setPendingWeighed] = useState<Product | null>(null);
  const [customAmountOpen, setCustomAmountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(() => {
    const hasItems = (bootActive?.cart?.length || 0) > 0 || !!bootActive?.orderSent;
    return !!(bootCart?.mobileCartOpen && hasItems);
  });
  /** true below Tailwind lg (1024px) — drives Odoo mobile register (not CSS-only). */
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(min-width: 1024px)').matches;
  });
  const [recentOpen, setRecentOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'gate' | 'switch'>('gate');
  const [webposStaff, setWebposStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [staffConfigured, setStaffConfigured] = useState(false);
  const [staffRoster, setStaffRoster] = useState<StaffRosterRow[]>([]);
  const [panelStaff, setPanelStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [eodPickerOpen, setEodPickerOpen] = useState(false);
  const [eodIncludeProductsSold, setEodIncludeProductsSold] = useEodIncludeProductsSold();
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<number | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  /** Open carts keyed by table / tab / channel (also mirrored to sessionStorage). */
  const openCartDraftsRef = useRef<Map<string, OpenCartDraft>>(
    recordToDraftsMap(bootCart?.drafts)
  );
  const [draftVersion, setDraftVersion] = useState(0);
  const cartPersistReadyRef = useRef(false);
  const draftTableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [key, draft] of openCartDraftsRef.current.entries()) {
      if (!key.startsWith('table:')) continue;
      const occupied =
        draft.cart.length > 0 ||
        draft.orderSent ||
        draft.cart.some((l) => l.sentToKitchen);
      if (occupied) ids.add(key.slice(6));
    }
    for (const id of heldTableIds) ids.add(id);
    return [...ids];
  }, [draftVersion, heldTableIds]);

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.quantity, 0), [cart]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get('/merchant/pos/held');
        const ids = new Set<string>();
        for (const h of (res.data?.held || []) as Array<{ cartJson?: Record<string, unknown> | null }>) {
          const cj = h.cartJson;
          if (!cj || typeof cj !== 'object') continue;
          if (typeof cj.tableId === 'string' && cj.tableId) ids.add(cj.tableId);
        }
        if (!cancelled) setHeldTableIds([...ids]);
      } catch {
        if (!cancelled) setHeldTableIds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ordersRefreshToken, tablesRefreshToken, draftVersion]);

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of cart) {
      map.set(l.productId, (map.get(l.productId) || 0) + l.quantity);
    }
    return map;
  }, [cart]);

  /** Table or tab assigned → footer shows Send (not Set table / Set tab). */
  const hideTab = !!tableLabel || !!tabNumber;
  // Waiter / staff phone: USE_WEBPOS PIN gate works on mobile Safari; kitchen + receipt
  // print still goes through the print agent / main till printers (not the phone).
  const pinGateRequired =
    staffConfigured &&
    !webposStaff &&
    !(isWebPosCurrentlyOffline() && loadedFromOfflineCache);

  const applyStaffRoster = useCallback(
    (staffList: StaffRosterRow[], opts?: { openPinGate?: boolean }) => {
      const hasPins = staffList.some(
        (s) => !!(s as { pinSet?: boolean }).pinSet && s.isActive !== false
      );
      setStaffConfigured(hasPins);
      setPanelStaff(
        staffList
          .filter((s) => s.isActive !== false)
          .map((s) => ({ id: s.id, name: s.name }))
      );
      const session = resolveWebPosStaffSession({
        staffList,
        authStaffId: authUser?.staffId,
        authRole: authUser?.role,
        authPermissions: authUser?.permissions,
      });
      setWebposStaff(session);
      if (session) {
        window.dispatchEvent(new CustomEvent('webpos:staff-session'));
      }
      const shouldOpenPinGate =
        opts?.openPinGate !== false && hasPins && !session && authUser?.role !== 'staff';
      if (shouldOpenPinGate) {
        setPinModalMode('gate');
        setPinModalOpen(true);
      }
    },
    [authUser?.staffId, authUser?.role, authUser?.permissions]
  );

  useEffect(() => {
    if (!staffRoster.length) return;
    applyStaffRoster(staffRoster, { openPinGate: false });
  }, [staffRoster, applyStaffRoster]);

  useEffect(() => {
    localStorage.setItem('manupos_webpos_post_success', postSuccessTarget);
  }, [postSuccessTarget]);

  /** Persist open cart so refresh keeps items and returns to the cart page. */
  useEffect(() => {
    // Skip the very first paint so we don't race boot hydration with an empty write.
    if (!cartPersistReadyRef.current) {
      cartPersistReadyRef.current = true;
      return;
    }
    const active: OpenCartDraft = {
      cart,
      channel,
      tableId,
      tableLabel,
      tabNumber,
      ticketDisplay,
      ticketOrderNumber,
      orderNote,
      activeCourse,
      orderSent,
      coursesBulkSent,
      selectedLineId,
      keypadBuffer,
      billDiscount,
    };
    const key = openCartDraftKey({ tableId, tabNumber, channel });
    if (draftOccupiesTable(active)) {
      openCartDraftsRef.current.set(key, active);
    } else {
      openCartDraftsRef.current.delete(key);
      setDraftVersion((n) => n + 1);
    }
    savePersistedWebPosCarts({
      drafts: draftsMapToRecord(openCartDraftsRef.current),
      active: draftOccupiesTable(active) ? active : null,
      mobileCartOpen,
      customer: selectedCustomer
        ? {
            id: selectedCustomer.id,
            firstName: selectedCustomer.firstName,
            lastName: selectedCustomer.lastName,
            phone: selectedCustomer.phone,
            email: selectedCustomer.email,
            defaultAddress: selectedCustomer.defaultAddress,
            defaultZip: selectedCustomer.defaultZip,
            defaultCity: selectedCustomer.defaultCity,
          }
        : null,
    });
  }, [
    cart,
    channel,
    tableId,
    tableLabel,
    tabNumber,
    ticketDisplay,
    ticketOrderNumber,
    orderNote,
    activeCourse,
    orderSent,
    coursesBulkSent,
    selectedLineId,
    keypadBuffer,
    billDiscount,
    mobileCartOpen,
    selectedCustomer,
  ]);

  /** Mobile cart page is phone-only; restore side-cart layout from lg (1024px) up. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      const lgUp = mq.matches;
      setIsNarrowViewport(!lgUp);
      if (lgUp) setMobileCartOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = () => setSettingsOpen(false);
    const onDoc = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof Node && settingsRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onDoc, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('orientationchange', close);
    return () => {
      document.removeEventListener('pointerdown', onDoc, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('orientationchange', close);
    };
  }, [settingsOpen]);

  const showPanelMenus = useCallback(() => {
    const jwtIsOwner = authUser?.role === 'merchant' && authUser?.isOwner !== false;
    if (jwtIsOwner) {
      window.dispatchEvent(new CustomEvent('webpos:show-panel'));
      return;
    }
    const access = getEffectivePanelAccess({
      jwtPermissions: authUser?.permissions as Permission[] | undefined,
      isOwner: false,
      staffConfigured,
      pinSession: webposStaff,
    });
    // When PINs are configured, only staff with ACCESS_PANEL may leave WebPOS chrome.
    if (staffConfigured && !access.canOpenPanel) {
      toast.error(t('webPosPanelDenied'));
      return;
    }
    window.dispatchEvent(new CustomEvent('webpos:show-panel'));
  }, [authUser?.role, authUser?.isOwner, authUser?.permissions, staffConfigured, webposStaff, t]);

  const enterPosApp = useCallback(() => {
    window.dispatchEvent(new CustomEvent('webpos:enter-app'));
  }, []);

  useEffect(() => {
    if (loading || pinGateRequired) return;
    void enterWebPosFullscreenOnLoad();
  }, [loading, pinGateRequired]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingWeighed) {
        e.preventDefault();
        setPendingWeighed(null);
        return;
      }
      if (pendingProduct) {
        e.preventDefault();
        setPendingProduct(null);
        return;
      }
      if (pendingCombo) {
        e.preventDefault();
        setPendingCombo(null);
        return;
      }
      if (settingsOpen) {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }
      if (mobileCartOpen) {
        e.preventDefault();
        setMobileCartOpen(false);
        return;
      }
      if (appMode) {
        e.preventDefault();
        showPanelMenus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    appMode,
    pendingWeighed,
    pendingProduct,
    pendingCombo,
    settingsOpen,
    mobileCartOpen,
    showPanelMenus,
  ]);

  const taxRate = useMemo(() => {
    if (!merchant) return 8.1;
    const vat = merchant.vatRate;
    const ch = effectiveChannel;
    if (ch === 'dine_in') return resolvePosTaxRate(merchant.taxDineInRate, vat, 8.1);
    if (ch === 'delivery') {
      const delivery = resolvePosTaxRate(merchant.taxDeliveryRate, null, 0);
      if (delivery > 0) return delivery;
      return resolvePosTaxRate(merchant.taxTakeawayRate, vat, 2.6);
    }
    return resolvePosTaxRate(merchant.taxTakeawayRate, vat, 2.6);
  }, [merchant, effectiveChannel]);

  /** Menu prices include VAT (gross); prices are not tax-exclusive. */
  const vatIncludedInPrice = merchant?.taxIncludedInPrice === true;
  /** Tax-exclusive: VAT on discounted net (default) vs pre-discount net. */
  const vatAfterDiscount = merchant?.vatAfterDiscount !== false;

  const checkoutSettings = useMemo(
    () => normalizePosCheckoutSettings(paymentConfig?.posCheckoutSettings),
    [paymentConfig?.posCheckoutSettings]
  );
  const editionFeatures = paymentConfig?.editionFeatures;
  const editionAllows = (key: string) =>
    editionFeatures == null || editionFeatures.includes(key);
  const posMode = checkoutSettings.posMode === 'retail' ? 'retail' : 'restaurant';
  const isRetail = posMode === 'retail';
  const retailTakeawayEnabled =
    !!checkoutSettings.retailTakeawayEnabled && editionAllows('channel_takeaway');
  const retailDeliveryEnabled =
    !!checkoutSettings.retailDeliveryEnabled && editionAllows('channel_delivery');
  const retailDineInEnabled = !!checkoutSettings.retailDineInEnabled;
  const requireTableForDineIn = checkoutSettings.requireTableForDineIn !== false;
  const counterDineInEnabled = !requireTableForDineIn;
  const showChannelTabs = isRetail
    ? retailDineInEnabled || retailDeliveryEnabled
    : editionAllows('channel_takeaway') ||
      editionAllows('channel_delivery') ||
      counterDineInEnabled;
  const channelTabOptions: Array<'takeaway' | 'delivery' | 'dine_in'> = isRetail
    ? [
        ...(retailDineInEnabled ? (['dine_in'] as const) : []),
        ...(retailDeliveryEnabled ? (['delivery'] as const) : []),
      ]
    : [
        ...(counterDineInEnabled ? (['dine_in'] as const) : []),
        ...(editionAllows('channel_takeaway') ? (['takeaway'] as const) : []),
        ...(editionAllows('channel_delivery') ? (['delivery'] as const) : []),
      ];
  const kitchenEnabled = !isRetail && editionAllows('pos_kitchen');
  const coursesEnabled =
    !!merchant?.coursesEnabled && kitchenEnabled && editionAllows('pos_courses');
  const tablesEditionOk = editionAllows('pos_tables');
  /** Fast-food can keep kitchen but hide Tables / Set table. */
  const tablesUiEnabled =
    !isRetail && tablesEditionOk && checkoutSettings.tablesEnabled !== false;
  const giftCardsEditionOk =
    editionAllows('pos_gift_cards') || editionAllows('gift_cards');
  // Counter / takeaway / delivery / open table or tab → Send.
  // When tables are off, always offer Send (fast-food walk-in).
  const showSend =
    kitchenEnabled &&
    (!tablesUiEnabled ||
      counterDineInEnabled ||
      channel === 'takeaway' ||
      channel === 'delivery' ||
      (channel === 'dine_in' && counterDineInEnabled) ||
      !!tableLabel ||
      !!tabNumber);
  const cartSide = checkoutSettings.cartSide === 'left' ? 'left' : 'right';
  const courseSendMode = checkoutSettings.courseSendMode || 'fire_per_course';

  const courseNumbers = useMemo(() => {
    const set = new Set<number>();
    for (const l of cart) {
      if (l.courseNumber) set.add(l.courseNumber);
    }
    if (coursesEnabled && cart.length > 0) set.add(activeCourse);
    return Array.from(set).sort((a, b) => a - b);
  }, [cart, activeCourse, coursesEnabled]);

  useEffect(() => {
    const fromSettings = checkoutSettings.postSuccessTarget;
    if (fromSettings === 'tables' || fromSettings === 'register') {
      setPostSuccessTarget(tablesUiEnabled ? fromSettings : 'register');
    }
  }, [checkoutSettings.postSuccessTarget, tablesUiEnabled]);

  // No tables UI — keep post-success on register.
  useEffect(() => {
    if (!tablesUiEnabled && postSuccessTarget === 'tables') {
      setPostSuccessTarget('register');
    }
  }, [tablesUiEnabled, postSuccessTarget]);

  useEffect(() => {
    if (!tablesUiEnabled && (posTab === 'tables' || posTab === 'bookings')) {
      setPosTab('register');
      setPosView('register');
    }
  }, [tablesUiEnabled, posTab]);

  const showFireCourseButton =
    coursesEnabled &&
    courseSendMode === 'fire_per_course' &&
    coursesBulkSent &&
    activeCourse > 1;
  const hasUnsentItems = cart.some((l) => !l.sentToKitchen);
  // Ongoing order with new (unsent) lines must keep Send — not New.
  const showNewOrderButton = orderSent && !showFireCourseButton && !hasUnsentItems;
  const sendLabel = useMemo(() => {
    if (showFireCourseButton) {
      return t('webPosFireCourse').replace('{n}', String(activeCourse));
    }
    return t('webPosSend');
  }, [showFireCourseButton, activeCourse, t]);

  const roundingStep = checkoutSettings.roundingStep || 0.05;

  const fullTotals = useMemo(
    () => computeMerchandiseTotals(cart, taxRate, vatIncludedInPrice, roundingStep),
    [cart, taxRate, vatIncludedInPrice, roundingStep]
  );

  const payableFullTotals = useMemo(
    () => applyBillDiscountToTotals(fullTotals, billDiscount, vatIncludedInPrice, roundingStep, vatAfterDiscount),
    [fullTotals, billDiscount, vatIncludedInPrice, roundingStep, vatAfterDiscount]
  );

  const activeSale = useMemo(() => {
    const part = splitQueue[splitIndex];
    if (!part) {
      return { lines: cart, totals: payableFullTotals, label: null as string | null };
    }
    const resolveSplitLines = () => {
      if (part.lineQtys && Object.keys(part.lineQtys).length > 0) {
        return cart.flatMap((l) => {
          const qty = part.lineQtys![l.lineId] ?? 0;
          if (qty <= 0) return [];
          const unit = l.quantity > 0 ? l.lineTotal / l.quantity : l.unitPrice;
          if (qty >= l.quantity) return [l];
          return [
            {
              ...l,
              quantity: qty,
              lineTotal: roundMoney2(unit * qty),
            },
          ];
        });
      }
      if (part.lineIds.length > 0) {
        return cart.filter((l) => part.lineIds.includes(l.lineId));
      }
      return [];
    };
    if (part.lineIds.length > 0 || (part.lineQtys && Object.keys(part.lineQtys).length > 0)) {
      const lines = resolveSplitLines();
      const t = computeMerchandiseTotals(lines, taxRate, vatIncludedInPrice, roundingStep);
      const payableShare =
        payableFullTotals.total > 0 && fullTotals.total > 0
          ? roundMoney2((t.total / fullTotals.total) * payableFullTotals.total)
          : t.total;
      return {
        lines,
        totals: { ...t, total: part.amount || payableShare, discount: 0 },
        label: part.label,
      };
    }
    const factor = payableFullTotals.total > 0 ? part.amount / payableFullTotals.total : 1;
    const lines = scaleLinesByFactor(cart, factor);
    const t = computeMerchandiseTotals(lines, taxRate, vatIncludedInPrice, roundingStep);
    return {
      lines,
      totals: {
        ...t,
        total: part.amount,
        rounding: roundMoney2(part.amount - t.gross),
        discount: 0,
      },
      label: part.label,
    };
  }, [
    cart,
    fullTotals,
    payableFullTotals,
    splitQueue,
    splitIndex,
    taxRate,
    vatIncludedInPrice,
    roundingStep,
  ]);

  /** Payable cart totals for sidebar / pay buttons (includes bill discount). */
  const totals = splitQueue.length > 0 ? activeSale.totals : payableFullTotals;

  const membershipCheckout = useMemo(() => {
    if (
      !attachedMembership?.membershipEnabled ||
      attachedMembership.pointsBalance < REDEEM_THRESHOLD_POINTS
    ) {
      return {
        canPayWithPoints: false,
        pointsRedeemed: 0,
        pointsDiscount: 0,
      };
    }
    const payable = activeSale.totals.total;
    const maxPoints = maxRedeemablePoints(payable, attachedMembership.pointsBalance);
    const pointsRedeemed = payWithPoints ? maxPoints : 0;
    const pointsDiscount =
      pointsRedeemed > 0 ? computeCashDiscount(pointsRedeemed) : 0;
    return {
      canPayWithPoints: maxPoints > 0,
      pointsRedeemed,
      pointsDiscount,
    };
  }, [attachedMembership, activeSale.totals.total, payWithPoints]);

  useEffect(() => {
    if (posView !== 'checkout' || !attachedMembership?.membershipEnabled) return;
    const payable = activeSale.totals.total;
    const maxPts = maxRedeemablePoints(payable, attachedMembership.pointsBalance);
    setPayWithPoints(
      attachedMembership.pointsBalance >= REDEEM_THRESHOLD_POINTS && maxPts > 0
    );
  }, [posView, splitIndex, attachedMembership?.cardId, activeSale.totals.total]);

  const billDiscountLabel =
    billDiscount.percent > 0
      ? `${billDiscount.percent}%`
      : billDiscount.amount > 0
        ? money(billDiscount.amount)
        : null;

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bestsellerOrder = new Map(bestsellerIds.map((id, i) => [id, i]));
    const filtered = products.filter((p) => {
      if (categoryId === POS_GIFT_CARDS_CATEGORY) {
        return false;
      } else if (categoryId !== 'all' && p.categoryId !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const useBestsellerSort = gridSort === 'bestseller';
    if (useBestsellerSort && bestsellerIds.length) {
      return filtered.sort(
        (a, b) => (bestsellerOrder.get(a.id) ?? 999) - (bestsellerOrder.get(b.id) ?? 999)
      );
    }
    if (gridSort === 'alpha') {
      return filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    return filtered;
  }, [products, categoryId, search, bestsellerIds, gridSort]);

  const refreshAgent = useCallback(async () => {
    const ok = await isPrintAgentAvailable();
    setAgentOk(ok);
    if (!ok) {
      setPrinters([]);
      return;
    }
    try {
      const list = await listAgentPrinters();
      setPrinters(list);
      if (!printerName && list.length) {
        const def = list.find((p) => p.isDefault) || list[0];
        setPrinterName(def.name);
      }
    } catch {
      setPrinters([]);
    }
  }, [printerName]);

  const shiftsEnabledRef = useRef(shiftsEnabled);
  shiftsEnabledRef.current = shiftsEnabled;
  const shiftMigrateToastRef = useRef(false);

  type ShiftSnapshot = {
    shift: { id: string; openingCash: number; openedAt: string } | null;
    live: {
      cashSales: number;
      cashIn?: number;
      cashOut?: number;
      cardSales: number;
      terminalSales: number;
      totalSales: number;
      orderCount: number;
      expectedCash: number;
    } | null;
  };

  const refreshCurrentShift = useCallback(async (enabled?: boolean): Promise<ShiftSnapshot | null> => {
    const on = enabled ?? shiftsEnabledRef.current;
    if (!on) {
      setOpenShift(null);
      setShiftLive(null);
      return { shift: null, live: null };
    }
    try {
      const res = await api.get('/merchant/pos/shifts/current');
      const shift = res.data.shift as {
        id: string;
        openingCash: number;
        openedAt: string;
      } | null;
      const live = res.data.live as ShiftSnapshot['live'];
      if (shift) {
        const parsed = {
          id: shift.id,
          openingCash: Number(shift.openingCash) || 0,
          openedAt: String(shift.openedAt),
        };
        setOpenShift(parsed);
        setShiftLive(live);
        return { shift: parsed, live };
      }
      setOpenShift(null);
      setShiftLive(null);
      return { shift: null, live: null };
    } catch (e: any) {
      const msg = String(e?.response?.data?.error || e?.message || '');
      // Surface missing DB migration once so shift UI is not silently dead.
      if (
        on &&
        !shiftMigrateToastRef.current &&
        /shifts_enabled|pos_shifts|does not exist|column/i.test(msg)
      ) {
        shiftMigrateToastRef.current = true;
        toast.error(
          `${t('webPosShiftStartFailed')}: DB migrate required (backend/sql/ensure-shifts.sql)`
        );
      }
      return null;
    }
  }, [t]);

  const applyCachedOfflineSnapshot = useCallback(
    async (reason?: string) => {
      if (!isWebPosOfflineEnabled()) return false;
      const snap = await loadWebPosOfflineSnapshot();
      if (!snap) return false;
      const merch = snap.config.merchant as any;
      const cfg = snap.config.paymentConfig as (WebPosPaymentConfig & {
        shiftsSchemaMissing?: boolean;
        entitlement?: WebPosEntitlement;
      }) | null;
      const entitlementCached =
        (snap.config.entitlement as WebPosEntitlement | null) || cfg?.entitlement || null;
      setMerchant(merch);
      setPrintSettings(
        (snap.config.printSettings as PosPrintSettingsClient | null) ||
          merch?.posPrintSettings ||
          null
      );
      setCategories((snap.catalog.categories || []) as Category[]);
      setProducts((snap.catalog.products || []) as Product[]);
      setEntitlement(entitlementCached);
      const editionFeats = Array.isArray(cfg?.editionFeatures)
        ? cfg!.editionFeatures
        : Array.isArray(merch?.editionFeatures)
          ? (merch.editionFeatures as string[])
          : null;
      const shiftsAllowed = editionFeats == null || editionFeats.includes('pos_shifts');
      const shiftsOn = shiftsAllowed && !!(cfg?.shiftsEnabled || merch?.shiftsEnabled);
      const theme = (cfg?.posColorTheme || merch?.posColorTheme || 'teal').toLowerCase();
      setShiftsEnabled(shiftsOn);
      shiftsEnabledRef.current = shiftsOn;
      setPosColorTheme(
        (WEBPOS_COLOR_THEMES as string[]).includes(theme) ? (theme as WebPosColorTheme) : 'teal'
      );
      if (cfg) {
        setPaymentConfig({
          ...cfg,
          editionFeatures: cfg.editionFeatures ?? merch?.editionFeatures ?? null,
        });
        if (cfg.defaultTerminalId) setSelectedTerminalId(cfg.defaultTerminalId);
        const first = ['cash', 'card', 'terminal'] as const;
        const pick = first.find((m) => cfg.methods[m]);
        if (pick) setPaymentMethod(pick);
      }
      const staffList = Array.isArray(snap.config.staff) ? snap.config.staff : [];
      setStaffRoster(staffList as StaffRosterRow[]);
      applyStaffRoster(staffList as StaffRosterRow[], { openPinGate: true });
      setLoadedFromOfflineCache(true);
      toast(reason || t('webPosOfflineCacheLoaded'), { icon: '📴', duration: 4500 });
      return true;
    },
    [t, applyStaffRoster]
  );

  const load = useCallback(async () => {
    setLoading(true);
    let cacheReady = false;
    const offlineBoot = !isBrowserOnline();

    if (offlineBoot && isWebPosOfflineEnabled()) {
      cacheReady = await applyCachedOfflineSnapshot(t('webPosOfflineCacheLoaded'));
      if (cacheReady) {
        setLoading(false);
        void refreshAgent().catch(() => undefined);
        void flushOfflineOutbox();
        return;
      }
    }

    const fetchTimeout = offlineBoot ? WEBPOS_CATALOG_FETCH_TIMEOUT_MS : 60_000;
    const fetchOpts = { timeout: fetchTimeout };

    try {
      const [settingsRes, catRes, prodRes, webposRes, staffRes, bestsellerRes] = await Promise.all([
        api.get('/merchant/settings', fetchOpts),
        api.get('/merchant/categories', fetchOpts),
        api.get('/merchant/products', { params: { limit: 500 }, ...fetchOpts }),
        api.get('/merchant/webpos-config', fetchOpts).catch(() => ({ data: { config: null } })),
        api.get('/merchant/staff', fetchOpts).catch(() => ({ data: { staff: [] } })),
        api
          .get('/merchant/bestsellers', { params: { limit: 20, days: 30 }, ...fetchOpts })
          .catch(() => ({ data: { productIds: [] } })),
      ]);
      const merch = settingsRes.data.settings || settingsRes.data.merchant;
      setMerchant(merch);
      setPrintSettings(merch?.posPrintSettings || null);
      const mappedCategories = (catRes.data.categories || catRes.data || []).map((c: any) => ({
        ...c,
        name: repairCatalogText(c.name),
      }));
      setCategories(mappedCategories);
      setBestsellerIds(
        Array.isArray(bestsellerRes.data?.productIds) ? bestsellerRes.data.productIds : []
      );
      const cfg = webposRes.data.config as (WebPosPaymentConfig & {
        shiftsSchemaMissing?: boolean;
        entitlement?: WebPosEntitlement;
      }) | null;
      let nextEntitlement: WebPosEntitlement | null = cfg?.entitlement || null;
      if (cfg?.entitlement) {
        setEntitlement(cfg.entitlement);
      } else {
        try {
          const entRes = await api.get('/merchant/webpos-entitlement', fetchOpts);
          nextEntitlement = entRes.data.entitlement || null;
          setEntitlement(nextEntitlement);
        } catch {
          nextEntitlement = null;
          setEntitlement(null);
        }
      }
      // Either source can enable; avoids hiding shifts when one payload omits the flag.
      const editionFeats = Array.isArray(cfg?.editionFeatures)
        ? cfg!.editionFeatures
        : Array.isArray(merch?.editionFeatures)
          ? (merch.editionFeatures as string[])
          : null;
      const shiftsAllowed =
        editionFeats == null || editionFeats.includes('pos_shifts');
      const shiftsOn =
        shiftsAllowed && !!(cfg?.shiftsEnabled || merch?.shiftsEnabled);
      const theme =
        (cfg?.posColorTheme || merch?.posColorTheme || 'teal').toLowerCase();
      setShiftsEnabled(shiftsOn);
      shiftsEnabledRef.current = shiftsOn;
      if (cfg?.shiftsSchemaMissing && !shiftMigrateToastRef.current) {
        shiftMigrateToastRef.current = true;
        toast.error(
          `${t('webPosShiftStartFailed')}: DB migrate required (backend/sql/ensure-shifts.sql)`
        );
      }
      setPosColorTheme(
        (WEBPOS_COLOR_THEMES as string[]).includes(theme) ? (theme as WebPosColorTheme) : 'teal'
      );
      let nextPaymentConfig: WebPosPaymentConfig | null = null;
      let nextPrintSettings: PosPrintSettingsClient | null = merch?.posPrintSettings || null;
      if (cfg) {
        nextPaymentConfig = {
          ...cfg,
          editionFeatures: cfg.editionFeatures ?? merch?.editionFeatures ?? null,
        };
        setPaymentConfig(nextPaymentConfig);
        if (cfg.posPrintSettings) {
          nextPrintSettings = cfg.posPrintSettings;
          setPrintSettings(cfg.posPrintSettings);
        }
        if (cfg.defaultTerminalId) setSelectedTerminalId(cfg.defaultTerminalId);
        const first = ['cash', 'card', 'terminal'] as const;
        const pick = first.find((m) => cfg.methods[m]);
        if (pick) setPaymentMethod(pick);
        if (cfg.posPrintSettings?.autoPrintReceipt != null) {
          setAutoPrint(cfg.posPrintSettings.autoPrintReceipt !== false);
        }
      }
      const staffList = (staffRes.data.staff || []) as StaffRosterRow[];
      setStaffRoster(staffList);
      applyStaffRoster(staffList, { openPinGate: true });
      const prods = prodRes.data.products || prodRes.data || [];
      const mappedProducts = prods.map((p: any) => ({
        ...p,
        image: p.image || p.imageUrl || null,
        name: repairCatalogText(p.name),
        price: Number(p.price),
        sku: p.sku ?? null,
        barcode: p.barcode ?? null,
        extras: Array.isArray(p.extras)
          ? p.extras.map((e: any) => ({
              ...e,
              name: repairCatalogText(e?.name || ''),
            }))
          : p.extras,
        modifierGroups: Array.isArray(p.modifierGroups)
          ? p.modifierGroups.map((g: any) => ({
              ...g,
              name: repairCatalogText(g?.name || ''),
              options: Array.isArray(g?.options)
                ? g.options.map((o: any) => ({
                    ...o,
                    name: repairCatalogText(o?.name || ''),
                  }))
                : g?.options,
            }))
          : p.modifierGroups,
        comboSlots: Array.isArray(p.comboSlots)
          ? p.comboSlots.map((slot: any) => ({
              ...slot,
              name: repairCatalogText(slot?.name || ''),
              products: Array.isArray(slot?.products)
                ? slot.products.map((sp: any) => ({
                    ...sp,
                    name: repairCatalogText(sp?.name || ''),
                    extras: Array.isArray(sp?.extras)
                      ? sp.extras.map((e: any) => ({
                          ...e,
                          name: repairCatalogText(e?.name || ''),
                        }))
                      : sp?.extras,
                    modifierGroups: Array.isArray(sp?.modifierGroups)
                      ? sp.modifierGroups.map((g: any) => ({
                          ...g,
                          name: repairCatalogText(g?.name || ''),
                          options: Array.isArray(g?.options)
                            ? g.options.map((o: any) => ({
                                ...o,
                                name: repairCatalogText(o?.name || ''),
                              }))
                            : g?.options,
                        }))
                      : sp?.modifierGroups,
                  }))
                : slot?.products,
            }))
          : p.comboSlots,
      }));
      setProducts(mappedProducts);
      setLoadedFromOfflineCache(false);
      if (isWebPosOfflineEnabled() && merch?.id) {
        void saveWebPosOfflineSnapshot({
          merchantId: String(merch.id),
          categories: mappedCategories,
          products: mappedProducts,
          merchant: merch,
          paymentConfig: nextPaymentConfig,
          entitlement: nextEntitlement,
          printSettings: nextPrintSettings,
          staff: staffList,
        }).catch(() => undefined);
      }
      await refreshAgent();
      await refreshCurrentShift(shiftsOn);
      void flushOfflineOutbox();
    } catch (e: any) {
      if (!cacheReady) {
        const hydrated = await applyCachedOfflineSnapshot(
          isNetworkError(e) || !isBrowserOnline()
            ? t('webPosOfflineCacheLoaded')
            : undefined
        );
        cacheReady = hydrated;
      }
      if (!cacheReady) {
        toast.error(e.response?.data?.error || t('webPosLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [applyCachedOfflineSnapshot, applyStaffRoster, refreshAgent, refreshCurrentShift, t]);

  const refreshBestsellers = useCallback(async () => {
    try {
      const res = await api.get('/merchant/bestsellers', { params: { limit: 20, days: 30 } });
      setBestsellerIds(Array.isArray(res.data?.productIds) ? res.data.productIds : []);
    } catch {
      /* keep previous list */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!shiftsEnabled || !offlineSync.online) return;
    void refreshCurrentShift(true);
  }, [shiftsEnabled, offlineSync.online, refreshCurrentShift]);

  useEffect(() => {
    if (!shiftsEnabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && offlineSync.online) {
        void refreshCurrentShift(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [shiftsEnabled, offlineSync.online, refreshCurrentShift]);

  /** Main till hub: Print Agent online → pull waiter/mobile ESC/POS jobs and print locally. */
  useEffect(() => {
    if (!agentOk) return;
    let cancelled = false;
    let timer: number | null = null;
    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void tick();
      }, ms);
    };
    const tick = async () => {
      if (cancelled) return;
      try {
        // processPendingEscPosPrintJobs is mutexed; backend claims jobs as PROCESSING.
        await processPendingEscPosPrintJobs();
      } catch {
        /* best-effort */
      } finally {
        schedule(2500);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [agentOk]);

  useEffect(() => {
    if (!isWebPosOfflineEnabled()) return;
    const stop = startOfflineSyncEngine();
    const unsub = subscribeOfflineSync(setOfflineSync);
    const unsubSale = onOfflineSaleSynced(({ clientId, orderId }) => {
      setSales((prev) =>
        prev.map((s) =>
          s.id === clientId
            ? { ...s, synced: true, backendOrderId: orderId || s.backendOrderId }
            : s
        )
      );
      setOrdersRefreshToken((n) => n + 1);
    });
    return () => {
      stop();
      unsub();
      unsubSale();
    };
  }, []);

  const pollOnlineOrders = useCallback(async () => {
    try {
      const res = await api.get('/merchant/orders', { params: { limit: 80 } });
      const all = (res.data.orders || []) as OnlineOrder[];
      const online = all.filter((o) => o.orderType === 'web_shop');
      setOnlineOrders(online);

      const newOnes = online.filter(
        (o) => o.status === 'pending' || o.status === 'pending_approval'
      );
      const newIds = newOnes.map((o) => o.id);

      if (knownOnlineIdsRef.current == null) {
        knownOnlineIdsRef.current = new Set(newIds);
        return;
      }

      const fresh = newIds.filter((id) => !knownOnlineIdsRef.current!.has(id));
      const freshOrders = newOnes.filter((o) => fresh.includes(o.id));
      for (const id of newIds) knownOnlineIdsRef.current.add(id);

      for (const id of [...unactionedOrderIdsRef.current]) {
        const row = online.find((o) => o.id === id);
        if (!row || (row.status !== 'pending' && row.status !== 'pending_approval')) {
          unactionedOrderIdsRef.current.delete(id);
        }
      }
      setNewOrderAlertQueue((prev) =>
        prev.filter((o) => {
          const row = online.find((x) => x.id === o.id);
          return !!row && (row.status === 'pending' || row.status === 'pending_approval');
        })
      );

      if (freshOrders.length > 0) {
        for (const o of freshOrders) {
          unactionedOrderIdsRef.current.add(o.id);
        }
        setUnactionedOrderCount(unactionedOrderIdsRef.current.size);
        setNewOrderAlertQueue((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const next = [...prev];
          for (const o of freshOrders) {
            if (!seen.has(o.id)) next.push(o);
          }
          return next;
        });
        playOrderAlertOnce();
        if (!onlinePanelOpenRef.current) {
          startOrderAlertLoop(5000);
        }
      } else {
        setUnactionedOrderCount(unactionedOrderIdsRef.current.size);
      }

      if (unactionedOrderIdsRef.current.size === 0) {
        stopOrderAlertLoop();
      }
    } catch {
      /* ignore poll errors */
    }
  }, []);

  const markOnlineOrderActioned = useCallback((orderId: string) => {
    unactionedOrderIdsRef.current.delete(orderId);
    setUnactionedOrderCount(unactionedOrderIdsRef.current.size);
    setNewOrderAlertQueue((prev) => prev.filter((o) => o.id !== orderId));
    if (unactionedOrderIdsRef.current.size === 0) {
      stopOrderAlertLoop();
    }
  }, []);

  const dismissNewOrderAlert = useCallback((orderId: string) => {
    setNewOrderAlertQueue((prev) => prev.filter((o) => o.id !== orderId));
  }, []);

  const openOnlineOrdersInTab = useCallback((orderId?: string | null) => {
    setOrdersChannelPref('online');
    setHighlightOrderId(orderId ?? null);
    setPosTab('orders');
    setPosView('orders');
    stopOrderAlertLoop();
  }, []);

  const acceptFromNewOrderAlert = useCallback(
    async (order: OnlineOrder) => {
      setAlertActionBusy(true);
      try {
        await api.post(`/merchant/orders/${order.id}/action`, { action: 'accept' });
        markOnlineOrderActioned(order.id);
        dismissNewOrderAlert(order.id);
        toast.success(t('updated'));
        void pollOnlineOrders();
        openOnlineOrdersInTab(order.id);
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
        if (unactionedOrderIdsRef.current.size > 0) startOrderAlertLoop(5000);
      } finally {
        setAlertActionBusy(false);
      }
    },
    [dismissNewOrderAlert, markOnlineOrderActioned, openOnlineOrdersInTab, pollOnlineOrders, t]
  );

  const rejectFromNewOrderAlert = useCallback((order: OnlineOrder) => {
    setAlertRejectOrder(order);
  }, []);

  const confirmRejectFromAlert = useCallback(
    async (reason: string) => {
      if (!alertRejectOrder) return;
      setAlertActionBusy(true);
      try {
        await api.post(`/merchant/orders/${alertRejectOrder.id}/action`, {
          action: 'reject',
          rejectReason: reason,
        });
        markOnlineOrderActioned(alertRejectOrder.id);
        dismissNewOrderAlert(alertRejectOrder.id);
        setAlertRejectOrder(null);
        toast.success(t('updated'));
        void pollOnlineOrders();
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
        if (unactionedOrderIdsRef.current.size > 0) startOrderAlertLoop(5000);
      } finally {
        setAlertActionBusy(false);
      }
    },
    [alertRejectOrder, dismissNewOrderAlert, markOnlineOrderActioned, pollOnlineOrders, t]
  );

  const pollReservations = useCallback(async () => {
    try {
      const from = new Date(Date.now() - 3600_000);
      const to = new Date(Date.now() + 48 * 3600_000);
      const res = await api.get('/merchant/reservations', {
        params: { from: from.toISOString(), to: to.toISOString(), status: 'all' },
      });
      const rows = (res.data.reservations || []) as Array<{
        id: string;
        status: string;
      }>;
      const actionable = rows.filter((r) => r.status === 'pending' || r.status === 'confirmed');
      setReservationPendingCount(rows.filter((r) => r.status === 'pending').length);

      const alertIds = actionable.map((r) => r.id);
      if (knownReservationIdsRef.current == null) {
        knownReservationIdsRef.current = new Set(alertIds);
        return;
      }

      const fresh = alertIds.filter((id) => !knownReservationIdsRef.current!.has(id));
      for (const id of alertIds) knownReservationIdsRef.current.add(id);

      if (fresh.length > 0) {
        playOrderAlertOnce();
        startOrderAlertForDuration(10000, 2500);
        setReservationAlertUntil(Date.now() + 10000);
        toast(t('webPosNewReservationAlert'), { icon: '📅', duration: 10000 });
      }
    } catch {
      /* ignore poll errors */
    }
  }, [t]);

  useEffect(() => {
    if (reservationAlertUntil <= Date.now()) return;
    const ms = reservationAlertUntil - Date.now();
    const id = window.setTimeout(() => setReservationAlertUntil(0), ms);
    return () => window.clearTimeout(id);
  }, [reservationAlertUntil]);

  useEffect(() => {
    const viewing = posView === 'orders' && ordersChannelPref === 'online';
    onlinePanelOpenRef.current = viewing;
    if (viewing) stopOrderAlertLoop();
  }, [posView, ordersChannelPref]);

  useEffect(() => {
    void pollOnlineOrders();
    const id = setInterval(() => void pollOnlineOrders(), 8000);
    return () => {
      clearInterval(id);
      stopOrderAlertLoop();
    };
  }, [pollOnlineOrders]);

  useEffect(() => {
    void pollReservations();
    const id = setInterval(() => void pollReservations(), 8000);
    return () => clearInterval(id);
  }, [pollReservations]);

  // Browsers block audio until a user gesture - unlock AudioContext on first tap
  useEffect(() => {
    const softUnlock = () => {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) void new AC().resume();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', softUnlock, { once: true });
    return () => window.removeEventListener('pointerdown', softUnlock);
  }, []);

  useEffect(() => {
    localStorage.setItem('manupos_webpos_printer', printerName || '');
  }, [printerName]);

  useEffect(() => {
    localStorage.setItem('manupos_webpos_autoprint', autoPrint ? '1' : '0');
  }, [autoPrint]);

  const ensureShift = useCallback(
    async (action: () => void) => {
      // Offline: shift open/close needs the API — do not block cash/card sales.
      if (!shiftsEnabled || !offlineSync.online) {
        action();
        return;
      }
      if (openShift) {
        action();
        return;
      }
      // UI may be stale after relaunch — confirm with server before prompting.
      const current = await refreshCurrentShift(true);
      if (current?.shift) {
        action();
        return;
      }
      pendingAfterShift.current = action;
      setStartShiftOpen(true);
    },
    [shiftsEnabled, openShift, offlineSync.online, refreshCurrentShift]
  );

  /** Same product + options + course → one line with qty. Skip open-price / gift / already-sent. */
  const cartLineStackKey = (l: {
    productId: string;
    isOpenPrice?: boolean;
    giftCard?: unknown;
    sentToKitchen?: boolean;
    selectedExtras: ShopSelectedExtra[];
    comboSelections: ShopComboSelection[];
    courseNumber?: number;
    lineNote?: string;
  }) => {
    if (l.isOpenPrice || l.giftCard || l.sentToKitchen) return null;
    const course = coursesEnabled ? l.courseNumber || 1 : 0;
    const note = (l.lineNote || '').trim();
    return `${l.productId}|${lineSignature(l.selectedExtras, l.comboSelections)}|c${course}|n${note}`;
  };

  /** Collapse duplicate stackable lines (qty sum). Keeps first line’s price/discount. */
  const collapseStackableCart = (lines: CartLine[]): CartLine[] => {
    const out: CartLine[] = [];
    const indexByKey = new Map<string, number>();
    for (const l of lines) {
      const key = cartLineStackKey(l);
      if (!key) {
        out.push(l);
        continue;
      }
      const idx = indexByKey.get(key);
      if (idx == null) {
        indexByKey.set(key, out.length);
        out.push(l);
        continue;
      }
      const prev = out[idx]!;
      const quantity = prev.quantity + l.quantity;
      const disc = prev.lineDiscountPercent || 0;
      out[idx] = {
        ...prev,
        quantity,
        lineTotal: roundMoney2(prev.unitPrice * quantity * (1 - disc / 100)),
      };
    }
    return out;
  };

  const pushConfiguredProduct = (
    p: Product,
    unitPrice: number,
    selectedExtras: ShopSelectedExtra[] = [],
    comboSelections: ShopComboSelection[] = [],
    quantity = 1,
    lineNote?: string
  ) => {
    const price = roundMoney2(unitPrice);
    const qty = Math.max(1, Math.round(quantity));
    const sig = lineSignature(selectedExtras, comboSelections);
    const courseNumber = coursesEnabled ? activeCourse : undefined;
    const noteSuffix = lineNote?.trim() ? `:note:${lineNote.trim()}` : '';
    setCart((prev) => {
      const isOpen = p.isOpenPrice || p.productType === 'open_price';
      if (isOpen) {
        return [
          ...prev,
          {
            lineId: `${p.id}-${Date.now()}-open`,
            productId: p.id,
            name: p.name,
            quantity: qty,
            unitPrice: price,
            lineTotal: roundMoney2(price * qty),
            taxable: p.isTaxable !== false,
            categoryId: p.categoryId,
            selectedExtras,
            comboSelections,
            isOpenPrice: true,
            courseNumber,
            lineNote: lineNote?.trim() || undefined,
          },
        ];
      }
      if (qty === 1 && !lineNote?.trim()) {
        return collapseStackableCart([
          ...prev,
          {
            lineId: `${p.id}-${Date.now()}-${sig || 'plain'}`,
            productId: p.id,
            name: p.name,
            quantity: 1,
            unitPrice: price,
            lineTotal: price,
            taxable: p.isTaxable !== false,
            categoryId: p.categoryId,
            selectedExtras,
            comboSelections,
            isOpenPrice: false,
            courseNumber,
          },
        ]);
      }
      return [
        ...prev,
        {
          lineId: `${p.id}-${Date.now()}-${sig || 'plain'}${noteSuffix}`,
          productId: p.id,
          name: p.name,
          quantity: qty,
          unitPrice: price,
          lineTotal: roundMoney2(price * qty),
          taxable: p.isTaxable !== false,
          categoryId: p.categoryId,
          selectedExtras,
          comboSelections,
          isOpenPrice: false,
          courseNumber,
          lineNote: lineNote?.trim() || undefined,
        },
      ];
    });
  };

  const pushConfiguredProductWithQty = (
    p: Product,
    unitPrice: number,
    selectedExtras: ShopSelectedExtra[] = [],
    comboSelections: ShopComboSelection[] = [],
    quantity = 1,
    lineNote?: string
  ) => {
    void ensureShift(() =>
      pushConfiguredProduct(p, unitPrice, selectedExtras, comboSelections, quantity, lineNote)
    );
  };

  const updateConfiguredLine = (
    lineId: string,
    unitPrice: number,
    selectedExtras: ShopSelectedExtra[],
    comboSelections: ShopComboSelection[],
    quantity: number,
    lineNote?: string
  ) => {
    const qty = Math.max(1, Math.round(quantity));
    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const disc = l.lineDiscountPercent || 0;
        return {
          ...l,
          unitPrice: roundMoney2(unitPrice),
          selectedExtras,
          comboSelections,
          quantity: qty,
          lineNote: lineNote?.trim() || undefined,
          lineTotal: lineTotalFor(roundMoney2(unitPrice), qty, disc),
        };
      })
    );
  };

  const lineIsEditable = (line: CartLine, product?: Product | null) => {
    if (line.sentToKitchen || line.giftCard || line.isOpenPrice || line.isWeighed) return false;
    if (line.comboSelections.length) return true;
    if (line.selectedExtras.length || line.lineNote?.trim()) return true;
    if (product && productHasComboSlots(product)) return true;
    if (product && productHasModifiers(product as ShopProductForModifiers)) return true;
    return false;
  };

  const openLineForEdit = (line: CartLine) => {
    if (line.sentToKitchen) {
      toast.error(t('webPosCancelSentToEdit'));
      return;
    }
    const product = products.find((p) => p.id === line.productId);
    if (!product || !lineIsEditable(line, product)) {
      setSelectedLineId((prev) => (prev === line.lineId ? null : line.lineId));
      setKeypadBuffer('');
      return;
    }
    setEditingLineId(line.lineId);
    setSelectedLineId(null);
    setKeypadBuffer('');
    if (line.comboSelections.length || productHasComboSlots(product)) {
      setPendingCombo({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        allowExtras: product.allowExtras,
        extras: product.extras,
        modifierGroups: product.modifierGroups,
        comboSlots: product.comboSlots || [],
      });
      setPendingProduct(null);
      return;
    }
    setPendingProduct({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      allowExtras: product.allowExtras,
      extras: product.extras,
      modifierGroups: product.modifierGroups,
    });
    setPendingCombo(null);
  };

  const addConfiguredProduct = (
    p: Product,
    unitPrice: number,
    selectedExtras: ShopSelectedExtra[] = [],
    comboSelections: ShopComboSelection[] = []
  ) => {
    pushConfiguredProductWithQty(p, unitPrice, selectedExtras, comboSelections, 1);
  };

  const isWeighedProduct = (p: Product) =>
    !!p.soldByWeight || p.productType === 'weighed';

  const pushWeighedProduct = (p: Product, weightKg: number) => {
    const kg = roundMoney2(Math.max(0, weightKg));
    if (kg <= 0) return;
    const pricePerKg = roundMoney2(Number(p.price) || 0);
    const lineTotal = roundMoney2(pricePerKg * kg);
    const courseNumber = coursesEnabled ? activeCourse : undefined;
    setCart((prev) => [
      ...prev,
      {
        lineId: `${p.id}-${Date.now()}-w`,
        productId: p.id,
        name: p.name,
        quantity: kg,
        unitPrice: pricePerKg,
        lineTotal,
        taxable: p.isTaxable !== false,
        categoryId: p.categoryId,
        selectedExtras: [],
        comboSelections: [],
        isOpenPrice: false,
        isWeighed: true,
        weightKg: kg,
        courseNumber,
      },
    ]);
  };

  const onProductClick = (p: Product) => {
    void ensureShift(() => {
      if (p.isOpenPrice || p.productType === 'open_price') {
        setPendingOpenPrice(p);
        return;
      }
      if (isWeighedProduct(p)) {
        setPendingWeighed(p);
        return;
      }
      if (productHasComboSlots(p)) {
        if (!p.comboSlots?.length) {
          toast.error(t('webPosComboNoOptions'));
          return;
        }
        setPendingCombo({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          allowExtras: p.allowExtras,
          extras: p.extras,
          modifierGroups: p.modifierGroups,
          comboSlots: p.comboSlots || [],
        });
        return;
      }
      // Open tabbed modifier modal for any product with modifier groups / extras.
      if (productHasModifiers(p as ShopProductForModifiers)) {
        setPendingProduct({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          allowExtras: p.allowExtras,
          extras: p.extras,
          modifierGroups: p.modifierGroups,
        });
        return;
      }
      pushConfiguredProduct(p, roundMoney2(Number(p.price) || 0), [], []);
    });
  };

  const handleStartShift = async (openingCash: number) => {
    setShiftBusy(true);
    try {
      const res = await api.post('/merchant/pos/shifts/start', {
        openingCash,
        staffId: webposStaff?.id || null,
        staffName: webposStaff?.name || null,
      });
      const shift = res.data.shift as {
        id: string;
        openingCash: number;
        openedAt: string;
      };
      setOpenShift({
        id: shift.id,
        openingCash: Number(shift.openingCash) || 0,
        openedAt: String(shift.openedAt),
      });
      setShiftLive({
        cashSales: 0,
        cardSales: 0,
        terminalSales: 0,
        totalSales: 0,
        orderCount: 0,
        expectedCash: Number(shift.openingCash) || 0,
      });
      setStartShiftOpen(false);
      toast.success(t('webPosShiftStarted'));
      const pending = pendingAfterShift.current;
      pendingAfterShift.current = null;
      if (pending) pending();
    } catch (e: any) {
      const msg = String(e.response?.data?.error || e.message || '');
      const alreadyOpen =
        e.response?.status === 409 || /already open/i.test(msg);
      if (alreadyOpen) {
        const resShift = e.response?.data?.shift as
          | { id: string; openingCash: number; openedAt: string }
          | undefined;
        if (resShift?.id) {
          const parsed = {
            id: resShift.id,
            openingCash: Number(resShift.openingCash) || 0,
            openedAt: String(resShift.openedAt),
          };
          setOpenShift(parsed);
          setShiftLive(e.response?.data?.live ?? null);
        } else {
          await refreshCurrentShift(true);
        }
        setStartShiftOpen(false);
        const pending = pendingAfterShift.current;
        pendingAfterShift.current = null;
        if (pending) pending();
        return;
      }
      toast.error(msg || t('webPosShiftStartFailed'));
    } finally {
      setShiftBusy(false);
    }
  };

  const openCloseShiftModal = async () => {
    if (!openShift) return;
    setSettingsOpen(false);
    await refreshCurrentShift(true);
    setCloseShiftOpen(true);
  };

  const handleCloseShift = async (closingCash: number) => {
    setShiftBusy(true);
    try {
      const res = await api.post('/merchant/pos/shifts/close', {
        closingCashCounted: closingCash,
      });
      const shift = res.data.shift as {
        openingCash: number;
        closingCashCounted: number;
        expectedCash: number;
        cashSales: number;
        cardSales: number;
        terminalSales: number;
        otherSales: number;
        orderCount: number;
        variance: number | null;
      };
      const reportPeriod = res.data.reportPeriod as { from: string; to: string };
      const balanced = !!res.data.balanced;
      setLastClosedShift({
        openingCash: Number(shift.openingCash) || 0,
        closingCashCounted: Number(shift.closingCashCounted) || 0,
        expectedCash: Number(shift.expectedCash) || 0,
        cashSales: Number(shift.cashSales) || 0,
        cardSales: Number(shift.cardSales) || 0,
        terminalSales: Number(shift.terminalSales) || 0,
        otherSales: Number(shift.otherSales) || 0,
        orderCount: Number(shift.orderCount) || 0,
        variance: shift.variance != null ? Number(shift.variance) : null,
        reportPeriod,
      });
      setShiftBalanced(balanced);
      setOpenShift(null);
      setShiftLive(null);
      setCloseShiftOpen(false);
      setShiftClosedOpen(true);
      toast.success(t('webPosShiftClosedToast'));
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosShiftCloseFailed'));
    } finally {
      setShiftBusy(false);
    }
  };

  type PosReportPayload = {
    salesCount: number;
    revenue: number;
    subtotal?: number;
    taxTotal: number;
    netTotal?: number;
    tipsTotal?: number;
    grandTotal?: number;
    refundTotal: number;
    cancelledCount: number;
    cancelledTotal: number;
    cashTotal: number;
    cardTotal: number;
    terminalTotal: number;
    coversServed?: number | null;
    vatRows?: Array<{ label: string; net: number; tva: number; brut: number }>;
    productsSold: Array<{ name: string; quantity: number; total: number }>;
    paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
    orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
    channelRows?: Array<{ channel: string; count: number; total: number }>;
    range?: { label: string; from: string; to: string };
    shiftCash?: Array<{
      openingFloat: number;
      cashSales: number;
      expectedCash: number;
      closingCashCounted?: number | null;
      variance?: number | null;
      staffName?: string | null;
    }>;
  };

  const reportFetchHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (webposStaff?.accessToken) {
      headers['X-WebPos-Staff-Access'] = webposStaff.accessToken;
    }
    return headers;
  };

  const scopeStaffNameForReport = () =>
    staffConfigured &&
    webposStaff &&
    !hasPermission(webposStaff.permissions, 'VIEW_ALL_SALES')
      ? webposStaff.name
      : null;

  /** Whole-day EOD: END_OF_DAY/VIEW_REPORTS plus VIEW_ALL_SALES (managers). */
  const mayPrintWholeDayEod =
    !staffConfigured ||
    (!!webposStaff &&
      (hasPermission(webposStaff.permissions, 'VIEW_REPORTS') ||
        hasPermission(webposStaff.permissions, 'END_OF_DAY')) &&
      hasPermission(webposStaff.permissions, 'VIEW_ALL_SALES', false));

  const buildClosedShiftPrintPayload = (
    report: PosReportPayload | null,
    includeProductsSold: boolean,
    reportKind: 'shift' | 'eod',
    label: string
  ) => {
    if (!lastClosedShift) return null;
    const totalSales =
      lastClosedShift.cashSales +
      lastClosedShift.cardSales +
      lastClosedShift.terminalSales +
      lastClosedShift.otherSales;
    const lang = resolveReceiptLanguage(printSettings, locale);
    const periodFrom =
      reportKind === 'eod'
        ? report?.range?.from || lastClosedShift.reportPeriod.from
        : lastClosedShift.reportPeriod.from;
    const periodTo =
      reportKind === 'eod'
        ? report?.range?.to || lastClosedShift.reportPeriod.to
        : lastClosedShift.reportPeriod.to;
    const base = {
      label: report?.range?.label || label,
      periodFrom,
      periodTo,
      scopeStaffName: scopeStaffNameForReport(),
      salesCount: report?.salesCount ?? (reportKind === 'eod' ? 0 : lastClosedShift.orderCount),
      revenue: report?.revenue ?? (reportKind === 'eod' ? 0 : totalSales),
      subtotal: report?.subtotal ?? (reportKind === 'eod' ? 0 : totalSales),
      taxTotal: report?.taxTotal ?? 0,
      netTotal: report?.netTotal,
      tipsTotal: report?.tipsTotal,
      grandTotal: report?.grandTotal ?? (reportKind === 'eod' ? 0 : totalSales),
      refundTotal: report?.refundTotal ?? 0,
      cancelledCount: report?.cancelledCount ?? 0,
      cancelledTotal: report?.cancelledTotal ?? 0,
      cashTotal: report?.cashTotal ?? (reportKind === 'eod' ? 0 : lastClosedShift.cashSales),
      cardTotal: report?.cardTotal ?? (reportKind === 'eod' ? 0 : lastClosedShift.cardSales),
      terminalTotal:
        report?.terminalTotal ?? (reportKind === 'eod' ? 0 : lastClosedShift.terminalSales),
      coversServed: report?.coversServed,
      vatRows: report?.vatRows,
      productsSold: report?.productsSold ?? [],
      paymentRows:
        report?.paymentRows ??
        (reportKind === 'eod'
          ? []
          : [
              { method: 'cash', count: 0, total: lastClosedShift.cashSales },
              { method: 'card', count: 0, total: lastClosedShift.cardSales },
              { method: 'terminal', count: 0, total: lastClosedShift.terminalSales },
            ].filter((r) => r.total > 0)),
      orderTypeRows: report?.orderTypeRows,
      channelRows: report?.channelRows,
      businessName: merchant?.name || APP_NAME,
      language: lang,
      paperWidthMm: printSettings?.paperWidthMm || 80,
      header: printSettings?.receiptHeader,
      footer: printSettings?.receiptFooter,
      shiftCash:
        reportKind === 'eod' && report?.shiftCash?.length
          ? report.shiftCash
          : {
              openingFloat: lastClosedShift.openingCash,
              cashSales: lastClosedShift.cashSales,
              expectedCash: lastClosedShift.expectedCash,
              closingCashCounted: lastClosedShift.closingCashCounted,
              variance: lastClosedShift.variance,
              staffName: webposStaff?.name || null,
            },
      includeProductsSold,
      reportKind,
    };
    return reportKind === 'shift'
      ? generateShiftReportText(base)
      : generateEodReportText(base);
  };

  /** Print report for the just-closed shift only (openedAt → closedAt). */
  const printShiftReport = async (opts?: { includeProductsSold?: boolean }) => {
    const includeProductsSold = opts?.includeProductsSold !== false;
    if (!lastClosedShift) {
      toast.error(t('webPosShiftNoReport'));
      return;
    }
    try {
      let report: PosReportPayload | null = null;
      try {
        const repRes = await api.get('/merchant/reports/shift', {
          params: {
            from: lastClosedShift.reportPeriod.from,
            to: lastClosedShift.reportPeriod.to,
          },
          headers: reportFetchHeaders(),
        });
        report = repRes.data.report;
      } catch {
        report = null;
      }
      const text = buildClosedShiftPrintPayload(
        report,
        includeProductsSold,
        'shift',
        t('webPosShiftReportLabel')
      );
      if (!text) {
        toast.error(t('webPosShiftNoReport'));
        return;
      }
      await printEscPosToTargets(text, { role: 'eod' });
      toast.success(t('webPosShiftPrinted'));
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  /** Print whole-day EOD (all shifts / full calendar day). Managers with View all sales only. */
  const printDayEodFromShiftClose = async (opts?: { includeProductsSold?: boolean }) => {
    const includeProductsSold = opts?.includeProductsSold !== false;
    if (!lastClosedShift) {
      toast.error(t('webPosShiftNoReport'));
      return;
    }
    if (!mayPrintWholeDayEod) {
      toast.error(t('webPosEodPermissionDenied'));
      return;
    }
    try {
      let report: PosReportPayload | null = null;
      try {
        const repRes = await api.get('/merchant/reports/eod', {
          params: { preset: 'today' },
          headers: reportFetchHeaders(),
        });
        report = repRes.data.report;
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('webPosPrintFailed'));
        return;
      }
      const text = buildClosedShiftPrintPayload(
        report,
        includeProductsSold,
        'eod',
        t('webPosEodReport')
      );
      if (!text) {
        toast.error(t('webPosShiftNoReport'));
        return;
      }
      await printEscPosToTargets(text, { role: 'eod' });
      toast.success(t('webPosEodPrinted'));
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const handleRestartShift = () => {
    setShiftClosedOpen(false);
    pendingAfterShift.current = null;
    setStartShiftOpen(true);
  };

  const handleStaffLogoutFromShiftClosed = () => {
    setShiftClosedOpen(false);
    clearWebPosStaffSession();
    setWebposStaff(null);
    window.dispatchEvent(new CustomEvent('webpos:staff-session'));
  };

  /** EOD print/download when cash shifts are disabled (late-night venues). */
  const printTodayEod = async (
    scopeStaffId?: string | null,
    scopeStaffName?: string | null,
    opts?: { includeProductsSold?: boolean }
  ) => {
    const includeProductsSold = opts?.includeProductsSold !== false;
    if (!mayPrintWholeDayEod) {
      toast.error(t('webPosEodPermissionDenied'));
      return;
    }
    try {
      const headers: Record<string, string> = {};
      if (webposStaff?.accessToken) {
        headers['X-WebPos-Staff-Access'] = webposStaff.accessToken;
      }
      const params: Record<string, string> = { preset: 'today' };
      const adminViewAll =
        !staffConfigured ||
        (!!webposStaff && hasPermission(webposStaff.permissions, 'VIEW_ALL_SALES', false));
      if (adminViewAll && scopeStaffId) {
        params.staffId = scopeStaffId;
        if (scopeStaffName) params.staffName = scopeStaffName;
      }
      const repRes = await api.get('/merchant/reports/eod', {
        params,
        headers,
      });
      const report = repRes.data.report as {
        salesCount: number;
        revenue: number;
        subtotal?: number;
        taxTotal: number;
        netTotal?: number;
        tipsTotal?: number;
        grandTotal?: number;
        refundTotal: number;
        cancelledCount: number;
        cancelledTotal: number;
        cashTotal: number;
        cardTotal: number;
        terminalTotal: number;
        coversServed?: number | null;
        vatRows?: Array<{ label: string; net: number; tva: number; brut: number }>;
        productsSold: Array<{ name: string; quantity: number; total: number }>;
        paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
        orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
        channelRows?: Array<{ channel: string; count: number; total: number }>;
        range?: { label: string; from: string; to: string };
        shiftCash?: Array<{
          openingFloat: number;
          cashSales: number;
          expectedCash: number;
          closingCashCounted?: number | null;
          variance?: number | null;
          staffName?: string | null;
        }>;
      };
      const lang = resolveReceiptLanguage(printSettings, locale);
      const text = generateEodReportText({
        label: report?.range?.label || t('webPosEodReport'),
        periodFrom: report?.range?.from,
        periodTo: report?.range?.to,
        scopeStaffName:
          scopeStaffName ||
          (staffConfigured &&
          webposStaff &&
          !hasPermission(webposStaff.permissions, 'VIEW_ALL_SALES')
            ? webposStaff.name
            : null),
        salesCount: report?.salesCount ?? 0,
        revenue: report?.revenue ?? 0,
        subtotal: report?.subtotal ?? report?.revenue ?? 0,
        taxTotal: report?.taxTotal ?? 0,
        netTotal: report?.netTotal,
        tipsTotal: report?.tipsTotal,
        grandTotal: report?.grandTotal ?? report?.revenue ?? 0,
        refundTotal: report?.refundTotal ?? 0,
        cancelledCount: report?.cancelledCount ?? 0,
        cancelledTotal: report?.cancelledTotal ?? 0,
        cashTotal: report?.cashTotal ?? 0,
        cardTotal: report?.cardTotal ?? 0,
        terminalTotal: report?.terminalTotal ?? 0,
        coversServed: report?.coversServed,
        vatRows: report?.vatRows,
        productsSold: report?.productsSold ?? [],
        paymentRows: report?.paymentRows ?? [],
        orderTypeRows: report?.orderTypeRows,
        channelRows: report?.channelRows,
        businessName: merchant?.name || APP_NAME,
        language: lang,
        paperWidthMm: printSettings?.paperWidthMm || 80,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
        shiftCash: report?.shiftCash,
        includeProductsSold,
      });
      await printEscPosToTargets(text, { role: 'eod' });
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosPrintFailed'));
    }
  };

  const lineTotalFor = (unitPrice: number, quantity: number, discountPercent = 0) =>
    roundMoney2(unitPrice * quantity * (1 - discountPercent / 100));

  const removeSelectedLine = (line: CartLine) => {
    if (line.sentToKitchen) {
      setCancelModal({ scope: 'item', lineId: line.lineId });
      return;
    }
    setCart((prev) => prev.filter((l) => l.lineId !== line.lineId));
    setSelectedLineId(null);
    setKeypadBuffer('');
  };

  /** Apply a numeric buffer to the selected cart line. Live typing keeps the buffer. */
  const applyKeypadValue = (
    raw: string,
    opts?: { clearBuffer?: boolean; allowQtyDelete?: boolean; silentInvalid?: boolean }
  ) => {
    if (!selectedLineId) return;
    const clearBuffer = opts?.clearBuffer ?? false;
    const allowQtyDelete = opts?.allowQtyDelete ?? false;
    const silentInvalid = opts?.silentInvalid ?? false;

    // Incomplete entry while typing (e.g. ".", "12.")
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.' || raw.endsWith('.')) {
      if (!silentInvalid && clearBuffer) toast.error(t('webPosEnterPrice'));
      return;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      if (!silentInvalid) toast.error(t('webPosEnterPrice'));
      return;
    }

    const selected = cart.find((l) => l.lineId === selectedLineId);
    if (!selected) return;

    if (keypadMode === 'qty' && Math.round(value) <= 0) {
      if (!allowQtyDelete) return;
      removeSelectedLine(selected);
      return;
    }

    if (selected.sentToKitchen && (keypadMode === 'qty' || keypadMode === 'price')) {
      if (!silentInvalid) toast.error(t('webPosCancelSentToEdit'));
      return;
    }

    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== selectedLineId) return l;
        if (keypadMode === 'qty') {
          const quantity = Math.max(1, Math.round(value));
          return {
            ...l,
            quantity,
            lineTotal: lineTotalFor(l.unitPrice, quantity, l.lineDiscountPercent || 0),
          };
        }
        if (keypadMode === 'percent') {
          const pct = Math.max(0, Math.min(100, value));
          return {
            ...l,
            lineDiscountPercent: pct,
            lineTotal: lineTotalFor(l.unitPrice, l.quantity, pct),
          };
        }
        const unitPrice = roundMoney2(Math.max(0, value));
        return {
          ...l,
          unitPrice,
          isOpenPrice: true,
          lineTotal: lineTotalFor(unitPrice, l.quantity, l.lineDiscountPercent || 0),
        };
      })
    );
    if (clearBuffer) setKeypadBuffer('');
  };

  const applyKeypadToLine = () => {
    applyKeypadValue(keypadBuffer, { clearBuffer: true, allowQtyDelete: true });
    setSelectedLineId(null);
    setKeypadBuffer('');
  };

  const handleKeypadBufferChange = (buf: string) => {
    setKeypadBuffer(buf);
    applyKeypadValue(buf, { clearBuffer: false, allowQtyDelete: false, silentInvalid: true });
  };

  const handleKeypadModeChange = (mode: KeypadMode) => {
    setKeypadMode(mode);
    setKeypadBuffer('');
  };

  const handleSelectLine = (lineId: string | null) => {
    setSelectedLineId(lineId);
    setKeypadBuffer('');
  };

  const handleKeypadAdjust = (delta: number) => {
    if (!selectedLineId) return;
    const selected = cart.find((l) => l.lineId === selectedLineId);
    if (!selected) return;

    if (keypadMode === 'qty' || keypadMode === 'price') {
      if (selected.sentToKitchen) {
        toast.error(t('webPosCancelSentToEdit'));
        return;
      }
    }

    setKeypadBuffer('');

    if (keypadMode === 'qty') {
      const next = selected.quantity + delta;
      if (next <= 0) {
        removeSelectedLine(selected);
        return;
      }
      setCart((prev) =>
        prev.map((l) =>
          l.lineId !== selectedLineId
            ? l
            : {
                ...l,
                quantity: next,
                lineTotal: lineTotalFor(l.unitPrice, next, l.lineDiscountPercent || 0),
              }
        )
      );
      return;
    }

    if (keypadMode === 'percent') {
      const pct = Math.max(0, Math.min(100, (selected.lineDiscountPercent || 0) + delta));
      setCart((prev) =>
        prev.map((l) =>
          l.lineId !== selectedLineId
            ? l
            : {
                ...l,
                lineDiscountPercent: pct,
                lineTotal: lineTotalFor(l.unitPrice, l.quantity, pct),
              }
        )
      );
      return;
    }

    const unitPrice = roundMoney2(Math.max(0, selected.unitPrice + delta));
    setCart((prev) =>
      prev.map((l) =>
        l.lineId !== selectedLineId
          ? l
          : {
              ...l,
              unitPrice,
              isOpenPrice: true,
              lineTotal: lineTotalFor(unitPrice, l.quantity, l.lineDiscountPercent || 0),
            }
      )
    );
  };

  const handleKeypadBackspace = () => {
    if (!selectedLineId) return;

    if (keypadBuffer.length > 0) {
      const next = keypadBuffer.slice(0, -1);
      setKeypadBuffer(next);
      if (next !== '' && next !== '-' && next !== '.' && next !== '-.' && !next.endsWith('.')) {
        applyKeypadValue(next, { clearBuffer: false, allowQtyDelete: false, silentInvalid: true });
      }
      return;
    }

    const selected = cart.find((l) => l.lineId === selectedLineId);
    if (!selected) return;

    // 1st ⌫ (buffer empty): zero item price
    if (selected.unitPrice !== 0) {
      if (selected.sentToKitchen) {
        toast.error(t('webPosCancelSentToEdit'));
        return;
      }
      setCart((prev) =>
        prev.map((l) =>
          l.lineId !== selectedLineId
            ? l
            : {
                ...l,
                unitPrice: 0,
                isOpenPrice: true,
                lineTotal: 0,
              }
        )
      );
      return;
    }

    // 2nd ⌫: remove line
    removeSelectedLine(selected);
  };

  const advanceCourse = () => {
    if (!coursesEnabled) return;
    // Stamp current cart items without a course onto the active course, then open next
    setCart((prev) =>
      prev.map((l) =>
        l.courseNumber ? l : { ...l, courseNumber: activeCourse }
      )
    );
    const next = Math.max(activeCourse, ...courseNumbers, 0) + 1;
    setActiveCourse(next);
    toast.success(`${t('webPosCourse')} ${next}`);
  };

  const fireCourseLines = async (lines: CartLine[], courseOnly?: number) => {
    const ticket = ensureCartTicket();
    const ids = new Set(lines.map((l) => l.lineId));
    const sentAt = Date.now();
    // Mark sent first so Send can release the register immediately.
    setCart((prev) =>
      prev.map((l) =>
        ids.has(l.lineId) ? { ...l, sentToKitchen: true, sentToKitchenAt: l.sentToKitchenAt || sentAt } : l
      )
    );
    // Print agent can take several seconds; never block the Send button on it.
    // printKitchenForCart captures ticket fields synchronously before its first await.
    void printKitchenForCart(lines, effectiveChannel, {
        orderNumber: kitchenOrderNumber({ ticket }),
        when: fulfillmentWhen,
        courseOnly,
      }).catch((e: any) => {
      toast.error(e?.message || t('webPosKitchenPrintFailed'));
    });
  };

  /** Clear operator editing UI without deleting table/tab kitchen drafts. */
  const releaseOperatorAfterKitchen = (
    sentCart: CartLine[],
    opts?: { draftActiveCourse?: number }
  ) => {
    const wasTable = !!tableId;
    const pendingCourses = sentCart
      .filter((l) => !l.sentToKitchen)
      .map((l) => l.courseNumber || 1)
      .sort((a, b) => a - b);
    const draftActiveCourse =
      opts?.draftActiveCourse ?? pendingCourses[0] ?? activeCourse;
    if (tableId || tabNumber) {
      const key = openCartDraftKey({ tableId, tabNumber, channel: tableId ? 'dine_in' : channel });
      openCartDraftsRef.current.set(key, {
        cart: sentCart,
        channel: tableId ? 'dine_in' : channel,
        tableId,
        tableLabel,
        tabNumber,
        ticketDisplay,
        ticketOrderNumber,
        orderNote,
        activeCourse: draftActiveCourse,
        orderSent: true,
        coursesBulkSent: true,
        selectedLineId: null,
        keypadBuffer: '',
        billDiscount,
      });
      setDraftVersion((n) => n + 1);
    }
    setCart([]);
    setSelectedLineId(null);
    setKeypadBuffer('');
    setOrderNote('');
    setBillDiscount({ percent: 0, amount: 0 });
    setTableId(null);
    setTableLabel(null);
    setTabNumber(null);
    clearCartTicket();
    setActiveCourse(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel(null);
    setFulfillmentWhen(null);
    setSelectedCustomer(null);
    setProvisionalPrinted(false);
    if (wasTable) {
      setPosTab('tables');
      setPosView('tables');
    } else {
      setPosTab('register');
      setPosView('register');
    }
  };

  const sendCoursesToKitchen = async () => {
    if (!cart.length) return;
    setBusy(true);
    try {
      if (showFireCourseButton) {
        const lines = cart.filter(
          (l) => (l.courseNumber || 1) === activeCourse && !l.sentToKitchen
        );
        if (!lines.length) {
          toast.error(t('webPosNoItemsInCourse'));
          return;
        }
        const sentIds = new Set(lines.map((l) => l.lineId));
        const sentAt = Date.now();
        const sentCart = cart.map((l) =>
          sentIds.has(l.lineId)
            ? { ...l, sentToKitchen: true, sentToKitchenAt: l.sentToKitchenAt || sentAt }
            : l
        );
        const ticket = ensureCartTicket();
        // Orders panel only lists API held rows — persist before clearing the register.
        await persistHeldOrder(sentCart, true, { ticket });
        await fireCourseLines(lines, activeCourse);
        toast.success(t('webPosFireCourseDone').replace('{n}', String(activeCourse)));
        releaseOperatorAfterKitchen(sentCart);
        return;
      }

      const stamped = cart.map((l) =>
        l.courseNumber || !coursesEnabled
          ? l
          : { ...l, courseNumber: activeCourse }
      );
      const unsent = stamped.filter((l) => !l.sentToKitchen);
      let toSend: CartLine[];
      if (coursesEnabled && courseSendMode === 'fire_per_course') {
        // SEND fires Course 1; later courses wait for FIRE Course N
        const course1 = unsent.filter((l) => (l.courseNumber || 1) === 1);
        if (course1.length) {
          toSend = course1;
        } else if (unsent.length) {
          const minCourse = Math.min(...unsent.map((l) => l.courseNumber || 1));
          toSend = unsent.filter((l) => (l.courseNumber || 1) === minCourse);
        } else {
          toSend = stamped;
        }
      } else {
        toSend = unsent.length > 0 ? unsent : stamped;
      }

      const sentIds = new Set(toSend.map((l) => l.lineId));
      const sentAt = Date.now();
      const sentCart = stamped.map((l) =>
        sentIds.has(l.lineId)
          ? { ...l, sentToKitchen: true, sentToKitchenAt: l.sentToKitchenAt || sentAt }
          : l
      );
      const ticket = ensureCartTicket();
      // Print alone is not enough — Orders loads /merchant/pos/held + today's paid POS.
      await persistHeldOrder(sentCart, true, { ticket });
      await fireCourseLines(toSend);
      setOrderSent(true);
      setCoursesBulkSent(true);
      toast.success(t('webPosHeldSentKitchen'));
      releaseOperatorAfterKitchen(sentCart);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e.message || t('webPosKitchenPrintFailed'));
    } finally {
      setBusy(false);
    }
  };

  const snapshotOpenCartDraft = (): OpenCartDraft => ({
    cart,
    channel,
    tableId,
    tableLabel,
    tabNumber,
    ticketDisplay,
    ticketOrderNumber,
    orderNote,
    activeCourse,
    orderSent,
    coursesBulkSent,
    selectedLineId,
    keypadBuffer,
    billDiscount,
  });

  const saveOpenCartDraft = (override?: Partial<OpenCartDraft>) => {
    const snap = { ...snapshotOpenCartDraft(), ...override };
    const key = openCartDraftKey({
      tableId: snap.tableId,
      tabNumber: snap.tabNumber,
      channel: snap.channel,
    });
    if (draftOccupiesTable(snap)) {
      openCartDraftsRef.current.set(key, snap);
    } else {
      openCartDraftsRef.current.delete(key);
    }
    savePersistedWebPosCarts({
      drafts: draftsMapToRecord(openCartDraftsRef.current),
      active: draftOccupiesTable(snap) ? snap : null,
      mobileCartOpen,
      customer: selectedCustomer
        ? {
            id: selectedCustomer.id,
            firstName: selectedCustomer.firstName,
            lastName: selectedCustomer.lastName,
            phone: selectedCustomer.phone,
            email: selectedCustomer.email,
            defaultAddress: selectedCustomer.defaultAddress,
            defaultZip: selectedCustomer.defaultZip,
            defaultCity: selectedCustomer.defaultCity,
          }
        : null,
    });
    setDraftVersion((n) => n + 1);
    return key;
  };

  const applyOpenCartDraft = (draft: OpenCartDraft) => {
    setCart(draft.cart);
    setChannel(draft.channel);
    setTableId(draft.tableId);
    setTableLabel(draft.tableLabel);
    setTabNumber(draft.tabNumber);
    setTicketDisplay(draft.ticketDisplay ?? null);
    setTicketOrderNumber(draft.ticketOrderNumber ?? null);
    setOrderNote(draft.orderNote);
    setActiveCourse(draft.activeCourse);
    setOrderSent(draft.orderSent);
    setCoursesBulkSent(draft.coursesBulkSent);
    setSelectedLineId(draft.selectedLineId);
    setKeypadBuffer(draft.keypadBuffer);
    setBillDiscount(draft.billDiscount || { percent: 0, amount: 0 });
  };

  /** One arbitrary ticket per open cart (kitchen + receipt share the same shout #). */
  const ensureCartTicket = useCallback(() => {
    if (ticketDisplay && ticketOrderNumber) {
      return { display: ticketDisplay, orderNumber: ticketOrderNumber };
    }
    const isCounterDineIn =
      effectiveChannel === 'dine_in' && counterDineInEnabled && !tableId;
    const ticket = isCounterDineIn
      ? nextDineInCounterNumber(merchant?.id, openShift?.id)
      : nextWebPosTicketNumber(merchant?.id);
    setTicketDisplay(ticket.display);
    setTicketOrderNumber(ticket.orderNumber);
    return ticket;
  }, [
    ticketDisplay,
    ticketOrderNumber,
    merchant?.id,
    effectiveChannel,
    counterDineInEnabled,
    tableId,
    openShift?.id,
  ]);

  const clearCartTicket = useCallback(() => {
    setTicketDisplay(null);
    setTicketOrderNumber(null);
  }, []);

  /** Kitchen shout number — after tab assignment use tab #, not a stale pre-tab ticket. */
  const kitchenOrderNumber = useCallback(
    (opts?: { ticket?: { display: string; orderNumber: string } }) => {
      if (tabNumber) return `#${tabNumber}`;
      const ticket = opts?.ticket ?? (ticketDisplay ? { display: ticketDisplay, orderNumber: ticketOrderNumber! } : null);
      if (ticket?.display) return ticket.display;
      return ensureCartTicket().display;
    },
    [tabNumber, ticketDisplay, ticketOrderNumber, ensureCartTicket]
  );

  /**
   * Persist cart to /merchant/pos/held so Orders can list kitchen / held tickets.
   * Upserts by ticket (or table / tab) so re-sends update the same row.
   */
  const persistHeldOrder = async (
    cartLines: CartLine[],
    sendToKitchen: boolean,
    opts?: { ticket?: { display: string; orderNumber: string } }
  ) => {
    if (!cartLines.length) return;
    const ticket = opts?.ticket ?? ensureCartTicket();
    const cartSum = cartLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
    const heldLabel = [
      tableLabel || null,
      tabNumber ? `${t('webPosTab')} ${tabNumber}` : null,
      ticket.display,
      channel,
      money(cartSum),
    ]
      .filter(Boolean)
      .join(' · ');
    const cartJson = {
      cart: cartLines,
      channel,
      tableId,
      tableLabel,
      tabNumber,
      ticketDisplay: ticket.display,
      ticketOrderNumber: ticket.orderNumber,
      billDiscount,
      orderNote,
    };

    try {
      const res = await api.get('/merchant/pos/held');
      const list = (res.data?.held || []) as Array<{
        id: string;
        cartJson?: Record<string, unknown> | null;
      }>;
      for (const h of list) {
        const cj = h.cartJson;
        if (!cj || typeof cj !== 'object') continue;
        const sameTicket =
          typeof cj.ticketDisplay === 'string' && cj.ticketDisplay === ticket.display;
        const sameTable = !!tableId && cj.tableId === tableId;
        const sameTab =
          !!tabNumber && !tableId && cj.tabNumber === tabNumber && !cj.tableId;
        if (sameTicket || sameTable || sameTab) {
          await api.delete(`/merchant/pos/held/${h.id}`);
        }
      }
    } catch {
      /* best-effort upsert cleanup */
    }

    await api.post('/merchant/pos/held', {
      label: heldLabel,
      channel,
      cartJson,
      staffId: webposStaff?.id,
      staffName: webposStaff?.name,
      sendToKitchen,
    });
    setOrdersRefreshToken((n) => n + 1);
  };

  /** Attach current cart lines to a table (Set table) — never wipe the cart. */
  const assignCartToTable = (table: { id: string; label: string }) => {
    const fromKey = openCartDraftKey({ tableId, tabNumber, channel });
    const toKey = openCartDraftKey({ tableId: table.id, channel: 'dine_in' });
    const existing = fromKey !== toKey ? openCartDraftsRef.current.get(toKey) : undefined;

    const movingCart = cart;
    let nextCart = movingCart;
    let nextNote = orderNote;
    let nextCourse = activeCourse;
    let nextOrderSent = orderSent;
    let nextCoursesBulkSent = coursesBulkSent;
    let nextBillDiscount = billDiscount;

    if (existing && (existing.cart.length > 0 || existing.orderSent)) {
      const existingIds = new Set(existing.cart.map((l) => l.lineId));
      const incoming = movingCart.filter((l) => !existingIds.has(l.lineId));
      nextCart = [...existing.cart, ...incoming];
      nextOrderSent = existing.orderSent || orderSent;
      nextCoursesBulkSent = existing.coursesBulkSent || coursesBulkSent;
      nextCourse = Math.max(existing.activeCourse || 1, activeCourse || 1);
      if (existing.orderNote && orderNote && existing.orderNote !== orderNote) {
        nextNote = `${existing.orderNote} · ${orderNote}`;
      } else {
        nextNote = orderNote || existing.orderNote || '';
      }
      nextBillDiscount = mergeBillDiscounts(billDiscount, existing.billDiscount);
    }

    if (fromKey !== toKey) {
      openCartDraftsRef.current.delete(fromKey);
    }

    setCart(nextCart);
    setTableId(table.id);
    setTableLabel(table.label);
    setChannel('dine_in');
    setTabNumber(null);
    setOrderNote(nextNote);
    setActiveCourse(nextCourse);
    setOrderSent(nextOrderSent);
    setCoursesBulkSent(nextCoursesBulkSent);
    setBillDiscount(nextBillDiscount);
    setFulfillmentWhen(null);

    openCartDraftsRef.current.set(toKey, {
      cart: nextCart,
      channel: 'dine_in',
      tableId: table.id,
      tableLabel: table.label,
      tabNumber: null,
      orderNote: nextNote,
      activeCourse: nextCourse,
      orderSent: nextOrderSent,
      coursesBulkSent: nextCoursesBulkSent,
      selectedLineId,
      keypadBuffer,
      billDiscount: nextBillDiscount,
    });
    setDraftVersion((n) => n + 1);
    setPosTab('register');
    setPosView('register');
  };

  /** Open a table from the Tables plan (load that table's draft / empty order). */
  const switchToTableOrder = (table: { id: string; label: string }) => {
    saveOpenCartDraft();
    const key = openCartDraftKey({ tableId: table.id, channel: 'dine_in' });
    const existing = openCartDraftsRef.current.get(key);
    if (existing) {
      applyOpenCartDraft(existing);
    } else {
      setCart([]);
      setSelectedLineId(null);
      setKeypadBuffer('');
      setOrderNote('');
      setBillDiscount({ percent: 0, amount: 0 });
      setTabNumber(null);
      clearCartTicket();
      setActiveCourse(1);
      setOrderSent(false);
      setCoursesBulkSent(false);
      setFulfillmentWhen(null);
      setSelectedCustomer(null);
      setTableId(table.id);
      setTableLabel(table.label);
      setChannel('dine_in');
    }
    setPosTab('register');
    setPosView('register');
  };

  const startNewOrder = async (force = false) => {
    if (cart.length > 0 && !force) {
      setNewOrderConfirmOpen(true);
      return;
    }
    if (cart.length > 0) {
      try {
        await persistHeldOrder(cart, orderSent || cart.some((l) => l.sentToKitchen));
      } catch {
        /* best-effort — do not lose held order on New */
      }
    }
    resumedHeldIdRef.current = null;
    const key = openCartDraftKey({ tableId, tabNumber, channel });
    openCartDraftsRef.current.delete(key);
    setDraftVersion((n) => n + 1);
    setCart([]);
    setSelectedLineId(null);
    setKeypadBuffer('');
    setMobileCartOpen(false);
    setOrderNote('');
    setBillDiscount({ percent: 0, amount: 0 });
    setTableId(null);
    setTableLabel(null);
    setTabNumber(null);
    clearCartTicket();
    setActiveCourse(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel('takeaway');
    setFulfillmentWhen(asapFulfillment());
    setSelectedCustomer(null);
    clearAttachedMembership();
    setProvisionalPrinted(false);
    savePersistedWebPosCarts({
      drafts: draftsMapToRecord(openCartDraftsRef.current),
      active: null,
      mobileCartOpen: false,
      customer: null,
    });
  };

  const clearHeldOrdersForTable = async (tid: string) => {
    const res = await api.get('/merchant/pos/held');
    const list = (res.data?.held || []) as Array<{
      id: string;
      cartJson?: Record<string, unknown> | null;
    }>;
    for (const h of list) {
      const cj = h.cartJson;
      if (!cj || typeof cj !== 'object') continue;
      if (cj.tableId !== tid) continue;
      await api.delete(`/merchant/pos/held/${h.id}`);
    }
  };

  const releaseEmptyTable = () => {
    if (!tableId || cart.length > 0 || orderSent) return;
    const releasedId = tableId;
    void (async () => {
      const key = openCartDraftKey({ tableId: releasedId, tabNumber, channel });
      openCartDraftsRef.current.delete(key);
      setDraftVersion((n) => n + 1);
      resumedHeldIdRef.current = null;
      setCart([]);
      setSelectedLineId(null);
      setKeypadBuffer('');
      setMobileCartOpen(false);
      setOrderNote('');
      setBillDiscount({ percent: 0, amount: 0 });
      setTableId(null);
      setTableLabel(null);
      setTabNumber(null);
      clearCartTicket();
      setActiveCourse(1);
      setOrderSent(false);
      setCoursesBulkSent(false);
      setChannel('takeaway');
      setFulfillmentWhen(asapFulfillment());
      setSelectedCustomer(null);
      clearAttachedMembership();
      setProvisionalPrinted(false);
      savePersistedWebPosCarts({
        drafts: draftsMapToRecord(openCartDraftsRef.current),
        active: null,
        mobileCartOpen: false,
        customer: null,
      });
      try {
        await clearHeldOrdersForTable(releasedId);
        await api.patch(`/merchant/floor-plans/tables/${releasedId}/status`, {
          status: 'available',
          currentOrderId: null,
        });
      } catch {
        /* best-effort server sync */
      }
      setOrdersRefreshToken((n) => n + 1);
      setTablesRefreshToken((n) => n + 1);
      setPosTab('tables');
      setPosView('tables');
      toast.success(t('webPosTableReleased'));
    })();
  };

  const getDraftForTable = (tid: string): OpenCartDraft | undefined => {
    if (tableId === tid) return snapshotOpenCartDraft();
    return openCartDraftsRef.current.get(openCartDraftKey({ tableId: tid, channel: 'dine_in' }));
  };

  const syncHeldOrdersForTableMove = async (
    sourceId: string,
    target: { id: string; label: string },
    mutateCart?: (cart: CartLine[]) => CartLine[]
  ) => {
    try {
      const res = await api.get('/merchant/pos/held');
      const list = (res.data?.held || []) as Array<{
        id: string;
        label?: string;
        channel?: string | null;
        cartJson?: Record<string, unknown>;
        status?: string;
      }>;
      for (const h of list) {
        const cj = h.cartJson;
        if (!cj || typeof cj !== 'object') continue;
        if (cj.tableId !== sourceId) continue;
        const prevCart = Array.isArray(cj.cart) ? (cj.cart as CartLine[]) : [];
        const nextCart = mutateCart ? mutateCart(prevCart) : prevCart;
        await api.delete(`/merchant/pos/held/${h.id}`);
        if (!nextCart.length && mutateCart) continue;
        await api.post('/merchant/pos/held', {
          label: h.label || `${target.label} · ${money(payableFullTotals.total)}`,
          channel: 'dine_in',
          cartJson: {
            ...cj,
            cart: nextCart,
            channel: 'dine_in',
            tableId: target.id,
            tableLabel: target.label,
          },
          staffId: webposStaff?.id,
          staffName: webposStaff?.name,
          sendToKitchen: h.status === 'sent_to_kitchen',
        });
      }
    } catch {
      /* best-effort */
    }
  };

  const openMoveTablePicker = (source?: { id: string; label: string }) => {
    const src =
      source || (tableId && tableLabel ? { id: tableId, label: tableLabel } : null);
    if (!src) {
      toast.error(t('webPosSetTable'));
      return;
    }
    saveOpenCartDraft();
    const draft = getDraftForTable(src.id);
    if (!draft || (!draft.cart.length && !draft.orderSent)) {
      toast.error(t('webPosSetTable'));
      return;
    }
    setMoveSourceTable(src);
    setMoveLineId(null);
    setMergeTarget(null);
    setTablePickerPurpose('move_table');
    setSetTableOpen(true);
  };

  const openMoveDishPicker = () => {
    if (!tableId || !tableLabel || !selectedLineId) return;
    saveOpenCartDraft();
    setMoveSourceTable({ id: tableId, label: tableLabel });
    setMoveLineId(selectedLineId);
    setMergeTarget(null);
    setTablePickerPurpose('move_dish');
    setSetTableOpen(true);
  };

  const executeMoveEntireTable = async (
    source: { id: string; label: string },
    target: { id: string; label: string },
    merge: boolean
  ) => {
    if (tableId === source.id || tableId === target.id) {
      saveOpenCartDraft();
    }
    const srcDraft = getDraftForTable(source.id);
    if (!srcDraft || (!srcDraft.cart.length && !srcDraft.orderSent)) return;
    const tgtDraft = getDraftForTable(target.id);
    const targetOccupied = !!(tgtDraft && (tgtDraft.cart.length > 0 || tgtDraft.orderSent));
    if (targetOccupied && !merge) return;

    const sourceKey = openCartDraftKey({ tableId: source.id, channel: 'dine_in' });
    const targetKey = openCartDraftKey({ tableId: target.id, channel: 'dine_in' });

    let result: OpenCartDraft;
    if (merge && tgtDraft) {
      const existingIds = new Set(tgtDraft.cart.map((l) => l.lineId));
      const incoming = srcDraft.cart.filter((l) => !existingIds.has(l.lineId));
      let nextNote = tgtDraft.orderNote || srcDraft.orderNote || '';
      if (tgtDraft.orderNote && srcDraft.orderNote && tgtDraft.orderNote !== srcDraft.orderNote) {
        nextNote = `${tgtDraft.orderNote} · ${srcDraft.orderNote}`;
      }
      result = {
        cart: [...tgtDraft.cart, ...incoming],
        channel: 'dine_in',
        tableId: target.id,
        tableLabel: target.label,
        tabNumber: null,
        orderNote: nextNote,
        activeCourse: Math.max(tgtDraft.activeCourse || 1, srcDraft.activeCourse || 1),
        orderSent: tgtDraft.orderSent || srcDraft.orderSent,
        coursesBulkSent: tgtDraft.coursesBulkSent || srcDraft.coursesBulkSent,
        selectedLineId: null,
        keypadBuffer: '',
        billDiscount: mergeBillDiscounts(srcDraft.billDiscount, tgtDraft.billDiscount),
      };
    } else {
      result = {
        ...srcDraft,
        channel: 'dine_in',
        tableId: target.id,
        tableLabel: target.label,
        tabNumber: null,
      };
    }

    openCartDraftsRef.current.delete(sourceKey);
    openCartDraftsRef.current.set(targetKey, result);

    if (tableId === source.id || tableId === target.id) {
      applyOpenCartDraft(result);
    } else {
      setDraftVersion((n) => n + 1);
    }

    await syncHeldOrdersForTableMove(source.id, target);

    toast.success(
      (merge ? t('webPosTableMerged') : t('webPosTableMoved')).replace('{table}', target.label)
    );
    setMoveSourceTable(null);
    setMoveLineId(null);
    setMergeTarget(null);
    setTablePickerPurpose('set');
  };

  const executeMoveDish = async (
    source: { id: string; label: string },
    target: { id: string; label: string },
    lineId: string
  ) => {
    if (tableId === source.id || tableId === target.id) {
      saveOpenCartDraft();
    }
    const srcDraft = getDraftForTable(source.id);
    if (!srcDraft) return;
    const line = srcDraft.cart.find((l) => l.lineId === lineId);
    if (!line) return;

    const sourceKey = openCartDraftKey({ tableId: source.id, channel: 'dine_in' });
    const targetKey = openCartDraftKey({ tableId: target.id, channel: 'dine_in' });
    const newSourceCart = srcDraft.cart.filter((l) => l.lineId !== lineId);

    let tgtDraft = getDraftForTable(target.id);
    if (!tgtDraft) {
      tgtDraft = {
        cart: [],
        channel: 'dine_in',
        tableId: target.id,
        tableLabel: target.label,
        tabNumber: null,
        orderNote: '',
        activeCourse: 1,
        orderSent: false,
        coursesBulkSent: false,
        selectedLineId: null,
        keypadBuffer: '',
        billDiscount: { percent: 0, amount: 0 },
      };
    }

    const updatedTarget: OpenCartDraft = {
      ...tgtDraft,
      cart: tgtDraft.cart.some((l) => l.lineId === lineId)
        ? tgtDraft.cart
        : [...tgtDraft.cart, line],
      channel: 'dine_in',
      tableId: target.id,
      tableLabel: target.label,
      tabNumber: null,
    };
    openCartDraftsRef.current.set(targetKey, updatedTarget);

    if (newSourceCart.length === 0) {
      openCartDraftsRef.current.delete(sourceKey);
    } else {
      openCartDraftsRef.current.set(sourceKey, {
        ...srcDraft,
        cart: newSourceCart,
        selectedLineId: srcDraft.selectedLineId === lineId ? null : srcDraft.selectedLineId,
      });
    }

    if (tableId === source.id) {
      if (newSourceCart.length === 0) {
        setCart([]);
        setSelectedLineId(null);
        setKeypadBuffer('');
        setOrderNote('');
        setBillDiscount({ percent: 0, amount: 0 });
        setTableId(null);
        setTableLabel(null);
        setOrderSent(false);
        setCoursesBulkSent(false);
        setChannel(null);
        setDraftVersion((n) => n + 1);
      } else {
        applyOpenCartDraft({
          ...srcDraft,
          cart: newSourceCart,
          selectedLineId: srcDraft.selectedLineId === lineId ? null : srcDraft.selectedLineId,
        });
      }
    } else if (tableId === target.id) {
      applyOpenCartDraft(updatedTarget);
    } else {
      setDraftVersion((n) => n + 1);
    }

    try {
      const res = await api.get('/merchant/pos/held');
      const list = (res.data?.held || []) as Array<{
        id: string;
        label?: string;
        channel?: string | null;
        cartJson?: Record<string, unknown>;
        status?: string;
      }>;
      for (const h of list) {
        const cj = h.cartJson;
        if (!cj || typeof cj !== 'object' || cj.tableId !== source.id) continue;
        const prevCart = Array.isArray(cj.cart) ? (cj.cart as CartLine[]) : [];
        if (!prevCart.some((l) => l.lineId === lineId)) continue;
        const moved = prevCart.find((l) => l.lineId === lineId)!;
        const remaining = prevCart.filter((l) => l.lineId !== lineId);
        await api.delete(`/merchant/pos/held/${h.id}`);
        if (remaining.length) {
          await api.post('/merchant/pos/held', {
            label: h.label,
            channel: (cj.channel as string) || 'dine_in',
            cartJson: { ...cj, cart: remaining },
            staffId: webposStaff?.id,
            staffName: webposStaff?.name,
            sendToKitchen: h.status === 'sent_to_kitchen',
          });
        }
        await api.post('/merchant/pos/held', {
          label: `${target.label} · ${moved.name}`,
          channel: 'dine_in',
          cartJson: {
            cart: [moved],
            channel: 'dine_in',
            tableId: target.id,
            tableLabel: target.label,
          },
          staffId: webposStaff?.id,
          staffName: webposStaff?.name,
          sendToKitchen: !!moved.sentToKitchen,
        });
      }
    } catch {
      /* best-effort */
    }

    toast.success(t('webPosDishMoved').replace('{table}', target.label));
    setMoveSourceTable(null);
    setMoveLineId(null);
    setTablePickerPurpose('set');
  };

  const handleTablePickerSelect = (table: { id: string; label: string }) => {
    setSetTableOpen(false);
    if (tablePickerPurpose === 'set') {
      assignCartToTable(table);
      return;
    }
    if (tablePickerPurpose === 'move_table') {
      const source = moveSourceTable;
      if (!source) return;
      if (source.id === table.id) {
        toast.error(t('webPosSameTable'));
        return;
      }
      const targetDraft = getDraftForTable(table.id);
      if (targetDraft && (targetDraft.cart.length > 0 || targetDraft.orderSent)) {
        setMergeTarget(table);
        return;
      }
      void executeMoveEntireTable(source, table, false);
      return;
    }
    if (tablePickerPurpose === 'move_dish') {
      const source =
        moveSourceTable ||
        (tableId && tableLabel ? { id: tableId, label: tableLabel } : null);
      if (!source || !moveLineId) return;
      if (source.id === table.id) {
        toast.error(t('webPosSameTable'));
        return;
      }
      void executeMoveDish(source, table, moveLineId);
    }
  };

  const checkoutBillDiscountExtras = () => {
    const amount = resolveBillDiscountAmount(fullTotals, billDiscount, vatIncludedInPrice);
    return {
      discountPercent: billDiscount.percent,
      discountAmount:
        billDiscount.percent > 0 ? amount : billDiscount.amount > 0 ? billDiscount.amount : amount,
    };
  };

  const printProvisionalReceipt = async () => {
    if (!cart.length) return;
    try {
      const ticket = ensureCartTicket();
      const lang = resolveReceiptLanguage(printSettings, paymentConfig?.panelLanguage || locale);
      const disc = payableFullTotals.discount || 0;
      const receiptPayload: WebPosReceipt = {
        businessName: merchant?.name || APP_NAME,
        address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
        phone: merchant?.phone || undefined,
        vatNumber: merchant?.vatNumber || undefined,
        id: `prov-${Date.now()}`,
        orderDisplay: ticket.display,
        orderNumber: ticket.orderNumber,
        completedAt: Date.now(),
        channel: effectiveChannel,
        paymentMethod: 'cash',
        isProvisional: true,
        tableLabel,
        items: cart.map((l) => ({
          name: lineExtrasLabel(l) ? `${l.name} (${lineExtrasLabel(l)})` : l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          productId: l.productId,
          categoryId: l.categoryId,
        })),
        subtotal: fullTotals.subtotal,
        discount: disc,
        taxAmount: fullTotals.tax,
        taxRate,
        rounding: payableFullTotals.rounding,
        total: payableFullTotals.total,
        vatIncludedInPrice,
        vatAfterDiscount,
        language: lang,
        paperWidthMm: printSettings?.paperWidthMm || 80,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
        showVat: printSettings?.receiptShowVatTable !== false,
        showStaff: printSettings?.receiptShowStaffLine !== false,
        staffName: webposStaff?.name,
        includeQr: false,
      };
      const text = generateWebPosReceiptText(receiptPayload, locale);
      setProvisionalPrinted(true);
      toast.success(t('webPosProvisionalPrinted'));
      void printEscPosToTargets(text, { role: 'receipt', quiet: true }).catch((e: any) => {
        toast.error(e?.message || t('webPosPrintFailed'));
      });
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const onKitchenMessage = async (message: string) => {
    try {
      const orderNumber = kitchenOrderNumber();
      const whenSnapshot = fulfillmentWhen;
      toast.success(t('webPosKitchenMessageSent'));
      const lang = resolveReceiptLanguage(printSettings, paymentConfig?.panelLanguage || locale);
      const paperWidthMm = resolveKitchenPaperWidthMm(printSettings, printSettings?.paperWidthMm || 80);
      const msgOpts = {
        message,
        language: lang,
        paperWidthMm,
        orderNumber,
        tableLabel: tableLabel || null,
        tabNumber: tabNumber || null,
        userName: webposStaff?.name || null,
        orderedAt: Date.now(),
        orderSource: 'WEBPOS' as const,
      };
      const escpos = generateKitchenMessageTicketEscPos(msgOpts);
      const text = generateKitchenMessageTicketText(msgOpts);
      void printViaAgentOrQueue({
        printerName: printerName || undefined,
        dataBase64: uint8ToBase64(escpos),
        text,
        orderId: orderNumber,
      }).catch((e: any) => {
        toast.error(e?.message || t('webPosKitchenPrintFailed'));
      });
    } catch (e: any) {
      toast.error(e.message || t('webPosKitchenPrintFailed'));
    }
  };

  const asapFulfillment = (): FulfillmentWhen => ({
    mode: 'asap',
    scheduledFor: null,
    label: t('webPosAsap'),
  });

  const openRegisterCheckout = () => {
    if (!cart.length || busy) return;
    if (
      (channel === 'delivery' || channel === 'takeaway') &&
      !fulfillmentWhen
    ) {
      setFulfillmentWhen(asapFulfillment());
    }
    if (channel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod('cash');
      setCustomerOpen(true);
      return;
    }
    setMobileCartOpen(false);
    setSelectedLineId(null);
    setPosView('checkout');
  };

  const leaveTableForChannel = () => {
    saveOpenCartDraft();
    if (tableId) {
      openCartDraftsRef.current.delete(openCartDraftKey({ tableId, channel: 'dine_in' }));
      setTableId(null);
      setTableLabel(null);
      setDraftVersion((n) => n + 1);
    }
  };

  const selectFulfillmentChannel = (ch: 'takeaway' | 'delivery' | 'dine_in') => {
    if (ch === 'dine_in' && channel === 'dine_in') {
      leaveTableForChannel();
      if (!tableId) clearCartTicket();
      setChannel('takeaway');
      setFulfillmentWhen(asapFulfillment());
      return;
    }
    leaveTableForChannel();
    if (channel === 'dine_in' && ch !== 'dine_in' && !tableId) {
      clearCartTicket();
    }
    const channelChanged = channel !== ch;
    setChannel(ch);
    if (ch === 'dine_in' && counterDineInEnabled) {
      setFulfillmentWhen(null);
      if (!ticketDisplay) {
        const ticket = nextDineInCounterNumber(merchant?.id, openShift?.id);
        setTicketDisplay(ticket.display);
        setTicketOrderNumber(ticket.orderNumber);
      }
      return;
    }
    // Default ASAP immediately — no modal. Keep existing when re-tapping same channel.
    if (channelChanged || !fulfillmentWhen) {
      setFulfillmentWhen(asapFulfillment());
    }
  };

  /** Menu: switch to dine-in; table picker only when tables are required. */
  const switchToDineIn = () => {
    if (channel !== 'dine_in') {
      setChannel('dine_in');
      setFulfillmentWhen(null);
    }
    if (counterDineInEnabled) {
      if (!ticketDisplay) {
        const ticket = nextDineInCounterNumber(merchant?.id, openShift?.id);
        setTicketDisplay(ticket.display);
        setTicketOrderNumber(ticket.orderNumber);
      }
      return;
    }
    if (!tableId) {
      setTablePickerPurpose('set');
      setMoveSourceTable(null);
      setMoveLineId(null);
      setSetTableOpen(true);
    }
  };

  const confirmCancelCart = async (reason: string, reasonId?: string) => {
    if (!cancelModal) return;
    const scope = cancelModal.scope;
    const lineId = cancelModal.lineId;
    const kitchenLines =
      scope === 'item'
        ? cart.filter((l) => l.lineId === lineId && l.sentToKitchen)
        : cart.filter((l) => l.sentToKitchen);
    const recordLines =
      scope === 'item' && lineId
        ? cart.filter((l) => l.lineId === lineId)
        : [...cart];

    setCancelModal(null);
    setBusy(true);
    try {
      if (kitchenLines.length) {
        const ticket = nextWebPosTicketNumber(merchant?.id);
        await printKitchenForCart(kitchenLines, effectiveChannel, {
          orderNumber: kitchenOrderNumber(),
          when: fulfillmentWhen,
          cancelled: true,
          cancelReason: reason,
          forcePrint: true,
        });
      }

      // Persist cancellation for EOD / sales reports (reason required).
      if (recordLines.length) {
        const ticket = nextWebPosTicketNumber(merchant?.id);
        const cancelBase = computeMerchandiseTotals(
          recordLines,
          taxRate,
          vatIncludedInPrice,
          roundingStep
        );
        const cancelTotals = { ...cancelBase, discount: 0 };
        const clientId = `webpos-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const sale = {
          ...buildSalePayload(
            clientId,
            'cash',
            fulfillmentWhen,
            ticket.orderNumber,
            null,
            recordLines,
            cancelTotals,
            undefined,
            ticket
          ),
          status: 'cancelled',
          paymentStatus: 'cancelled',
          cancelReason: reasonId || reason,
          cancelledAt: Date.now(),
          completedAt: undefined,
        };
        await api.post('/sync/push-sales', { sales: [sale] });
        setOrdersRefreshToken((n) => n + 1);
      }

      if (scope === 'item' && lineId) {
        setCart((prev) => {
          const next = prev.filter((l) => l.lineId !== lineId);
          if (next.length === 0) {
            setOrderSent(false);
            setCoursesBulkSent(false);
          }
          return next;
        });
        if (selectedLineId === lineId) setSelectedLineId(null);
        toast.success(t('webPosItemCancelled'));
      } else {
        void startNewOrder(true);
        toast.success(t('webPosOrderCancelled'));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosCancelFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addGiftCardLine = (meta: GiftCardCartMeta, lineName: string) => {
    const doAdd = () => {
    const amount = roundMoney2(meta.amount);
    const line: CartLine = {
      lineId: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: `__gift_card_${meta.op}__`,
      name: lineName,
      quantity: 1,
      unitPrice: amount,
      lineTotal: amount,
      taxable: false,
      selectedExtras: [],
      comboSelections: [],
      isOpenPrice: true,
      giftCard: {
        op: meta.op,
        cardNumber: meta.cardNumber,
        cardId: meta.cardId,
        mediaType: meta.mediaType,
        amount,
        ecardEmail: meta.ecardEmail,
        holderName: meta.holderName,
        deliveryMethod: meta.deliveryMethod,
      },
    };
    setCart((prev) => [...prev, line]);
    setSelectedLineId(line.lineId);
    setPosTab('register');
    setPosView('register');
    toast.success(t('giftCardAddedToCart'));
    };
    if (meta.op === 'sell') {
      void ensureShift(doAdd);
      return;
    }
    doAdd();
  };

  const pushCustomAmountLine = (amount: number) => {
    const price = roundMoney2(amount);
    if (price <= 0) return;
    const courseNumber = coursesEnabled ? activeCourse : undefined;
    const lineId = `misc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCart((prev) => [
      ...prev,
      {
        lineId,
        productId: '__misc__',
        name: t('webPosCustomAmount'),
        quantity: 1,
        unitPrice: price,
        lineTotal: price,
        taxable: true,
        selectedExtras: [],
        comboSelections: [],
        isOpenPrice: true,
        courseNumber,
      },
    ]);
    setSelectedLineId(null);
    setKeypadBuffer('');
    setPosTab('register');
    setPosView('register');
  };

  const addCustomAmountLine = (amount: number) => {
    void ensureShift(() => pushCustomAmountLine(amount));
  };

  const openCustomAmountModal = () => {
    void ensureShift(() => setCustomAmountOpen(true));
  };

  const printGiftCardSaleReceipt = async (opts: {
    code: string;
    balance: number;
    recipientEmail?: string | null;
    holderName?: string | null;
  }) => {
    const lang = resolveReceiptLanguage(printSettings, paymentConfig?.panelLanguage || locale);
    const showVat = printSettings?.receiptShowVatTable !== false;
    const vat = computeGiftCardSaleVat(opts.balance, taxRate, vatIncludedInPrice);
    const text = generateGiftCardSaleReceiptText(
      {
        businessName: merchant?.name || APP_NAME,
        address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
        phone: merchant?.phone || undefined,
        vatNumber: merchant?.vatNumber || undefined,
        code: opts.code,
        balance: opts.balance,
        subtotal: vat.subtotal,
        taxAmount: vat.taxAmount,
        taxRate,
        total: vat.total,
        vatIncludedInPrice,
        showVat,
        recipientEmail: opts.recipientEmail,
        holderName: opts.holderName,
        language: lang,
        paperWidthMm: printSettings?.paperWidthMm || 80,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
      },
      locale
    );
    const paper = printSettings?.paperWidthMm || 80;
    const logoUrl =
      printSettings?.receiptLogoUrl || merchant?.shopLogoUrl || paymentConfig?.shopLogoUrl;
    let logo: Uint8Array | null = null;
    if (logoUrl) {
      const cacheKey = `${String(logoUrl)}|${paper}`;
      if (logoEscPosCacheRef.current?.key === cacheKey) {
        logo = logoEscPosCacheRef.current.bytes;
      } else {
        logo = await logoUrlToEscPos(String(logoUrl), paper === 58 ? 240 : 384);
        logoEscPosCacheRef.current = { key: cacheKey, bytes: logo };
      }
    }
    const escpos = giftCardSaleReceiptEscPos(text, opts.code, logo);
    const dataBase64 = uint8ToBase64(escpos);
    const targets = printersForRole(printSettings, 'receipt');
    const names =
      targets.length > 0
        ? targets.map((x) => x.name)
        : [printerName || ''];
    const named = names.map((n) => (n || '').trim()).filter(Boolean);
    let printedOk = 0;
    let queuedOk = 0;
    for (const label of named) {
      if (label && isUnsuitableRawPrinter(label)) {
        throw new Error(unsuitableRawPrinterMessage(label) || t('webPosUnsuitablePrinter'));
      }
      try {
        const mode = await printViaAgentOrQueue({
          printerName: label || undefined,
          dataBase64,
          text,
        });
        if (mode === 'queued') queuedOk += 1;
        else printedOk += 1;
      } catch (e: any) {
        throw e;
      }
    }
    if (!printedOk && !queuedOk) {
      throw new Error(t('webPosPrintFailed'));
    }
  };

  const fulfillEcardDeliveries = async (
    saleLines: CartLine[],
    orderId?: string | null
  ) => {
    for (const line of saleLines) {
      const gc = line.giftCard;
      if (!gc || gc.op !== 'sell' || gc.mediaType !== 'e_card') continue;
      const delivery = gc.deliveryMethod || 'print';
      try {
        const creditRes = await api.post('/gift-cards/credit', {
          type: gc.op,
          cardId: gc.cardId,
          cardNumber: gc.cardNumber || undefined,
          cardMediaType: 'e_card',
          ecardEmail: gc.ecardEmail,
          holderName: gc.holderName,
          amount: gc.amount,
          orderId: orderId || undefined,
          createIfMissing: true,
        });
        const card = creditRes.data?.card;
        const code = String(card?.ecardCode || card?.cardNumber || '').trim();
        if (!code) continue;
        const balance = Number(card?.balance ?? gc.amount);
        if (delivery === 'print' || delivery === 'both') {
          void printGiftCardSaleReceipt({
            code,
            balance,
            recipientEmail: gc.ecardEmail,
            holderName: gc.holderName,
          }).catch((e: any) => toast.error(e?.message || t('webPosPrintFailed')));
        }
        if ((delivery === 'email' || delivery === 'both') && gc.ecardEmail) {
          await api.post('/gift-cards/send-ecard-email', {
            to: gc.ecardEmail,
            code,
            balance,
            holderName: gc.holderName,
            orderId: orderId || undefined,
          });
          toast.success(t('giftCardEcardEmailSent'));
        }
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('giftCardCreditFailed'));
      }
    }
  };

  const creditGiftCardLines = async (saleLines: CartLine[], orderId?: string | null) => {
    const ecardLines = saleLines.filter(
      (l) => l.giftCard?.op === 'sell' && l.giftCard.mediaType === 'e_card'
    );
    const otherLines = saleLines.filter(
      (l) => l.giftCard && !(l.giftCard.op === 'sell' && l.giftCard.mediaType === 'e_card')
    );
    if (ecardLines.length) {
      await fulfillEcardDeliveries(ecardLines, orderId);
    }
    for (const line of otherLines) {
      if (!line.giftCard) continue;
      try {
        await api.post('/gift-cards/credit', {
          type: line.giftCard.op,
          cardId: line.giftCard.cardId,
          cardNumber: line.giftCard.cardNumber,
          cardMediaType: line.giftCard.mediaType,
          amount: line.giftCard.amount,
          orderId: orderId || undefined,
          createIfMissing: line.giftCard.op === 'sell',
        });
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('giftCardCreditFailed'));
      }
    }
  };

  const redeemGiftCardPayments = async (
    payments: AppliedPayment[],
    orderId?: string | null
  ): Promise<number | null> => {
    let remaining: number | null = null;
    for (const p of payments) {
      if (p.method !== 'gift_card' || !p.giftCardId) continue;
      try {
        const res = await api.post('/gift-cards/redeem', {
          cardId: p.giftCardId,
          amount: p.amount,
          orderId: orderId || undefined,
          allowPartial: true,
        });
        const balanceAfter = roundMoney2(Number(res.data?.remainingBalance));
        if (Number.isFinite(balanceAfter)) {
          p.giftCardRemainingBalance = balanceAfter;
          remaining =
            remaining == null ? balanceAfter : Math.min(remaining, balanceAfter);
        }
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('giftCardRedeemFailed'));
        throw e;
      }
    }
    return remaining;
  };

  const clearAttachedMembership = () => {
    setAttachedMembership(null);
    setPayWithPoints(false);
  };

  const attachMembershipCard = (membership: AttachedMembership) => {
    const displayName = membership.customerName?.trim();
    if (displayName) {
      setSelectedCustomer((prev) => {
        if (prev?.id && membership.customerId && prev.id === membership.customerId) {
          return prev;
        }
        if (membership.customerId) {
          const parts = displayName.split(/\s+/);
          return {
            id: membership.customerId,
            firstName: parts[0] || displayName,
            lastName: parts.slice(1).join(' ') || '',
            email: null,
            phone: null,
          } as WebPosCustomer;
        }
        return prev;
      });
    }
    const disc = membershipDiscountPercent(membership);
    if (disc > 0) {
      setBillDiscount((prev) =>
        prev.percent >= disc ? prev : { percent: disc, amount: 0 }
      );
    }
    setAttachedMembership(membership);
    toast.success(displayName || membership.cardNumber || t('webPosMembershipAttached'));
  };

  const lookupMembershipCard = async (
    rawCode: string,
    opts?: { silentNotFound?: boolean }
  ): Promise<boolean> => {
    const code = rawCode.trim();
    if (!code || membershipBusy) return false;
    const ecParsed = normalizeScannedPayload(code);
    const normalized = ecParsed || normalizeRfidUid(code) || code;
    const mediaType = /^EC/i.test(normalized) ? 'e_card' : 'physical';
    setMembershipBusy(true);
    try {
      const res = await api.get(
        `/gift-cards/lookup/${encodeURIComponent(normalized)}`,
        { params: { mediaType } }
      );
      const c = res.data?.card;
      if (!c?.id) throw new Error(t('webPosMembershipLookupFailed'));
      if (c.status && c.status !== 'active') {
        throw new Error(t('webPosCardBlocked'));
      }
      const holder =
        c.holderName ||
        [c.customer?.firstName, c.customer?.lastName].filter(Boolean).join(' ') ||
        null;
      attachMembershipCard({
        cardId: c.id,
        cardNumber: c.cardNumber || normalized,
        customerName: holder,
        customerId: c.customerId || c.customer?.id || null,
        pointsBalance: Math.max(0, Math.floor(Number(c.points ?? c.pointsBalance ?? 0))),
        giftBalance: Number(c.balance ?? c.balanceAmount ?? 0),
        membershipEnabled: !!c.membershipEnabled,
        membershipPlanId: c.membershipPlanId || null,
        membershipPlan: (c.membershipPlan as MembershipPlan | null) || null,
        stampCount: Number(c.stampCount ?? 0),
      });
      return true;
    } catch (e: any) {
      const notFound = e.response?.status === 404;
      if (!opts?.silentNotFound || !notFound) {
        toast.error(e.response?.data?.error || e.message || t('webPosMembershipLookupFailed'));
      }
      return false;
    } finally {
      setMembershipBusy(false);
    }
  };

  const saleMerchandiseTotal = (lines: CartLine[]) => {
    const merchLines = lines.filter(
      (l) => !l.giftCard && !String(l.productId || '').startsWith('__gift_card_')
    );
    if (!merchLines.length) return 0;
    return computeMerchandiseTotals(merchLines, taxRate, vatIncludedInPrice, roundingStep).total;
  };

  const applyLoyaltyAfterSale = async (
    membership: AttachedMembership,
    orderId: string,
    paidSubtotal: number,
    pointsRedeemed: number
  ) => {
    if (pointsRedeemed > 0) {
      await api.post(`/gift-cards/${membership.cardId}/points/redeem`, {
        points: pointsRedeemed,
        orderId,
      });
    }
    const earned = computeEarnPoints(paidSubtotal);
    if (earned > 0) {
      await api.post(`/gift-cards/${membership.cardId}/points/earn`, {
        points: earned,
        orderId,
      });
    }
    if (membership.membershipPlan?.type === 'stamp_card') {
      try {
        const stampRes = await api.post(`/gift-cards/${membership.cardId}/stamps/increment`, {
          orderId,
        });
        if (stampRes.data?.rewardEarned) {
          toast.success(t('membershipRewardEarned'));
        }
        const nextCount = stampRes.data?.stampCount;
        if (typeof nextCount === 'number') {
          setAttachedMembership((prev) =>
            prev?.cardId === membership.cardId ? { ...prev, stampCount: nextCount } : prev
          );
        }
      } catch {
        /* stamp optional — don't fail sale */
      }
    }
  };

  const clearCollectCheckout = () => {
    setCollectOrderRef(null);
    setCart([]);
    clearCartTicket();
    setSelectedCustomer(null);
    setBillDiscount({ percent: 0, amount: 0 });
    setFulfillmentWhen(null);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel(null);
    setOrderNote('');
    setTableId(null);
    setTableLabel(null);
    setTabNumber(null);
    terminalPaymentRef.current = null;
    setCheckoutExtras(null);
  };

  const openOrderCollectCheckout = (
    order: MerchantOrder,
    returnView: 'orders' | 'register' = 'orders'
  ) => {
    const lines = orderItemsToCartLines(order.items || []);
    if (!lines.length) {
      toast.error(t('webPosNoItems'));
      return;
    }
    const ch = (order.channel || order.fulfillmentChannel || 'takeaway') as Channel;
    setCart(lines);
    setBillDiscount({ percent: 0, amount: Number(order.discountAmount || 0) });
    setChannel(ch);
    setOrderNote('');
    setTableId(null);
    setTableLabel(order.tableLabel || null);
    setTabNumber(order.tabNumber || null);
    setTicketDisplay(order.ticketDisplay || order.orderNumber);
    setTicketOrderNumber(order.orderNumber);
    setOrderSent(true);
    setCoursesBulkSent(true);
    setSplitQueue([]);
    setSplitIndex(0);
    splitMasterIdRef.current = null;
    clearAttachedMembership();
    setPayWithPoints(false);
    setSelectedCustomer(customerFromOrder(order));
    if (order.scheduledFor) {
      setFulfillmentWhen({
        mode: 'later',
        scheduledFor: String(order.scheduledFor),
        label: String(order.scheduledFor),
      });
    } else {
      setFulfillmentWhen(null);
    }
    setCollectOrderRef({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      returnView,
    });
    setHighlightOrderId(null);
    setOrdersChannelPref(null);
    setPosTab('register');
    setPosView('checkout');
  };

  const collectUrlHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || pinGateRequired) return;
    const collectId = searchParams.get('collect');
    if (!collectId || collectUrlHandledRef.current === collectId) return;
    collectUrlHandledRef.current = collectId;
    void (async () => {
      try {
        const res = await api.get(`/merchant/orders/${collectId}`);
        const order = (res.data?.order || res.data) as MerchantOrder;
        if (!order?.id) throw new Error('Order not found');
        openOrderCollectCheckout(order, 'register');
        setSearchParams({}, { replace: true });
      } catch (e: any) {
        toast.error(e.response?.data?.error || e.message || t('webPosOrdersLoadFailed'));
        setSearchParams({}, { replace: true });
      }
    })();
  }, [loading, pinGateRequired, searchParams, setSearchParams, t]);

  const finalizeCollectPayment = async (
    payments: AppliedPayment[],
    changeDue: number,
    tipAmount = 0
  ) => {
    const ctx = collectOrderRef;
    if (!ctx) return;
    const tip = roundMoney2(Math.max(0, tipAmount));
    const due = roundMoney2(ctx.total + tip);
    const primary =
      payments.find((p) => p.method === 'terminal') ||
      payments.find((p) => p.method === 'card') ||
      payments.find((p) => p.method === 'gift_card') ||
      payments[0];
    if (!primary && due > 0.001) return;
    let payMethod = primary?.method === 'gift_card' ? 'card' : primary?.method || 'cash';
    if (payMethod === 'pay_later') payMethod = 'cash';
    if (!['cash', 'card', 'terminal'].includes(payMethod)) payMethod = 'cash';
    const action = collectPaymentAction(ctx.status);
    setBusy(true);
    try {
      const res = await api.post(`/merchant/orders/${ctx.id}/action`, {
        action,
        paymentMethod: payMethod,
      });
      toast.success(t('webPosPaymentCollected'));
      let orderForReceipt: PosOrderForReceipt | null = null;
      try {
        const fresh = await api.get(`/merchant/orders/${ctx.id}`);
        orderForReceipt = (fresh.data?.order || fresh.data) as PosOrderForReceipt;
      } catch {
        orderForReceipt = (res.data?.order as PosOrderForReceipt) || null;
      }
      if (!orderForReceipt?.id) {
        orderForReceipt = {
          id: ctx.id,
          orderNumber: ctx.orderNumber,
          total: ctx.total,
          createdAt: new Date().toISOString(),
          paymentMethod: payMethod,
          items: [],
        };
      }
      if (!orderForReceipt.items?.length && cart.length) {
        orderForReceipt = {
          ...orderForReceipt,
          items: cart.map((l) => {
            const detail = lineExtrasLabel(l);
            return {
              name: detail ? `${l.name} (${detail})` : l.name,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              totalPrice: l.lineTotal,
              weightKg: l.isWeighed ? l.weightKg ?? l.quantity : undefined,
            };
          }),
        };
      }
      try {
        const receiptPayload = posOrderToWebPosReceipt(orderForReceipt, {
          businessName: merchant?.name || APP_NAME,
          address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
          phone: merchant?.phone || undefined,
          vatNumber: merchant?.vatNumber || undefined,
          taxRate,
          vatIncludedInPrice,
          vatAfterDiscount,
          printSettings,
          panelLang: locale,
        });
        const payLines = payments
          .filter((p) => roundMoney2(p.amount) > 0)
          .map((p) => ({ method: p.method, amount: roundMoney2(p.amount) }));
        if (payLines.length) {
          receiptPayload.paymentLines = payLines;
          receiptPayload.paymentMethod =
            payLines.length > 1 ? 'mixed' : payLines[0]!.method;
        } else {
          receiptPayload.paymentMethod = payMethod;
        }
        const tendered = roundMoney2(payments.reduce((s, p) => s + p.amount, 0));
        if (tendered > 0) receiptPayload.amountTendered = tendered;
        if (changeDue > 0) receiptPayload.changeDue = roundMoney2(changeDue);
        if (tip > 0) receiptPayload.tipAmount = tip;
        const gcRemaining = payments
          .filter((p) => p.method === 'gift_card' && p.giftCardRemainingBalance != null)
          .map((p) => roundMoney2(Number(p.giftCardRemainingBalance)))
          .filter((v) => Number.isFinite(v));
        if (gcRemaining.length) {
          receiptPayload.giftCardRemainingBalance = Math.min(...gcRemaining);
        }
        const receiptText = generateWebPosReceiptText(receiptPayload, locale);
        const deliveryQrUrl = deliveryDirectionsUrlForReceipt(receiptPayload);
        const orderId = String(orderForReceipt.id || orderForReceipt.clientId || ctx.id);
        const orderNumber =
          orderForReceipt.orderNumber ||
          orderForReceipt.ticketDisplay ||
          ctx.orderNumber ||
          '';
        setLastReceipt(receiptText);
        setLastReceiptUrl(receiptPayload.receiptUrl);
        setLastReceiptOrderId(orderId);
        setLastReceiptOrderNumber(orderNumber);
        const part: SplitReceiptPart = {
          id: orderId,
          label: t('webPosPrintReceipt'),
          text: receiptText,
          url: receiptPayload.receiptUrl,
          deliveryQrUrl,
          amount: ctx.total,
          orderNumber,
        };
        splitReceiptsRef.current = [part];
        setLastSplitReceipts([part]);
        try {
          await printReceipt(receiptText, receiptPayload.receiptUrl, deliveryQrUrl);
        } catch {
          /* print is best-effort — manual reprint uses staged lastReceipt */
        }
      } catch {
        /* receipt build is best-effort */
      }
      setSuccessInfo({
        amount: ctx.total,
        changeDue: changeDue > 0 ? changeDue : null,
      });
      clearCollectCheckout();
      setOrdersRefreshToken((n) => n + 1);
      setPosView('success');
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentCollectFailed'));
      setPosView('checkout');
    } finally {
      setBusy(false);
    }
  };

  const completeMultiTenderCheckout = async (
    payments: AppliedPayment[],
    changeDue: number,
    tipAmount = 0
  ) => {
    if (!activeSale.lines.length) {
      toast.error(t('webPosNoItems'));
      setPosView('register');
      setPosTab('register');
      setCheckoutOpen(false);
      return;
    }
    if (collectOrderRef) {
      const tip = roundMoney2(Math.max(0, tipAmount));
      const due = roundMoney2(collectOrderRef.total + tip);
      const collectPrimary =
        payments.find((p) => p.method === 'terminal') ||
        payments.find((p) => p.method === 'card') ||
        payments.find((p) => p.method === 'gift_card') ||
        payments[0];
      if (!collectPrimary && due > 0.001) return;
      if (collectPrimary?.method === 'terminal') {
        if (payments.length > 1) {
          toast.error(t('webPosTerminalSinglePayment'));
          return;
        }
        if (!guardOfflineCheckout('terminal')) return;
        const extras: CheckoutResult = {
          method: 'terminal',
          discountPercent: 0,
          discountAmount: 0,
          tipAmount: tip,
          roundingAmount: 0,
          total: due,
          amountTendered: due,
          changeDue: null,
        };
        setCheckoutExtras(extras);
        await runTerminalPayment(undefined, extras);
        return;
      }
      const collectMethod = (collectPrimary?.method || 'cash') as PosPaymentMethod;
      if (!guardOfflineCheckout(collectMethod)) return;
      await finalizeCollectPayment(payments, changeDue, tipAmount);
      return;
    }
    const tip = roundMoney2(Math.max(0, tipAmount));
    const part = splitQueue[splitIndex];
    const pointsDiscount = membershipCheckout.pointsDiscount;
    const pointsRedeemed = membershipCheckout.pointsRedeemed;
    const partTotal = roundMoney2(
      Math.max(0, (part?.amount ?? totals.total) - pointsDiscount) + tip
    );
    const primary = payments.find((p) => p.method === 'terminal')
      || payments.find((p) => p.method === 'card')
      || payments.find((p) => p.method === 'gift_card')
      || payments[0];
    if (!primary && partTotal > 0.001) return;
    const amountTendered = roundMoney2(
      payments.length ? payments.reduce((s, p) => s + p.amount, 0) : 0
    );
    const discExtras = checkoutBillDiscountExtras();
    const extras: CheckoutResult = {
      method: ((primary?.method === 'gift_card' ? 'card' : primary?.method) ||
        'cash') as CheckoutResult['method'],
      discountPercent: splitQueue.length > 0 ? 0 : discExtras.discountPercent,
      discountAmount: splitQueue.length > 0 ? 0 : discExtras.discountAmount,
      tipAmount: tip,
      roundingAmount: totals.rounding,
      total: partTotal,
      amountTendered,
      changeDue: changeDue > 0 ? changeDue : null,
      tenders: payments.map((p) => ({ method: p.method, amount: roundMoney2(p.amount) })),
      pointsRedeemed,
      pointsDiscount,
    };
    if (primary?.method === 'terminal') {
      if (payments.length > 1) {
        toast.error(t('webPosTerminalSinglePayment'));
        return;
      }
      if (!guardOfflineCheckout('terminal')) return;
      setCheckoutExtras(extras);
      await runTerminalPayment(undefined, extras);
      return;
    }
    setBusy(true);
    try {
      const saleMethod: PosPaymentMethod =
        !primary
          ? 'cash'
          : primary.method === 'pay_later'
          ? 'pay_later'
          : primary.method === 'gift_card'
            ? 'gift_card'
            : primary.method;
      if (!guardOfflineCheckout(saleMethod, { payments })) {
        return;
      }
      const remainingSplits = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
      // Deduct gift balance after order exists (orderId links redeem → refund).
      await finalizeSale(saleMethod, undefined, undefined, extras, true, { payments });
      if (remainingSplits) {
        setSplitIndex((i) => i + 1);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
    } finally {
      setBusy(false);
    }
  };

  const runExpressPay = async (method: PosPaymentMethod) => {
    if (!cart.length || busy) return;
    if (!guardOfflineCheckout(method)) return;
    let whenForPay: FulfillmentWhen | undefined;
    if (
      (channel === 'delivery' || channel === 'takeaway') &&
      !fulfillmentWhen
    ) {
      whenForPay = asapFulfillment();
      setFulfillmentWhen(whenForPay);
    }
    if (channel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod(method);
      setCustomerOpen(true);
      return;
    }
    const discExtras = checkoutBillDiscountExtras();
    const extras: CheckoutResult = {
      method,
      discountPercent: discExtras.discountPercent,
      discountAmount: discExtras.discountAmount,
      tipAmount: 0,
      roundingAmount: totals.rounding,
      total: totals.total,
      amountTendered: totals.total,
      changeDue: 0,
    };
    if (method === 'terminal') {
      setCheckoutExtras(extras);
      await runTerminalPayment(undefined, extras);
      return;
    }
    const paidAmount = totals.total;
    setBusy(true);
    try {
      // Express: compact success popup; honor autoPrintReceipt like normal checkout.
      await finalizeSale(method, undefined, whenForPay, extras, false);
      setSuccessInfo({ amount: paidAmount, changeDue: 0 });
      setExpressSuccessOpen(true);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
    } finally {
      setBusy(false);
    }
  };

  const setQty = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.lineId !== lineId));
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId
          ? { ...l, quantity, lineTotal: roundMoney2(l.unitPrice * quantity) }
          : l
      )
    );
  };

  const printEscPosToTargets = async (
    text: string,
    opts: {
      qrUrl?: string;
      deliveryQrUrl?: string;
      barcodeData?: string;
      /** Gift-card receipts always print QR/barcode even when receipt QR is disabled. */
      forceScannable?: boolean;
      role: 'receipt' | 'kitchen' | 'eod';
      paperWidthMm?: 58 | 80;
      /** Skip success toast (caller already confirmed to the cashier). */
      quiet?: boolean;
    }
  ) => {
    const targets = printersForRole(printSettings, opts.role);
    const names =
      targets.length > 0
        ? targets.map((x) => x.name)
        : [printerName || ''];
    const named = names.map((n) => (n || '').trim()).filter(Boolean);
    const unsuitableNamed = named.filter((n) => isUnsuitableRawPrinter(n));

    // EOD to OneNote/PDF: browser text/PDF window instead of claiming RAW success.
    if (opts.role === 'eod' && named.length > 0 && unsuitableNamed.length === named.length) {
      browserPrintText(text);
      toast(t('webPosEodBrowserFallback'));
      return;
    }

    const paper = opts.paperWidthMm || targets[0]?.paperWidthMm || printSettings?.paperWidthMm || 80;
    const logoUrl =
      opts.role === 'receipt'
        ? printSettings?.receiptLogoUrl || merchant?.shopLogoUrl || paymentConfig?.shopLogoUrl
        : null;
    let logo: Uint8Array | null = null;
    if (logoUrl) {
      const cacheKey = `${String(logoUrl)}|${paper}`;
      if (logoEscPosCacheRef.current?.key === cacheKey) {
        logo = logoEscPosCacheRef.current.bytes;
      } else {
        logo = await logoUrlToEscPos(String(logoUrl), paper === 58 ? 240 : 384);
        logoEscPosCacheRef.current = { key: cacheKey, bytes: logo };
      }
    }
    const qr =
      opts.forceScannable ||
      (opts.role === 'receipt' && printSettings?.receiptShowQrCode !== false)
        ? opts.qrUrl
        : undefined;
    const barcode = opts.barcodeData || (opts.forceScannable ? opts.qrUrl : undefined);
    const escpos = await buildReceiptEscPos(text, {
      qrData: qr,
      deliveryQrData: opts.deliveryQrUrl,
      logoBytes: logo,
      barcodeData: barcode,
      paperWidthMm: paper,
    });
    const dataBase64 = uint8ToBase64(escpos);

    let printedOk = 0;
    let queuedOk = 0;
    let lastOkName = '';
    for (const name of names) {
      const label = (name || '').trim();
      if (label && isUnsuitableRawPrinter(label)) {
        if (opts.role === 'eod') {
          browserPrintText(text);
          toast(t('webPosEodBrowserFallback'));
          return;
        }
        throw new Error(unsuitableRawPrinterMessage(label) || t('webPosUnsuitablePrinter'));
      }
      try {
        const mode = await printViaAgentOrQueue({
          printerName: label || undefined,
          dataBase64,
          text,
        });
        if (mode === 'queued') {
          queuedOk += 1;
        } else {
          printedOk += 1;
          lastOkName = label;
        }
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (
          opts.role === 'eod' &&
          /OneNote|PDF|XPS|ESC-POS|virtual|receipt\/ESC-POS|corrupted|agent|offline/i.test(msg)
        ) {
          browserPrintText(text);
          toast(t('webPosEodBrowserFallback'));
          return;
        }
        throw e;
      }
    }

    if (!printedOk && !queuedOk) {
      throw new Error(t('webPosPrintFailed'));
    }

    if (opts.quiet) return;
    if (queuedOk && !printedOk) {
      toast.success(t('webPosPrintQueuedMainTill'));
      return;
    }
    if (opts.role === 'eod') {
      toast.success(t('webPosEodPrinted'));
    } else {
      toast.success(
        lastOkName
          ? t('webPosPrintedOn').replace('{name}', lastOkName)
          : t('webPosSentDefaultPrinter')
      );
    }
  };

  const printReceipt = async (receiptText: string, receiptUrl?: string, deliveryQrUrl?: string) => {
    await printEscPosToTargets(receiptText, {
      qrUrl: receiptUrl,
      deliveryQrUrl,
      role: 'receipt',
      quiet: true,
    });
  };

  const openSuccessPrint = () => {
    if (lastSplitReceipts.length > 1) {
      setPrintChooserOpen(true);
      return;
    }
    if (lastReceipt) {
      void printReceipt(lastReceipt, lastReceiptUrl || undefined, lastDeliveryQrUrl || undefined).catch((e: any) =>
        toast.error(e.message || t('webPosPrintFailed'))
      );
      return;
    }
    toast.error(t('webPosPrintFailed'));
  };

  const printSuccessPart = async (partId: string) => {
    const part = lastSplitReceipts.find((p) => p.id === partId);
    if (!part) {
      toast.error(t('webPosPrintFailed'));
      return;
    }
    try {
      await printReceipt(part.text, part.url, part.deliveryQrUrl);
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const printSuccessAll = async () => {
    if (!lastSplitReceipts.length) {
      toast.error(t('webPosPrintFailed'));
      return;
    }
    try {
      const combined = lastSplitReceipts.map((p) => p.text).join('\n\n====================\n\n');
      const firstUrl = lastSplitReceipts[0]?.url;
      const firstDeliveryQr = lastSplitReceipts[0]?.deliveryQrUrl;
      await printReceipt(combined, firstUrl, firstDeliveryQr);
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const successSplitParts =
    lastSplitReceipts.length > 1
      ? lastSplitReceipts.map((p) => ({
          id: p.id,
          label: p.label,
          amount: p.amount,
          url: p.url,
        }))
      : undefined;

  const sendReceiptEmail = async (email: string) => {
    setSendReceiptBusy(true);
    try {
      const parts = lastSplitReceipts.length > 0 ? lastSplitReceipts : null;
      const receiptUrl =
        parts && parts.length > 1
          ? parts.map((p) => p.url).filter(Boolean).join('\n') || lastReceiptUrl
          : lastReceiptUrl;
      const receiptText =
        parts && parts.length > 1
          ? parts.map((p) => `${p.label}\n${p.text}`).join('\n\n----------\n\n')
          : lastReceipt;
      const amount =
        parts && parts.length > 0
          ? roundMoney2(parts.reduce((s, p) => s + p.amount, 0))
          : successInfo?.amount;
      await api.post('/merchant/pos/send-receipt-email', {
        email,
        receiptUrl: receiptUrl || undefined,
        receiptText: receiptText || undefined,
        orderNumber: lastReceiptOrderNumber || undefined,
        orderId: lastReceiptOrderId || undefined,
        clientId: lastReceiptOrderId || undefined,
        amount: amount ?? undefined,
      });
      toast.success(t('webPosReceiptEmailSent'));
      setSendReceiptOpen(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosReceiptEmailFailed'));
    } finally {
      setSendReceiptBusy(false);
    }
  };

  const printPosOrderReceipt = async (order: PosOrderForReceipt, splitLabel?: string | null) => {
    const receiptPayload = posOrderToWebPosReceipt(order, {
      businessName: merchant?.name || APP_NAME,
      address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
      phone: merchant?.phone || undefined,
      vatNumber: merchant?.vatNumber || undefined,
      taxRate,
      vatIncludedInPrice,
      vatAfterDiscount,
      printSettings,
      panelLang: locale,
      splitLabel,
    });
    const receiptText = generateWebPosReceiptText(receiptPayload, locale);
    await printReceipt(
      receiptText,
      receiptPayload.receiptUrl,
      deliveryDirectionsUrlForReceipt(receiptPayload)
    );
  };

  const printPosRefundReceipt = async (payload: {
    order: PosOrderForReceipt;
    refunded: number;
    refundTotal: number;
    reason: string;
    allocation?: { giftCard?: number; cash?: number; terminal?: number; other?: number };
  }) => {
    await printRefundReceipt(
      {
        businessName: merchant?.name || APP_NAME,
        address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
        phone: merchant?.phone || undefined,
        orderNumber: payload.order.orderNumber,
        orderDisplay: payload.order.ticketDisplay,
        refundedAt: Date.now(),
        refundAmount: payload.refunded,
        refundTotal: payload.refundTotal,
        reason: payload.reason,
        allocation: payload.allocation,
        staffName: payload.order.staffName,
      },
      { merchant: merchant || {}, printSettings, locale, fallbackPrinterName: printerName }
    );
  };

  const printKitchenForCart = async (
    lines: CartLine[],
    saleChannel: Channel,
    opts?: {
      orderNumber?: string | null;
      when?: FulfillmentWhen | null;
      courseOnly?: number;
      cancelled?: boolean;
      cancelReason?: string | null;
      /** Cancel tickets always print even if auto-print kitchen is off */
      forcePrint?: boolean;
      /** Snapshot tab/table before cart reset (payment path). */
      tabNumber?: string | null;
      tableLabel?: string | null;
    }
  ) => {
    if (isRetail) return;
    if (printSettings?.autoPrintKitchen === false && !opts?.forcePrint && !opts?.cancelled) return;
    const lang = resolveReceiptLanguage(printSettings, printSettings?.receiptLanguage === 'panel' ? locale : printSettings?.receiptLanguage || locale);
    const filteredLines = (
      opts?.courseOnly != null
        ? lines.filter((l) => (l.courseNumber || 1) === opts.courseOnly)
        : lines
    ).filter((l) => !l.giftCard && !String(l.productId || '').startsWith('__gift_card_'));
    if (!filteredLines.length) return;
    const receiptItems = filteredLines.map((l) =>
      buildKitchenTicketItemFromLine({
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        weightKg: l.isWeighed ? l.weightKg ?? l.quantity : undefined,
        productId: l.productId,
        categoryId: l.categoryId,
        courseNumber: l.courseNumber,
        selectedExtras: l.selectedExtras,
        comboSelections: l.comboSelections,
        lineNote: l.lineNote,
      })
    );
    const customerName = selectedCustomer
      ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
      : '';
    const userName =
      (webposStaff?.name || '').trim() ||
      customerName ||
      null;
    const when = opts?.when !== undefined ? opts.when : fulfillmentWhen;
    const scheduledRaw = when?.mode === 'later' ? when.scheduledFor : null;
    const scheduledFor =
      scheduledRaw != null && scheduledRaw !== ''
        ? localDateTimeToIso(String(scheduledRaw)) || scheduledRaw
        : null;

    const kitchenOpts = {
      channel: saleChannel,
      language: lang,
      orderNumber: opts?.orderNumber || kitchenOrderNumber(),
      orderedAt: Date.now(),
      scheduledFor,
      userName,
      orderSource: 'WEBPOS' as const,
      itemTextScale: printSettings?.kitchenItemTextScale || 2,
      headerTextScale: printSettings?.kitchenHeaderTextScale || 2,
      boldText: printSettings?.kitchenBoldText !== false,
      groupByCourse: coursesEnabled && !opts?.cancelled,
      tableLabel: opts?.tableLabel !== undefined ? opts.tableLabel : tableLabel || null,
      tabNumber: opts?.tabNumber !== undefined ? opts.tabNumber : tabNumber || null,
      cancelled: !!opts?.cancelled,
      cancelReason: opts?.cancelReason || null,
    };

    let queuedAny = false;
    const printJobs = buildKitchenPrintJobs(receiptItems, printSettings);
    if (printJobs.length) {
      for (const job of printJobs) {
        const paperWidthMm = job.paperWidthMm;
        const escpos = generateKitchenTicketEscPos({
          ...kitchenOpts,
          items: job.items,
          paperWidthMm,
        });
        const text = generateKitchenTicketText({
          ...kitchenOpts,
          items: job.items,
          paperWidthMm,
        });
        const mode = await printViaAgentOrQueue({
          printerName: job.printerName || printerName || undefined,
          dataBase64: uint8ToBase64(escpos),
          text,
          orderId: opts?.orderNumber || null,
        });
        if (mode === 'queued') queuedAny = true;
      }
      if (queuedAny) toast.success(t('webPosPrintQueuedMainTill'));
      return;
    }

    const paperWidthMm = resolveKitchenPaperWidthMm(printSettings, printSettings?.paperWidthMm || 80);
    const escpos = generateKitchenTicketEscPos({
      ...kitchenOpts,
      items: receiptItems,
      paperWidthMm,
    });
    const text = generateKitchenTicketText({
      ...kitchenOpts,
      items: receiptItems,
      paperWidthMm,
    });
    const mode = await printViaAgentOrQueue({
      printerName: printerName || undefined,
      dataBase64: uint8ToBase64(escpos),
      text,
      orderId: opts?.orderNumber || null,
    });
    if (mode === 'queued') toast.success(t('webPosPrintQueuedMainTill'));
  };

  const buildSalePayload = (
    clientId: string,
    method: PosPaymentMethod,
    whenOverride?: FulfillmentWhen | null,
    orderNumber?: string,
    extras?: CheckoutExtras | null,
    saleLines: CartLine[] = cart,
    saleTotals = activeSale.totals,
    splitMeta?: { masterOrderId?: string; splitCheckNumber?: number },
    ticketMeta?: { display?: string | null; orderNumber?: string | null } | null,
    terminalCapture?: {
      reference: string;
      poiTransactionTimestamp: string;
      customerReceipt?: AdyenTerminalReceipt | null;
      cashierReceipt?: AdyenTerminalReceipt | null;
    } | null
  ) => {
    const saleTicketDisplay = ticketMeta?.display || ticketDisplay;
    const saleTabNumber = tabNumber;
    const payLater = method === 'pay_later';
    const when = whenOverride !== undefined ? whenOverride : fulfillmentWhen;
    const scheduledRaw = when?.mode === 'later' ? when.scheduledFor : null;
    const scheduledFor =
      scheduledRaw != null && scheduledRaw !== ''
        ? localDateTimeToIso(String(scheduledRaw)) || scheduledRaw
        : null;
    const custName = selectedCustomer
      ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
      : undefined;
    const ship = selectedCustomer
      ? [selectedCustomer.defaultAddress, selectedCustomer.defaultZip, selectedCustomer.defaultCity]
          .filter(Boolean)
          .join(', ')
      : undefined;
    const discPct = extras?.discountPercent || 0;
    const merchandiseGross = vatIncludedInPrice
      ? roundMoney2(saleTotals.subtotal + saleTotals.tax)
      : saleTotals.subtotal;
    const discountAmount =
      extras?.discountAmount != null && extras.discountAmount > 0
        ? roundMoney2(Math.min(extras.discountAmount, merchandiseGross))
        : roundMoney2((merchandiseGross * discPct) / 100);
    const tipAmount = roundMoney2(extras?.tipAmount || 0);
    const roundingAmount = roundMoney2(
      extras?.roundingAmount != null ? extras.roundingAmount : saleTotals.rounding
    );
    const saleTotal =
      extras?.total != null
        ? roundMoney2(extras.total)
        : roundTo005(merchandiseGross - discountAmount + tipAmount);
    const tenders = (extras?.tenders || [])
      .map((p) => ({ method: p.method, amount: roundMoney2(p.amount) }))
      .filter((p) => p.amount > 0);
    const resolvedMethod =
      tenders.length > 1 ? 'mixed' : tenders.length === 1 ? tenders[0]!.method : method;
    return {
      clientId,
      orderNumber,
      paymentMethod: resolvedMethod,
      paymentBreakdown: tenders.length ? tenders : undefined,
      paymentStatus: payLater ? 'awaiting_payment' : 'completed',
      status: payLater ? (scheduledFor ? 'accepted' : 'preparing') : 'completed',
      subtotal: saleTotals.subtotal,
      taxAmount: saleTotals.tax,
      discountAmount,
      tipAmount,
      roundingAmount,
      amountTendered: extras?.amountTendered ?? null,
      changeDue: extras?.changeDue ?? null,
      staffName: webposStaff?.name || null,
      staffId: webposStaff?.id || null,
      total: saleTotal,
      fulfillmentChannel: effectiveChannel,
      completedAt: payLater ? undefined : Date.now(),
      scheduledFor,
      customerId: selectedCustomer?.id || null,
      customerName: custName || null,
      customerPhone: selectedCustomer?.phone || null,
      customerEmail: selectedCustomer?.email || null,
      shippingAddress: ship || null,
      tableId: tableId || null,
      tableLabel: tableLabel || null,
      // Tab labels are not PAX; only send a numeric guest count when tabNumber is numeric.
      guestCount: (() => {
        if (tabNumber == null || tabNumber === '') return null;
        const n = Number(tabNumber);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
      })(),
      masterOrderId: splitMeta?.masterOrderId || null,
      splitCheckNumber: splitMeta?.splitCheckNumber ?? null,
      ticketDisplay: saleTicketDisplay || undefined,
      tabNumber: saleTabNumber || undefined,
      adyenReference: terminalCapture?.reference || undefined,
      adyenPoiTransactionTimestamp: terminalCapture?.poiTransactionTimestamp || undefined,
      adyenCustomerReceiptJson: terminalCapture?.customerReceipt
        ? JSON.stringify(terminalCapture.customerReceipt)
        : undefined,
      adyenCashierReceiptJson: terminalCapture?.cashierReceipt
        ? JSON.stringify(terminalCapture.cashierReceipt)
        : undefined,
      notes: encodeOrderMetaNotes({
        existing: [
          roundingAmount
            ? `Rounding ${roundingAmount > 0 ? '+' : ''}${roundingAmount.toFixed(2)}`
            : '',
          tipAmount > 0 ? `Tip CHF ${tipAmount.toFixed(2)}` : '',
          (extras?.pointsDiscount || 0) > 0
            ? `Points −CHF ${(extras?.pointsDiscount || 0).toFixed(2)} (${extras?.pointsRedeemed || 0} pts)`
            : '',
          extras?.amountTendered != null
            ? `Tendered CHF ${extras.amountTendered.toFixed(2)}`
            : '',
          extras?.changeDue != null ? `Change CHF ${extras.changeDue.toFixed(2)}` : '',
          when?.mode === 'later' ? `Pickup/delivery: ${when.label}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        ticketDisplay: saleTicketDisplay,
        tabNumber: saleTabNumber,
      }),
      items: saleLines.map((l) => ({
        productClientId: l.productId,
        productId: l.productId,
        productName: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        totalPrice: l.lineTotal,
        weightKg: l.isWeighed ? l.weightKg ?? l.quantity : undefined,
        taxAmount: l.taxable
          ? vatIncludedInPrice
            ? extractVatFromGross(l.lineTotal, taxRate)
            : roundMoney2((l.lineTotal * taxRate) / 100)
          : 0,
        selectedExtras: l.selectedExtras.map((e) => ({
          id: e.id,
          name: e.name,
          price: e.price,
        })),
        comboSelections: l.comboSelections.map((c) => ({
          slotId: c.slotId,
          slotName: c.slotName,
          productId: c.productId,
          productName: c.productName,
          extraPrice: c.extraPrice,
          selectedExtras: (c.selectedExtras || []).map((e) => ({
            id: e.id,
            name: e.name,
            price: e.price,
          })),
        })),
        isOpenPrice: !!l.isOpenPrice,
      })),
    };
  };

  const closePaymentModal = () => {
    paymentAbortRef.current?.abort();
    paymentAbortRef.current = null;
    setPaymentModalOpen(false);
    setPaymentMessage('');
  };

  const finalizeSale = async (
    method: PosPaymentMethod,
    presetClientId?: string,
    whenOverride?: FulfillmentWhen | null,
    extrasOverride?: CheckoutExtras | null,
    showSuccessScreen = false,
    opts?: { skipReceiptPrint?: boolean; payments?: AppliedPayment[] }
  ) => {
    const saleLines = activeSale.lines;
    if (!saleLines.length) {
      toast.error(t('webPosNoItems'));
      setPosView('register');
      setPosTab('register');
      setCheckoutOpen(false);
      return;
    }
    const ticket = ensureCartTicket();
    const clientId = presetClientId || `webpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const whenSnapshot =
      whenOverride !== undefined ? whenOverride : fulfillmentWhen;
    const extras = extrasOverride !== undefined ? extrasOverride : checkoutExtras;
    /** Pre-discount merchandise for payload/receipt; payable amount comes from extras.total. */
    const saleTotals =
      splitQueue.length > 0
        ? activeSale.totals
        : computeMerchandiseTotals(saleLines, taxRate, vatIncludedInPrice, roundingStep);
    const splitMeta =
      splitQueue.length > 0 && splitMasterIdRef.current
        ? { masterOrderId: splitMasterIdRef.current, splitCheckNumber: splitIndex + 1 }
        : undefined;
    const discExtras = checkoutBillDiscountExtras();
    const extrasWithDisc: CheckoutExtras | null = extras
      ? {
          ...extras,
          discountPercent:
            extras.discountPercent ||
            (splitQueue.length > 0 ? 0 : discExtras.discountPercent),
          discountAmount:
            extras.discountAmount != null && extras.discountAmount > 0
              ? extras.discountAmount
              : splitQueue.length > 0
                ? 0
                : discExtras.discountAmount,
        }
      : splitQueue.length > 0
        ? extras
        : {
            method: method as CheckoutResult['method'],
            discountPercent: discExtras.discountPercent,
            discountAmount: discExtras.discountAmount,
            tipAmount: 0,
            roundingAmount: saleTotals.rounding,
            total: payableFullTotals.total,
          };
    const sale = buildSalePayload(
      clientId,
      method,
      whenSnapshot,
      ticket.orderNumber,
      extrasWithDisc,
      saleLines,
      saleTotals,
      splitMeta,
      ticket,
      terminalPaymentRef.current
    );
    const terminalCapture = terminalPaymentRef.current;

    const offlineEligible =
      isWebPosOfflineEnabled() && canCompleteSaleOffline(method, saleLines);
    let pushRes: { data?: { results?: Array<{ clientId?: string; orderId?: string }> } } | null =
      null;
    let queuedOffline = false;

    if (!isBrowserOnline() && offlineEligible) {
      await enqueueOutboxSale(sale);
      queuedOffline = true;
    } else {
      try {
        pushRes = await api.post('/sync/push-sales', { sales: [sale] });
      } catch (err: any) {
        if (
          err.response?.data?.code === 'WEBPOS_LICENSE_REQUIRED' &&
          err.response?.data?.entitlement
        ) {
          setEntitlement(err.response.data.entitlement as WebPosEntitlement);
        }
        // Online-first: only queue on transport failures for safe tenders (never on 4xx).
        if (offlineEligible && isNetworkError(err)) {
          await enqueueOutboxSale(sale);
          queuedOffline = true;
        } else {
          throw err;
        }
      }
    }

    const backendOrderId = queuedOffline
      ? null
      : (() => {
          const match = pushRes?.data?.results?.find(
            (r: { clientId?: string; orderId?: string; skipped?: boolean }) =>
              r.clientId === clientId
          );
          const first = pushRes?.data?.results?.[0];
          const pick = (row?: { orderId?: string; skipped?: boolean }) =>
            row?.orderId && !row.skipped ? row.orderId : null;
          return pick(match) || pick(first) || null;
        })();

    // Credit gift-card sell/reload lines after successful online persistence only
    let giftCardRemainingBalance: number | null = null;
    if (!queuedOffline) {
      if (opts?.payments?.length) {
        giftCardRemainingBalance = await redeemGiftCardPayments(opts.payments, backendOrderId);
      }
      await creditGiftCardLines(saleLines, backendOrderId);
      if (
        attachedMembership?.membershipEnabled &&
        backendOrderId &&
        method !== 'pay_later'
      ) {
        const giftCardPaid = roundMoney2(
          (extrasWithDisc?.tenders || [])
            .filter((p) => p.method === 'gift_card')
            .reduce((s, p) => s + p.amount, 0)
        );
        const merchandise = saleMerchandiseTotal(saleLines);
        const billDisc = extrasWithDisc?.discountAmount || 0;
        const payableMerch = roundMoney2(Math.max(0, merchandise - billDisc));
        const paidSubtotal = roundMoney2(
          Math.max(
            0,
            payableMerch -
              (extrasWithDisc?.pointsDiscount || 0) -
              giftCardPaid
          )
        );
        try {
          await applyLoyaltyAfterSale(
            attachedMembership,
            backendOrderId,
            paidSubtotal,
            extrasWithDisc?.pointsRedeemed || 0
          );
        } catch (e: any) {
          toast.error(e.response?.data?.error || t('webPosLoyaltySyncFailed'));
        }
      }
    } else {
      void flushOfflineOutbox();
    }

    if (!giftCardRemainingBalance && opts?.payments?.length) {
      const fromPayments = opts.payments
        .filter((p) => p.method === 'gift_card' && p.giftCardRemainingBalance != null)
        .map((p) => roundMoney2(Number(p.giftCardRemainingBalance)))
        .filter((v) => Number.isFinite(v));
      if (fromPayments.length) {
        giftCardRemainingBalance = Math.min(...fromPayments);
      }
    }
    const receiptRef = queuedOffline
      ? null
      : await resolvePublishedReceiptRef(backendOrderId, clientId);
    const receiptUrl = receiptRef ? buildReceiptUrl(receiptRef) : undefined;
    const lang = resolveReceiptLanguage(
      printSettings,
      paymentConfig?.panelLanguage || locale
    );
    const paperWidthMm = printSettings?.paperWidthMm || 80;
    const cartSnapshot = [...cart];
    const channelSnapshot = effectiveChannel;
    const tabSnapshot = tabNumber;
    const tableLabelSnapshot = tableLabel;
    const shipAddr =
      sale.shippingAddress ||
      (selectedCustomer
        ? [selectedCustomer.defaultAddress, selectedCustomer.defaultZip, selectedCustomer.defaultCity]
            .filter(Boolean)
            .join(', ')
        : '') ||
      undefined;
    const receiptPayload: WebPosReceipt = {
      businessName: merchant?.name || APP_NAME,
      address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
      phone: merchant?.phone || undefined,
      vatNumber: merchant?.vatNumber || undefined,
      id: clientId,
      orderDisplay: ticket.display,
      orderNumber: ticket.orderNumber,
      completedAt: Date.now(),
      channel: effectiveChannel,
      paymentMethod: method,
      paymentLines: extrasWithDisc?.tenders?.length
        ? extrasWithDisc.tenders.map((p) => ({
            method: p.method,
            amount: roundMoney2(p.amount),
          }))
        : undefined,
      amountTendered: extrasWithDisc?.amountTendered ?? null,
      changeDue: extrasWithDisc?.changeDue ?? null,
      customerName: sale.customerName || undefined,
      customerPhone: sale.customerPhone || undefined,
      shippingAddress: effectiveChannel === 'delivery' ? shipAddr : undefined,
      tableLabel,
      items: saleLines.map((l) => {
        const detail = lineExtrasLabel(l);
        return {
          name: detail ? `${l.name} (${detail})` : l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          weightKg: l.isWeighed ? l.weightKg ?? l.quantity : undefined,
          productId: l.productId,
          categoryId: l.categoryId,
        };
      }),
      subtotal: saleTotals.subtotal,
      discount: sale.discountAmount || 0,
      taxAmount: saleTotals.tax,
      taxRate,
      rounding: saleTotals.rounding,
      tipAmount: sale.tipAmount,
      total: sale.total,
      vatIncludedInPrice,
      vatAfterDiscount,
      splitLabel: activeSale.label,
      receiptUrl,
      includeQr: !queuedOffline && printSettings?.receiptShowQrCode !== false,
      deliveryDirectionsQr: printSettings?.receiptDeliveryDirectionsQr !== false,
      staffName: webposStaff?.name,
      language: lang,
      paperWidthMm,
      header: printSettings?.receiptHeader,
      footer: printSettings?.receiptFooter,
      showVat: printSettings?.receiptShowVatTable !== false,
      showStaff: printSettings?.receiptShowStaffLine !== false,
      adyenCustomerReceipt: normalizeAdyenTerminalReceipt(terminalCapture?.customerReceipt),
      printAdyenReceiptOnTicket: printSettings?.adyenReceiptDigitalOnly !== true,
      giftCardRemainingBalance,
    };
    const receiptText = generateWebPosReceiptText(receiptPayload, locale);
    const deliveryQrUrl = deliveryDirectionsUrlForReceipt(receiptPayload);
    setLastReceipt(receiptText);
    setLastReceiptUrl(receiptUrl);
    setLastDeliveryQrUrl(deliveryQrUrl || '');
    setLastReceiptOrderId(receiptRef || clientId);
    setLastReceiptOrderNumber(ticket.orderNumber || ticket.display || '');

    const splitPart: SplitReceiptPart = {
      id: clientId,
      label:
        activeSale.label ||
        (splitQueue.length > 0
          ? t('webPosSplitBillN').replace('{n}', String(splitIndex + 1))
          : t('webPosPrintReceipt')),
      text: receiptText,
      url: receiptUrl,
      deliveryQrUrl,
      amount: sale.total,
      orderNumber: ticket.orderNumber || ticket.display,
    };
    if (splitQueue.length > 0) {
      if (splitIndex === 0) splitReceiptsRef.current = [splitPart];
      else splitReceiptsRef.current = [...splitReceiptsRef.current, splitPart];
    } else {
      splitReceiptsRef.current = [splitPart];
    }

    setSales((prev) =>
      [
        {
          id: clientId,
          orderNumber: ticket.orderNumber,
          backendOrderId: backendOrderId || undefined,
          total: sale.total,
          paymentMethod: method,
          channel: effectiveChannel,
          completedAt: Date.now(),
          synced: !queuedOffline,
        },
        ...prev,
      ].slice(0, 30)
    );
    setOrdersRefreshToken((n) => n + 1);
    if (!queuedOffline) void refreshBestsellers();
    if (shiftsEnabled) void refreshCurrentShift(true);
    const moreSplits = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
    if (!moreSplits) {
      const paidKey = openCartDraftKey({ tableId, tabNumber, channel });
      openCartDraftsRef.current.delete(paidKey);
      setDraftVersion((n) => n + 1);
      setSendReceiptPrefillEmail(selectedCustomer?.email || '');
      setCart([]);
      setFulfillmentWhen(null);
      setSelectedCustomer(null);
      setSplitQueue([]);
      setSplitIndex(0);
      splitMasterIdRef.current = null;
      setSelectedLineId(null);
      setKeypadBuffer('');
      setOrderNote('');
      setBillDiscount({ percent: 0, amount: 0 });
      setTableId(null);
      setTableLabel(null);
      setTabNumber(null);
      clearCartTicket();
      setActiveCourse(1);
      setOrderSent(false);
      setCoursesBulkSent(false);
      setChannel(null);
      setMobileCartOpen(false);
      clearAttachedMembership();
      clearPersistedWebPosCarts();
      terminalPaymentRef.current = null;
      setLastSplitReceipts([...splitReceiptsRef.current]);
    }
    setCheckoutExtras(null);
    setCheckoutOpen(false);
    const payLater = method === 'pay_later';
    const paidTotal = sale.total;
    const splitPaidTotal = roundMoney2(
      splitReceiptsRef.current.reduce((s, p) => s + p.amount, 0)
    );
    if (showSuccessScreen && !payLater && !moreSplits) {
      setSuccessInfo({
        amount: splitReceiptsRef.current.length > 1 ? splitPaidTotal : paidTotal,
        changeDue: extras?.changeDue ?? null,
      });
      setPosView('success');
      setExpressSuccessOpen(false);
    } else if (!showSuccessScreen || payLater || moreSplits) {
      toast.success(
        payLater
          ? t('webPosProgrammedSaved')
          : moreSplits
            ? t('webPosSplitNext').replace('{n}', String(splitIndex + 2)).replace('{total}', String(splitQueue.length))
            : t('webPosSaleCompleteAmount').replace('{amount}', money(paidTotal))
      );
    }
    // Pay later must leave checkout — otherwise Confirm on a CHF 0 cart creates empty duplicates.
    if (payLater && !moreSplits) {
      setPosView('register');
      setPosTab('register');
    }
    const shouldPrintReceipt =
      !opts?.skipReceiptPrint &&
      !payLater &&
      autoPrint &&
      printSettings?.autoPrintReceipt !== false;
    // Offline sales have no published receipt URL yet — still print text via local Print Agent.
    if (shouldPrintReceipt) {
      // Never hold checkout/busy on the print agent.
      void printReceipt(receiptText, receiptUrl, deliveryQrUrl).catch((e: any) => {
        toast.error(e?.message || t('webPosPrintFailed'));
      });
    }
    const kitchenDelta = unsentKitchenLines(cartSnapshot);
    if ((!moreSplits || splitIndex === 0) && kitchenDelta.length) {
      // Don't hold checkout/busy on kitchen print — agent latency is often several seconds.
      void printKitchenForCart(kitchenDelta, channelSnapshot, {
        orderNumber: kitchenOrderNumber({ ticket }),
        when: whenSnapshot,
        tabNumber: tabSnapshot,
        tableLabel: tableLabelSnapshot,
      }).catch((e: any) => {
        toast.error(e?.message || t('webPosKitchenPrintFailed'));
      });
    }
  };

  const guardOfflineCheckout = (
    method: PosPaymentMethod | 'express',
    opts?: { payments?: AppliedPayment[] }
  ): boolean => {
    if (!isWebPosCurrentlyOffline() && isBrowserOnline()) return true;
    if (!isWebPosOfflineEnabled()) {
      toast.error(t('webPosOfflineNeedNetwork'));
      return false;
    }
    const hasGiftTender = !!opts?.payments?.some((p) => p.method === 'gift_card');
    if (hasGiftTender || cartHasOfflineUnsafeLines(cart)) {
      toast.error(t('webPosOfflineGiftCardBlocked'));
      return false;
    }
    const payMethod = method === 'express' ? 'cash' : method;
    if (!canCompleteSaleOffline(payMethod, cart)) {
      toast.error(t('webPosOfflinePaymentBlocked'));
      return false;
    }
    return true;
  };

  const beginCheckout = (method: PosPaymentMethod | 'express') => {
    if (!cart.length || busy || paymentModalOpen || checkoutOpen) return;
    if (!guardOfflineCheckout(method)) return;
    if (method === 'pay_later' && (channel === 'dine_in' || !channel)) {
      setChannel('takeaway');
    }
    const scheduleChannel =
      method === 'pay_later' && (channel === 'dine_in' || !channel)
        ? 'takeaway'
        : channel;
    let whenForCheckout: FulfillmentWhen | undefined;
    if (
      (scheduleChannel === 'takeaway' || scheduleChannel === 'delivery') &&
      !fulfillmentWhen
    ) {
      whenForCheckout = asapFulfillment();
      setFulfillmentWhen(whenForCheckout);
    }
    if (scheduleChannel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod(method);
      setCustomerOpen(true);
      return;
    }
    void runCheckout(method, whenForCheckout);
  };

  const runCheckout = async (
    method: PosPaymentMethod | 'express',
    whenOverride?: FulfillmentWhen | null
  ) => {
    if (whenOverride !== undefined) setFulfillmentWhen(whenOverride);
    if (method === 'express') {
      setBusy(true);
      try {
        await finalizeSale('cash', undefined, whenOverride, {
          method: 'cash',
          ...checkoutBillDiscountExtras(),
          tipAmount: 0,
          roundingAmount: totals.rounding,
          total: totals.total,
          amountTendered: totals.total,
          changeDue: 0,
        }, true);
      } catch (e: any) {
        toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }
    setCheckoutSeedMethod(method);
    setPosView('checkout');
  };

  const completeFromCheckout = async (result: CheckoutResult) => {
    const part = splitQueue[splitIndex];
    const adjusted: CheckoutResult = part
      ? {
          ...result,
          total: part.amount,
          amountTendered:
            result.method === 'cash'
              ? result.amountTendered ?? part.amount
              : result.amountTendered,
          changeDue:
            result.method === 'cash' && result.amountTendered != null
              ? roundMoney2(result.amountTendered - part.amount)
              : result.changeDue,
        }
      : result;
    if (!guardOfflineCheckout(adjusted.method)) return;
    setCheckoutExtras(adjusted);
    setCheckoutOpen(false);
    if (adjusted.method === 'terminal') {
      setPaymentMethod('terminal');
      await runTerminalPayment(undefined, adjusted);
      return;
    }
    setBusy(true);
    try {
      const remaining = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
      await finalizeSale(adjusted.method, undefined, undefined, adjusted, true);
      if (remaining) {
        setSplitIndex((i) => i + 1);
        setCheckoutSeedMethod('cash');
        setPosView('checkout');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
      setPosView('checkout');
    } finally {
      setBusy(false);
    }
  };

  const holdCurrentOrder = async (sendToKitchen = false) => {
    if (!cart.length) return;
    try {
      const cartSnapshot = cart;
      const channelSnapshot = channel;
      const whenSnapshot = fulfillmentWhen;
      const tabSnapshot = tabNumber;
      const tableLabelSnapshot = tableLabel;
      const ticket = ensureCartTicket();
      await persistHeldOrder(cart, sendToKitchen, { ticket });
      setCart([]);
      clearCartTicket();
      toast.success(sendToKitchen ? t('webPosHeldSentKitchen') : t('webPosOrderHeld'));
      if (sendToKitchen) {
        const kitchenDelta = unsentKitchenLines(cartSnapshot);
        if (kitchenDelta.length) {
          void printKitchenForCart(kitchenDelta, channelSnapshot, {
            orderNumber: kitchenOrderNumber({ ticket }),
            when: whenSnapshot,
            tabNumber: tabSnapshot,
            tableLabel: tableLabelSnapshot,
          }).catch((e: any) => {
            toast.error(e?.message || t('webPosKitchenPrintFailed'));
          });
        }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosHoldFailed'));
    }
  };

  const runTerminalPayment = async (
    whenOverride?: FulfillmentWhen | null,
    extras?: CheckoutExtras | null
  ) => {
    if (!selectedTerminalId) {
      toast.error(t('webPosSelectTerminal'));
      return;
    }

    const clientId = `webpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const abort = new AbortController();
    paymentAbortRef.current = abort;
    setPaymentModalOpen(true);
    setPaymentPhase('processing');
    setPaymentMessage(t('webPosPayCompleteOnTerminal'));
    setBusy(true);

    try {
      const terminalAmount = roundMoney2(
        extras?.total ??
          (collectOrderRef ? collectOrderRef.total : activeSale.totals.total)
      );
      const res = await api.post(
        '/payment/terminal/poi',
        {
          amount: terminalAmount,
          terminalId: selectedTerminalId,
          currency: 'CHF',
          saleRef: clientId,
        },
        { signal: abort.signal, timeout: 170_000 }
      );

      const result = res.data.result as {
        status: string;
        message?: string;
        reference?: string;
        poiTransactionTimestamp?: string;
        customerReceipt?: AdyenTerminalReceipt | null;
        cashierReceipt?: AdyenTerminalReceipt | null;
      };
      const approved = res.data.success === true || result.status === 'approved';

      if (approved) {
        terminalPaymentRef.current = {
          reference: String(result.reference || ''),
          poiTransactionTimestamp: String(
            result.poiTransactionTimestamp || new Date().toISOString()
          ),
          customerReceipt: normalizeAdyenTerminalReceipt(result.customerReceipt),
          cashierReceipt: normalizeAdyenTerminalReceipt(result.cashierReceipt),
        };
        closePaymentModal();
        if (collectOrderRef) {
          await finalizeCollectPayment(
            [{ id: clientId, method: 'terminal', amount: terminalAmount }],
            0,
            extras?.tipAmount || 0
          );
          return;
        }
        await finalizeSale('terminal', clientId, whenOverride, extras, true);
        return;
      }

      if (result.status === 'cancelled') {
        setPaymentPhase('cancelled');
        setPaymentMessage(result.message || t('webPosPayCancelledMsg'));
        return;
      }

      setPaymentPhase('failed');
      setPaymentMessage(result.message || t('webPosPayFailedMsg'));
    } catch (e: any) {
      if (e.code === 'ERR_CANCELED' || e.name === 'CanceledError') {
        setPaymentPhase('cancelled');
        setPaymentMessage(t('webPosPayCancelled'));
        return;
      }
      setPaymentPhase('failed');
      setPaymentMessage(e.response?.data?.error || e.message || t('webPosPayFailedMsg'));
    } finally {
      setBusy(false);
      paymentAbortRef.current = null;
    }
  };

  const completeSale = async () => {
    beginCheckout(paymentMethod);
  };

  const expressSale = async () => {
    beginCheckout('express');
  };

  const staffPerms = webposStaff?.permissions;
  /** Never treat merchant-owner JWT as a bypass while a PIN session is required. */
  const canPay =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'PROCESS_PAYMENTS', false));
  const canDrawer =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'OPEN_CASH_DRAWER', false));
  const canCancelOrders =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'CANCEL_ORDERS', false));
  const canRefundOrders =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'REFUND_ORDERS', false));
  const canApplyDiscounts =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'APPLY_DISCOUNTS', false));
  const canViewReports =
    !staffConfigured ||
    (!!webposStaff &&
      (hasPermission(staffPerms, 'VIEW_REPORTS', false) ||
        hasPermission(staffPerms, 'END_OF_DAY', false)));
  const canOpenPanel =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'ACCESS_PANEL', false));
  const canViewAllSales =
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'VIEW_ALL_SALES', false));
  /** Whole-day EOD: report permission + company-wide sales visibility. */
  const canPrintDayEod = mayPrintWholeDayEod;
  const showEodButton = !shiftsEnabled && canPrintDayEod;

  const openEodPrint = () => {
    setSettingsOpen(false);
    if (canViewAllSales && panelStaff.length > 0) {
      setEodPickerOpen(true);
      return;
    }
    void printTodayEod(undefined, undefined, { includeProductsSold: eodIncludeProductsSold });
  };

  const openCashDrawer = async () => {
    if (!canDrawer) {
      toast.error(t('webPosDrawerDenied'));
      return;
    }
    try {
      await openCashDrawerViaAgent({ printerName: printerName || undefined });
      toast.success(t('webPosDrawerOpened'));
    } catch (e: any) {
      toast.error(e.message || t('webPosDrawerFailed'));
    }
  };

  const changePosColorTheme = async (theme: WebPosColorTheme) => {
    const prev = posColorTheme;
    setPosColorTheme(theme);
    try {
      await api.put('/merchant/settings', { posColorTheme: theme });
    } catch (e: any) {
      setPosColorTheme(prev);
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    }
  };

  const changePosTextSize = (size: WebPosTextSize) => {
    setPosTextSize(size);
    setSettingsOpen(false);
    try {
      localStorage.setItem(WEBPOS_TEXT_SIZE_KEY, size);
    } catch {
      /* ignore */
    }
  };

  const changePosAppearance = (appearance: WebPosAppearance) => {
    setPosAppearance(appearance);
    setSettingsOpen(false);
    try {
      localStorage.setItem(WEBPOS_APPEARANCE_KEY, appearance);
    } catch {
      /* ignore */
    }
  };

  const onStaffPinSuccess = (staff: {
    id: string;
    name: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    accessToken?: string;
  }) => {
    const session: WebPosStaffSession = {
      id: staff.id,
      name: staff.name,
      roleId: staff.roleId,
      roleName: staff.roleName,
      permissions: staff.permissions as Permission[],
      accessToken: staff.accessToken,
    };
    setWebposStaff(session);
    saveWebPosStaffSession(session);
    window.dispatchEvent(new CustomEvent('webpos:staff-session'));
    setPinModalOpen(false);
    toast.success(t('webPosSignedInAs').replace('{name}', staff.name));
    void refreshCurrentShift();
  };

  const openSwitchUserPin = () => {
    setPinModalMode('switch');
    setPinModalOpen(true);
  };

  const findProductByScanCode = useCallback(
    (code: string): Product | null => {
      const q = code.trim();
      if (!q) return null;
      const lower = q.toLowerCase();
      return (
        products.find(
          (p) =>
            (p.barcode && String(p.barcode).trim() === q) ||
            (p.sku && String(p.sku).trim().toLowerCase() === lower)
        ) || null
      );
    },
    [products]
  );

  const handlePosScan = useCallback(
    async (code: string) => {
      if (pinGateRequired || pinModalOpen) return;
      if (posView !== 'register') return;
      if (
        pendingProduct ||
        pendingCombo ||
        pendingOpenPrice ||
        checkoutOpen ||
        paymentModalOpen ||
        giftCardOpsOpen ||
        giftCardPayOpen ||
        splitOpen ||
        scheduleOpen ||
        customerOpen ||
        kitchenMsgOpen ||
        noteOpen ||
        setTableOpen ||
        setTabOpen ||
        cancelModal ||
        expressSuccessOpen
      ) {
        return;
      }
      const membershipEnabledSetting = !!(
        paymentConfig?.giftCardSettings as { membershipEnabled?: boolean } | null
      )?.membershipEnabled;
      const cardsScanEnabled =
        giftCardsEditionOk &&
        !isWebPosCurrentlyOffline() &&
        (((paymentConfig?.methods.giftCard === true) && canPay) || membershipEnabledSetting);
      if (cardsScanEnabled) {
        const attached = await lookupMembershipCard(code, { silentNotFound: true });
        if (attached) return;
      }
      const product = findProductByScanCode(code);
      if (product) {
        onProductClick(product);
        return;
      }
      const tableQr = parseTableQrPayload(code);
      if (tableQr?.tableId && tablesUiEnabled) {
        switchToTableOrder({
          id: tableQr.tableId,
          label: `T-${tableQr.tableId.slice(0, 6).toUpperCase()}`,
        });
        toast.success(
          t('tableQrAssigned').replace('{label}', tableQr.tableId.slice(0, 8).toUpperCase())
        );
        return;
      }
      toast.error(t('webPosBarcodeNotFound').replace('{code}', code));
    },
    // onProductClick is stable enough for scan; listed intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pinGateRequired,
      pinModalOpen,
      posView,
      pendingProduct,
      pendingCombo,
      pendingOpenPrice,
      checkoutOpen,
      paymentModalOpen,
      giftCardOpsOpen,
      giftCardPayOpen,
      splitOpen,
      scheduleOpen,
      customerOpen,
      kitchenMsgOpen,
      noteOpen,
      setTableOpen,
      setTabOpen,
      cancelModal,
      expressSuccessOpen,
      findProductByScanCode,
      giftCardsEditionOk,
      paymentConfig?.methods.giftCard,
      canPay,
      tablesUiEnabled,
      switchToTableOrder,
      t,
    ]
  );

  // Keyboard-wedge barcode scanner: buffer printable keys, Enter submits.
  useEffect(() => {
    const clearScanTimer = () => {
      if (scanTimerRef.current != null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (pinGateRequired || pinModalOpen || posView !== 'register') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'Enter') {
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        clearScanTimer();
        if (code.length >= 3) {
          e.preventDefault();
          handlePosScan(code);
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBufferRef.current += e.key;
        clearScanTimer();
        scanTimerRef.current = window.setTimeout(() => {
          scanBufferRef.current = '';
          scanTimerRef.current = null;
        }, 120);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearScanTimer();
    };
  }, [handlePosScan, pinGateRequired, pinModalOpen, posView]);

  const offlineNow = isWebPosCurrentlyOffline();
  const enabledMethods = {
    express: (paymentConfig?.methods.express ?? true) && canPay,
    cash: (paymentConfig?.methods.cash ?? true) && canPay,
    card: (paymentConfig?.methods.card ?? true) && canPay,
    // Terminal / gift card require live cloud APIs — hide while offline.
    terminal: (paymentConfig?.methods.terminal ?? false) && canPay && !offlineNow,
    giftCard:
      (paymentConfig?.methods.giftCard === true) && canPay && giftCardsEditionOk && !offlineNow,
  };
  const giftCardsFeatureOn =
    giftCardsEditionOk && enabledMethods.giftCard;

  const activeTerminals = useMemo(
    () => (paymentConfig?.terminals || []).filter((t) => t.status === 'active'),
    [paymentConfig]
  );

  const checkoutSplitTickets = useMemo(() => {
    if (!splitQueue.length) return undefined;
    return splitQueue.map((part, index) => {
      const resolveLines = () => {
        if (part.lineQtys && Object.keys(part.lineQtys).length > 0) {
          return cart.flatMap((l) => {
            const qty = part.lineQtys![l.lineId] ?? 0;
            if (qty <= 0) return [];
            return [{ name: l.name, quantity: qty }];
          });
        }
        if (part.lineIds.length > 0) {
          return cart
            .filter((l) => part.lineIds.includes(l.lineId))
            .map((l) => ({ name: l.name, quantity: l.quantity }));
        }
        return [];
      };
      return {
        index,
        label: part.label,
        amount: part.amount,
        lines: resolveLines(),
        paid: index < splitIndex,
      };
    });
  }, [splitQueue, splitIndex, cart]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        {t('webPosLoading')}
      </div>
    );
  }

  if (entitlement && !entitlement.allowed) {
    return (
      <div
        className={`webpos-shell ${
          appMode ? 'h-dvh' : '-m-3 sm:-m-4 h-[calc(100dvh-4rem)]'
        } flex flex-col`}
        data-theme={posColorTheme || 'teal'}
      >
        <WebPosLicenseGate
          entitlement={entitlement}
          businessName={merchant?.name || APP_NAME}
        />
      </div>
    );
  }

  if (pinGateRequired) {
    const pinNeedsNetwork = isWebPosCurrentlyOffline();
    return (
      <div
        className={`webpos-shell ${
          appMode ? 'h-dvh' : '-m-3 sm:-m-4 h-[calc(100dvh-4rem)]'
        } flex flex-col bg-stone-950`}
        data-theme={posColorTheme || 'teal'}
        data-text-size={posTextSize}
        data-narrow={isNarrowViewport ? '1' : '0'}
      >
        {pinNeedsNetwork ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-stone-100">
            <p className="text-lg font-semibold">{t('webPosOfflinePinTitle')}</p>
            <p className="max-w-md text-sm text-stone-300">{t('webPosOfflinePinBody')}</p>
            <button
              type="button"
              className="mt-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
              onClick={() => void load()}
            >
              {t('webPosOfflineRetry')}
            </button>
          </div>
        ) : (
          <WebPosPinModal
            open
            mode="gate"
            onClose={() => {
              /* gate cannot be dismissed without PIN */
            }}
            onSuccess={onStaffPinSuccess}
          />
        )}
      </div>
    );
  }

  const customerLabel = selectedCustomer
    ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ') ||
      selectedCustomer.phone ||
      null
    : null;
  const checkoutDueTotal = collectOrderRef?.total ?? activeSale.totals.total;

  const onlinePendingCount = unactionedOrderCount;
  const orderAlertRing = unactionedOrderCount > 0;
  const currentNewOrderAlert = newOrderAlertQueue[0] ?? null;

  const tableBadge =
    tableLabel || tabNumber
      ? [tableLabel, tabNumber ? `#${tabNumber}` : ''].filter(Boolean).join(' · ')
      : null;

  const onPosTabChange = (tab: PosTab) => {
    if (tab === 'tables' || tab === 'orders' || tab === 'bookings') {
      saveOpenCartDraft();
    }
    setMobileCartOpen(false);
    setSelectedLineId(null);
    setPosTab(tab);
    setPosView(tab);
    if (tab === 'register') {
      requestAnimationFrame(() => blurPosInputs());
    }
  };

  const cartItemsLabel =
    cartCount === 1
      ? t('webPosCartItemOne')
      : t('webPosCartItems').replace('{n}', String(cartCount));

  return (
    <div
      className={`webpos-shell min-h-0 overflow-hidden flex flex-col ${
        appMode ? 'webpos-shell--fill' : 'webpos-shell--embedded -m-3 sm:-m-4'
      }`}
      data-theme={posColorTheme || 'teal'}
      data-appearance={posAppearance}
      data-text-size={posTextSize}
      data-narrow={isNarrowViewport ? '1' : '0'}
    >
      {reservationAlertUntil > Date.now() ? (
        <div
          className="shrink-0 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950 animate-pulse"
          role="status"
        >
          {t('webPosNewReservationAlert')}
        </div>
      ) : null}
      <WebPosTopBar
        activeTab={posTab}
        posView={posView}
        onTabChange={onPosTabChange}
        merchantName={merchant?.name || t('webPosStore')}
        agentOk={agentOk}
        search={search}
        onSearchChange={setSearch}
        showSearch={posView === 'register'}
        onlinePendingCount={onlinePendingCount}
        orderAlertRing={orderAlertRing}
        reservationPendingCount={reservationPendingCount}
        staffName={webposStaff?.name}
        canDrawer={canDrawer}
        canShowPanel={canOpenPanel}
        appMode={appMode}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onCloseSettings={() => setSettingsOpen(false)}
        settingsRef={settingsRef}
        onOnlineOrders={() => openOnlineOrdersInTab()}
        onSwitchUser={openSwitchUserPin}
        onOpenDrawer={() => void openCashDrawer()}
        onShowPanel={showPanelMenus}
        tableBadge={tableBadge}
        shiftsEnabled={shiftsEnabled}
        shiftOpen={!!openShift}
        onCloseShift={() => void openCloseShiftModal()}
        onStartShift={() => {
          setSettingsOpen(false);
          setStartShiftOpen(true);
        }}
        showEodButton={showEodButton}
        onEodReport={openEodPrint}
        hideTablesTab={!tablesUiEnabled}
        hideBookingsTab={!tablesUiEnabled}
        colorTheme={posColorTheme}
        onColorThemeChange={(theme) => void changePosColorTheme(theme)}
        appearance={posAppearance}
        onAppearanceChange={changePosAppearance}
        textSize={posTextSize}
        onTextSizeChange={changePosTextSize}
        syncOnline={offlineSync.online}
        syncPendingCount={offlineSync.pendingCount}
        syncFailedCount={offlineSync.failedCount}
        syncing={offlineSync.syncing}
        onSyncNow={() => {
          if (!isBrowserOnline()) {
            toast.error(t('webPosOfflineNeedNetwork'));
            return;
          }
          void flushOfflineOutbox().then((r) => {
            if (r.synced > 0) {
              toast.success(
                t('webPosSyncFlushed').replace('{n}', String(r.synced))
              );
            } else if (r.failed > 0) {
              toast.error(t('webPosSyncFailed').replace('{n}', String(r.failed)));
            } else {
              toast.success(t('webPosSyncOk'));
            }
          });
        }}
        settingsPanel={
          <WebPosSettingsDropdown
            printerName={printerName}
            printers={printers}
            agentOk={agentOk}
            autoPrint={autoPrint}
            postSuccessTarget={postSuccessTarget}
            onPrinterChange={setPrinterName}
            onAutoPrintChange={setAutoPrint}
            onPostSuccessChange={setPostSuccessTarget}
            onRefreshPrinters={() => {
              void refreshAgent();
              setSettingsOpen(false);
              toast.success(t('webPosPrintersRefreshed'));
            }}
            onReloadCatalog={() => {
              void load();
              setSettingsOpen(false);
            }}
            shiftsEnabled={shiftsEnabled}
            shiftOpen={!!openShift}
            onCloseShift={() => void openCloseShiftModal()}
            onStartShift={() => {
              setSettingsOpen(false);
              setStartShiftOpen(true);
            }}
            onCashMovement={() => {
              if (!openShift) {
                toast.error(t('webPosCashRequiresShift'));
                return;
              }
              setSettingsOpen(false);
              setCashMovementOpen(true);
            }}
            showEodButton={showEodButton}
            onEodReport={openEodPrint}
            onlinePendingCount={onlinePendingCount}
            reservationPendingCount={reservationPendingCount}
            onOnlineOrders={() => {
              setSettingsOpen(false);
              openOnlineOrdersInTab();
            }}
            onSwitchUser={() => {
              setSettingsOpen(false);
              openSwitchUserPin();
            }}
            staffName={webposStaff?.name}
            colorTheme={posColorTheme}
            onColorThemeChange={(theme) => void changePosColorTheme(theme)}
            appearance={posAppearance}
            onAppearanceChange={changePosAppearance}
            textSize={posTextSize}
            onTextSizeChange={changePosTextSize}
            syncOnline={offlineSync.online}
            syncPendingCount={offlineSync.pendingCount}
            syncFailedCount={offlineSync.failedCount}
            syncing={offlineSync.syncing}
            onSyncNow={() => {
              if (!isBrowserOnline()) {
                toast.error(t('webPosOfflineNeedNetwork'));
                return;
              }
              void flushOfflineOutbox().then((r) => {
                if (r.synced > 0) {
                  toast.success(
                    t('webPosSyncFlushed').replace('{n}', String(r.synced))
                  );
                } else if (r.failed > 0) {
                  toast.error(t('webPosSyncFailed').replace('{n}', String(r.failed)));
                } else {
                  toast.success(t('webPosSyncOk'));
                }
              });
            }}
            canDrawer={canDrawer}
            onOpenDrawer={() => {
              setSettingsOpen(false);
              void openCashDrawer();
            }}
            canShowPanel={canOpenPanel}
            appMode={appMode}
            onShowPanel={() => {
              setSettingsOpen(false);
              showPanelMenus();
            }}
          />
        }
      />

      {shiftsEnabled && !openShift && !startShiftOpen && !offlineNow ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-3 py-2 sm:px-4">
          <p className="min-w-0 text-xs font-medium text-amber-950 sm:text-sm">
            {t('webPosShiftClosedHint')}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            onClick={() => {
              void (async () => {
                const current = await refreshCurrentShift(true);
                if (!current?.shift) setStartShiftOpen(true);
              })();
            }}
          >
            {t('webPosShiftStart')}
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {posView === 'checkout' ? (
          <WebPosCheckoutView
            key={
              collectOrderRef
                ? `collect-${collectOrderRef.id}`
                : splitQueue.length
                  ? `split-${splitIndex}-${splitQueue.length}`
                  : 'register-checkout'
            }
            total={checkoutDueTotal}
            splitLabel={collectOrderRef ? collectOrderRef.orderNumber : activeSale.label}
            splitGuestCount={collectOrderRef ? undefined : splitQueue.length || undefined}
            splitTickets={checkoutSplitTickets}
            splitActiveIndex={splitIndex}
            onSplitTicketChange={(index) => {
              if (index >= splitIndex) setSplitIndex(index);
            }}
            settings={checkoutSettings}
            methods={{
              cash: enabledMethods.cash,
              card: enabledMethods.card,
              terminal: enabledMethods.terminal,
              giftCard: collectOrderRef ? false : enabledMethods.giftCard,
              payLater:
                !collectOrderRef &&
                (channel === 'takeaway' || channel === 'delivery') &&
                canPay &&
                !offlineNow,
            }}
            busy={busy || paymentModalOpen}
            customerLabel={customerLabel}
            membershipPointsBalance={
              collectOrderRef
                ? null
                : attachedMembership?.membershipEnabled
                  ? attachedMembership.pointsBalance
                  : null
            }
            canPayWithPoints={!collectOrderRef && membershipCheckout.canPayWithPoints}
            payWithPoints={payWithPoints}
            onTogglePayWithPoints={setPayWithPoints}
            pointsRedeemed={membershipCheckout.pointsRedeemed}
            pointsDiscount={membershipCheckout.pointsDiscount}
            onCustomer={collectOrderRef ? undefined : () => setCustomerOpen(true)}
            onOpenDrawer={canDrawer ? () => void openCashDrawer() : undefined}
            onSplit={
              !collectOrderRef && checkoutSettings.splitBillsEnabled && !splitQueue.length
                ? () => {
                    setSplitOpen(true);
                  }
                : undefined
            }
            onGiftCardRequest={
              collectOrderRef
                ? undefined
                : (due) => {
                    setGiftCardPayDue(due);
                    setGiftCardPayOpen(true);
                  }
            }
            injectPayment={giftPayInject}
            onInjectPaymentConsumed={() => setGiftPayInject(null)}
            onComplete={(payments, changeDue, tipAmount) =>
              void completeMultiTenderCheckout(payments, changeDue, tipAmount)
            }
            onBack={() => {
              if (collectOrderRef) {
                const returnView = collectOrderRef.returnView;
                clearCollectCheckout();
                if (returnView === 'orders') {
                  setPosTab('orders');
                  setPosView('orders');
                } else {
                  setPosView('register');
                  setPosTab('register');
                }
                return;
              }
              setSplitQueue([]);
              setSplitIndex(0);
              splitMasterIdRef.current = null;
              setPosView('register');
              setPosTab('register');
            }}
            onBillDiscount={
              !collectOrderRef && checkoutSettings.discountsEnabled
                ? () => setBillDiscountOpen(true)
                : undefined
            }
            onClearBillDiscount={
              !collectOrderRef && checkoutSettings.discountsEnabled
                ? () => setBillDiscount({ percent: 0, amount: 0 })
                : undefined
            }
            canApplyBillDiscount={!collectOrderRef && canApplyDiscounts}
            billDiscountLabel={billDiscountLabel}
            billDiscountAmount={payableFullTotals.discount || 0}
          />
        ) : posView === 'success' && successInfo ? (
          <WebPosSuccessView
            amount={successInfo.amount}
            changeDue={successInfo.changeDue}
            receiptUrl={lastSplitReceipts.length <= 1 ? lastReceiptUrl : undefined}
            splitParts={successSplitParts}
            onBack={() => {
              setSuccessInfo(null);
              setLastSplitReceipts([]);
              splitReceiptsRef.current = [];
              setPosView('register');
              setPosTab('register');
            }}
            onPrint={lastSplitReceipts.length <= 1 ? openSuccessPrint : undefined}
            onPrintPart={successSplitParts ? (id) => void printSuccessPart(id) : undefined}
            onPrintAll={successSplitParts ? () => void printSuccessAll() : undefined}
            onOpenDrawer={canDrawer ? () => void openCashDrawer() : undefined}
            onSendReceipt={() => setSendReceiptOpen(true)}
            onContinue={() => {
              setSuccessInfo(null);
              setLastSplitReceipts([]);
              splitReceiptsRef.current = [];
              const next = isRetail ? 'register' : postSuccessTarget;
              setPosTab(next);
              setPosView(next);
            }}
          />
        ) : posView === 'tables' ? (
          <WebPosTablesView
            selectedTableId={tableId}
            draftTableIds={draftTableIds}
            refreshToken={tablesRefreshToken}
            onSelectTable={(table) => switchToTableOrder(table)}
            onMoveTable={(table) => openMoveTablePicker(table)}
          />
        ) : posView === 'bookings' ? (
          <WebPosBookingsView />
        ) : posView === 'orders' ? (
          <WebPosOrdersPanel
            embedded
            open
            onClose={() => {
              setHighlightOrderId(null);
              setOrdersChannelPref(null);
              setPosTab('register');
              setPosView('register');
            }}
            refreshToken={ordersRefreshToken}
            canCancel={canCancelOrders}
            canRefund={canRefundOrders}
            highlightOrderId={highlightOrderId}
            initialChannelFilter={ordersChannelPref}
            onResumeHeld={(held) => {
              resumedHeldIdRef.current = held.id;
              const data = held.cartJson as
                | {
                    cart?: CartLine[];
                    channel?: Channel;
                    tableId?: string | null;
                    tableLabel?: string | null;
                    tabNumber?: string | null;
                    ticketDisplay?: string | null;
                    ticketOrderNumber?: string | null;
                    billDiscount?: BillDiscount;
                    orderNote?: string;
                  }
                | CartLine[];
              if (Array.isArray(data)) {
                setCart(data);
              } else if (data?.cart) {
                setCart(data.cart);
                if (data.channel) setChannel(data.channel);
                if (data.tableId) setTableId(data.tableId);
                if (data.tableLabel) setTableLabel(data.tableLabel);
                if (data.tabNumber != null) setTabNumber(data.tabNumber);
                if (data.ticketDisplay) setTicketDisplay(data.ticketDisplay);
                if (data.ticketOrderNumber) setTicketOrderNumber(data.ticketOrderNumber);
                if (data.orderNote != null) setOrderNote(data.orderNote);
                if (data.billDiscount) setBillDiscount(data.billDiscount);
              }
              const sent = held.status === 'sent_to_kitchen';
              setOrderSent(sent);
              setCoursesBulkSent(sent);
              // Remove from held list while editing/paying on the register.
              void api.post(`/merchant/pos/held/${held.id}/resume`).catch(() => {});
              setOrdersRefreshToken((n) => n + 1);
              setPosTab('register');
              setPosView('register');
              requestAnimationFrame(() => blurPosInputs());
              toast.success(t('webPosOrderResumed'));
            }}
            onPrintOrder={async (order, splitLabel) => {
              try {
                await printPosOrderReceipt(order, splitLabel);
              } catch (e: any) {
                toast.error(e.message || t('webPosPrintFailed'));
              }
            }}
            onPrintRefund={async (payload) => {
              try {
                await printPosRefundReceipt(payload);
                toast.success(t('webPosSentDefaultPrinter'));
              } catch (e: any) {
                toast.error(e.message || t('webPosPrintFailed'));
              }
            }}
            terminalEnabled={enabledMethods.terminal}
            onVoidHeldKitchen={async (held, reason) => {
              const data = held.cartJson as
                | { cart?: CartLine[]; ticketDisplay?: string | null }
                | CartLine[];
              const lines = Array.isArray(data) ? data : data?.cart || [];
              if (!lines.length) return;
              const ch = (held.channel || 'takeaway') as Channel;
              const existingTicket =
                (!Array.isArray(data) && data?.ticketDisplay) ||
                (held.label || '').match(/#\d{4}/)?.[0] ||
                null;
              const ticketDisplay =
                existingTicket || nextWebPosTicketNumber(merchant?.id).display;
              await printKitchenForCart(lines, ch, {
                orderNumber: ticketDisplay,
                cancelled: true,
                cancelReason: reason,
                forcePrint: true,
              });
            }}
            onCollectPaymentCheckout={(order) => openOrderCollectCheckout(order, 'orders')}
            onOrderActioned={markOnlineOrderActioned}
            onlineOrders={onlineOrders}
            onRefreshOnline={() => void pollOnlineOrders()}
            onChannelFilterChange={(filter) => {
              if (filter === 'online') {
                setOrdersChannelPref('online');
              } else if (ordersChannelPref === 'online') {
                setOrdersChannelPref(null);
              }
            }}
          />
        ) : (
          <div
            className={`flex min-h-0 flex-1 flex-col lg:flex-row ${
              cartSide === 'right' ? 'lg:flex-row-reverse' : ''
            }`}
          >
            {/* Desktop: side cart. Mobile (<1024): full-screen cart only when open — JS-gated. */}
            {(mobileCartOpen || !isNarrowViewport) ? (
            <div
              className={
                mobileCartOpen && isNarrowViewport
                  ? 'flex min-h-0 flex-1 flex-col'
                  : 'hidden min-h-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:self-stretch'
              }
            >
              <WebPosCartPanel
                cart={cart}
                totals={totals}
                taxRate={taxRate}
                money={money}
                selectedLineId={selectedLineId}
                onSelectLine={handleSelectLine}
                onEditLine={openLineForEdit}
                keypadMode={keypadMode}
                onKeypadModeChange={handleKeypadModeChange}
                keypadBuffer={keypadBuffer}
                onKeypadBufferChange={handleKeypadBufferChange}
                onKeypadApply={applyKeypadToLine}
                onKeypadAdjust={handleKeypadAdjust}
                onKeypadBackspace={handleKeypadBackspace}
                channel={effectiveChannel}
                onChannelChange={selectFulfillmentChannel}
                activeCourse={activeCourse}
                coursesEnabled={coursesEnabled}
                courseNumbers={courseNumbers}
                onSelectCourse={setActiveCourse}
                orderNote={orderNote}
                tableLabel={tableLabel}
                tabNumber={tabNumber}
                ticketDisplay={ticketDisplay}
                customerLabel={customerLabel}
                membershipName={
                  attachedMembership
                    ? attachedMembership.customerName ||
                      attachedMembership.cardNumber ||
                      null
                    : null
                }
                membershipPointsBalance={
                  attachedMembership?.membershipEnabled
                    ? attachedMembership.pointsBalance
                    : null
                }
                onClearMembership={
                  attachedMembership ? clearAttachedMembership : undefined
                }
                fulfillmentLabel={fulfillmentWhen?.label || null}
                fulfillmentIsLater={fulfillmentWhen?.mode === 'later'}
                busy={busy || paymentModalOpen}
                orderSent={orderSent}
                showNewOrder={showNewOrderButton}
                sendLabel={sendLabel}
                onCustomer={() => setCustomerOpen(true)}
                onProvisionalReceipt={() => void printProvisionalReceipt()}
                onSwitchToDineIn={switchToDineIn}
                onCourse={advanceCourse}
                onKitchenMessage={() => setKitchenMsgOpen(true)}
                onSetTable={() => {
                  setTablePickerPurpose('set');
                  setMoveSourceTable(null);
                  setMoveLineId(null);
                  setSetTableOpen(true);
                }}
                onSetTab={() => setSetTabOpen(true)}
                onSend={() => void sendCoursesToKitchen()}
                onNewOrder={startNewOrder}
                onPayment={openRegisterCheckout}
                onCancelOrder={() => {
                  if (!cart.length && !orderSent) {
                    void startNewOrder(true);
                    return;
                  }
                  if (!cart.length) return;
                  setCancelModal({ scope: 'order' });
                }}
                onCancelItem={() => {
                  const line = cart.find((l) => l.lineId === selectedLineId);
                  if (!line?.sentToKitchen) {
                    toast.error(t('webPosCancelItemNeedSent'));
                    return;
                  }
                  setCancelModal({ scope: 'item', lineId: line.lineId });
                }}
                onRemoveLine={removeSelectedLine}
                onPayLater={() => beginCheckout('pay_later')}
                onEditFulfillment={() => setScheduleOpen(true)}
                showSend={showSend}
                hideTab={hideTab}
                canCancelOrder={cart.length > 0 || (!kitchenEnabled && !orderSent)}
                canCancelItem={!!cart.find((l) => l.lineId === selectedLineId)?.sentToKitchen}
                dockSide={cartSide}
                showChannelTabs={showChannelTabs}
                channelTabOptions={channelTabOptions}
                kitchenEnabled={kitchenEnabled}
                tablesEnabled={tablesUiEnabled}
                requireTableForDineIn={requireTableForDineIn}
                onHoldOrder={() => void holdCurrentOrder(false)}
                onMoveTable={
                  tablesUiEnabled && kitchenEnabled
                    ? () => openMoveTablePicker()
                    : undefined
                }
                onMoveDish={
                  tablesUiEnabled && kitchenEnabled
                    ? () => openMoveDishPicker()
                    : undefined
                }
                onBillDiscount={
                  checkoutSettings.discountsEnabled ? () => setBillDiscountOpen(true) : undefined
                }
                canApplyBillDiscount={canApplyDiscounts}
                billDiscountLabel={billDiscountLabel}
                canReleaseTable={!!tableLabel && cart.length === 0}
                onReleaseTable={releaseEmptyTable}
                isRetail={isRetail}
                layout={isNarrowViewport && mobileCartOpen ? 'page' : 'side'}
                onBack={
                  isNarrowViewport && mobileCartOpen
                    ? () => {
                        setMobileCartOpen(false);
                        setSelectedLineId(null);
                        setKeypadBuffer('');
                      }
                    : undefined
                }
              />
            </div>
            ) : null}

            {/* Products (mobile default). Hidden on narrow viewports while cart page is open. */}
            {(!isNarrowViewport || !mobileCartOpen) ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <WebPosProductArea
                categories={categories}
                products={visibleProducts}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                onProductClick={onProductClick}
                cartQtyByProduct={cartQtyByProduct}
                productHasCombo={(p) => productHasComboSlots(p)}
                productHasMods={(p) => productHasModifiers(p as ShopProductForModifiers)}
                showProductImages={gridShowImages}
                onToggleShowImages={() => {
                  setGridShowImages((v) => {
                    const next = !v;
                    try {
                      localStorage.setItem(WEBPOS_GRID_SHOW_IMAGES_KEY, next ? '1' : '0');
                    } catch {
                      /* ignore */
                    }
                    return next;
                  });
                }}
                tileSize={gridTileSize}
                onCycleTileSize={() => {
                  setGridTileSize((cur) => {
                    const next: ProductGridTileSize =
                      cur === 'sm' ? 'md' : cur === 'md' ? 'lg' : 'sm';
                    try {
                      localStorage.setItem(WEBPOS_GRID_TILE_SIZE_KEY, next);
                    } catch {
                      /* ignore */
                    }
                    return next;
                  });
                }}
                productSort={gridSort}
                onToggleSortAlpha={() => {
                  setGridSort((cur) => {
                    const next: ProductGridSort = cur === 'alpha' ? 'default' : 'alpha';
                    try {
                      localStorage.setItem(WEBPOS_GRID_SORT_KEY, next);
                    } catch {
                      /* ignore */
                    }
                    return next;
                  });
                }}
                onToggleSortBestseller={() => {
                  setGridSort((cur) => {
                    const next: ProductGridSort = cur === 'bestseller' ? 'default' : 'bestseller';
                    try {
                      localStorage.setItem(WEBPOS_GRID_SORT_KEY, next);
                    } catch {
                      /* ignore */
                    }
                    return next;
                  });
                }}
                expressMethods={{
                  cash: enabledMethods.cash,
                  card: enabledMethods.card,
                  terminal: enabledMethods.terminal,
                }}
                onExpressPay={(m) => void runExpressPay(m)}
                onOpenCheckout={openRegisterCheckout}
                expressDisabled={!cart.length || busy || paymentModalOpen}
                checkoutDisabled={!cart.length || busy || paymentModalOpen}
                giftCardsEnabled={giftCardsFeatureOn && !offlineNow}
                onGiftCards={() => {
                  if (offlineNow) {
                    toast.error(t('webPosOfflineGiftCardBlocked'));
                    return;
                  }
                  setCategoryId(POS_GIFT_CARDS_CATEGORY);
                }}
                onSellGiftCard={() => {
                  if (offlineNow) {
                    toast.error(t('webPosOfflineGiftCardBlocked'));
                    return;
                  }
                  void ensureShift(() => setGiftCardOpsOpen(true));
                }}
                onSellMembership={() => {
                  if (offlineNow) {
                    toast.error(t('webPosOfflineGiftCardBlocked'));
                    return;
                  }
                  if (!(paymentConfig?.giftCardSettings as { membershipEnabled?: boolean } | null)?.membershipEnabled) {
                    toast.error(t('membershipEnabled'));
                    return;
                  }
                  void ensureShift(() => setMembershipSellOpen(true));
                }}
                membershipEnabled={
                  !!(paymentConfig?.giftCardSettings as { membershipEnabled?: boolean } | null)?.membershipEnabled
                }
                onCustomAmount={openCustomAmountModal}
                onBackgroundClick={() => handleSelectLine(null)}
              />
              {/* Odoo-style sticky Pay | Cart — only on narrow viewports (JS + CSS). */}
              {isNarrowViewport ? (
              <div className="webpos-mobile-pay-cart shrink-0 border-t border-stone-200 bg-white p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!cart.length || busy || paymentModalOpen}
                    onClick={openRegisterCheckout}
                    className="flex flex-col items-center justify-center rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-800 hover:bg-stone-50 disabled:opacity-40"
                  >
                    <span className="text-sm font-bold leading-none">{t('webPosPay')}</span>
                    <span className="mt-1 text-xs font-semibold tabular-nums text-stone-600">
                      {money(totals.total)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileCartOpen(true);
                      setSelectedLineId(null);
                      setKeypadBuffer('');
                    }}
                    className="webpos-accent-btn flex flex-col items-center justify-center rounded-xl px-3 py-3 disabled:opacity-40"
                  >
                    <span className="text-sm font-bold leading-none">{t('webPosCart')}</span>
                    <span className="mt-1 text-xs font-semibold opacity-95">{cartItemsLabel}</span>
                  </button>
                </div>
              </div>
              ) : null}
            </div>
            ) : null}
          </div>
        )}

        {expressSuccessOpen && successInfo ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-6">
            <div className="w-full max-w-xl">
              <WebPosSuccessView
                compact
                amount={successInfo.amount}
                changeDue={successInfo.changeDue}
                receiptUrl={lastSplitReceipts.length <= 1 ? lastReceiptUrl : undefined}
                splitParts={successSplitParts}
                onPrint={lastSplitReceipts.length <= 1 ? openSuccessPrint : undefined}
                onPrintPart={successSplitParts ? (id) => void printSuccessPart(id) : undefined}
                onPrintAll={successSplitParts ? () => void printSuccessAll() : undefined}
                onOpenDrawer={canDrawer ? () => void openCashDrawer() : undefined}
                onSendReceipt={() => setSendReceiptOpen(true)}
                onContinue={() => {
                  setExpressSuccessOpen(false);
                  setSuccessInfo(null);
                  setLastSplitReceipts([]);
                  splitReceiptsRef.current = [];
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <WebPosSendReceiptModal
        open={sendReceiptOpen}
        busy={sendReceiptBusy}
        initialEmail={sendReceiptPrefillEmail}
        onClose={() => {
          if (!sendReceiptBusy) setSendReceiptOpen(false);
        }}
        onSend={(email) => void sendReceiptEmail(email)}
      />

      <WebPosPrintChooserModal
        open={printChooserOpen}
        busy={printChooserBusy}
        parts={lastSplitReceipts.map((p) => ({
          id: p.id,
          label: p.label,
          amount: p.amount,
        }))}
        onClose={() => {
          if (!printChooserBusy) setPrintChooserOpen(false);
        }}
        onPrintPart={async (partId) => {
          const part = lastSplitReceipts.find((p) => p.id === partId);
          if (!part) return;
          setPrintChooserBusy(true);
          try {
            await printReceipt(part.text, part.url, part.deliveryQrUrl);
            setPrintChooserOpen(false);
          } catch (e: any) {
            toast.error(e.message || t('webPosPrintFailed'));
          } finally {
            setPrintChooserBusy(false);
          }
        }}
        onPrintComplete={async () => {
          if (!lastSplitReceipts.length) return;
          setPrintChooserBusy(true);
          try {
            const combined = lastSplitReceipts
              .map((p) => p.text)
              .join('\n\n====================\n\n');
            const firstUrl = lastSplitReceipts[0]?.url;
            const firstDeliveryQr = lastSplitReceipts[0]?.deliveryQrUrl;
            await printReceipt(combined, firstUrl, firstDeliveryQr);
            setPrintChooserOpen(false);
          } catch (e: any) {
            toast.error(e.message || t('webPosPrintFailed'));
          } finally {
            setPrintChooserBusy(false);
          }
        }}
      />

      <WebPosKitchenMessageModal
        open={kitchenMsgOpen}
        onClose={() => setKitchenMsgOpen(false)}
        onSend={onKitchenMessage}
      />
      {newOrderConfirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">{t('webPosNewOrderConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-stone-600">{t('webPosNewOrderConfirmBody')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                onClick={() => setNewOrderConfirmOpen(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800"
                onClick={() => {
                  setNewOrderConfirmOpen(false);
                  void startNewOrder(true);
                }}
              >
                {t('webPosNew')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <WebPosOrderNoteModal
        open={noteOpen}
        initial={orderNote}
        onClose={() => setNoteOpen(false)}
        onSave={setOrderNote}
      />
      <WebPosSetTableModal
        open={setTableOpen}
        onClose={() => {
          setSetTableOpen(false);
          setTablePickerPurpose('set');
        }}
        selectedTableId={tableId}
        excludeTableId={
          tablePickerPurpose === 'set'
            ? null
            : moveSourceTable?.id || tableId
        }
        title={
          tablePickerPurpose === 'move_table'
            ? t('webPosMoveTableTo')
            : tablePickerPurpose === 'move_dish'
              ? t('webPosMoveDishTo')
              : undefined
        }
        draftTableIds={draftTableIds}
        refreshToken={tablesRefreshToken}
        onSelect={handleTablePickerSelect}
      />

      {mergeTarget && moveSourceTable ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-stone-900">
              {t('webPosMergeTableTitle')}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {t('webPosMergeTableBody').replace('{table}', mergeTarget.label)}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setMergeTarget(null)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => {
                  const source = moveSourceTable;
                  const target = mergeTarget;
                  setMergeTarget(null);
                  if (source && target) void executeMoveEntireTable(source, target, true);
                }}
              >
                {t('webPosMerge')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <WebPosSetTabModal
        open={setTabOpen}
        onClose={() => setSetTabOpen(false)}
        current={tabNumber}
        onConfirm={(tab) => {
          saveOpenCartDraft();
          // Tabs are walk-in takeaway (not dine-in tables).
          const tabChannel: Channel = 'takeaway';
          const key = openCartDraftKey({ tabNumber: tab, channel: tabChannel });
          const existing = openCartDraftsRef.current.get(key);
          if (existing) {
            applyOpenCartDraft(existing);
          } else {
            setTabNumber(tab);
            setTableId(null);
            setTableLabel(null);
            setChannel(tabChannel);
            setFulfillmentWhen(asapFulfillment());
            if (!ticketDisplay) ensureCartTicket();
          }
        }}
      />

      {pendingProduct && (
        <WebPosProductModifiersModal
          product={pendingProduct}
          showProductImages={gridShowImages}
          initialSelectedExtras={
            editingLineId
              ? cart.find((l) => l.lineId === editingLineId)?.selectedExtras
              : undefined
          }
          initialQuantity={
            editingLineId
              ? cart.find((l) => l.lineId === editingLineId)?.quantity
              : undefined
          }
          initialLineNote={
            editingLineId
              ? cart.find((l) => l.lineId === editingLineId)?.lineNote || ''
              : undefined
          }
          onClose={() => {
            setPendingProduct(null);
            setEditingLineId(null);
          }}
          onConfirm={({ selectedExtras, unitPrice, quantity, lineNote }) => {
            const base = products.find((p) => p.id === pendingProduct.id);
            if (base) {
              if (editingLineId) {
                updateConfiguredLine(
                  editingLineId,
                  unitPrice,
                  selectedExtras,
                  [],
                  quantity,
                  lineNote
                );
              } else {
                pushConfiguredProductWithQty(base, unitPrice, selectedExtras, [], quantity, lineNote);
              }
            }
            setPendingProduct(null);
            setEditingLineId(null);
          }}
        />
      )}

      {pendingCombo && (
        <WebPosComboModal
          product={pendingCombo}
          showProductImages={gridShowImages}
          initialComboSelections={
            editingLineId
              ? cart.find((l) => l.lineId === editingLineId)?.comboSelections
              : undefined
          }
          initialSelectedExtras={
            editingLineId
              ? cart.find((l) => l.lineId === editingLineId)?.selectedExtras
              : undefined
          }
          initialQuantity={
            editingLineId
              ? cart.find((l) => l.lineId === editingLineId)?.quantity
              : undefined
          }
          initialLineNote={
            editingLineId
              ? cart.find((l) => l.lineId === editingLineId)?.lineNote || ''
              : undefined
          }
          onClose={() => {
            setPendingCombo(null);
            setEditingLineId(null);
          }}
          onConfirm={({ comboSelections, selectedExtras, unitPrice, quantity, lineNote }) => {
            const base = products.find((p) => p.id === pendingCombo.id);
            if (base) {
              if (editingLineId) {
                updateConfiguredLine(
                  editingLineId,
                  unitPrice,
                  selectedExtras,
                  comboSelections as ShopComboSelection[],
                  quantity,
                  lineNote
                );
              } else {
                pushConfiguredProductWithQty(
                  base,
                  unitPrice,
                  selectedExtras,
                  comboSelections as ShopComboSelection[],
                  quantity,
                  lineNote
                );
              }
            }
            setPendingCombo(null);
            setEditingLineId(null);
          }}
        />
      )}

      <WebPosTipKeypad
        open={!!pendingOpenPrice}
        allowPercent={false}
        title={
          pendingOpenPrice
            ? `${t('webPosEnterPrice')} - ${pendingOpenPrice.name}`
            : t('webPosEnterPrice')
        }
        onClose={() => setPendingOpenPrice(null)}
        onConfirm={(amount) => {
          if (!pendingOpenPrice) return;
          if (amount <= 0) {
            toast.error(t('webPosEnterPrice'));
            return;
          }
          addConfiguredProduct(pendingOpenPrice, amount, [], []);
          setPendingOpenPrice(null);
        }}
      />

      <WebPosCustomAmountModal
        open={customAmountOpen}
        onClose={() => setCustomAmountOpen(false)}
        onConfirm={addCustomAmountLine}
      />

      <WebPosWeightModal
        open={!!pendingWeighed}
        productName={pendingWeighed?.name || ''}
        pricePerKg={Number(pendingWeighed?.price) || 0}
        weightUnit={pendingWeighed?.weightUnit}
        configuredPort={printSettings?.scaleComPort}
        onClose={() => setPendingWeighed(null)}
        onConfirm={(weightKg) => {
          if (!pendingWeighed) return;
          if (weightKg <= 0) {
            toast.error(t('webPosEnterWeight'));
            return;
          }
          void ensureShift(() => pushWeighedProduct(pendingWeighed, weightKg));
          setPendingWeighed(null);
        }}
      />

      <WebPosTipKeypad
        open={billDiscountOpen}
        title={t('webPosBillDiscount')}
        baseAmount={merchandiseBase(fullTotals, vatIncludedInPrice)}
        presetsPercent={(checkoutSettings.discountPresets || [])
          .map((p) => p.percent)
          .filter((p) => p > 0)}
        allowPercent
        allowCustom
        initial={
          billDiscount.percent > 0
            ? billDiscount.percent
            : billDiscount.amount > 0
              ? billDiscount.amount
              : 0
        }
        onClose={() => setBillDiscountOpen(false)}
        onConfirm={(amount, meta) => {
          if (!canApplyDiscounts) {
            setBillDiscountOpen(false);
            return;
          }
          if (meta?.mode === 'percent') {
            setBillDiscount({ percent: Math.max(0, meta.value), amount: 0 });
          } else {
            setBillDiscount({ percent: 0, amount: Math.max(0, amount) });
          }
          setBillDiscountOpen(false);
          if (amount > 0 || (meta?.value || 0) > 0) {
            toast.success(t('webPosBillDiscountApplied'));
          }
        }}
      />

      <WebPosPinModal
        open={pinModalOpen && !pinGateRequired}
        mode={pinModalMode}
        onClose={() => setPinModalOpen(false)}
        onSuccess={onStaffPinSuccess}
      />

      <WebPosPaymentModal
        open={paymentModalOpen}
        phase={paymentPhase}
        amountLabel={money(checkoutExtras?.total ?? totals.total)}
        message={paymentMessage}
        onCancel={() => {
          paymentAbortRef.current?.abort();
          setPaymentPhase('cancelled');
          setPaymentMessage(t('webPosPayCancelled'));
        }}
        onRetry={() => {
          closePaymentModal();
          void runTerminalPayment();
        }}
        onClose={closePaymentModal}
      />

      <WebPosNewOrderAlertModal
        order={currentNewOrderAlert}
        queueCount={newOrderAlertQueue.length}
        busy={alertActionBusy}
        onAccept={acceptFromNewOrderAlert}
        onReject={rejectFromNewOrderAlert}
      />

      <WebPosRejectOrderModal
        open={!!alertRejectOrder}
        orderLabel={
          alertRejectOrder
            ? alertRejectOrder.orderNumber || alertRejectOrder.id.slice(0, 8)
            : undefined
        }
        busy={alertActionBusy}
        onClose={() => setAlertRejectOrder(null)}
        onConfirm={confirmRejectFromAlert}
      />

      {(effectiveChannel === 'takeaway' || effectiveChannel === 'delivery') && (
        <WebPosFulfillmentModal
          open={scheduleOpen}
          channel={effectiveChannel}
          storeHours={(merchant?.storeHours || null) as StoreHours | null}
          leadMinutes={
            channel === 'delivery'
              ? Number(merchant?.deliveryEtaMinutes) || 45
              : Number(merchant?.pickupEtaMinutes) || 20
          }
          onClose={() => {
            setScheduleOpen(false);
            setPendingPayMethod(null);
          }}
          onConfirm={(when) => {
            setFulfillmentWhen(when);
            setScheduleOpen(false);
            if (channel === 'delivery' && !selectedCustomer) {
              setCustomerOpen(true);
              return;
            }
            if (pendingPayMethod) {
              const m = pendingPayMethod;
              setPendingPayMethod(null);
              // Pass `when` directly - setState is async and would otherwise print ASAP
              void runCheckout(m, when);
            }
          }}
        />
      )}

      <WebPosCancelModal
        open={!!cancelModal}
        scope={cancelModal?.scope || 'order'}
        simpleConfirm={
          cancelModal?.scope === 'order' && !cart.some((l) => l.sentToKitchen) && !orderSent
        }
        itemLabel={
          cancelModal?.scope === 'item'
            ? (() => {
                const line = cart.find((l) => l.lineId === cancelModal.lineId);
                return line ? `${line.quantity}x ${line.name}` : null;
              })()
            : null
        }
        onClose={() => setCancelModal(null)}
        onConfirm={(reason, reasonId) => void confirmCancelCart(reason, reasonId)}
      />

      <WebPosCustomerPicker
        open={customerOpen}
        onClose={() => {
          setCustomerOpen(false);
          setPendingPayMethod(null);
        }}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setCustomerOpen(false);
          if (pendingPayMethod) {
            const m = pendingPayMethod;
            setPendingPayMethod(null);
            // Default ASAP when takeaway/delivery has no time yet.
            const when =
              !fulfillmentWhen &&
              (channel === 'delivery' || channel === 'takeaway')
                ? asapFulfillment()
                : undefined;
            if (when) setFulfillmentWhen(when);
            void runCheckout(m, when);
          }
        }}
      />

      <WebPosCheckoutModal
        open={checkoutOpen}
        subtotal={activeSale.totals.subtotal}
        taxAmount={activeSale.totals.tax}
        taxRate={taxRate}
        vatIncludedInPrice={vatIncludedInPrice}
        settings={checkoutSettings}
        methods={{
          cash: paymentConfig?.methods.cash !== false,
          card: paymentConfig?.methods.card !== false,
          terminal: paymentConfig?.methods.terminal === true,
          payLater: true,
        }}
        initialMethod={checkoutSeedMethod}
        onClose={() => {
          setCheckoutOpen(false);
          setSplitQueue([]);
          setSplitIndex(0);
          splitMasterIdRef.current = null;
        }}
        onConfirm={(r) => void completeFromCheckout(r)}
        onSplit={
          checkoutSettings.splitBillsEnabled && !splitQueue.length
            ? () => {
                setCheckoutOpen(false);
                setSplitOpen(true);
              }
            : undefined
        }
      />

      <WebPosSplitBillModal
        open={splitOpen}
        lines={cart.map((l) => ({
          id: l.lineId,
          name: l.name,
          quantity: l.quantity,
          lineTotal: l.lineTotal,
        }))}
        total={totals.total}
        maxParts={checkoutSettings.maxSplitParts}
        onClose={() => setSplitOpen(false)}
        onConfirm={(parts) => {
          setSplitOpen(false);
          splitMasterIdRef.current = crypto.randomUUID();
          splitReceiptsRef.current = [];
          setLastSplitReceipts([]);
          setSplitQueue(parts);
          setSplitIndex(0);
          setCheckoutSeedMethod('cash');
          setPosView('checkout');
        }}
      />

      <WebPosGiftCardModal
        open={giftCardOpsOpen}
        mode="ops"
        settings={paymentConfig?.giftCardSettings || null}
        onClose={() => setGiftCardOpsOpen(false)}
        onAddToCart={addGiftCardLine}
        onAttachCustomer={(c) => {
          setSelectedCustomer({
            id: c.id,
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || null,
            phone: c.phone || null,
          } as WebPosCustomer);
        }}
      />
      <WebPosMembershipSellModal
        open={membershipSellOpen}
        plans={(paymentConfig?.giftCardSettings as { membershipPlans?: MembershipPlan[] } | null)?.membershipPlans || []}
        onClose={() => setMembershipSellOpen(false)}
        onSold={(m) => attachMembershipCard(m)}
      />
      <WebPosGiftCardModal
        open={giftCardPayOpen}
        mode="pay"
        settings={paymentConfig?.giftCardSettings || null}
        amountDue={giftCardPayDue}
        onClose={() => setGiftCardPayOpen(false)}
        onAddToCart={() => undefined}
        onPayConfirm={(result: GiftCardPayResult) => {
          setGiftPayInject({
            id: `gc-pay-${Date.now()}`,
            method: 'gift_card',
            amount: result.amount,
            giftCardId: result.cardId,
            giftCardNumber: result.cardNumber,
            giftCardRemainingBalance: result.balanceAfter,
          });
        }}
        onAttachCustomer={(c) => {
          setSelectedCustomer({
            id: c.id,
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || null,
            phone: c.phone || null,
          } as WebPosCustomer);
        }}
      />

      <WebPosStartShiftModal
        open={startShiftOpen}
        busy={shiftBusy}
        onCancel={() => {
          setStartShiftOpen(false);
          pendingAfterShift.current = null;
        }}
        onConfirm={(cash) => void handleStartShift(cash)}
      />
      <WebPosCloseShiftModal
        open={closeShiftOpen}
        busy={shiftBusy}
        openingCash={openShift?.openingCash ?? 0}
        live={shiftLive}
        onCancel={() => setCloseShiftOpen(false)}
        onConfirm={(cash) => void handleCloseShift(cash)}
      />
      <WebPosCashMovementModal
        open={cashMovementOpen}
        shiftId={openShift?.id ?? null}
        staffId={webposStaff?.id}
        staffName={webposStaff?.name}
        onClose={() => setCashMovementOpen(false)}
        onSuccess={(live) => {
          setShiftLive((prev) => ({ ...(prev || {}), ...live } as NonNullable<typeof shiftLive>));
          toast.success(t('webPosCashMovementSuccess'));
        }}
      />
      {eodPickerOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{t('webPosEodReport')}</h3>
            <p className="mt-1 text-sm text-slate-600">Choose company-wide or an individual waiter.</p>
            <EodIncludeProductsCheckbox
              className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              checked={eodIncludeProductsSold}
              onChange={setEodIncludeProductsSold}
            />
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-left font-semibold hover:bg-slate-50"
                onClick={() => {
                  setEodPickerOpen(false);
                  void printTodayEod(undefined, undefined, {
                    includeProductsSold: eodIncludeProductsSold,
                  });
                }}
              >
                Company-wide
              </button>
              {panelStaff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    setEodPickerOpen(false);
                    void printTodayEod(s.id, s.name, {
                      includeProductsSold: eodIncludeProductsSold,
                    });
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              onClick={() => setEodPickerOpen(false)}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
      <WebPosShiftClosedModal
        open={shiftClosedOpen}
        balanced={shiftBalanced}
        showEodPrint={canPrintDayEod}
        onPrintShift={(opts) => void printShiftReport(opts)}
        onPrintEod={(opts) => void printDayEodFromShiftClose(opts)}
        onRestart={handleRestartShift}
        onStay={() => setShiftClosedOpen(false)}
        onLogout={handleStaffLogoutFromShiftClosed}
      />
    </div>
  );
}
