import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RefreshCw, Truck } from 'lucide-react';
import api from '@/lib/api';
import { repairCatalogText } from '@/lib/text-encoding';
import { useI18n, type Locale } from '@/lib/i18n';
import { formatCheckoutOrderRef, guestOrderNumber, resolveOdsPushNumber } from '@/lib/order-number';
import { paymentMethodLabel } from '@/lib/payment-breakdown';
import { roundMoney2, roundWeightKg, roundTo005, roundingAdjustment, computeMerchandiseTotals, scaleLinesByFactor, extractVatFromGross, resolvePosTaxRate } from '@/lib/money';
import { APP_NAME } from '@/lib/brand';
import {
  buildKitchenPrintJobs,
  buildKitchenCrossStationFooters,
  kitchenJobsExcludingReceiptPrinters,
  resolveKitchenPrintJobs,
  buildKitchenTicketItemFromLine,
  generateKitchenTicketEscPos,
  generateKitchenTicketText,
  generateKitchenMessageTicketEscPos,
  generateKitchenMessageTicketText,
  resolveKitchenPaperWidthMm,
  generateWebPosReceiptText,
  generateRefundReceiptText,
  generateGiftCardSaleReceiptText,
  giftCardSaleReceiptEscPos,
  computeGiftCardSaleVat,
  logoUrlToEscPos,
  resolveReceiptLogoWidthPx,
  encodeOrderMetaNotes,
  parseOrderMetaNotes,
  nextWebPosTicketNumber,
  nextDineInCounterNumber,
  webPosBackendOrderId,
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
import { normalizeBusinessModule } from '@/lib/business-module';
import { showPosScaleFeature } from '@/lib/edition-features';
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
import { removePaidSplitLines } from '@/lib/split-bill';
import { localDateTimeToIso, type StoreHours } from '@/lib/shop-hours';
import {
  browserPrintText,
  formatScalePortLabel,
  getPrintAgentHealth,
  isConfiguredPrinterMissing,
  isPrintAgentVersionOutdated,
  isPrinterDisconnectedError,
  isUnsuitableRawPrinter,
  listAgentPrinters,
  pairPrintAgentCloudRelay,
  printViaAgent,
  reconcilePosPrinterProfiles,
  reconcileAndPrunePosPrinterProfiles,
  resolveAgentPrinterName,
  suggestPrinterAutoHeal,
  unsuitableRawPrinterMessage,
  type AgentPrinter,
} from '@/lib/print-agent';
import {
  isLocalPrintStation,
  printKitchenViaAgentOrQueue,
  printViaAgentOrQueue,
  processPendingEscPosPrintJobs,
  resolvePrintRetryLocally,
  shouldAutoPrintKitchen,
  shouldAutoPrintReceipt,
  cacheMerchantAutoPrintSettings,
} from '@/lib/webpos-print-relay';
import {
  applyKitchenPrintRetryFromSettings,
  hasKitchenRetryPending,
  removePrintJobs,
  reprintPrintJobs,
  startPrintQueueAutoRetry,
  subscribePrintJobExhausted,
  usePendingPrintJobs,
} from '@/lib/webpos-print-queue';
import {
  POS_SESSION_KICKED_EVENT,
  registerPosSession,
  clearPosSessionLocal,
  revokePosSession,
  fetchActivePosSessions,
  setPosSessionHeartbeatExtras,
} from '@/lib/pos-session';
import { buildReceiptUrl, resolvePublishedReceiptRef, normalizeScannedPayload, parseTableQrPayload } from '@/lib/qr';
import WebPosMembershipSellModal from '@/components/webpos/WebPosMembershipSellModal';
import { membershipDiscountPercent } from '@/lib/membership-plans';
import type { MembershipPlan } from '@/lib/membership-plans';
import {
  lineSignature,
  type ShopComboSelection,
  type ShopSelectedExtra,
} from '@/lib/shop-cart';
import { isVisibleOnChannel, productVisibleOnChannel } from '@/lib/catalog-visibility';
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
import WebPosBlockingAlert from '@/components/WebPosBlockingAlert';
import { pushCartLinesToKds, fetchKdsBoardStatus, matchBoardTickets, collectReadyLineIds, applyKdsReadyToCart, buildKdsReadyMap, collectKdsTicketKeys, dismissKdsTicket } from '@/lib/kds-push';
import { kitchenTicketKeyBase } from '@/lib/kitchen-progress';
import { playKitchenCompleteOnce } from '@/lib/order-alert';
import { pushOrderToOds, dismissOrderFromOds } from '@/lib/ods-push';
import WebPosOrdersPanel from '@/components/WebPosOrdersPanel';
import WebPosTipKeypad from '@/components/WebPosTipKeypad';
import WebPosWeightModal from '@/components/webpos/WebPosWeightModal';
import WebPosCustomAmountModal from '@/components/webpos/WebPosCustomAmountModal';
import WebPosOnlineOrdersPanel, {
  type OnlineOrder,
} from '@/components/WebPosOnlineOrdersPanel';
import WebPosNewOrderAlertModal from '@/components/webpos/WebPosNewOrderAlertModal';
import WebPosNotificationsPanel, {
  type WebPosReservationAlert,
} from '@/components/webpos/WebPosNotificationsPanel';
import WebPosRejectOrderModal from '@/components/webpos/WebPosRejectOrderModal';
import WebPosTopBar, {
  WebPosSettingsDropdown,
  WEBPOS_COLOR_THEMES,
  WEBPOS_TEXT_SIZES,
  enterWebPosFullscreenOnLoad,
  type WebPosColorTheme,
  type WebPosTextSize,
} from '@/components/webpos/WebPosTopBar';
import WebPosLogsModal from '@/components/webpos/WebPosLogsModal';
import WebPosOnboardingTour, { readWebPosOnboardingDone } from '@/components/webpos/WebPosOnboardingTour';
import {
  initWebPosLogging,
  sendWebPosLogsToSupport,
} from '@/lib/webpos-log';

const WEBPOS_TEXT_SIZE_KEY = 'webpos_text_size';
const WEBPOS_APPEARANCE_KEY = 'webpos_appearance';
const WEBPOS_GRID_SHOW_IMAGES_KEY = 'webpos.grid.showImages';
const WEBPOS_GRID_TILE_SIZE_KEY = 'webpos.grid.tileSize';
const WEBPOS_GRID_MOBILE_COLS_KEY = 'webpos.grid.mobileCols';
/** Mobile grid step: 0 = 2× categories + 2× products, 1 = 3× cat + 2× prod, 2 = 3× both */
type MobileGridLayoutStep = 0 | 1 | 2;
const WEBPOS_GRID_SORT_KEY = 'webpos.grid.sort';
const WEBPOS_SET_PIN_HINT_KEY = 'webpos_set_pin_hint_dismissed';
const WEBPOS_TERMINAL_KEY = 'manupos_webpos_terminal';

function terminalStorageKey(staffId?: string | null) {
  return staffId ? `${WEBPOS_TERMINAL_KEY}_${staffId}` : WEBPOS_TERMINAL_KEY;
}

function readStoredTerminalId(staffId?: string | null): string {
  try {
    return localStorage.getItem(terminalStorageKey(staffId)) || '';
  } catch {
    return '';
  }
}

function persistTerminalId(terminalId: string, staffId?: string | null) {
  try {
    const key = terminalStorageKey(staffId);
    if (terminalId.trim()) localStorage.setItem(key, terminalId.trim());
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function resolveActiveTerminalId(
  terminals: WebPosTerminal[] | undefined,
  opts: { preferred?: string | null; defaultId?: string | null; stored?: string | null }
): string {
  const active = (terminals || []).filter((t) => t.status === 'active');
  const valid = new Set(active.map((t) => t.terminalId));
  for (const candidate of [opts.preferred, opts.stored, opts.defaultId]) {
    const id = (candidate || '').trim();
    if (id && valid.has(id)) return id;
  }
  return active[0]?.terminalId || '';
}

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

function readStoredMobileGridLayout(): MobileGridLayoutStep {
  try {
    const v = localStorage.getItem(WEBPOS_GRID_MOBILE_COLS_KEY);
    if (v === '0' || v === '1' || v === '2') return Number(v) as MobileGridLayoutStep;
    // Migrate legacy single column count (2 | 3 toggled together).
    if (v === '3') return 2;
    if (v === '2') return 0;
  } catch {
    /* ignore */
  }
  return 0;
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
import { printMerchantOrderReceipt } from '@/lib/print-order-receipt';
import WebPosCartPanel from '@/components/webpos/WebPosCartPanel';
import WebPosProductArea, {
  type ProductGridSort,
  type ProductGridTileSize,
} from '@/components/webpos/WebPosProductArea';
import WebPosCheckoutView from '@/components/webpos/WebPosCheckoutView';
import WebPosSuccessView from '@/components/webpos/WebPosSuccessView';
import WebPosSendReceiptModal from '@/components/webpos/WebPosSendReceiptModal';
import WebPosPrintChooserModal from '@/components/webpos/WebPosPrintChooserModal';
import WebPosKitchenPrintIssuesModal from '@/components/webpos/WebPosKitchenPrintIssuesModal';
import WebPosReprintModal from '@/components/webpos/WebPosReprintModal';
import {
  shortPrintErrorMessage,
  toastPrintError as toastPrintErrorRaw,
} from '@/lib/webpos-print-toast';
import WebPosTablesView from '@/components/webpos/WebPosTablesView';
import WebPosBookingsView from '@/components/webpos/WebPosBookingsView';
import WebPosDeliveryHub from '@/components/webpos/WebPosDeliveryHub';
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
  normalizeLoyaltyProgram,
  normalizeRfidUid,
  redeemThresholdPoints,
  type AttachedGiftCard,
  type AttachedMembership,
} from '@/lib/loyalty-math';
import type { AppliedPayment } from '@/components/webpos/WebPosCheckoutView';
import {
  collectPaymentAction,
  customerFromOrder,
  orderItemsToCartLines,
  orderMatchesCartLink,
  resolveCartCheckoutGuard,
  type CartOrderLink,
} from '@/lib/order-to-cart';
import {
  buildHeldTableInfoMap,
  findHeldOrderForTable,
  heldCartSignature,
  heldRowTimeMs,
  parseHeldCartJson,
  releaseHeldOrder,
  remoteHeldShouldReplaceLocal,
  type HeldOrderRow,
} from '@/lib/webpos-held';
import type { TableHeldDisplay } from '@/components/webpos/WebPosTablesView';
import {
  INVOICE_SETTLEMENT_METHOD,
  isAwaitingApproval,
  isInvoiceOrder,
  isOnlineShopOrder,
  isPaidOrder,
  isTerminalOrderStatus,
  orderPublicRefs,
  posSaleFulfillmentStatus,
  type MerchantOrder,
} from '@/lib/order-management';
import { readDeliveryAutoAccept, onlineOrderAlertStatuses } from '@/lib/delivery-auto-accept';
import { INCOMING_ONLINE_ORDER_STATUSES_PARAM } from '@/lib/incoming-orders';
import { isPayLaterPaymentMethod, payLaterCollectedTender } from '@/lib/receipt-labels';
import {
  posSaleToNotificationOrder,
  subscribeWebPosOrderCompleted,
  subscribeWebPosReservationCreated,
} from '@/lib/webpos-notifications';

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
  isInvoice?: boolean;
  isPayLater?: boolean;
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
  playWaiterTillBellOnce,
  playReservationTillBellOnce,
  startOrderAlertLoop,
  startOrderAlertForDuration,
  stopOrderAlertLoop,
} from '@/lib/order-alert';
import {
  extractZipFromAddress,
  onlineShopOrderSpeechLine,
  speakDeliveryAlert,
} from '@/lib/delivery-hub-alerts';
import { isMainTillRegister, shouldRingWaiterTillBell } from '@/lib/waiter-till-bell';
import {
  backOfficeHomePath,
  deliveryDriverHomePath,
  getEffectivePanelAccess,
  hasPermission,
  isDeliveryDriverOnlyStaff,
  isMerchantOwnerJwt,
  clearWebPosStaffSession,
  loadWebPosStaffSession,
  notifyWebPosStaffSessionChanged,
  resolveWebPosStaffSession,
  saveWebPosStaffSession,
  webPosPinGateRequired,
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
  visibility?: unknown;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: ShopModifierGroup[];
  comboSlots?: ComboSlot[];
};

type Category = { id: string; name: string; color?: string | null; visibility?: unknown };

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
  /** Kitchen ticket did not print after send. */
  kitchenPrintFailed?: boolean;
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

type PosPaymentMethod = 'cash' | 'card' | 'terminal' | 'pay_later' | 'gift_card' | 'invoice';

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
    invoice?: boolean;
  };
  terminalReady: boolean;
  adyenConfigured: boolean;
  defaultTerminalId: string | null;
  staffPreferredTerminalId?: string | null;
  terminals: WebPosTerminal[];
  posPrintSettings?: PosPrintSettingsClient | null;
  posCheckoutSettings?: PosCheckoutSettings | null;
  giftCardSettings?: GiftCardSettingsClient | null;
  loyalty?: {
    enabled?: boolean;
    earnPointsPerChf?: number;
    redeemPointsPerChf?: number;
  } | null;
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

function normalizeCartLines(lines: CartLine[] | null | undefined): CartLine[] {
  return (lines || []).map((line) => ({
    ...line,
    taxable: line.taxable !== false,
    lineTotal: Number(line.lineTotal) || 0,
    unitPrice: Number(line.unitPrice) || 0,
    quantity: Number(line.quantity) || 0,
  }));
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
  // Fixed amounts: keep the larger single discount (do not sum — avoids 48+10 on a CHF 10 cart).
  return { percent: 0, amount: roundMoney2(Math.max(src.amount, tgt.amount)) };
}

export default function WebPos({ appMode = true }: { appMode?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const lastPrintErrorRef = useRef<{ key: string; at: number } | null>(null);
  const lastQueuedToastAtRef = useRef(0);
  const toastPrintQueuedMainTill = () => {
    const now = Date.now();
    if (now - lastQueuedToastAtRef.current < 4000) return;
    lastQueuedToastAtRef.current = now;
    toast.success(t('webPosPrintQueuedMainTill'));
  };
  const notifyPrintError = (raw: unknown, fallbackKey = 'webPosPrintFailed') => {
    if (isPrinterDisconnectedError(raw)) setPrinterDisconnected(true);
    const short = shortPrintErrorMessage(raw, t, fallbackKey);
    const now = Date.now();
    if (
      lastPrintErrorRef.current?.key === short &&
      now - lastPrintErrorRef.current.at < 4000
    ) {
      return;
    }
    lastPrintErrorRef.current = { key: short, at: now };
    toastPrintErrorRaw(raw, t, fallbackKey);
  };
  const notifyPrintErrorRef = useRef(notifyPrintError);
  notifyPrintErrorRef.current = notifyPrintError;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deliveryHubOpen, setDeliveryHubOpen] = useState(false);
  const [deliveryHubMinimized, setDeliveryHubMinimized] = useState(false);

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  useEffect(() => {
    if (searchParams.get('delivery') === '1') {
      setDeliveryHubOpen(true);
      setDeliveryHubMinimized(false);
      const next = new URLSearchParams(searchParams);
      next.delete('delivery');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const authUser = useAuthStore((s) => s.user);
  const jwtIsOwner = isMerchantOwnerJwt(authUser);
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
  const [cart, setCart] = useState<CartLine[]>(() => normalizeCartLines(bootActive?.cart));
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
  const [courseCount, setCourseCount] = useState(() => {
    let max = bootActive?.activeCourse || 1;
    if (bootActive?.courseCount && bootActive.courseCount > max) {
      max = bootActive.courseCount;
    }
    for (const line of bootActive?.cart || []) {
      const n = Number(line.courseNumber) || 0;
      if (n > max) max = n;
    }
    return max;
  });
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
  const [gridMobileLayout, setGridMobileLayout] = useState<MobileGridLayoutStep>(() =>
    readStoredMobileGridLayout()
  );
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
    cashRefunds?: number;
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
    cashIn?: number;
    cashOut?: number;
    cashRefunds?: number;
    movements?: Array<{
      type: string;
      amount: number;
      reason?: string | null;
      staffName?: string | null;
      createdAt?: string | null;
    }>;
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
  const [manualTableOpen, setManualTableOpen] = useState(false);
  const [newOrderConfirmOpen, setNewOrderConfirmOpen] = useState(false);
  const resumedHeldIdRef = useRef<string | null>(null);
  const lastSeenHeldUpdatedAtRef = useRef(0);
  const lastLocalCartMutationRef = useRef(0);
  const applyingRemoteHeldRef = useRef(false);
  /** Last kitchen shout printed for this cart — hurry/follow-up must reuse it. */
  const lastKitchenTicketRef = useRef<string | null>(bootActive?.ticketDisplay ?? null);
  const [successInfo, setSuccessInfo] = useState<{
    amount: number;
    changeDue: number | null;
    orderNumber?: string | null;
    paymentMethod?: string | null;
  } | null>(null);
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
  const [agentOutdated, setAgentOutdated] = useState(false);
  const isLocalPrint = isLocalPrintStation(agentOk);
  const [mainTillOnline, setMainTillOnline] = useState(false);
  const [mainTillPrintAgentOnline, setMainTillPrintAgentOnline] = useState(false);
  const printRetryLocally = resolvePrintRetryLocally(agentOk);
  const [printerDisconnected, setPrinterDisconnected] = useState(false);
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
  const [printersReady, setPrintersReady] = useState(false);
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('manupos_webpos_printer') || '');
  const printerHealAttemptedRef = useRef<Set<string>>(new Set());
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
  const [kitchenPrintIssuesOpen, setKitchenPrintIssuesOpen] = useState(false);
  const [kitchenPrintRetryBusy, setKitchenPrintRetryBusy] = useState(false);
  const [reprintModal, setReprintModal] = useState<{
    lineIds: string[];
    lineLabel?: string | null;
  } | null>(null);
  const [reprintBusy, setReprintBusy] = useState(false);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const [tablesRefreshToken, setTablesRefreshToken] = useState(0);
  const [heldTableIds, setHeldTableIds] = useState<string[]>([]);
  const [heldTableInfo, setHeldTableInfo] = useState<Record<string, TableHeldDisplay>>({});
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  const [ordersChannelPref, setOrdersChannelPref] = useState<'online' | null>(null);
  const [collectOrderRef, setCollectOrderRef] = useState<CollectOrderRef | null>(null);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const knownOnlineIdsRef = useRef<Set<string> | null>(null);
  const unactionedOrderIdsRef = useRef<Set<string>>(new Set());
  const [unactionedOrderCount, setUnactionedOrderCount] = useState(0);
  const [newOrderAlertQueue, setNewOrderAlertQueue] = useState<OnlineOrder[]>([]);
  const [deliveryAutoAccept, setDeliveryAutoAccept] = useState(false);
  const [deliverySettingsReady, setDeliverySettingsReady] = useState(false);
  const deliveryAutoAcceptRef = useRef(deliveryAutoAccept);
  const [alertRejectOrder, setAlertRejectOrder] = useState<OnlineOrder | null>(null);
  const [alertActionBusy, setAlertActionBusy] = useState(false);
  const knownReservationIdsRef = useRef<Set<string> | null>(null);
  /** Held orders seen by remote-order bell poll (seeded on first tick). */
  const knownRemoteHeldRef = useRef<Set<string> | null>(null);
  /** Suppress till bell for held rows this till just saved (avoid self-ring). */
  const localHeldBellSuppressRef = useRef<Map<string, number>>(new Map());
  const onlinePanelOpenRef = useRef(false);
  const [reservationPendingCount, setReservationPendingCount] = useState(0);
  const unactionedReservationIdsRef = useRef<Set<string>>(new Set());
  const [unactionedReservationCount, setUnactionedReservationCount] = useState(0);
  const [reservationAlertById, setReservationAlertById] = useState<
    Record<string, WebPosReservationAlert>
  >({});
  const localPosOrderIdsRef = useRef<Set<string>>(new Set());
  const [localPosOrderAlerts, setLocalPosOrderAlerts] = useState<OnlineOrder[]>([]);
  const [localPosOrderCount, setLocalPosOrderCount] = useState(0);
  const [reservationAlertUntil, setReservationAlertUntil] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
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
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsAutoSend, setLogsAutoSend] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
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
  const [attachedGiftCard, setAttachedGiftCard] = useState<AttachedGiftCard | null>(null);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [payWithPoints, setPayWithPoints] = useState(false);
  const lastGiftInjectRef = useRef<string | null>(null);
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
  const [channelsSaving, setChannelsSaving] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(() => {
    const hasItems = (bootActive?.cart?.length || 0) > 0 || !!bootActive?.orderSent;
    return !!(bootCart?.mobileCartOpen && hasItems);
  });
  /** true below Tailwind lg (1024px) — drives Odoo mobile register (not CSS-only). */
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(min-width: 1024px)').matches;
  });
  /** Phone-width: force compact tiles so the Windows till scale is not used. */
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(min-width: 640px)').matches;
  });
  const [recentOpen, setRecentOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'gate' | 'switch'>('gate');
  const [posAuthAlert, setPosAuthAlert] = useState<{
    title?: string;
    message: string;
    variant?: 'error' | 'warning';
  } | null>(null);
  const [webposStaff, setWebposStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [staffConfigured, setStaffConfigured] = useState(false);
  const [staffPinsKnown, setStaffPinsKnown] = useState(false);
  const [setPinHintDismissed, setSetPinHintDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(WEBPOS_SET_PIN_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
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
  const draftOccupiesTable = (draft: OpenCartDraft) =>
    draft.cart.length > 0 || draft.cart.some((l) => l.sentToKitchen);
  const draftTableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [key, draft] of openCartDraftsRef.current.entries()) {
      if (!key.startsWith('table:')) continue;
      if (draftOccupiesTable(draft)) ids.add(key.slice(6));
    }
    for (const id of heldTableIds) ids.add(id);
    return [...ids];
  }, [draftVersion, heldTableIds]);

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.quantity, 0), [cart]);

  useEffect(() => {
    let cancelled = false;
    const refreshHeldTables = async () => {
      try {
        const res = await api.get('/merchant/pos/held');
        const rows = (res.data?.held || []) as Array<{
          cartJson?: Record<string, unknown> | null;
          staffName?: string | null;
          updatedAt?: string | null;
          createdAt?: string | null;
        }>;
        if (cancelled) return;
        const ids = new Set<string>();
        for (const h of rows) {
          const tid = parseHeldCartJson(h.cartJson).tableId;
          if (typeof tid === 'string' && tid) ids.add(tid);
        }
        setHeldTableIds([...ids]);
        const infoMap = buildHeldTableInfoMap(rows);
        const display: Record<string, TableHeldDisplay> = {};
        for (const [tid, info] of Object.entries(infoMap)) {
          display[tid] = { staffName: info.staffName, itemCount: info.itemCount };
        }
        setHeldTableInfo(display);
      } catch {
        if (!cancelled) {
          setHeldTableIds([]);
          setHeldTableInfo({});
        }
      }
    };
    void refreshHeldTables();
    if (posView !== 'tables') {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(() => void refreshHeldTables(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ordersRefreshToken, tablesRefreshToken, draftVersion, posView]);

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    const weighedIds = new Set<string>();
    for (const l of cart) {
      if (l.isWeighed) weighedIds.add(l.productId);
      map.set(l.productId, (map.get(l.productId) || 0) + l.quantity);
    }
    for (const productId of weighedIds) {
      const total = map.get(productId);
      if (total != null) map.set(productId, roundWeightKg(total));
    }
    return map;
  }, [cart]);

  /** Table or tab assigned → footer shows Send (not Set table / Set tab). */
  const hideTab = !!tableLabel || !!tabNumber;
  // Waiter / staff phone: USE_WEBPOS PIN gate works on mobile Safari; kitchen + receipt
  // print still goes through the print agent / main till printers (not the phone).
  const pinGateRequired = webPosPinGateRequired({
    hasStaffPins: staffConfigured,
    pinSession: webposStaff,
    offlineUnlocked: isWebPosCurrentlyOffline() && loadedFromOfflineCache,
  });
  /** Owner on the till without a clock-in keeps owner/manager perms. */
  const ownerOnRegister = jwtIsOwner && !webposStaff;

  const applyStaffRoster = useCallback(
    (staffList: StaffRosterRow[], opts?: { openPinGate?: boolean }) => {
      const hasPins = staffList.some(
        (s) => !!(s as { pinSet?: boolean }).pinSet && s.isActive !== false
      );
      setStaffConfigured(hasPins);
      setStaffPinsKnown(true);
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
        notifyWebPosStaffSessionChanged();
      }
      const shouldOpenPinGate =
        opts?.openPinGate !== false &&
        hasPins &&
        !session &&
        authUser?.role !== 'staff';
      if (shouldOpenPinGate) {
        setPinModalMode('gate');
        setPinModalOpen(true);
      }
    },
    [authUser?.staffId, authUser?.role, authUser?.permissions, authUser?.isOwner]
  );

  useEffect(() => {
    if (!webposStaff) return;
    if (isDeliveryDriverOnlyStaff(webposStaff.permissions, false)) {
      navigate(deliveryDriverHomePath(), { replace: true });
    }
  }, [webposStaff, navigate]);

  useEffect(() => {
    if (!staffPinsKnown) return;
    if (pinGateRequired) {
      clearPosSessionLocal();
      return;
    }
    void registerPosSession({
      sessionKind: 'main',
      platform: 'webpos',
      staffId: webposStaff?.id || null,
      staffName: webposStaff?.name || null,
    }).then((result) => {
      if (result.ok && result.kickedSessionIds.length > 0) {
        toast.info(t('webPosSessionReclaimed'));
      }
    });
  }, [staffPinsKnown, pinGateRequired, webposStaff?.id, webposStaff?.name, t]);

  useEffect(() => {
    const onKicked = () => {
      clearPosSessionLocal();
      clearWebPosStaffSession();
      setWebposStaff(null);
      setPosAuthAlert({
        title: t('webPosSessionKickedTitle'),
        message: t('webPosSessionKickedReclaim'),
        variant: 'warning',
      });
      if (staffConfigured) {
        setPinModalMode('gate');
        setPinModalOpen(true);
      } else if (staffPinsKnown) {
        void registerPosSession({
          sessionKind: 'main',
          platform: 'webpos',
        });
      }
    };
    window.addEventListener(POS_SESSION_KICKED_EVENT, onKicked);
    return () => window.removeEventListener(POS_SESSION_KICKED_EVENT, onKicked);
  }, [staffConfigured, staffPinsKnown, t]);

  useEffect(() => {
    if (!staffRoster.length) return;
    applyStaffRoster(staffRoster, { openPinGate: false });
  }, [staffRoster, applyStaffRoster]);

  const refreshStaffRosterFromServer = useCallback(async () => {
    try {
      const staffRes = await api.get('/merchant/staff');
      const staffList = (staffRes.data.staff || []) as StaffRosterRow[];
      setStaffRoster(staffList);
      applyStaffRoster(staffList, { openPinGate: true });
    } catch {
      /* ignore */
    }
  }, [applyStaffRoster]);

  useEffect(() => {
    const onRosterChanged = () => void refreshStaffRosterFromServer();
    window.addEventListener('webpos:staff-roster-changed', onRosterChanged);
    return () => window.removeEventListener('webpos:staff-roster-changed', onRosterChanged);
  }, [refreshStaffRosterFromServer]);

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
      courseCount,
      orderSent,
      coursesBulkSent,
      selectedLineId,
      keypadBuffer,
      billDiscount,
    };
    const key = openCartDraftKey({ tableId, tabNumber, channel, ticketDisplay });
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
    courseCount,
    orderSent,
    coursesBulkSent,
    selectedLineId,
    keypadBuffer,
    billDiscount,
    mobileCartOpen,
    selectedCustomer,
  ]);

  /** Narrow screens scale rem UI via html font-size (zoom is disabled on phones). */
  useEffect(() => {
    document.documentElement.setAttribute('data-webpos-text-size', posTextSize);
    return () => {
      document.documentElement.removeAttribute('data-webpos-text-size');
    };
  }, [posTextSize]);

  /** Main till reports Print Agent status for mobile/waiter devices. */
  useEffect(() => {
    if (!isLocalPrint) {
      setPosSessionHeartbeatExtras({});
      return;
    }
    setPosSessionHeartbeatExtras({ printAgentOnline: agentOk });
  }, [isLocalPrint, agentOk]);

  /** Phones/tablets: show main till print hub status instead of local agent. */
  useEffect(() => {
    if (isLocalPrint || pinGateRequired) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { sessions } = await fetchActivePosSessions();
        const main = sessions.main || [];
        if (cancelled) return;
        setMainTillOnline(main.length > 0);
        setMainTillPrintAgentOnline(main.some((s) => s.printAgentOnline === true));
      } catch {
        if (!cancelled) {
          setMainTillOnline(false);
          setMainTillPrintAgentOnline(false);
        }
      }
    };
    void poll();
    const id = window.setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLocalPrint, pinGateRequired]);

  /** Mobile cart page is phone-only; restore side-cart layout from lg (1024px) up. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mqLg = window.matchMedia('(min-width: 1024px)');
    const mqSm = window.matchMedia('(min-width: 640px)');
    const sync = () => {
      const lgUp = mqLg.matches;
      setIsNarrowViewport(!lgUp);
      setIsPhoneViewport(!mqSm.matches);
      if (lgUp) setMobileCartOpen(false);
    };
    sync();
    mqLg.addEventListener('change', sync);
    mqSm.addEventListener('change', sync);
    return () => {
      mqLg.removeEventListener('change', sync);
      mqSm.removeEventListener('change', sync);
    };
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
    const access = getEffectivePanelAccess({
      jwtPermissions: authUser?.permissions as Permission[] | undefined,
      isOwner: jwtIsOwner,
      authRole: authUser?.role,
      hasStaffPins: staffConfigured,
      pinSession: webposStaff,
      pathname: '/merchant/pos',
    });
    if (!access.canOpenBackOffice) {
      toast.error(t('webPosPanelDenied'));
      return;
    }
    if (access.canOpenPanel) {
      window.dispatchEvent(new CustomEvent('webpos:show-panel'));
      navigate('/merchant');
      return;
    }
    navigate(backOfficeHomePath(access.permissions, false));
  }, [jwtIsOwner, authUser?.permissions, staffConfigured, webposStaff, t, navigate]);

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

  const merchantTax = useMemo(
    () =>
      merchant
        ? {
            vatRate: merchant.vatRate,
            taxTakeawayRate: merchant.taxTakeawayRate,
            taxDineInRate: merchant.taxDineInRate,
            taxDeliveryRate: merchant.taxDeliveryRate,
          }
        : undefined,
    [merchant]
  );

  /** Menu prices include VAT (gross); prices are not tax-exclusive. */
  const vatIncludedInPrice = merchant?.taxIncludedInPrice === true;
  /** Tax-exclusive: VAT on discounted net (default) vs pre-discount net. */
  const vatAfterDiscount = merchant?.vatAfterDiscount !== false;

  const checkoutSettings = useMemo(
    () => normalizePosCheckoutSettings(paymentConfig?.posCheckoutSettings),
    [paymentConfig?.posCheckoutSettings]
  );
  const loyaltyProgram = useMemo(
    () =>
      normalizeLoyaltyProgram(
        paymentConfig?.loyalty ||
          (merchant
            ? {
                enabled: !!(merchant as { loyaltyEnabled?: boolean }).loyaltyEnabled,
                earnPointsPerChf: Number(
                  (merchant as { loyaltyEarnPointsPerChf?: string | number }).loyaltyEarnPointsPerChf
                ),
                redeemPointsPerChf: Number(
                  (merchant as { loyaltyRedeemPointsPerChf?: number }).loyaltyRedeemPointsPerChf
                ),
              }
            : null)
      ),
    [paymentConfig?.loyalty, merchant]
  );
  const loyaltyRedeemRate = loyaltyProgram.redeemPointsPerChf;
  const loyaltyEarnRate = loyaltyProgram.earnPointsPerChf;
  const loyaltyRedeemThreshold = redeemThresholdPoints(loyaltyRedeemRate);
  const editionFeatures = paymentConfig?.editionFeatures;
  const editionAllows = (key: string) =>
    editionFeatures == null || editionFeatures.includes(key);
  const scaleFeatureEnabled = showPosScaleFeature(
    editionFeatures,
    normalizeBusinessModule(merchant?.businessCategory)
  );
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
  /** Bookings tab + reservation alerts — restaurant only when module is on. */
  const reservationsPosUiEnabled = !isRetail && !!merchant?.reservationsEnabled;
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
      (channel === 'dine_in' &&
        (!!ticketDisplay || !!tableLabel || !!tabNumber || counterDineInEnabled)));
  const cartSide = checkoutSettings.cartSide === 'left' ? 'left' : 'right';
  const courseSendMode = checkoutSettings.courseSendMode || 'fire_per_course';
  const postSuccessTarget =
    !isRetail && tablesUiEnabled && checkoutSettings.postSuccessTarget === 'tables'
      ? 'tables'
      : 'register';

  const courseNumbers = useMemo(() => {
    const set = new Set<number>();
    for (const l of cart) {
      if (l.courseNumber) set.add(l.courseNumber);
    }
    if (coursesEnabled && cart.length > 0) {
      const max = Math.max(activeCourse, courseCount, ...set, 1);
      for (let n = 1; n <= max; n++) set.add(n);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [cart, activeCourse, coursesEnabled, courseCount]);

  useEffect(() => {
    if (!tablesUiEnabled && posTab === 'tables') {
      setPosTab('register');
      setPosView('register');
    }
  }, [tablesUiEnabled, posTab]);

  useEffect(() => {
    if (!reservationsPosUiEnabled && posTab === 'bookings') {
      setPosTab('register');
      setPosView('register');
    }
  }, [reservationsPosUiEnabled, posTab]);

  const showFireCourseButton =
    coursesEnabled &&
    courseSendMode === 'fire_per_course' &&
    coursesBulkSent &&
    activeCourse > 1;
  const hasUnsentItems = cart.some((l) => !l.sentToKitchen);
  const pendingPrintJobs = usePendingPrintJobs();
  const exhaustedPrintJobs = useMemo(
    () => pendingPrintJobs.filter((j) => j.exhausted),
    [pendingPrintJobs]
  );
  const failedPrintLines = useMemo(
    () => cart.filter((l) => !!l.kitchenPrintFailed && !!l.sentToKitchen),
    [cart]
  );
  const unprintedJobCount = Math.max(exhaustedPrintJobs.length, failedPrintLines.length);
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
      attachedMembership.pointsBalance < loyaltyRedeemThreshold
    ) {
      return {
        canPayWithPoints: false,
        pointsRedeemed: 0,
        pointsDiscount: 0,
      };
    }
    const payable = activeSale.totals.total;
    const maxPoints = maxRedeemablePoints(
      payable,
      attachedMembership.pointsBalance,
      loyaltyRedeemRate
    );
    const pointsRedeemed = payWithPoints ? maxPoints : 0;
    const pointsDiscount =
      pointsRedeemed > 0 ? computeCashDiscount(pointsRedeemed, loyaltyRedeemRate) : 0;
    return {
      canPayWithPoints: maxPoints > 0,
      pointsRedeemed,
      pointsDiscount,
    };
  }, [
    attachedMembership,
    activeSale.totals.total,
    payWithPoints,
    loyaltyRedeemRate,
    loyaltyRedeemThreshold,
  ]);

  useEffect(() => {
    if (posView !== 'checkout' || !attachedMembership?.membershipEnabled) return;
    const payable = activeSale.totals.total;
    const maxPts = maxRedeemablePoints(
      payable,
      attachedMembership.pointsBalance,
      loyaltyRedeemRate
    );
    setPayWithPoints(
      attachedMembership.pointsBalance >= loyaltyRedeemThreshold && maxPts > 0
    );
  }, [
    posView,
    splitIndex,
    attachedMembership?.cardId,
    activeSale.totals.total,
    loyaltyRedeemRate,
    loyaltyRedeemThreshold,
  ]);

  useEffect(() => {
    if (posView !== 'checkout') {
      lastGiftInjectRef.current = null;
      return;
    }
    if (!attachedGiftCard || attachedGiftCard.balance <= 0.001) return;
    const key = `${attachedGiftCard.cardId}:${splitIndex}`;
    if (lastGiftInjectRef.current === key) return;
    const due = roundMoney2(
      Math.max(0, activeSale.totals.total - membershipCheckout.pointsDiscount)
    );
    const amount = roundMoney2(Math.min(attachedGiftCard.balance, due));
    if (amount <= 0.001) return;
    lastGiftInjectRef.current = key;
    setGiftPayInject({
      id: `gc-pay-${attachedGiftCard.cardId}`,
      method: 'gift_card',
      amount,
      giftCardId: attachedGiftCard.cardId,
      giftCardNumber: attachedGiftCard.cardNumber,
      giftCardRemainingBalance: roundMoney2(attachedGiftCard.balance - amount),
    });
  }, [
    posView,
    attachedGiftCard,
    splitIndex,
    activeSale.totals.total,
    membershipCheckout.pointsDiscount,
  ]);

  const billDiscountLabel =
    billDiscount.percent > 0
      ? `${billDiscount.percent}%`
      : billDiscount.amount > 0
        ? money(
            resolveBillDiscountAmount(fullTotals, billDiscount, vatIncludedInPrice)
          )
        : null;

  /** Keep stored fixed discount ≤ current merchandise (e.g. after cart edits or draft merge). */
  useEffect(() => {
    if (billDiscount.amount <= 0) return;
    const merch = merchandiseBase(fullTotals, vatIncludedInPrice);
    if (billDiscount.amount > merch + 0.001) {
      setBillDiscount((d) => ({ ...d, amount: roundMoney2(Math.min(d.amount, merch)) }));
    }
  }, [fullTotals.subtotal, fullTotals.tax, billDiscount.amount, vatIncludedInPrice]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bestsellerOrder = new Map(bestsellerIds.map((id, i) => [id, i]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const filtered = products.filter((p) => {
      if (!productVisibleOnChannel(
        p,
        p.categoryId ? categoryById.get(p.categoryId) : null,
        'pos'
      )) {
        return false;
      }
      if (categoryId === POS_GIFT_CARDS_CATEGORY) {
        return false;
      } else if (categoryId !== 'all' && p.categoryId !== categoryId) return false;
      if (q) {
        const raw = search.trim();
        const barcode = String(p.barcode || '').trim();
        const sku = String(p.sku || '').trim();
        const nameHit = p.name.toLowerCase().includes(q);
        const codeHit =
          (barcode && (barcode === raw || barcode.toLowerCase() === q)) ||
          (sku && sku.toLowerCase() === q);
        if (!nameHit && !codeHit) return false;
      }
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
  }, [products, categories, categoryId, search, bestsellerIds, gridSort]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => isVisibleOnChannel(c.visibility, 'pos')),
    [categories]
  );

  const refreshAgent = useCallback(async () => {
    const health = await getPrintAgentHealth();
    setAgentOk(health.ok);
    setAgentOutdated(health.ok && isPrintAgentVersionOutdated(health.version));
    if (!health.ok) {
      setPrinters([]);
      setPrintersReady(false);
      return;
    }
    try {
      const list = await listAgentPrinters();
      setPrinters(list);
      setPrintersReady(true);
      setPrinterName((current) => {
        const trimmed = (current || '').trim();
        if (!trimmed) {
          if (!list.length) return current;
          const def =
            list.find((p) => p.isDefault && !isUnsuitableRawPrinter(p.name)) ||
            list.find((p) => !isUnsuitableRawPrinter(p.name)) ||
            list[0];
          return def?.name || current;
        }
        return resolveAgentPrinterName(trimmed, list) || '';
      });
      setPrintSettings((ps) => {
        if (!ps?.printers?.length) return ps;
        const { profiles, changed } = reconcileAndPrunePosPrinterProfiles(ps.printers, list);
        if (!changed) return ps;
        const next = { ...ps, printers: profiles };
        void api.put('/merchant/settings', { posPrintSettings: next }).catch(() => undefined);
        return next;
      });
    } catch {
      setPrinters([]);
      setPrintersReady(false);
    }
  }, []);

  const shiftsEnabledRef = useRef(shiftsEnabled);
  shiftsEnabledRef.current = shiftsEnabled;
  const shiftMigrateToastRef = useRef(false);

  type ShiftSnapshot = {
    shift: { id: string; openingCash: number; openedAt: string } | null;
    live: {
      cashSales: number;
      cashIn?: number;
      cashOut?: number;
      cashRefunds?: number;
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
        const offlineStaffId = loadWebPosStaffSession()?.id;
        const offlineTerminalId = resolveActiveTerminalId(cfg.terminals, {
          preferred: cfg.staffPreferredTerminalId,
          defaultId: cfg.defaultTerminalId,
          stored: readStoredTerminalId(offlineStaffId),
        });
        if (offlineTerminalId) setSelectedTerminalId(offlineTerminalId);
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
      let catalogError: { response?: { data?: { error?: string } }; message?: string } | null = null;
      let staffFailed = false;
      const [settingsRes, catRes, prodRes, webposRes, staffRes, bestsellerRes] = await Promise.all([
        api.get('/merchant/settings', fetchOpts),
        api.get('/merchant/categories', fetchOpts).catch(() => ({ data: { categories: [] } })),
        api.get('/merchant/products', { params: { limit: 500 }, ...fetchOpts }).catch((error) => {
          catalogError = error;
          return { data: { products: [] } };
        }),
        api.get('/merchant/webpos-config', fetchOpts).catch(() => ({ data: { config: null } })),
        api.get('/merchant/staff', fetchOpts).catch(() => {
          staffFailed = true;
          return { data: { staff: [] } };
        }),
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
          cacheMerchantAutoPrintSettings(cfg.posPrintSettings);
        }
        const staffId = loadWebPosStaffSession()?.id;
        const terminalId = resolveActiveTerminalId(cfg.terminals, {
          preferred: cfg.staffPreferredTerminalId,
          defaultId: cfg.defaultTerminalId,
          stored: readStoredTerminalId(staffId),
        });
        if (terminalId) setSelectedTerminalId(terminalId);
        const first = ['cash', 'card', 'terminal'] as const;
        const pick = first.find((m) => cfg.methods[m]);
        if (pick) setPaymentMethod(pick);
      }
      const staffList = (staffRes.data.staff || []) as StaffRosterRow[];
      if (!staffFailed) {
        setStaffRoster(staffList);
        applyStaffRoster(staffList, { openPinGate: true });
      }
      if (catalogError) {
        toast.error(
          catalogError.response?.data?.error || catalogError.message || t('webPosLoadFailed')
        );
      }
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
        specifications: Array.isArray(p.specifications)
          ? p.specifications.map((s: any, i: number) => ({
              id: s?.id || `spec-${i + 1}`,
              name: repairCatalogText(s?.name || ''),
              price: Number(s?.price) || 0,
              saleStatus: s?.saleStatus || 'in_stock',
              isDefault: !!s?.isDefault,
              sortOrder: Number(s?.sortOrder) || i,
            }))
          : p.specifications,
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
    initWebPosLogging({
      getDiagnostics: () => ({
        locale,
        staffName: webposStaff?.name,
        staffRole: webposStaff?.roleName,
        merchantName: merchant?.name || merchant?.businessName,
      }),
    });
    if (!readWebPosOnboardingDone()) {
      setOnboardingOpen(true);
    }
  }, [locale, webposStaff?.name, webposStaff?.roleName, merchant?.name, merchant?.businessName]);

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

  const ringWaiterTillBell = useCallback(
    (key: string, label?: string | null) => {
      if (printSettings?.waiterTillBellEnabled === false) return;
      if (!isMainTillRegister(agentOk)) return;
      if (!shouldRingWaiterTillBell(key)) return;
      playWaiterTillBellOnce();
      const msg = (label || '').trim()
        ? t('webPosWaiterOrderAtTillNamed').replace('{label}', label!.trim())
        : t('webPosWaiterOrderAtTill');
      toast.success(msg, { duration: 4000 });
      setOrdersRefreshToken((n) => n + 1);
    },
    [printSettings?.waiterTillBellEnabled, agentOk, t]
  );

  const ringReservationTillBell = useCallback(() => {
    if (!isMainTillRegister(agentOk)) return;
    playReservationTillBellOnce();
    setReservationAlertUntil(Date.now() + 10000);
    toast(t('webPosNewReservationAlert'), { icon: '📅', duration: 10000 });
  }, [agentOk, t]);

  /** Retry unprinted kitchen/receipt jobs every 8s while WebPOS stays open. */
  useEffect(() => {
    startPrintQueueAutoRetry();
  }, []);

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
        await pairPrintAgentCloudRelay();
        const result = await processPendingEscPosPrintJobs();
        if (result.remoteKitchenDone > 0) {
          ringWaiterTillBell(`remote-print-${Date.now()}`);
        }
        if (result.reservationDone > 0) {
          ringReservationTillBell();
        }
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
  }, [agentOk, ringWaiterTillBell, ringReservationTillBell]);

  /** Main till bell: new waiter/mobile kitchen sends registered via held orders. */
  useEffect(() => {
    if (!isMainTillRegister(agentOk)) return;
    if (printSettings?.waiterTillBellEnabled === false) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await api.get('/merchant/pos/held');
        const held = (res.data?.held || []) as Array<{
          id: string;
          status?: string;
          label?: string | null;
          staffName?: string | null;
        }>;
        if (knownRemoteHeldRef.current == null) {
          knownRemoteHeldRef.current = new Set(held.map((h) => h.id));
        } else {
          const ids = new Set(held.map((h) => h.id));
          let heldChanged = false;
          for (const h of held) {
            if (knownRemoteHeldRef.current.has(h.id)) continue;
            knownRemoteHeldRef.current.add(h.id);
            heldChanged = true;
            if (h.status !== 'sent_to_kitchen') continue;
            const suppressUntil = localHeldBellSuppressRef.current.get(h.id);
            if (suppressUntil != null && Date.now() < suppressUntil) continue;
            ringWaiterTillBell(
              `held-${h.id}`,
              h.label || h.staffName || null
            );
          }
          for (const id of [...knownRemoteHeldRef.current]) {
            if (!ids.has(id)) {
              knownRemoteHeldRef.current.delete(id);
              heldChanged = true;
            }
          }
          if (heldChanged) setOrdersRefreshToken((n) => n + 1);
        }
      } catch {
        /* best-effort */
      }
      if (!cancelled) timer = window.setTimeout(poll, 8000);
    };
    timer = window.setTimeout(poll, 8000);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [agentOk, printSettings?.waiterTillBellEnabled, ringWaiterTillBell]);

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

  useEffect(() => {
    setDeliverySettingsReady(false);
    void api
      .get('/merchant/settings')
      .then((res) => {
        const s = res.data?.settings || res.data || {};
        setDeliveryAutoAccept(readDeliveryAutoAccept(s));
      })
      .catch(() => {})
      .finally(() => setDeliverySettingsReady(true));
  }, []);

  useEffect(() => {
    if (!deliverySettingsReady) return;
    if (deliveryAutoAcceptRef.current !== deliveryAutoAccept) {
      deliveryAutoAcceptRef.current = deliveryAutoAccept;
      knownOnlineIdsRef.current = null;
    }
  }, [deliveryAutoAccept, deliverySettingsReady]);

  const pollOnlineOrders = useCallback(async () => {
    try {
      const res = await api.get('/merchant/orders/incoming', {
        params: { limit: 200, statuses: INCOMING_ONLINE_ORDER_STATUSES_PARAM },
      });
      const all = (res.data.orders || []) as OnlineOrder[];
      const online = all.filter((o) => isOnlineShopOrder(o));
      setOnlineOrders(online);

      const alertStatuses = onlineOrderAlertStatuses(deliveryAutoAccept);
      const newOnes = online.filter((o) =>
        alertStatuses.has(String(o.status || '').toLowerCase())
      );
      const newIds = newOnes.map((o) => o.id);

      if (knownOnlineIdsRef.current == null) {
        knownOnlineIdsRef.current = new Set(newIds);
        for (const o of newOnes) {
          unactionedOrderIdsRef.current.add(o.id);
        }
        setUnactionedOrderCount(unactionedOrderIdsRef.current.size);
        return;
      }

      const fresh = newIds.filter((id) => !knownOnlineIdsRef.current!.has(id));
      const freshOrders = newOnes.filter((o) => fresh.includes(o.id));
      for (const id of newIds) knownOnlineIdsRef.current.add(id);

      for (const id of [...unactionedOrderIdsRef.current]) {
        const row = online.find((o) => o.id === id);
        if (!row) {
          unactionedOrderIdsRef.current.delete(id);
          continue;
        }
        if (deliveryAutoAccept) {
          if (isTerminalOrderStatus(row.status)) unactionedOrderIdsRef.current.delete(id);
        } else if (!isAwaitingApproval(row.status)) {
          unactionedOrderIdsRef.current.delete(id);
        }
      }
      setNewOrderAlertQueue((prev) =>
        prev.filter((o) => unactionedOrderIdsRef.current.has(o.id))
      );

      if (freshOrders.length > 0) {
        const queueOrders: OnlineOrder[] = [];
        for (const o of freshOrders) {
          if (deliveryAutoAccept && isAwaitingApproval(o.status)) {
            try {
              const actionRes = await api.post(`/merchant/orders/${o.id}/action`, { action: 'accept' });
              const updated =
                (actionRes.data?.order as OnlineOrder | undefined) || { ...o, status: 'preparing' };
              queueOrders.push(updated);
            } catch {
              queueOrders.push(o);
            }
          } else {
            queueOrders.push(o);
          }
        }

        for (const o of queueOrders) {
          unactionedOrderIdsRef.current.add(o.id);
          const zip = extractZipFromAddress(o.shippingAddress);
          speakDeliveryAlert(onlineShopOrderSpeechLine(t, zip));
        }
        setUnactionedOrderCount(unactionedOrderIdsRef.current.size);
        setNewOrderAlertQueue((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const next = [...prev];
          for (const o of queueOrders) {
            if (!seen.has(o.id)) next.push(o);
          }
          return next;
        });
        playOrderAlertOnce();
        startOrderAlertLoop(5000);
      } else {
        setUnactionedOrderCount(unactionedOrderIdsRef.current.size);
      }

      if (unactionedOrderIdsRef.current.size === 0) {
        stopOrderAlertLoop();
      }
    } catch {
      /* ignore poll errors */
    }
  }, [deliveryAutoAccept, t]);

  const markOnlineOrderActioned = useCallback((orderId: string) => {
    unactionedOrderIdsRef.current.delete(orderId);
    localPosOrderIdsRef.current.delete(orderId);
    setLocalPosOrderCount(localPosOrderIdsRef.current.size);
    setUnactionedOrderCount(unactionedOrderIdsRef.current.size);
    setNewOrderAlertQueue((prev) => prev.filter((o) => o.id !== orderId));
    if (unactionedOrderIdsRef.current.size === 0) {
      stopOrderAlertLoop();
    }
  }, []);

  const pushLocalPosOrderNotification = useCallback((order: OnlineOrder) => {
    localPosOrderIdsRef.current.add(order.id);
    setLocalPosOrderCount(localPosOrderIdsRef.current.size);
    setLocalPosOrderAlerts((prev) => {
      const next = [order, ...prev.filter((row) => row.id !== order.id)];
      return next.slice(0, 20);
    });
  }, []);

  const pushReservationNotification = useCallback((reservation: WebPosReservationAlert) => {
    if (!['pending', 'confirmed'].includes(reservation.status)) return;
    knownReservationIdsRef.current ??= new Set<string>();
    knownReservationIdsRef.current.add(reservation.id);
    unactionedReservationIdsRef.current.add(reservation.id);
    setReservationAlertById((prev) => ({ ...prev, [reservation.id]: reservation }));
    setUnactionedReservationCount(unactionedReservationIdsRef.current.size);
    playReservationTillBellOnce();
    window.setTimeout(() => playReservationTillBellOnce(), 950);
    setReservationAlertUntil(Date.now() + 10000);
  }, []);

  const markReservationActioned = useCallback((reservationId?: string) => {
    if (reservationId) {
      unactionedReservationIdsRef.current.delete(reservationId);
    } else {
      unactionedReservationIdsRef.current.clear();
    }
    setUnactionedReservationCount(unactionedReservationIdsRef.current.size);
  }, []);

  const dismissNewOrderAlert = useCallback((orderId: string) => {
    setNewOrderAlertQueue((prev) => prev.filter((o) => o.id !== orderId));
  }, []);

  const acknowledgeNewOrderAlert = useCallback(
    (order: OnlineOrder) => {
      markOnlineOrderActioned(order.id);
      dismissNewOrderAlert(order.id);
    },
    [dismissNewOrderAlert, markOnlineOrderActioned]
  );

  const openOnlineOrdersInTab = useCallback((orderId?: string | null, channel: 'online' | 'all' = 'online') => {
    setOrdersChannelPref(channel === 'online' ? 'online' : null);
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
        setOrdersRefreshToken((n) => n + 1);
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
        code?: string;
        guestName: string;
        partySize: number;
        reservedAt: string;
        status: string;
      }>;
      const actionable = rows.filter((r) => r.status === 'pending' || r.status === 'confirmed');
      const pending = rows.filter((r) => r.status === 'pending');
      const alertById = Object.fromEntries(
        actionable.map((r) => [
          r.id,
          {
            id: r.id,
            code: r.code,
            guestName: r.guestName,
            partySize: r.partySize,
            reservedAt: r.reservedAt,
            status: r.status,
          } satisfies WebPosReservationAlert,
        ])
      );
      setReservationPendingCount(pending.length);
      setReservationAlertById(alertById);

      for (const id of [...unactionedReservationIdsRef.current]) {
        if (!alertById[id]) unactionedReservationIdsRef.current.delete(id);
      }
      setUnactionedReservationCount(unactionedReservationIdsRef.current.size);

      const alertIds = actionable.map((r) => r.id);
      if (knownReservationIdsRef.current == null) {
        knownReservationIdsRef.current = new Set(alertIds);
        for (const id of alertIds) unactionedReservationIdsRef.current.add(id);
        setUnactionedReservationCount(unactionedReservationIdsRef.current.size);
        return;
      }

      const fresh = alertIds.filter((id) => !knownReservationIdsRef.current!.has(id));
      for (const id of alertIds) knownReservationIdsRef.current.add(id);

      if (fresh.length > 0) {
        for (const id of fresh) unactionedReservationIdsRef.current.add(id);
        setUnactionedReservationCount(unactionedReservationIdsRef.current.size);
        playReservationTillBellOnce();
        window.setTimeout(() => playReservationTillBellOnce(), 950);
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
  }, [posView, ordersChannelPref]);

  useEffect(() => {
    if (pinGateRequired || loading || !deliverySettingsReady) {
      if (pinGateRequired || loading) {
        knownOnlineIdsRef.current = null;
        knownReservationIdsRef.current = null;
        unactionedOrderIdsRef.current.clear();
        setUnactionedOrderCount(0);
        setNewOrderAlertQueue([]);
        setReservationAlertById({});
        setReservationPendingCount(0);
        unactionedReservationIdsRef.current.clear();
        setUnactionedReservationCount(0);
        localPosOrderIdsRef.current.clear();
        setLocalPosOrderAlerts([]);
        setLocalPosOrderCount(0);
        stopOrderAlertLoop();
      }
      return;
    }
    void pollOnlineOrders();
    const id = setInterval(() => void pollOnlineOrders(), 8000);
    return () => {
      clearInterval(id);
      stopOrderAlertLoop();
    };
  }, [pinGateRequired, loading, deliverySettingsReady, pollOnlineOrders]);

  useEffect(() => {
    if (!reservationsPosUiEnabled || pinGateRequired || loading) {
      setReservationPendingCount(0);
      setReservationAlertById({});
      unactionedReservationIdsRef.current.clear();
      setUnactionedReservationCount(0);
      if (!reservationsPosUiEnabled) {
        knownReservationIdsRef.current = null;
      }
      return;
    }
    void pollReservations();
    const id = setInterval(() => void pollReservations(), 8000);
    return () => clearInterval(id);
  }, [pollReservations, reservationsPosUiEnabled, pinGateRequired, loading]);

  useEffect(() => {
    const unsubReservation = subscribeWebPosReservationCreated((reservation) => {
      pushReservationNotification(reservation);
    });
    const unsubOrder = subscribeWebPosOrderCompleted((order) => {
      pushLocalPosOrderNotification(order);
    });
    return () => {
      unsubReservation();
      unsubOrder();
    };
  }, [pushLocalPosOrderNotification, pushReservationNotification]);

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
    if (!agentOk || !printersReady || printers.length === 0) return;

    const configured = printerName.trim();
    if (configured && isConfiguredPrinterMissing(configured, printers)) {
      const heal = suggestPrinterAutoHeal(configured, printers);
      const key = `local:${configured}->${heal?.name || ''}`;
      if (heal && !printerHealAttemptedRef.current.has(key)) {
        printerHealAttemptedRef.current.add(key);
        setPrinterName(heal.name);
        setPrinterDisconnected(false);
        toast.success(t('webPosPrinterAutoHealed').replace('{name}', heal.name));
      } else if (!heal) {
        setPrinterDisconnected(true);
      }
    } else if (configured) {
      setPrinterDisconnected(false);
    }

    const profiles = printSettings?.printers;
    if (!profiles?.length) return;
    let changed = false;
    const nextProfiles = profiles.map((p) => {
      const name = (p.name || '').trim();
      if (!name || !isConfiguredPrinterMissing(name, printers)) return p;
      const heal = suggestPrinterAutoHeal(name, printers);
      if (!heal) return p;
      const key = `set:${p.id}:${name}->${heal.name}`;
      if (printerHealAttemptedRef.current.has(key)) return p;
      printerHealAttemptedRef.current.add(key);
      changed = true;
      return { ...p, name: heal.name };
    });
    if (!changed) return;
    const next = { ...printSettings, printers: nextProfiles };
    setPrintSettings(next);
    void api.put('/merchant/settings', { posPrintSettings: next }).catch(() => undefined);
  }, [agentOk, printersReady, printers, printerName, printSettings, t]);

  const scalePortHealRef = useRef<string | null>(null);

  const healScalePort = useCallback(
    (resolvedPort: string) => {
      if (!scaleFeatureEnabled || !printSettings) return;
      const want = formatScalePortLabel(resolvedPort);
      const have = formatScalePortLabel(printSettings.scaleComPort || '');
      if (!want || want === have) return;
      if (scalePortHealRef.current === want) return;
      scalePortHealRef.current = want;
      const next = { ...printSettings, scaleComPort: want, scaleEnabled: true };
      setPrintSettings(next);
      void api.put('/merchant/settings', { posPrintSettings: next }).catch(() => undefined);
    },
    [printSettings, scaleFeatureEnabled]
  );

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
      setSelectedLineId((prev) => (prev === line.lineId ? null : line.lineId));
      setKeypadBuffer('');
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
      specifications: product.specifications,
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
    const kg = roundWeightKg(Math.max(0, weightKg));
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
        if (!scaleFeatureEnabled) {
          addConfiguredProduct(p, Number(p.price) || 0);
          return;
        }
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
          specifications: p.specifications,
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
      const liveAtClose = shiftLive;
      setLastClosedShift({
        openingCash: Number(shift.openingCash) || 0,
        closingCashCounted: Number(shift.closingCashCounted) || 0,
        expectedCash: Number(shift.expectedCash) || 0,
        cashSales: Number(shift.cashSales) || 0,
        cashIn: Number(res.data.cashIn ?? liveAtClose?.cashIn) || 0,
        cashOut: Number(res.data.cashOut ?? liveAtClose?.cashOut) || 0,
        cashRefunds: Number(res.data.cashRefunds ?? liveAtClose?.cashRefunds) || 0,
        movements: Array.isArray(res.data.movements) ? res.data.movements : [],
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
    refundCount?: number;
    refundedOrders?: Array<{
      orderNumber: string;
      refundAmount: number;
      refundReason?: string | null;
    }>;
    refundRows?: Array<{ method: string; total: number }>;
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
      cashIn?: number;
      cashOut?: number;
      cashRefunds?: number;
      movements?: Array<{
        type: string;
        amount: number;
        reason?: string | null;
        staffName?: string | null;
        createdAt?: string | null;
      }>;
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

  /** EOD from POS menu: END_OF_DAY or VIEW_REPORTS (own sales when VIEW_ALL_SALES is off). */
  const canPrintEodReport =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff &&
      (hasPermission(webposStaff.permissions, 'VIEW_REPORTS') ||
        hasPermission(webposStaff.permissions, 'END_OF_DAY')));

  /** Whole-day EOD: END_OF_DAY/VIEW_REPORTS plus VIEW_ALL_SALES (managers). */
  const mayPrintWholeDayEod =
    canPrintEodReport &&
    (ownerOnRegister ||
      !staffConfigured ||
      hasPermission(webposStaff?.permissions, 'VIEW_ALL_SALES', false));

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
      refundCount: report?.refundedOrders?.length ?? report?.refundCount,
      refundedOrders: report?.refundedOrders?.map((r) => ({
        orderNumber: r.orderNumber,
        refundAmount: r.refundAmount,
        refundReason: r.refundReason,
      })),
      refundRows: report?.refundRows,
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
        reportKind === 'shift'
          ? report?.shiftCash?.length
            ? report.shiftCash
            : {
                openingFloat: lastClosedShift.openingCash,
                cashSales: lastClosedShift.cashSales,
                cashIn: lastClosedShift.cashIn ?? 0,
                cashOut: lastClosedShift.cashOut ?? 0,
                cashRefunds: lastClosedShift.cashRefunds ?? 0,
                movements: lastClosedShift.movements ?? [],
                expectedCash: lastClosedShift.expectedCash,
                closingCashCounted: lastClosedShift.closingCashCounted,
                variance: lastClosedShift.variance,
                staffName: webposStaff?.name || null,
              }
          : undefined,
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
      notifyPrintError(e, 'webPosPrintFailed');
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
      notifyPrintError(e, 'webPosPrintFailed');
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
    notifyWebPosStaffSessionChanged();
  };

  /** EOD print/download when cash shifts are disabled (late-night venues). */
  const printTodayEod = async (
    scopeStaffId?: string | null,
    scopeStaffName?: string | null,
    opts?: { includeProductsSold?: boolean }
  ) => {
    const includeProductsSold = opts?.includeProductsSold !== false;
    if (!canPrintEodReport) {
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
        ownerOnRegister ||
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
        refundCount?: number;
        refundedOrders?: Array<{
          orderNumber: string;
          refundAmount: number;
          refundReason?: string | null;
        }>;
        refundRows?: Array<{ method: string; total: number }>;
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
          cashIn?: number;
          cashOut?: number;
          cashRefunds?: number;
          movements?: Array<{
            type: string;
            amount: number;
            reason?: string | null;
            staffName?: string | null;
            createdAt?: string | null;
          }>;
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
        refundCount: report?.refundedOrders?.length ?? report?.refundCount,
        refundedOrders: report?.refundedOrders?.map((r) => ({
          orderNumber: r.orderNumber,
          refundAmount: r.refundAmount,
          refundReason: r.refundReason,
        })),
        refundRows: report?.refundRows,
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
        includeProductsSold,
        reportKind: 'eod',
      });
      await printEscPosToTargets(text, { role: 'eod' });
    } catch (e: any) {
      notifyPrintError(e, 'webPosPrintFailed');
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
    const next = Math.max(activeCourse, courseCount, ...courseNumbers, 0) + 1;
    setActiveCourse(next);
    setCourseCount(next);
    setSelectedLineId(null);
    setKeypadBuffer('');
    toast.success(`${t('webPosCourse')} ${next}`);
    if (isNarrowViewport) setMobileCartOpen(false);
    if (posView === 'checkout') {
      setCheckoutOpen(false);
      setPosView('register');
      setPosTab('register');
    }
  };

  const handleSelectCourse = (course: number) => {
    setActiveCourse(course);
    setSelectedLineId(null);
    setKeypadBuffer('');
  };

  const setKitchenPrintFailedForLines = useCallback((lineIds: Iterable<string>, failed: boolean) => {
    const idSet = new Set(lineIds);
    setCart((prev) =>
      prev.map((l) => (idSet.has(l.lineId) ? { ...l, kitchenPrintFailed: failed } : l))
    );
  }, []);

  useEffect(() => {
    applyKitchenPrintRetryFromSettings(printSettings);
  }, [printSettings]);

  useEffect(() => {
    return subscribePrintJobExhausted((job) => {
      if (job.kind === 'kitchen' && job.lineIds?.length) {
        setKitchenPrintFailedForLines(job.lineIds, true);
      }
      notifyPrintErrorRef.current(
        job.lastError || 'Print failed',
        job.kind === 'kitchen' ? 'webPosKitchenPrintFailed' : 'webPosPrintFailed'
      );
    });
  }, [setKitchenPrintFailedForLines]);

  useEffect(() => {
    const retryingLineIds = new Set(
      pendingPrintJobs.filter((j) => !j.exhausted).flatMap((j) => j.lineIds || [])
    );
    const exhaustedLineIds = new Set(
      pendingPrintJobs.filter((j) => j.exhausted).flatMap((j) => j.lineIds || [])
    );
    setCart((prev) => {
      let changed = false;
      const next = prev.map((l) => {
        if (!l.kitchenPrintFailed) return l;
        if (retryingLineIds.has(l.lineId)) {
          changed = true;
          return { ...l, kitchenPrintFailed: false };
        }
        if (exhaustedLineIds.has(l.lineId)) return l;
        if (pendingPrintJobs.length > 0 && retryingLineIds.size === 0 && exhaustedLineIds.size === 0) {
          return l;
        }
        changed = true;
        return { ...l, kitchenPrintFailed: false };
      });
      return changed ? next : prev;
    });
  }, [pendingPrintJobs]);

  const openOrderReprint = () => {
    const sentIds = cart.filter((l) => l.sentToKitchen).map((l) => l.lineId);
    setReprintModal({
      lineIds: sentIds.length ? sentIds : cart.map((l) => l.lineId),
    });
  };

  const openLineReprint = (line: CartLine) => {
    setReprintModal({
      lineIds: [line.lineId],
      lineLabel: repairCatalogText(line.name || ''),
    });
  };

  const handleKitchenPrintFailure = (e: unknown, lineIds: Iterable<string>) => {
    const ids = [...lineIds];
    setKitchenPrintFailedForLines(ids, true);
    notifyPrintError(e, 'webPosKitchenPrintFailed');
    if (hasKitchenRetryPending(ids)) {
      toast(t('webPosKitchenPrintRetrying'), { duration: 3500 });
    }
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
        lineIds: lines.map((l) => l.lineId),
      })
      .then(() => setKitchenPrintFailedForLines(ids, false))
      .catch((e: unknown) => {
        handleKitchenPrintFailure(e, ids);
      });
  };

  /** Clear operator editing UI without deleting table/tab kitchen drafts. */
  const releaseOperatorAfterKitchen = (
    sentCart: CartLine[],
    opts?: {
      draftActiveCourse?: number;
      ticket?: { display: string; orderNumber: string };
    }
  ) => {
    const wasTable = !!tableId;
    const pendingCourses = sentCart
      .filter((l) => !l.sentToKitchen)
      .map((l) => l.courseNumber || 1)
      .sort((a, b) => a - b);
    const draftActiveCourse =
      opts?.draftActiveCourse ?? pendingCourses[0] ?? activeCourse;
    const draftTicketDisplay =
      opts?.ticket?.display?.trim() ||
      ticketDisplay?.trim() ||
      lastKitchenTicketRef.current?.trim() ||
      null;
    const draftTicketOrderNumber =
      opts?.ticket?.orderNumber?.trim() || ticketOrderNumber?.trim() || null;
    // Keep a local draft for every kitchen-sent ticket (including takeaway)
    // so Orders can recover if /merchant/pos/held is slow or fails.
    const key = openCartDraftKey({
      tableId,
      tabNumber,
      channel: tableId ? 'dine_in' : effectiveChannel,
      ticketDisplay: draftTicketDisplay,
    });
    openCartDraftsRef.current.set(key, {
      cart: sentCart,
      channel: tableId ? 'dine_in' : effectiveChannel,
      tableId,
      tableLabel,
      tabNumber,
      ticketDisplay: draftTicketDisplay,
      ticketOrderNumber: draftTicketOrderNumber,
      orderNote,
      activeCourse: draftActiveCourse,
      courseCount,
      orderSent: true,
      coursesBulkSent: true,
      selectedLineId: null,
      keypadBuffer: '',
      billDiscount,
    });
    setDraftVersion((n) => n + 1);
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
    setCourseCount(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel(null);
    setFulfillmentWhen(null);
    setSelectedCustomer(null);
    setProvisionalPrinted(false);
    setMobileCartOpen(false);
    if (wasTable) {
      setTablesRefreshToken((n) => n + 1);
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
        releaseOperatorAfterKitchen(sentCart, { ticket });
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
      releaseOperatorAfterKitchen(sentCart, { ticket });
    } catch (e: unknown) {
      notifyPrintError(e, 'webPosKitchenPrintFailed');
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
    courseCount,
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
    setCart(normalizeCartLines(draft.cart));
    setChannel(draft.channel);
    setTableId(draft.tableId);
    setTableLabel(draft.tableLabel);
    setTabNumber(draft.tabNumber);
    setTicketDisplay(draft.ticketDisplay ?? null);
    if (draft.ticketDisplay) lastKitchenTicketRef.current = draft.ticketDisplay;
    setTicketOrderNumber(draft.ticketOrderNumber ?? null);
    setOrderNote(draft.orderNote);
    setActiveCourse(draft.activeCourse);
    {
      let max = Math.max(draft.activeCourse || 1, draft.courseCount || 1);
      for (const line of draft.cart) {
        const n = Number(line.courseNumber) || 0;
        if (n > max) max = n;
      }
      setCourseCount(max);
    }
    setOrderSent(draft.orderSent);
    setCoursesBulkSent(draft.coursesBulkSent);
    setSelectedLineId(draft.selectedLineId);
    setKeypadBuffer(draft.keypadBuffer);
    setBillDiscount(draft.billDiscount || { percent: 0, amount: 0 });
  };

  const applyHeldOrderFromRow = useCallback(
    (held: HeldOrderRow, table?: { id: string; label: string }) => {
      const meta = parseHeldCartJson(held.cartJson);
      if (!meta.cart.length) return false;
      resumedHeldIdRef.current = String(held.id).startsWith('local:') ? null : held.id;
      setCart(normalizeCartLines(meta.cart));
      setChannel((meta.channel as Channel) || 'dine_in');
      setTableId(meta.tableId || table?.id || null);
      setTableLabel(meta.tableLabel || table?.label || null);
      setTabNumber(meta.tabNumber);
      const ticketFromLabel = (held.label || '').match(/#\d{4}/)?.[0] || null;
      const restoredTicket =
        meta.kitchenTicketKey?.trim() ||
        meta.ticketDisplay?.trim() ||
        ticketFromLabel;
      if (restoredTicket) {
        setTicketDisplay(restoredTicket);
        lastKitchenTicketRef.current = restoredTicket;
      } else {
        setTicketDisplay(meta.ticketDisplay ?? null);
      }
      if (meta.ticketOrderNumber) setTicketOrderNumber(meta.ticketOrderNumber);
      if (meta.orderNote != null) setOrderNote(meta.orderNote);
      if (meta.billDiscount) setBillDiscount(meta.billDiscount);
      let maxCourse = 1;
      for (const line of meta.cart) {
        const n = Number(line.courseNumber) || 0;
        if (n > maxCourse) maxCourse = n;
      }
      setActiveCourse(maxCourse);
      setCourseCount(maxCourse);
      const sent =
        held.status === 'sent_to_kitchen' || meta.cart.some((l) => l.sentToKitchen);
      setOrderSent(sent);
      setCoursesBulkSent(sent);
      setSelectedLineId(null);
      setKeypadBuffer('');
      const draftKey = openCartDraftKey({
        tableId: meta.tableId || table?.id || null,
        tabNumber: meta.tabNumber,
        channel: (meta.channel as Channel) || 'dine_in',
      });
      openCartDraftsRef.current.set(draftKey, {
        cart: meta.cart,
        channel: (meta.channel as Channel) || 'dine_in',
        tableId: meta.tableId || table?.id || null,
        tableLabel: meta.tableLabel || table?.label || null,
        tabNumber: meta.tabNumber,
        ticketDisplay: restoredTicket || meta.ticketDisplay || null,
        ticketOrderNumber: meta.ticketOrderNumber || null,
        orderNote: meta.orderNote || '',
        activeCourse: maxCourse,
        courseCount: maxCourse,
        orderSent: sent,
        coursesBulkSent: sent,
        selectedLineId: null,
        keypadBuffer: '',
        billDiscount: meta.billDiscount || { percent: 0, amount: 0 },
      });
      setDraftVersion((n) => n + 1);
      lastSeenHeldUpdatedAtRef.current = heldRowTimeMs(held);
      return true;
    },
    []
  );

  useEffect(() => {
    if (applyingRemoteHeldRef.current || !tableId) return;
    lastLocalCartMutationRef.current = Date.now();
  }, [cart, tableId]);

  /** Pull waiter/mobile cart changes while a table order is open on the till. */
  useEffect(() => {
    if (!tableId) return;
    const hasSent = orderSent || cart.some((l) => l.sentToKitchen);
    if (!hasSent && !resumedHeldIdRef.current && !cart.length) return;
    let cancelled = false;
    const syncRemoteHeld = async () => {
      if (cancelled) return;
      if (Date.now() - lastLocalCartMutationRef.current < 2500) return;
      try {
        const res = await api.get('/merchant/pos/held');
        const held = findHeldOrderForTable(
          tableId,
          (res.data?.held || []) as HeldOrderRow[],
          { ticketDisplay: ticketDisplay || lastKitchenTicketRef.current }
        );
        if (!held) return;
        const remoteTime = heldRowTimeMs(held);
        const meta = parseHeldCartJson(held.cartJson);
        if (!meta.cart.length) return;
        if (
          heldCartSignature(meta.cart) === heldCartSignature(cart) &&
          remoteTime <= lastSeenHeldUpdatedAtRef.current
        ) {
          lastSeenHeldUpdatedAtRef.current = Math.max(lastSeenHeldUpdatedAtRef.current, remoteTime);
          return;
        }
        if (remoteTime <= lastSeenHeldUpdatedAtRef.current) return;
        if (!remoteHeldShouldReplaceLocal({ cart }, held)) return;
        applyingRemoteHeldRef.current = true;
        applyHeldOrderFromRow(held, {
          id: tableId,
          label: tableLabel || meta.tableLabel || tableId,
        });
        applyingRemoteHeldRef.current = false;
      } catch {
        /* best-effort */
      }
    };
    void syncRemoteHeld();
    const timer = window.setInterval(() => void syncRemoteHeld(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    tableId,
    tableLabel,
    ticketDisplay,
    cart,
    orderSent,
    applyHeldOrderFromRow,
  ]);

  /** Customer-facing shout from tab number (delivery / takeaway order #). */
  const tabOrderShout = useCallback((tab: string | null | undefined) => {
    const n = String(tab || '')
      .trim()
      .replace(/^#/, '');
    return n ? `#${n}` : '';
  }, []);

  /** One arbitrary ticket per open cart (kitchen + receipt share the same shout #). */
  const ensureCartTicket = useCallback(() => {
    const tabShout = tabOrderShout(tabNumber);
    if (tabShout) {
      if (ticketOrderNumber?.trim()) {
        return { display: tabShout, orderNumber: ticketOrderNumber.trim() };
      }
      const orderNumber = webPosBackendOrderId(merchant?.id);
      setTicketDisplay(tabShout);
      setTicketOrderNumber(orderNumber);
      lastKitchenTicketRef.current = tabShout;
      return { display: tabShout, orderNumber };
    }
    const display = ticketDisplay?.trim();
    if (display) {
      if (ticketOrderNumber?.trim()) {
        return { display, orderNumber: ticketOrderNumber.trim() };
      }
      const orderNumber = webPosBackendOrderId(merchant?.id);
      setTicketOrderNumber(orderNumber);
      return { display, orderNumber };
    }
    const isCounterDineIn =
      effectiveChannel === 'dine_in' && counterDineInEnabled && !tableId;
    const ticket = isCounterDineIn
      ? nextDineInCounterNumber(merchant?.id, openShift?.id)
      : nextWebPosTicketNumber(merchant?.id);
    setTicketDisplay(ticket.display);
    setTicketOrderNumber(ticket.orderNumber);
    lastKitchenTicketRef.current = ticket.display;
    return ticket;
  }, [
    ticketDisplay,
    ticketOrderNumber,
    merchant?.id,
    effectiveChannel,
    counterDineInEnabled,
    tableId,
    openShift?.id,
    tabNumber,
    tabOrderShout,
  ]);

  const clearCartTicket = useCallback(() => {
    setTicketDisplay(null);
    setTicketOrderNumber(null);
    lastKitchenTicketRef.current = null;
  }, []);

  /** Kitchen shout number — tab # when set, else ticket #6457 for kitchen / message / receipt. */
  const kitchenOrderNumber = useCallback(
    (opts?: { ticket?: { display: string; orderNumber: string }; allowNew?: boolean }) => {
      const tabShout = tabOrderShout(tabNumber);
      if (tabShout) {
        lastKitchenTicketRef.current = tabShout;
        return tabShout;
      }
      const ticket =
        opts?.ticket ??
        (ticketDisplay?.trim()
          ? { display: ticketDisplay.trim(), orderNumber: ticketOrderNumber || '' }
          : null);
      if (ticket?.display?.trim()) {
        lastKitchenTicketRef.current = ticket.display.trim();
        return ticket.display.trim();
      }
      const remembered = lastKitchenTicketRef.current?.trim();
      const hasActiveKitchen =
        cart.some((l) => l.sentToKitchen) || orderSent || !!ticketDisplay?.trim();
      if (remembered && hasActiveKitchen) {
        return remembered;
      }
      if (opts?.allowNew === false) {
        return '';
      }
      const created = ensureCartTicket();
      lastKitchenTicketRef.current = created.display;
      return created.display;
    },
    [tabNumber, tabOrderShout, ticketDisplay, ticketOrderNumber, ensureCartTicket, cart, orderSent]
  );

  const kdsTicketKey =
    tabOrderShout(tabNumber) ||
    ticketDisplay?.trim() ||
    lastKitchenTicketRef.current?.trim() ||
    '';

  const kdsCartTicketKeys = useMemo(
    () =>
      collectKdsTicketKeys({
        tabNumber,
        ticketDisplay,
        ticketOrderNumber,
        lastKitchenTicket: lastKitchenTicketRef.current,
        tabOrderShout,
      }),
    [tabNumber, ticketDisplay, ticketOrderNumber, draftVersion, tabOrderShout]
  );

  const kdsCompletedRungRef = useRef(new Set<string>());
  const [kdsReadyMap, setKdsReadyMap] = useState<Map<string, Set<string>>>(() => new Map());

  useEffect(() => {
    if (isRetail || !kitchenEnabled) return;

    let cancelled = false;
    const candidateKeys = () => {
      const keys = new Set<string>();
      const tab = tabOrderShout(tabNumber);
      if (tab) keys.add(kitchenTicketKeyBase(tab));
      const display = ticketDisplay?.trim();
      if (display) keys.add(kitchenTicketKeyBase(display));
      const last = lastKitchenTicketRef.current?.trim();
      if (last) keys.add(kitchenTicketKeyBase(last));
      const orderNum = ticketOrderNumber?.trim();
      if (orderNum) keys.add(kitchenTicketKeyBase(orderNum));
      if (kdsTicketKey) keys.add(kitchenTicketKeyBase(kdsTicketKey));
      return keys;
    };

    const syncBoard = async () => {
      const board = await fetchKdsBoardStatus();
      if (cancelled) return;
      setKdsReadyMap(buildKdsReadyMap(board));
      if (!board.length) return;

      const keys = candidateKeys();
      const matching = keys.size ? matchBoardTickets(board, keys) : [];
      const readyIds = collectReadyLineIds(board);

      for (const ticket of matching) {
        if (
          ticket.total > 0 &&
          ticket.ready === ticket.total &&
          ticket.status === 'pending'
        ) {
          const odsNum = resolveOdsPushNumber(ticket.ticketKey);
          if (odsNum) void pushOrderToOds({ orderNumber: odsNum, status: 'ready' });
        }
        if (ticket.status === 'completed') {
          const ringId = `${ticket.ticketKey}|${ticket.completedAt || 'done'}`;
          if (!kdsCompletedRungRef.current.has(ringId)) {
            kdsCompletedRungRef.current.add(ringId);
            playKitchenCompleteOnce();
          }
        }
      }

      if (!readyIds.size) return;
      const readyList = [...readyIds];
      setCart((prev) => applyKdsReadyToCart(prev, readyList));
      let draftChanged = false;
      for (const [key, draft] of openCartDraftsRef.current.entries()) {
        const nextCart = applyKdsReadyToCart(draft.cart, readyList);
        if (nextCart !== draft.cart) {
          openCartDraftsRef.current.set(key, { ...draft, cart: nextCart });
          draftChanged = true;
        }
      }
      if (draftChanged) setDraftVersion((n) => n + 1);
    };

    void syncBoard();
    const timer = window.setInterval(() => void syncBoard(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    isRetail,
    kitchenEnabled,
    kdsTicketKey,
    tabNumber,
    ticketDisplay,
    ticketOrderNumber,
    cart.filter((l) => l.sentToKitchen).length,
    draftVersion,
    tabOrderShout,
  ]);

  /** Assign the kitchen/public ticket when checkout opens so AMOUNT DUE can show both. */
  useEffect(() => {
    if (posView !== 'checkout' || collectOrderRef) return;
    if (!cart.length) return;
    ensureCartTicket();
  }, [posView, collectOrderRef, cart.length, ensureCartTicket]);

  /** Reattach kitchen shout # when cart has sent lines but ticket state was cleared. */
  useEffect(() => {
    if (ticketDisplay?.trim()) return;
    if (!cart.some((l) => l.sentToKitchen)) return;
    const remembered = lastKitchenTicketRef.current?.trim();
    if (!remembered) return;
    setTicketDisplay(remembered);
  }, [cart, ticketDisplay]);

  /** Assign kitchen shout # as soon as the cart opens so POS matches KDS/ODS. */
  useEffect(() => {
    if (isRetail || !kitchenEnabled || !cart.length) return;
    if (ticketDisplay?.trim() || tabOrderShout(tabNumber)) return;
    ensureCartTicket();
  }, [isRetail, kitchenEnabled, cart.length, ticketDisplay, tabNumber, tabOrderShout, ensureCartTicket]);

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
    lastKitchenTicketRef.current = ticket.display;
    const persistChannel = tableId ? 'dine_in' : effectiveChannel;
    const cartSum = cartLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
    const heldLabel = [
      tableLabel || null,
      tabNumber ? `${t('webPosTab')} ${tabNumber}` : null,
      ticket.display,
      persistChannel,
      money(cartSum),
    ]
      .filter(Boolean)
      .join(' · ');
    const heldCustomerName = selectedCustomer
      ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
      : null;
    const heldShippingAddress = selectedCustomer
      ? [
          selectedCustomer.defaultAddress,
          selectedCustomer.defaultZip,
          selectedCustomer.defaultCity,
        ]
          .filter(Boolean)
          .join(', ')
      : null;
    const cartJson = {
      cart: cartLines,
      channel: persistChannel,
      tableId,
      tableLabel,
      tabNumber,
      ticketDisplay: ticket.display,
      ticketOrderNumber: ticket.orderNumber,
      kitchenTicketKey: ticket.display,
      billDiscount,
      orderNote,
      customerId: selectedCustomer?.id || null,
      customerName: heldCustomerName || null,
      customerPhone: selectedCustomer?.phone || null,
      customerEmail: selectedCustomer?.email || null,
      shippingAddress: heldShippingAddress || null,
    };

    // Atomic server upsert — do not delete-then-insert (that lost kitchen tickets
    // when POST failed after DELETE, e.g. order 5126).
    const res = await api.post('/merchant/pos/held', {
      id: resumedHeldIdRef.current || undefined,
      label: heldLabel,
      channel: persistChannel,
      cartJson,
      staffId: webposStaff?.id,
      staffName: webposStaff?.name,
      sendToKitchen,
    });
    const savedId = (res.data?.held as { id?: string } | undefined)?.id;
    if (savedId) resumedHeldIdRef.current = savedId;
    if (sendToKitchen) {
      const suppressUntil = Date.now() + 60_000;
      if (savedId) localHeldBellSuppressRef.current.set(savedId, suppressUntil);
      if (ticket.display) {
        localHeldBellSuppressRef.current.set(`ticket:${ticket.display}`, suppressUntil);
      }
    }
    console.info('[WebPOS][held] persisted', {
      id: savedId,
      ticket: ticket.display,
      channel: persistChannel,
      sendToKitchen,
      lines: cartLines.length,
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
    let nextCourseCount = Math.max(activeCourse, courseCount, 1);

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
    nextCourseCount = Math.max(nextCourse, nextCourseCount, existing?.courseCount || 1);
    for (const line of nextCart) {
      const n = Number(line.courseNumber) || 0;
      if (n > nextCourseCount) nextCourseCount = n;
    }
    setCourseCount(nextCourseCount);
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
      courseCount: nextCourseCount,
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

  /** Open a table from the Tables plan (load that table's draft / waiter-held order). */
  const switchToTableOrder = async (table: { id: string; label: string }) => {
    saveOpenCartDraft();
    const key = openCartDraftKey({ tableId: table.id, channel: 'dine_in' });
    const existing = openCartDraftsRef.current.get(key);
    try {
      const res = await api.get('/merchant/pos/held');
      const held = findHeldOrderForTable(
        table.id,
        (res.data?.held || []) as HeldOrderRow[],
        { ticketDisplay: existing?.ticketDisplay || ticketDisplay }
      );
      if (held && applyHeldOrderFromRow(held, table)) {
        setMobileCartOpen(false);
        setPosTab('register');
        setPosView('register');
        return;
      }
    } catch (e) {
      console.warn('[WebPOS][held] load table order failed', e);
    }
    if (existing && draftOccupiesTable(existing)) {
      applyOpenCartDraft(existing);
      setMobileCartOpen(false);
      setPosTab('register');
      setPosView('register');
      return;
    }
    setCart([]);
    setSelectedLineId(null);
    setKeypadBuffer('');
    setOrderNote('');
    setBillDiscount({ percent: 0, amount: 0 });
    setTabNumber(null);
    clearCartTicket();
    setActiveCourse(1);
    setCourseCount(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setFulfillmentWhen(null);
    setSelectedCustomer(null);
    setTableId(table.id);
    setTableLabel(table.label);
    setChannel('dine_in');
    resumedHeldIdRef.current = null;
    setMobileCartOpen(false);
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
    setCourseCount(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel('takeaway');
    setFulfillmentWhen(asapFulfillment());
    setSelectedCustomer(null);
    clearAttachedMembership();
    clearAttachedGiftCard();
    setProvisionalPrinted(false);
    savePersistedWebPosCarts({
      drafts: draftsMapToRecord(openCartDraftsRef.current),
      active: null,
      mobileCartOpen: false,
      customer: null,
    });
  };

  const clearHeldOrdersForTable = async (tid: string) => {
    await releaseHeldOrder({ tableId: tid });
  };

  const releaseEmptyTable = () => {
    if (!tableId || cart.length > 0) return;
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
      setCourseCount(1);
      setOrderSent(false);
      setCoursesBulkSent(false);
      setChannel('takeaway');
      setFulfillmentWhen(asapFulfillment());
      setSelectedCustomer(null);
      clearAttachedMembership();
      clearAttachedGiftCard();
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
        courseCount: Math.max(
          tgtDraft.courseCount || 1,
          srcDraft.courseCount || 1,
          tgtDraft.activeCourse || 1,
          srcDraft.activeCourse || 1
        ),
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
      orderSent: tgtDraft.orderSent || !!line.sentToKitchen,
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
      discountAmount: amount,
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
        items: cart.map((l) =>
          buildKitchenTicketItemFromLine({
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
            productId: l.productId,
            categoryId: l.categoryId,
            courseNumber: l.courseNumber,
            selectedExtras: l.selectedExtras,
            comboSelections: l.comboSelections,
            lineNote: l.lineNote,
          })
        ),
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
        memberName: attachedMembership
          ? attachedMembership.customerName?.trim() || attachedMembership.cardNumber || null
          : null,
        loyaltyPointsBalance: attachedMembership?.membershipEnabled
          ? attachedMembership.pointsBalance
          : null,
      };
      const text = generateWebPosReceiptText(receiptPayload, locale);
      setProvisionalPrinted(true);
      toast.success(t('webPosProvisionalPrinted'));
      void printEscPosToTargets(text, { role: 'receipt', quiet: true }).catch((e: unknown) => {
        notifyPrintError(e, 'webPosPrintFailed');
      });
    } catch (e: unknown) {
      notifyPrintError(e, 'webPosPrintFailed');
    }
  };

  const onKitchenMessage = async (message: string) => {
    try {
      let orderNumber = kitchenOrderNumber({ allowNew: false });
      if (!orderNumber) {
        const ticket = ensureCartTicket();
        orderNumber = ticket.display;
      }
      if (!orderNumber) {
        toast.error(t('webPosKitchenPrintFailed'));
        return;
      }
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
      void printKitchenViaAgentOrQueue({
        printerName: printerName || undefined,
        dataBase64: uint8ToBase64(escpos),
        text,
        orderId: orderNumber,
        retryLocally: printRetryLocally,
        printers,
        configuredName: printerName,
        jobKind: 'kitchen',
        jobLabel: orderNumber || t('webPosPrintJobKitchen'),
      }).catch((e: unknown) => {
        handleKitchenPrintFailure(e, []);
      });
    } catch (e: unknown) {
      handleKitchenPrintFailure(e, []);
    }
  };

  const asapFulfillment = (): FulfillmentWhen => ({
    mode: 'asap',
    scheduledFor: null,
    label: t('webPosAsap'),
  });

  const openRegisterCheckout = () => {
    void (async () => {
      if (!cart.length || busy) return;
      if (!(await guardCartCheckout())) return;
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
    })();
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
    if (ch === 'dine_in') {
      setFulfillmentWhen(null);
      if (!tableId && !ticketDisplay) {
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

  /** Menu: switch to dine-in (floor-plan table selection is on the Tables tab only). */
  const switchToDineIn = () => {
    if (channel !== 'dine_in') {
      setChannel('dine_in');
      setFulfillmentWhen(null);
    }
    if (!tableId && !ticketDisplay) {
      const ticket = nextDineInCounterNumber(merchant?.id, openShift?.id);
      setTicketDisplay(ticket.display);
      setTicketOrderNumber(ticket.orderNumber);
    }
    if (!requireTableForDineIn) {
      return;
    }
  };

  const confirmCancelCart = async (reason: string, reasonId?: string) => {
    if (!cancelModal) return;
    if (!canCancelOrders) {
      toast.error(t('webPosCancelDenied'));
      setCancelModal(null);
      return;
    }
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
        try {
          const cancelTicket = ensureCartTicket();
          await printKitchenForCart(kitchenLines, effectiveChannel, {
            orderNumber:
              kitchenOrderNumber({ ticket: cancelTicket, allowNew: false }) ||
              kitchenOrderNumber({ ticket: cancelTicket }),
            when: fulfillmentWhen,
            cancelled: true,
            cancelReason: reason,
            forcePrint: true,
            lineIds: kitchenLines.map((l) => l.lineId),
          });
        } catch (printErr: unknown) {
          handleKitchenPrintFailure(printErr, kitchenLines.map((l) => l.lineId));
        }
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
      const logoWidth = resolveReceiptLogoWidthPx(printSettings, paper === 58 ? 58 : 80);
      const cacheKey = `${String(logoUrl)}|${paper}|${logoWidth}`;
      if (logoEscPosCacheRef.current?.key === cacheKey) {
        logo = logoEscPosCacheRef.current.bytes;
      } else {
        logo = await logoUrlToEscPos(String(logoUrl), logoWidth);
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
          retryLocally: printRetryLocally,
          jobKind: 'receipt',
          jobLabel: t('webPosPrintJobReceipt'),
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
          }).catch((e: unknown) => notifyPrintError(e, 'webPosPrintFailed'));
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

  const clearAttachedGiftCard = () => {
    setAttachedGiftCard(null);
    lastGiftInjectRef.current = null;
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

  const cardFromLookup = (c: Record<string, unknown>, fallbackNumber: string): AttachedMembership => {
    const customer = c.customer as
      | { id?: string; firstName?: string; lastName?: string }
      | null
      | undefined;
    const holder =
      (c.holderName as string) ||
      [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ||
      null;
    return {
      cardId: String(c.id),
      cardNumber: String(c.cardNumber || fallbackNumber),
      customerName: holder,
      customerId: (c.customerId as string) || customer?.id || null,
      pointsBalance: Math.max(0, Math.floor(Number(c.points ?? c.pointsBalance ?? 0))),
      giftBalance: Number(c.balance ?? c.balanceAmount ?? 0),
      membershipEnabled: !!c.membershipEnabled,
      membershipPlanId: (c.membershipPlanId as string) || null,
      membershipPlan: (c.membershipPlan as MembershipPlan | null) || null,
      stampCount: Number(c.stampCount ?? 0),
    };
  };

  const lookupPosCard = async (
    rawCode: string
  ): Promise<{ kind: 'membership' | 'gift'; membership: AttachedMembership } | null> => {
    const code = rawCode.trim();
    if (!code) return null;
    const ecParsed = normalizeScannedPayload(code);
    const normalized = ecParsed || normalizeRfidUid(code) || code;
    const mediaType = /^EC/i.test(normalized) ? 'e_card' : 'physical';
    const res = await api.get(`/gift-cards/lookup/${encodeURIComponent(normalized)}`, {
      params: { mediaType },
    });
    const c = res.data?.card;
    if (!c?.id) return null;
    if (c.status && c.status !== 'active') {
      throw new Error(t('webPosCardBlocked'));
    }
    const membership = cardFromLookup(c, normalized);
    const kind: 'membership' | 'gift' =
      c.cardKind === 'membership' || membership.membershipEnabled ? 'membership' : 'gift';
    return { kind, membership };
  };

  const lookupMembershipCard = async (
    rawCode: string,
    opts?: { silentNotFound?: boolean }
  ): Promise<boolean> => {
    if (!rawCode.trim() || membershipBusy) return false;
    setMembershipBusy(true);
    try {
      const found = await lookupPosCard(rawCode);
      if (!found) throw new Error(t('webPosMembershipLookupFailed'));
      if (found.kind === 'membership') {
        attachMembershipCard(found.membership);
      } else {
        applyScannedGiftCard(found.membership);
      }
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

  const applyScannedGiftCard = (card: AttachedMembership) => {
    const next: AttachedGiftCard = {
      cardId: card.cardId,
      cardNumber: card.cardNumber,
      balance: roundMoney2(Math.max(0, Number(card.giftBalance) || 0)),
    };
    setAttachedGiftCard(next);
    lastGiftInjectRef.current = null;
    if (next.balance <= 0.001) {
      toast.error(t('webPosGiftCardEmpty'));
      return;
    }
    toast.success(
      t('webPosGiftCardAttached').replace('{amount}', next.balance.toFixed(2))
    );
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
    const earned = computeEarnPoints(paidSubtotal, loyaltyEarnRate);
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

  const markInvoiceOrderPaid = async (
    order: { id: string },
    returnView: 'orders' | 'register' = 'orders'
  ) => {
    setBusy(true);
    try {
      await api.post(`/merchant/orders/${order.id}/record-invoice-payment`, {
        paymentMethod: INVOICE_SETTLEMENT_METHOD,
      });
      toast.success(t('webPosPaymentCollected'));
      setOrdersRefreshToken((n) => n + 1);
      if (returnView === 'orders') setPosTab('orders');
      setPosView('register');
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentCollectFailed'));
    } finally {
      setBusy(false);
    }
  };

  const dismissOdsForOrder = (order: MerchantOrder) => {
    const refs = orderPublicRefs(order);
    const nums = new Set<string>();
    const guest = guestOrderNumber({
      orderNumber: order.orderNumber,
      orderDisplay: refs.ticketDisplay || undefined,
      tabNumber: refs.tabNumber || undefined,
    });
    if (guest) nums.add(guest);
    if (refs.ticketDisplay) nums.add(refs.ticketDisplay);
    const tab = tabOrderShout(order.tabNumber ?? null);
    if (tab) nums.add(kitchenTicketKeyBase(tab));
    for (const num of nums) void dismissOrderFromOds(num);
  };

  const loadOrderIntoRegister = (order: MerchantOrder): boolean => {
    const lines = orderItemsToCartLines(order.items || []);
    if (!lines.length) {
      toast.error(t('webPosNoItems'));
      return false;
    }
    const ch = (order.channel || order.fulfillmentChannel || 'takeaway') as Channel;
    setCart(lines);
    setBillDiscount({ percent: 0, amount: Number(order.discountAmount || 0) });
    setChannel(ch);
    setOrderNote('');
    setTableId((order as { tableId?: string | null }).tableId || null);
    setTableLabel(order.tableLabel || null);
    setTabNumber(order.tabNumber || null);
    const shout =
      order.ticketDisplay && !/^(WP|DI)-/i.test(String(order.ticketDisplay))
        ? order.ticketDisplay
        : parseOrderMetaNotes(order.notes).ticketDisplay || null;
    setTicketDisplay(shout);
    if (shout) lastKitchenTicketRef.current = shout;
    setTicketOrderNumber(order.orderNumber);
    setOrderSent(true);
    setCoursesBulkSent(true);
    setSplitQueue([]);
    setSplitIndex(0);
    splitMasterIdRef.current = null;
    clearAttachedMembership();
    clearAttachedGiftCard();
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
    return true;
  };

  const loadPosOrderToRegister = (order: MerchantOrder) => {
    if (!loadOrderIntoRegister(order)) return;
    setHighlightOrderId(null);
    setOrdersChannelPref(null);
    setPosTab('register');
    setPosView('register');
  };

  const openOrderCollectCheckout = (
    order: MerchantOrder,
    returnView: 'orders' | 'register' = 'orders'
  ) => {
    if (!loadOrderIntoRegister(order)) return;
    setCollectOrderRef({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      returnView,
      isInvoice: isInvoiceOrder(order),
      isPayLater: isPayLaterPaymentMethod(order.paymentMethod),
    });
    setHighlightOrderId(null);
    setOrdersChannelPref(null);
    setPosTab('register');
    setPosView('checkout');
  };

  const currentCartOrderLink = (): CartOrderLink => ({
    ticketDisplay: ticketDisplay?.trim() || lastKitchenTicketRef.current?.trim() || null,
    tabNumber,
    tableId,
    ticketOrderNumber,
  });

  const orderDisplayLabel = (order: MerchantOrder) => {
    const refs = orderPublicRefs(order);
    return (
      guestOrderNumber({
        orderNumber: order.orderNumber,
        orderDisplay: refs.ticketDisplay || undefined,
        tabNumber: refs.tabNumber || undefined,
      }) ||
      refs.ticketDisplay ||
      order.orderNumber ||
      ''
    );
  };

  const splitBillActive = () => splitQueue.length > 0 || !!splitMasterIdRef.current;

  /** Drop stale cart when the same ticket was paid on another till / orders tab. */
  const releasePaidCartSession = (order?: MerchantOrder | null) => {
    if (splitBillActive()) return;
    const link = currentCartOrderLink();
    const draftKeys = [
      openCartDraftKey({ tableId, tabNumber, channel }),
      openCartDraftKey({ ticketDisplay: link.ticketDisplay, channel: effectiveChannel }),
      openCartDraftKey({ tableId: link.tableId, channel: 'dine_in' }),
    ];
    for (const key of draftKeys) openCartDraftsRef.current.delete(key);
    const heldId = resumedHeldIdRef.current;
    resumedHeldIdRef.current = null;
    void releaseHeldOrder({
      heldId,
      ticketDisplay: link.ticketDisplay || order?.ticketDisplay || ticketDisplay,
      tableId: link.tableId || tableId,
      tabNumber: link.tabNumber || tabNumber,
    });
    clearCollectCheckout();
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
    setCourseCount(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel(null);
    setCheckoutOpen(false);
    setMobileCartOpen(false);
    setPosView('register');
    setPosTab('register');
    setDraftVersion((n) => n + 1);
    setOrdersRefreshToken((n) => n + 1);
    if (order?.id) markOnlineOrderActioned(order.id);
  };

  const guardCartCheckout = async (): Promise<boolean> => {
    if (!cart.length || collectOrderRef) return true;
    // Split-bill parts share one kitchen ticket but post separate payments — do not treat part 1 as "already paid".
    if (splitBillActive()) return true;
    const hasSent = orderSent || cart.some((l) => l.sentToKitchen);
    if (!hasSent && !resumedHeldIdRef.current && !ticketDisplay?.trim()) return true;
    try {
      const res = await api.get('/merchant/orders', { params: { limit: 120 } });
      if (splitBillActive()) return true;
      const orders = (res.data?.orders || []) as MerchantOrder[];
      const guard = resolveCartCheckoutGuard(orders, currentCartOrderLink(), {
        requireSent: hasSent || !!resumedHeldIdRef.current,
      });
      if (guard.action === 'blocked') {
        releasePaidCartSession(guard.order);
        toast.error(
          t('webPosOrderAlreadyPaid').replace('{number}', orderDisplayLabel(guard.order))
        );
        return false;
      }
      if (guard.action === 'collect') {
        openOrderCollectCheckout(guard.order, 'register');
        toast.info(
          t('webPosOrderUseCollect').replace('{number}', orderDisplayLabel(guard.order))
        );
        return false;
      }
    } catch {
      /* allow checkout when order lookup fails */
    }
    return true;
  };

  const handleOrderPaidElsewhere = useCallback(
    (order: MerchantOrder) => {
      if (splitQueue.length > 0 || splitMasterIdRef.current) return;
      if (isPaidOrder(order)) dismissOdsForOrder(order);
      if (collectOrderRef?.id === order.id) {
        clearCollectCheckout();
        setOrdersRefreshToken((n) => n + 1);
        return;
      }
      if (!cart.length && !orderSent) return;
      if (!orderMatchesCartLink(order, currentCartOrderLink())) return;
      if (!isPaidOrder(order)) return;
      releasePaidCartSession(order);
      toast.error(
        t('webPosOrderAlreadyPaid').replace('{number}', orderDisplayLabel(order))
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot link fields only
    [
      cart.length,
      orderSent,
      ticketDisplay,
      tabNumber,
      tableId,
      ticketOrderNumber,
      collectOrderRef,
      splitQueue.length,
      t,
    ]
  );

  /** Clear register cart when the same kitchen ticket was paid on another till. */
  useEffect(() => {
    if (collectOrderRef) return;
    if (splitQueue.length > 0 || splitMasterIdRef.current) return;
    const hasSent = orderSent || cart.some((l) => l.sentToKitchen);
    if (!hasSent && !resumedHeldIdRef.current && !cart.length) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      if (cancelled || (!cart.length && !orderSent)) return;
      try {
        const res = await api.get('/merchant/orders', { params: { limit: 120 } });
        if (cancelled || splitMasterIdRef.current) return;
        const orders = (res.data?.orders || []) as MerchantOrder[];
        const guard = resolveCartCheckoutGuard(orders, currentCartOrderLink(), {
          requireSent: hasSent || !!resumedHeldIdRef.current,
        });
        if (guard.action === 'blocked') {
          releasePaidCartSession(guard.order);
          toast.error(
            t('webPosOrderAlreadyPaid').replace('{number}', orderDisplayLabel(guard.order))
          );
          return;
        }
      } catch {
        /* best-effort */
      }
      if (!cancelled) timer = window.setTimeout(poll, 6000);
    };
    timer = window.setTimeout(poll, 6000);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [
    cart,
    orderSent,
    ticketDisplay,
    tabNumber,
    tableId,
    ticketOrderNumber,
    collectOrderRef,
    splitQueue.length,
    ordersRefreshToken,
    t,
  ]);

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
    if (ctx.isInvoice) {
      const counterTender = ['cash', 'card', 'terminal'].includes(payMethod);
      if (!counterTender) {
        payMethod = INVOICE_SETTLEMENT_METHOD;
      }
    } else {
      if (payMethod === 'pay_later' || payMethod === 'invoice') payMethod = 'cash';
      if (!['cash', 'card', 'terminal', 'bank_transfer'].includes(payMethod)) payMethod = 'cash';
    }
    const action = collectPaymentAction(ctx.status);
    setBusy(true);
    try {
      const res = await api.post(`/merchant/orders/${ctx.id}/action`, {
        action,
        paymentMethod: payMethod,
        skipReceiptPrint: true,
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
          items: cart.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            totalPrice: l.lineTotal,
            weightKg: l.isWeighed ? l.weightKg ?? l.quantity : undefined,
            courseNumber: l.courseNumber,
            selectedExtras: l.selectedExtras,
            comboSelections: l.comboSelections,
          })),
        };
      }
      try {
        const receiptPayload = posOrderToWebPosReceipt(orderForReceipt, {
          businessName: merchant?.name || APP_NAME,
          address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
          phone: merchant?.phone || undefined,
          vatNumber: merchant?.vatNumber || undefined,
          taxRate,
          merchantTax,
          vatIncludedInPrice,
          vatAfterDiscount,
          printSettings,
          panelLang: locale,
        });
        const payLines = payments
          .filter((p) => roundMoney2(p.amount) > 0)
          .map((p) => ({ method: p.method, amount: roundMoney2(p.amount) }));
        if (ctx.isPayLater) {
          const laterTender =
            payLaterCollectedTender(payMethod) ||
            (payMethod === 'card' || payMethod === 'terminal' ? payMethod : 'cash');
          receiptPayload.paymentMethod = `pay_later:${laterTender}`;
          receiptPayload.payLaterTender = laterTender;
          receiptPayload.payLaterCollected = true;
        } else if (payLines.length) {
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
        const invoiceCounter =
          ctx.isInvoice && ['cash', 'card', 'terminal'].includes(payMethod);
        const skipThermal =
          (ctx.isInvoice || isInvoiceOrder(orderForReceipt || {})) && !invoiceCounter;
        if (!skipThermal && shouldAutoPrintReceipt(printSettings)) {
          try {
            await printReceipt(receiptText, receiptPayload.receiptUrl, deliveryQrUrl);
          } catch (e: unknown) {
            notifyPrintError(e, 'webPosPrintFailed');
          }
        }
      } catch (e: unknown) {
        notifyPrintError(e, 'webPosPrintFailed');
      }
      setSuccessInfo({
        amount: ctx.total,
        changeDue: changeDue > 0 ? changeDue : null,
        orderNumber:
          guestOrderNumber({
            orderNumber: orderForReceipt?.orderNumber || ctx.orderNumber,
            orderDisplay: orderForReceipt?.ticketDisplay,
            tabNumber: orderForReceipt?.tabNumber,
          }) || null,
        paymentMethod: paymentMethodLabel(payMethod, t),
      });
      const heldId = resumedHeldIdRef.current;
      resumedHeldIdRef.current = null;
      const ticketShout =
        orderForReceipt?.ticketDisplay ||
        parseOrderMetaNotes(orderForReceipt?.notes || '').ticketDisplay ||
        ticketDisplay ||
        null;
      void releaseHeldOrder({
        heldId,
        ticketDisplay: ticketShout,
        tableId: orderForReceipt?.tableId || tableId,
        tabNumber: orderForReceipt?.tabNumber || tabNumber,
      });
      clearCollectCheckout();
      setOrdersRefreshToken((n) => n + 1);
      if (orderForReceipt && isPaidOrder(orderForReceipt)) dismissOdsForOrder(orderForReceipt);
      pushLocalPosOrderNotification(
        posSaleToNotificationOrder({
          id: String(orderForReceipt?.id || ctx.id),
          orderNumber: orderForReceipt?.orderNumber || ctx.orderNumber,
          total: ctx.total,
          customerName: orderForReceipt?.customerName || null,
          items: (orderForReceipt?.items || cart).map((item) => {
            const line = item as {
              name?: string;
              productName?: string | null;
              quantity?: string | number;
            };
            return {
              name: line.name || line.productName || '',
              quantity: Number(line.quantity || 1),
            };
          }),
        })
      );
      setPosView('success');
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentCollectFailed'));
      setPosView('checkout');
    } finally {
      setBusy(false);
    }
  };

  const openInvoicePdf = async (orderId: string) => {
    try {
      const res = await api.get(`/merchant/orders/${orderId}/invoice.pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error(t('webPosInvoicePdfFailed'));
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
      payLaterTender:
        primary?.method === 'pay_later' ? primary.payLaterTender : undefined,
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
    if (primary?.method === 'invoice' && !selectedCustomer) {
      toast.error(t('webPosInvoiceCustomerRequired'));
      setCustomerOpen(true);
      return;
    }
    setBusy(true);
    try {
      const saleMethod: PosPaymentMethod =
        !primary
          ? 'cash'
          : primary.method === 'pay_later'
          ? 'pay_later'
          : primary.method === 'invoice'
            ? 'invoice'
          : primary.method === 'gift_card'
            ? 'gift_card'
            : primary.method;
      if (!guardOfflineCheckout(saleMethod, { payments })) {
        return;
      }
      // Deduct gift balance after order exists (orderId links redeem → refund).
      await finalizeSale(saleMethod, undefined, undefined, extras, true, { payments });
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
      setSuccessInfo({
        amount: paidAmount,
        changeDue: 0,
        orderNumber:
          guestOrderNumber({
            orderNumber: splitReceiptsRef.current[0]?.orderNumber || lastReceiptOrderNumber,
          }) || null,
        paymentMethod: paymentMethodLabel(method, t),
      });
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
      /** Pay Later: one guest receipt only (first receipt printer). */
      singleTarget?: boolean;
    }
  ) => {
    const targets = printersForRole(printSettings, opts.role);
    const names = (
      targets.length > 0
        ? targets.map((x) => x.name)
        : [printerName || '']
    ).slice(0, opts.singleTarget ? 1 : undefined);
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
      opts.role === 'receipt' || opts.role === 'eod'
        ? printSettings?.receiptLogoUrl || merchant?.shopLogoUrl || paymentConfig?.shopLogoUrl
        : null;
    let logo: Uint8Array | null = null;
    if (logoUrl) {
      const logoWidth = resolveReceiptLogoWidthPx(printSettings, paper === 58 ? 58 : 80);
      const cacheKey = `${String(logoUrl)}|${paper}|${logoWidth}`;
      if (logoEscPosCacheRef.current?.key === cacheKey) {
        logo = logoEscPosCacheRef.current.bytes;
      } else {
        logo = await logoUrlToEscPos(String(logoUrl), logoWidth);
        logoEscPosCacheRef.current = { key: cacheKey, bytes: logo };
      }
    }
    const qr =
      opts.forceScannable ||
      (opts.role === 'receipt' && printSettings?.receiptShowQrCode !== false)
        ? opts.qrUrl
        : undefined;
    const barcode = opts.barcodeData || (opts.forceScannable ? opts.qrUrl : undefined);
    const lang = resolveReceiptLanguage(printSettings, locale);
    const escpos = await buildReceiptEscPos(text, {
      qrData: qr,
      deliveryQrData: opts.deliveryQrUrl,
      language: lang,
      logoBytes: logo,
      barcodeData: barcode,
      paperWidthMm: paper,
    });
    const dataBase64 = uint8ToBase64(escpos);

    let printedOk = 0;
    let queuedOk = 0;
    let lastOkName = '';
    for (const name of names) {
      const configured = (name || '').trim();
      const label =
        configured && printers.length > 0
          ? resolveAgentPrinterName(configured, printers) || ''
          : configured;
      if (!label) continue;
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
          retryLocally: printRetryLocally,
          jobKind: opts.role === 'kitchen' ? 'kitchen' : opts.role === 'eod' ? 'eod' : 'receipt',
          jobLabel:
            opts.role === 'eod'
              ? t('webPosPrintJobEod')
              : opts.role === 'kitchen'
                ? t('webPosPrintJobKitchen')
                : lastReceiptOrderNumber || t('webPosPrintJobReceipt'),
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

    if (opts.quiet) {
      if (queuedOk && !printedOk && !printRetryLocally) {
        toastPrintQueuedMainTill();
      }
      return;
    }
    if (queuedOk && !printedOk) {
      toastPrintQueuedMainTill();
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

  const printReceipt = async (
    receiptText: string,
    receiptUrl?: string,
    deliveryQrUrl?: string,
    opts?: { singleTarget?: boolean }
  ) => {
    await printEscPosToTargets(receiptText, {
      qrUrl: receiptUrl,
      deliveryQrUrl,
      role: 'receipt',
      quiet: true,
      singleTarget: opts?.singleTarget,
    });
  };

  const openSuccessPrint = () => {
    if (lastSplitReceipts.length > 1) {
      setPrintChooserOpen(true);
      return;
    }
    if (lastReceipt) {
      void printReceipt(lastReceipt, lastReceiptUrl || undefined, lastDeliveryQrUrl || undefined).catch(
        (e: unknown) => notifyPrintError(e, 'webPosPrintFailed')
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
    } catch (e: unknown) {
      notifyPrintError(e, 'webPosPrintFailed');
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
    } catch (e: unknown) {
      notifyPrintError(e, 'webPosPrintFailed');
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
      merchantTax,
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
    const lang = resolveReceiptLanguage(printSettings, locale);
    const text = generateRefundReceiptText(
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
        language: lang,
        paperWidthMm: printSettings?.paperWidthMm || 80,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
      },
      locale
    );
    await printEscPosToTargets(text, { role: 'receipt' });
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
      lineIds?: string[];
      /** Pay Later: kitchen only on dedicated kitchen printers, not the guest-receipt printer. */
      dedicatedKitchenOnly?: boolean;
    }
  ) => {
    if (isRetail) return;
    const filteredLines = (
      opts?.courseOnly != null
        ? lines.filter((l) => (l.courseNumber || 1) === opts.courseOnly)
        : lines
    ).filter((l) => !l.giftCard && !String(l.productId || '').startsWith('__gift_card_'));
    if (!filteredLines.length) return;

    const lang = resolveReceiptLanguage(printSettings, printSettings?.receiptLanguage === 'panel' ? locale : printSettings?.receiptLanguage || locale);
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
      orderNumber: opts?.orderNumber || kitchenOrderNumber({ allowNew: false }) || kitchenOrderNumber(),
      orderedAt: Date.now(),
      scheduledFor,
      userName,
      orderSource: 'WEBPOS' as const,
      itemTextScale: printSettings?.kitchenItemTextScale ?? 1,
      headerTextScale: printSettings?.kitchenHeaderTextScale ?? 1,
      boldText: printSettings?.kitchenBoldText === true,
      groupByCourse: coursesEnabled && !opts?.cancelled,
      maxCourse: courseCount,
      tableLabel: opts?.tableLabel !== undefined ? opts.tableLabel : tableLabel || null,
      tabNumber: opts?.tabNumber !== undefined ? opts.tabNumber : tabNumber || null,
      cancelled: !!opts?.cancelled,
      cancelReason: opts?.cancelReason || null,
    };
    if (kitchenOpts.orderNumber) lastKitchenTicketRef.current = kitchenOpts.orderNumber;

    // Kitchen display: push new sends; mark cancelled (red card) on void/cancel tickets.
    const ticketKey = kitchenOpts.orderNumber || kdsTicketKey;
    if (opts?.cancelled) {
      if (ticketKey) {
        void dismissKdsTicket(ticketKey);
        void dismissOrderFromOds(ticketKey);
      }
    } else {
      void pushCartLinesToKds({
        ticketKey,
        orderNumber: kitchenOpts.orderNumber,
        tableLabel: kitchenOpts.tableLabel,
        tabNumber: kitchenOpts.tabNumber,
        channel: saleChannel,
        lines: filteredLines,
      });
      if (kitchenOpts.orderNumber) {
        void pushOrderToOds({ orderNumber: kitchenOpts.orderNumber, status: 'preparing' });
      }
    }

    if (!shouldAutoPrintKitchen(printSettings) && !opts?.forcePrint && !opts?.cancelled) {
      return;
    }
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
    let queuedAny = false;
    const kitchenLabel = [
      kitchenOpts.orderNumber,
      kitchenOpts.tableLabel || kitchenOpts.tabNumber,
    ]
      .filter(Boolean)
      .join(' · ');
    const printMeta = {
      jobKind: 'kitchen' as const,
      jobLabel: kitchenLabel || t('webPosPrintJobKitchen'),
      lineIds: opts?.lineIds,
    };
    const printJobs = resolveKitchenPrintJobs(receiptItems, printSettings).filter(
      (j) => (j.printerName || '').trim()
    );
    const crossFooters = buildKitchenCrossStationFooters(printJobs);
    const otherStationLabel = t('kitchenOtherStationFooter');
    if (printJobs.length) {
      let printedAny = false;
      for (const job of printJobs) {
        const configuredName = (job.printerName || '').trim();
        const resolvedName =
          printers.length > 0
            ? resolveAgentPrinterName(configuredName, printers)
            : configuredName;
        if (!resolvedName) continue;
        printedAny = true;
        const paperWidthMm = job.paperWidthMm;
        const otherItems = crossFooters.get(configuredName) || [];
        const ticketOpts = {
          ...kitchenOpts,
          items: job.items,
          paperWidthMm,
          otherStationItems: otherItems.length ? otherItems : undefined,
          otherStationLabel: otherItems.length ? otherStationLabel : undefined,
        };
        const escpos = generateKitchenTicketEscPos(ticketOpts);
        const text = generateKitchenTicketText(ticketOpts);
        if (typeof console !== 'undefined' && console.info) {
          console.info(
            '[kitchen-print]',
            JSON.stringify({
              configured: configuredName,
              resolved: resolvedName,
              bytes: escpos.length,
            })
          );
        }
        const mode = await printKitchenViaAgentOrQueue({
          printerName: resolvedName,
          dataBase64: uint8ToBase64(escpos),
          text,
          orderId: opts?.orderNumber || null,
          retryLocally: printRetryLocally,
          printers,
          configuredName,
          ...printMeta,
        });
        if (mode === 'queued') queuedAny = true;
      }
      if (!printedAny) {
        toast.error(t('webPosNoKitchenPrinterConfigured'));
        return;
      }
      setPrinterDisconnected(false);
      if (queuedAny) toastPrintQueuedMainTill();
      return;
    }

    if (opts?.dedicatedKitchenOnly) return;

    toast.error(t('webPosNoKitchenPrinterConfigured'));
    return;
  };

  const retryKitchenPrint = async (lines: CartLine[]) => {
    if (!lines.length || isRetail) return;
    setKitchenPrintRetryBusy(true);
    try {
      const ticket = ensureCartTicket();
      await printKitchenForCart(lines, effectiveChannel, {
        orderNumber: kitchenOrderNumber({ ticket }),
        when: fulfillmentWhen,
        forcePrint: true,
        lineIds: lines.map((l) => l.lineId),
      });
      setKitchenPrintFailedForLines(
        lines.map((l) => l.lineId),
        false
      );
    } catch (e: unknown) {
      handleKitchenPrintFailure(e, lines.map((l) => l.lineId));
      if (!hasKitchenRetryPending(lines.map((l) => l.lineId))) throw e;
    } finally {
      setKitchenPrintRetryBusy(false);
    }
  };

  const buildSalePayload = (
    clientId: string,
    method: PosPaymentMethod,
    whenOverride?: FulfillmentWhen | null,
    orderNumber?: string,
    extras?: CheckoutExtras | null,
    saleLines: CartLine[] = cart,
    saleTotals = activeSale.totals,
    splitMeta?: { masterOrderId?: string; splitCheckNumber?: number; splitPartCount?: number },
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
    const payLater = method === 'pay_later' || method === 'invoice';
    const when = whenOverride !== undefined ? whenOverride : fulfillmentWhen;
    const scheduledRaw = when?.mode === 'later' ? when.scheduledFor : null;
    const scheduledFor =
      scheduledRaw != null && scheduledRaw !== ''
        ? localDateTimeToIso(String(scheduledRaw)) || scheduledRaw
        : null;
    const memberName =
      attachedMembership?.customerName?.trim() || attachedMembership?.cardNumber || null;
    const custName = selectedCustomer
      ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
      : memberName ||
        (tableLabel && effectiveChannel !== 'dine_in' ? tableLabel : undefined);
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
    const fulfillmentStatus = posSaleFulfillmentStatus({
      channel: effectiveChannel,
      payLater,
      scheduledFor,
    });
    const giftCardPaid = tenders
      .filter((p) => p.method === 'gift_card')
      .reduce((s, p) => s + p.amount, 0);
    const pointsRedeemed = extras?.pointsRedeemed || 0;
    const pointsDiscount = extras?.pointsDiscount || 0;
    const paidSubtotal = roundMoney2(
      Math.max(0, merchandiseGross - discountAmount - pointsDiscount - giftCardPaid)
    );
    const pointsEarned =
      attachedMembership?.membershipEnabled && !payLater
        ? computeEarnPoints(paidSubtotal, loyaltyEarnRate)
        : 0;
    const pointsBalance =
      attachedMembership?.membershipEnabled
        ? Math.max(0, attachedMembership.pointsBalance - pointsRedeemed + pointsEarned)
        : null;
    return {
      clientId,
      orderNumber,
      paymentMethod: resolvedMethod,
      paymentBreakdown: tenders.length ? tenders : undefined,
      paymentStatus: payLater ? 'awaiting_payment' : 'completed',
      status: fulfillmentStatus,
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
      channel: effectiveChannel,
      completedAt: fulfillmentStatus === 'completed' ? Date.now() : undefined,
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
      splitPartCount: splitMeta?.splitPartCount ?? null,
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
      pointsEarned,
      pointsRedeemed,
      pointsDiscount,
      pointsBalance,
      notes: encodeOrderMetaNotes({
        existing: [
          roundingAmount
            ? `Rounding ${roundingAmount > 0 ? '+' : ''}${roundingAmount.toFixed(2)}`
            : '',
          tipAmount > 0 ? `Tip CHF ${tipAmount.toFixed(2)}` : '',
          pointsDiscount > 0
            ? `Points −CHF ${pointsDiscount.toFixed(2)} (${pointsRedeemed} pts)`
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
        memberName: attachedMembership ? memberName : null,
        pointsEarned,
        pointsBalance,
      }),
      items: saleLines.map((l) => {
        const pid = String(l.productId || '');
        const validProductId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          pid
        )
          ? pid
          : undefined;
        return {
          productClientId: l.productId,
          productId: validProductId,
          productName: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          totalPrice: l.lineTotal,
          weightKg:
            l.isWeighed && l.weightKg != null && Number.isFinite(Number(l.weightKg))
              ? l.weightKg
              : l.isWeighed
                ? l.quantity
                : undefined,
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
        };
      }),
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
    if (!collectOrderRef && !(await guardCartCheckout())) return;
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
        ? {
            masterOrderId: splitMasterIdRef.current,
            splitCheckNumber: splitIndex + 1,
            splitPartCount: splitQueue.length,
          }
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
        method !== 'pay_later' &&
        method !== 'invoice'
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
      ? clientId
      : (await resolvePublishedReceiptRef(
          backendOrderId,
          clientId,
          ticket.orderNumber || lastReceiptOrderNumber
        )) ||
        backendOrderId ||
        clientId;
    const receiptUrl = buildReceiptUrl(receiptRef);
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
      tabNumber: tabSnapshot || undefined,
      completedAt: Date.now(),
      channel: effectiveChannel,
      paymentMethod: method,
      payLaterTender: method === 'pay_later' ? extrasWithDisc?.payLaterTender || null : undefined,
      paymentLines: extrasWithDisc?.tenders?.length
        ? extrasWithDisc.tenders.map((p) => ({
            method: p.method,
            amount: roundMoney2(p.amount),
          }))
        : undefined,
      amountTendered: extrasWithDisc?.amountTendered ?? null,
      changeDue: extrasWithDisc?.changeDue ?? null,
      customerName: sale.customerName || undefined,
      memberName: attachedMembership
        ? attachedMembership.customerName?.trim() ||
          attachedMembership.cardNumber ||
          sale.customerName ||
          null
        : null,
      loyaltyPointsEarned: sale.pointsEarned != null && sale.pointsEarned > 0 ? sale.pointsEarned : null,
      loyaltyPointsBalance:
        attachedMembership?.membershipEnabled && sale.pointsBalance != null
          ? sale.pointsBalance
          : sale.pointsBalance ?? null,
      customerPhone: sale.customerPhone || undefined,
      shippingAddress: effectiveChannel === 'delivery' ? shipAddr : undefined,
      tableLabel,
      items: saleLines.map((l) =>
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
      ),
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
      includeQr: printSettings?.receiptShowQrCode !== false,
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
    if (method !== 'pay_later' && method !== 'invoice') {
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
    const nextSplitNum = splitIndex + 2;
    if (moreSplits) {
      const paidPart = splitQueue[splitIndex];
      const isItemSplit =
        !!paidPart &&
        (paidPart.lineIds.length > 0 ||
          (paidPart.lineQtys && Object.keys(paidPart.lineQtys).length > 0));
      const remainingCart = isItemSplit
        ? removePaidSplitLines(cartSnapshot, paidPart)
        : cartSnapshot;
      if (isItemSplit) {
        setCart(remainingCart);
      }
      if (remainingCart.length > 0) {
        try {
          await persistHeldOrder(
            remainingCart,
            orderSent || remainingCart.some((l) => l.sentToKitchen),
            { ticket }
          );
        } catch (heldErr) {
          console.warn('[WebPOS] held persist after split payment failed', heldErr);
        }
      }
      setSplitIndex((i) => i + 1);
      setCheckoutSeedMethod('cash');
      setPosView('checkout');
    }
    if (!moreSplits) {
      const payLaterSale = method === 'pay_later' || method === 'invoice';
      if (!payLaterSale) {
        const odsNums = new Set<string>();
        const display = ticket.display?.trim();
        if (display) odsNums.add(display);
        const kitchenNum = kitchenOrderNumber({ ticket, allowNew: false });
        if (kitchenNum) odsNums.add(kitchenNum);
        const tab = tabOrderShout(tabNumber);
        if (tab) odsNums.add(kitchenTicketKeyBase(tab));
        for (const num of odsNums) void dismissOrderFromOds(num);
      }
      const paidKeys = [
        openCartDraftKey({ tableId, tabNumber, channel }),
        openCartDraftKey({ ticketDisplay: ticket.display, channel: effectiveChannel }),
      ];
      for (const paidKey of paidKeys) openCartDraftsRef.current.delete(paidKey);
      const heldId = resumedHeldIdRef.current;
      resumedHeldIdRef.current = null;
      void releaseHeldOrder({
        heldId,
        ticketDisplay: ticket.display,
        tableId,
        tabNumber,
      });
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
      setCourseCount(1);
      setOrderSent(false);
      setCoursesBulkSent(false);
      setChannel(null);
      setMobileCartOpen(false);
      clearAttachedMembership();
      clearAttachedGiftCard();
      clearPersistedWebPosCarts();
      terminalPaymentRef.current = null;
      if (method !== 'pay_later' && method !== 'invoice') {
        setLastSplitReceipts([...splitReceiptsRef.current]);
      } else {
        splitReceiptsRef.current = [];
        setLastSplitReceipts([]);
      }
    }
    setCheckoutExtras(null);
    setCheckoutOpen(moreSplits);
    const payLater = method === 'pay_later' || method === 'invoice';
    const paidTotal = sale.total;
    const splitPaidTotal = roundMoney2(
      splitReceiptsRef.current.reduce((s, p) => s + p.amount, 0)
    );
    if (showSuccessScreen && !payLater && !moreSplits) {
      setSuccessInfo({
        amount: splitReceiptsRef.current.length > 1 ? splitPaidTotal : paidTotal,
        changeDue: extras?.changeDue ?? null,
        orderNumber:
          guestOrderNumber({
            orderNumber: ticket.orderNumber,
            orderDisplay: ticket.display,
          }) || null,
        paymentMethod: paymentMethodLabel(method, t),
      });
      setPosView('success');
      setExpressSuccessOpen(false);
    } else if (!showSuccessScreen || payLater || moreSplits) {
      toast.success(
        method === 'invoice'
          ? t('webPosInvoiceCreated').replace('{number}', sale.orderNumber || '')
          : payLater
          ? t('webPosProgrammedSaved')
          : moreSplits
            ? t('webPosSplitNext').replace('{n}', String(nextSplitNum)).replace('{total}', String(splitQueue.length))
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
      method !== 'invoice' &&
      method !== 'pay_later' &&
      shouldAutoPrintReceipt(printSettings);
    // Offline sales have no published receipt URL yet — still print text via local Print Agent.
    if (shouldPrintReceipt) {
      // Never hold checkout/busy on the print agent.
      void printReceipt(receiptText, receiptUrl, deliveryQrUrl, {
        singleTarget: method === 'pay_later',
      }).catch((e: unknown) => {
        notifyPrintError(e, 'webPosPrintFailed');
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
        lineIds: kitchenDelta.map((l) => l.lineId),
        dedicatedKitchenOnly: method === 'pay_later',
      }).catch((e: unknown) => {
        handleKitchenPrintFailure(e, kitchenDelta.map((l) => l.lineId));
      });
    }
    if (method === 'invoice' && backendOrderId) {
      void openInvoicePdf(backendOrderId);
    }
    if (!payLater && !moreSplits) {
      pushLocalPosOrderNotification(
        posSaleToNotificationOrder({
          id: backendOrderId || clientId,
          orderNumber: ticket.orderNumber || ticket.display || sale.orderNumber,
          total: paidTotal,
          customerName: sale.customerName,
          items: saleLines.map((line) => ({ name: line.name, quantity: line.quantity })),
        })
      );
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
    if ((scheduleChannel === 'delivery' || method === 'invoice') && !selectedCustomer) {
      if (method === 'invoice' && !selectedCustomer) {
        toast.error(t('webPosInvoiceCustomerRequired'));
      }
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
    if (!(await guardCartCheckout())) return;
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
      await finalizeSale(adjusted.method, undefined, undefined, adjusted, true);
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
      setMobileCartOpen(false);
      toast.success(sendToKitchen ? t('webPosHeldSentKitchen') : t('webPosOrderHeld'));
      if (sendToKitchen) {
        const kitchenDelta = unsentKitchenLines(cartSnapshot);
        if (kitchenDelta.length) {
          void printKitchenForCart(kitchenDelta, channelSnapshot, {
            orderNumber: kitchenOrderNumber({ ticket }),
            when: whenSnapshot,
            tabNumber: tabSnapshot,
            tableLabel: tableLabelSnapshot,
            lineIds: kitchenDelta.map((l) => l.lineId),
          }).catch((e: unknown) => {
            handleKitchenPrintFailure(e, kitchenDelta.map((l) => l.lineId));
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
  /** A staff PIN session still overrides owner JWT. Owner on the till without clock-in keeps manager perms. */
  const canPay =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'PROCESS_PAYMENTS', false));
  const canDrawer =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'OPEN_CASH_DRAWER', false));
  const canCancelOrders =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'CANCEL_ORDERS', false));
  const canRefundOrders =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'REFUND_ORDERS', false));
  const canApplyDiscounts =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'APPLY_DISCOUNTS', false));
  const canViewReports =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff &&
      (hasPermission(staffPerms, 'VIEW_REPORTS', false) ||
        hasPermission(staffPerms, 'END_OF_DAY', false)));
  const canOpenPanel =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'ACCESS_PANEL', false));
  const canManageProducts = ownerOnRegister
    ? hasPermission(authUser?.permissions as Permission[] | undefined, 'MANAGE_PRODUCTS', true)
    : staffConfigured
      ? !!webposStaff && hasPermission(staffPerms, 'MANAGE_PRODUCTS', false)
      : hasPermission(authUser?.permissions as Permission[] | undefined, 'MANAGE_PRODUCTS', jwtIsOwner);
  const canViewOrders =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'VIEW_ORDER_HISTORY', false));
  const canShowBackOffice = canOpenPanel || canManageProducts || canViewOrders;
  const canManageOnlineShop = ownerOnRegister
    ? hasPermission(authUser?.permissions as Permission[] | undefined, 'MANAGE_ONLINE_SHOP', true) ||
      hasPermission(authUser?.permissions as Permission[] | undefined, 'MANAGE_SETTINGS', true)
    : staffConfigured
      ? !!webposStaff &&
        (hasPermission(staffPerms, 'MANAGE_ONLINE_SHOP', false) ||
          hasPermission(staffPerms, 'MANAGE_SETTINGS', false))
      : hasPermission(authUser?.permissions as Permission[] | undefined, 'MANAGE_ONLINE_SHOP', jwtIsOwner) ||
        hasPermission(authUser?.permissions as Permission[] | undefined, 'MANAGE_SETTINGS', jwtIsOwner);
  const canViewAllSales =
    ownerOnRegister ||
    !staffConfigured ||
    (!!webposStaff && hasPermission(staffPerms, 'VIEW_ALL_SALES', false));
  /** Whole-day EOD: report permission + company-wide sales visibility. */
  const showEodButton = canPrintEodReport;

  const printEodAfterShiftClose = async (opts?: { includeProductsSold?: boolean }) => {
    if (mayPrintWholeDayEod) {
      await printDayEodFromShiftClose(opts);
      return;
    }
    await printTodayEod(undefined, undefined, opts);
  };

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
      notifyPrintError(e, 'webPosDrawerFailed');
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

  const changePosLanguage = async (lang: Locale) => {
    setLocale(lang);
    try {
      await api.put('/merchant/settings', { panelLanguage: lang });
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('failedSaveLanguage'));
    }
  };

  const toggleShopEnabled = async (next: boolean) => {
    const prev = !!merchant?.shopEnabled;
    setMerchant((m: any) => (m ? { ...m, shopEnabled: next } : m));
    setChannelsSaving(true);
    try {
      await api.put('/merchant/settings', { shopEnabled: next });
      toast.success(t('onlineShopSaved'));
    } catch (e: any) {
      setMerchant((m: any) => (m ? { ...m, shopEnabled: prev } : m));
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setChannelsSaving(false);
    }
  };

  const toggleReservationsEnabled = async (next: boolean) => {
    const prev = !!merchant?.reservationsEnabled;
    setMerchant((m: any) => (m ? { ...m, reservationsEnabled: next } : m));
    setChannelsSaving(true);
    try {
      await api.put('/merchant/reservations/config', { enabled: next });
      toast.success(t('saved'));
    } catch (e: any) {
      setMerchant((m: any) => (m ? { ...m, reservationsEnabled: prev } : m));
      toast.error(e.response?.data?.error || t('resellerSaveFailed'));
    } finally {
      setChannelsSaving(false);
    }
  };

  const changePosTerminal = async (terminalId: string) => {
    setSelectedTerminalId(terminalId);
    persistTerminalId(terminalId, webposStaff?.id);
    if (webposStaff?.id) {
      try {
        await api.put('/merchant/pos/staff-preferences', {
          preferredTerminalId: terminalId || null,
        });
      } catch {
        /* local fallback kept */
      }
    }
  };

  const onStaffPinSuccess = async (staff: {
    id: string;
    name: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    accessToken?: string;
    preferredTerminalId?: string | null;
  }) => {
    const session: WebPosStaffSession = {
      id: staff.id,
      name: staff.name,
      roleId: staff.roleId,
      roleName: staff.roleName,
      permissions: staff.permissions as Permission[],
      accessToken: staff.accessToken,
    };
    setPosAuthAlert(null);
    clearPosSessionLocal();
    clearWebPosStaffSession();
    const reg = await registerPosSession({
      sessionKind: 'main',
      platform: 'webpos',
      staffId: session.id,
      staffName: session.name,
    });
    if (!reg.ok) {
      const schemaLag = /Failed query|does not exist|location_id|pos_sessions/i.test(
        reg.error || ''
      );
      if (!schemaLag) {
        setPosAuthAlert({
          title: t('webPosPinErrorTitle'),
          message: reg.error || t('webPosSessionRegisterFailed'),
          variant: 'error',
        });
        setPinModalMode('gate');
        setPinModalOpen(true);
        return;
      }
      console.warn('[webpos] session register skipped (schema):', reg.error);
    }
    setWebposStaff(session);
    saveWebPosStaffSession(session);
    notifyWebPosStaffSessionChanged();
    if (reg.ok && reg.kickedSessionIds.length > 0) {
      toast.info(t('webPosSessionReclaimed'));
    }
    setPinModalOpen(false);
    toast.success(t('webPosSignedInAs').replace('{name}', staff.name));
    if (isDeliveryDriverOnlyStaff(session.permissions, false)) {
      navigate(deliveryDriverHomePath(), { replace: true });
      return;
    }
    if (paymentConfig?.terminals?.length) {
      const terminalId = resolveActiveTerminalId(paymentConfig.terminals, {
        preferred: staff.preferredTerminalId,
        defaultId: paymentConfig.defaultTerminalId,
        stored: readStoredTerminalId(staff.id),
      });
      if (terminalId) {
        setSelectedTerminalId(terminalId);
        persistTerminalId(terminalId, staff.id);
      }
    }
    void refreshCurrentShift();
  };

  const openSwitchUserPin = () => {
    if (!staffConfigured) return;
    setPinModalMode('switch');
    setPinModalOpen(true);
  };

  const dismissSetPinHint = () => {
    setSetPinHintDismissed(true);
    try {
      sessionStorage.setItem(WEBPOS_SET_PIN_HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const openSetStaffPin = () => {
    dismissSetPinHint();
    window.dispatchEvent(new CustomEvent('webpos:show-panel'));
    navigate('/merchant/settings?tab=users');
  };

  const findProductByScanCode = useCallback(
    (code: string): Product | null => {
      const q = code.trim();
      if (!q) return null;
      const lower = q.toLowerCase();
      const digits = q.replace(/\s/g, '');
      return (
        products.find((p) => {
          const barcode = String(p.barcode || '').trim();
          const sku = String(p.sku || '').trim();
          if (barcode && (barcode === q || barcode === digits || barcode.toLowerCase() === lower)) {
            return true;
          }
          if (sku && sku.toLowerCase() === lower) return true;
          return false;
        }) || null
      );
    },
    [products]
  );

  const handlePosScan = useCallback(
    async (code: string) => {
      if (pinGateRequired || pinModalOpen) return;
      const onCheckout = posView === 'checkout';
      if (posView !== 'register' && !onCheckout) return;
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
        manualTableOpen ||
        cancelModal ||
        expressSuccessOpen
      ) {
        return;
      }
      if (!isWebPosCurrentlyOffline()) {
        try {
          const found = await lookupPosCard(code);
          if (found) {
            if (found.kind === 'membership') {
              attachMembershipCard(found.membership);
            } else {
              applyScannedGiftCard(found.membership);
            }
            return;
          }
        } catch (e: any) {
          if (e.response?.status !== 404) {
            toast.error(e.response?.data?.error || e.message || t('webPosMembershipLookupFailed'));
            return;
          }
        }
      }
      if (onCheckout) {
        toast.error(t('webPosBarcodeNotFound').replace('{code}', code));
        return;
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
    // onProductClick / attach helpers are stable enough for scan
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
      manualTableOpen,
      cancelModal,
      expressSuccessOpen,
      findProductByScanCode,
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
      if (pinGateRequired || pinModalOpen || (posView !== 'register' && posView !== 'checkout'))
        return;
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
    invoice: (paymentConfig?.methods.invoice !== false) && canPay,
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

  const configuredPrinterNames = useMemo(() => {
    const names = new Set<string>();
    if (printerName.trim()) names.add(printerName.trim());
    for (const p of printSettings?.printers || []) {
      if (p.enabled === false) continue;
      const n = (p.name || '').trim();
      if (n) names.add(n);
    }
    return [...names];
  }, [printerName, printSettings]);

  const printerNameMissing =
    printersReady &&
    configuredPrinterNames.some((n) => isConfiguredPrinterMissing(n, printers, { agentOk }));

  const printerMissing = printerDisconnected || printerNameMissing;

  const notificationOrders = useMemo(() => {
    const online = onlineOrders.filter((o) => unactionedOrderIdsRef.current.has(o.id));
    const local = localPosOrderAlerts.filter((o) => localPosOrderIdsRef.current.has(o.id));
    const seen = new Set<string>();
    return [...local, ...online].filter((order) => {
      if (seen.has(order.id)) return false;
      seen.add(order.id);
      return true;
    });
  }, [onlineOrders, unactionedOrderCount, localPosOrderAlerts, localPosOrderCount]);

  const pendingReservationAlerts = useMemo(
    () =>
      [...unactionedReservationIdsRef.current]
        .map((id) => reservationAlertById[id])
        .filter((row): row is WebPosReservationAlert => !!row),
    [reservationAlertById, unactionedReservationCount]
  );

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
        data-phone={isPhoneViewport ? '1' : '0'}
        data-grid-step={isPhoneViewport ? String(gridMobileLayout) : undefined}
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
          <>
            <WebPosBlockingAlert
              open={!!posAuthAlert}
              title={posAuthAlert?.title}
              message={posAuthAlert?.message || ''}
              variant={posAuthAlert?.variant || 'error'}
              onDismiss={() => setPosAuthAlert(null)}
              minMs={posAuthAlert?.variant === 'warning' ? 4000 : 8000}
            />
            <WebPosPinModal
              open
              mode="gate"
              onClose={() => {
                /* gate cannot be dismissed without PIN */
              }}
              onSuccess={onStaffPinSuccess}
            />
          </>
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
  const checkoutKitchenNumber =
    tabOrderShout(tabNumber) || ticketDisplay?.trim() || null;
  const checkoutOrderRef = formatCheckoutOrderRef(
    collectOrderRef?.orderNumber || ticketOrderNumber,
    checkoutKitchenNumber,
    tabNumber
  );

  const onlinePendingCount = unactionedOrderCount;
  const notificationCount =
    unactionedOrderCount +
    localPosOrderCount +
    (reservationsPosUiEnabled ? unactionedReservationCount : 0);
  const orderAlertRing = unactionedOrderCount > 0;
  const reservationAlertRing = reservationAlertUntil > Date.now();
  const currentNewOrderAlert = newOrderAlertQueue[0] ?? null;
  const newOrderAlertAcknowledgeOnly =
    deliveryAutoAccept &&
    !!currentNewOrderAlert &&
    !isAwaitingApproval(currentNewOrderAlert.status);

  const tableBadge =
    tableLabel || tabNumber
      ? [tableLabel, tabNumber ? `#${tabNumber}` : ''].filter(Boolean).join(' · ')
      : null;

  const onPosTabChange = (tab: PosTab) => {
    if (tab === 'tables' || tab === 'orders' || tab === 'bookings' || tab === 'delivery') {
      saveOpenCartDraft();
    }
    setMobileCartOpen(false);
    setSelectedLineId(null);
    setPosTab(tab);
    setPosView(tab);
    if (tab === 'tables') {
      setTablesRefreshToken((n) => n + 1);
    }
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
      data-phone={isPhoneViewport ? '1' : '0'}
      data-grid-step={isPhoneViewport ? String(gridMobileLayout) : undefined}
    >
      {reservationAlertUntil > Date.now() ? (
        <div
          className="shrink-0 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950 animate-pulse"
          role="status"
        >
          {t('webPosNewReservationAlert')}
        </div>
      ) : null}
      {staffPinsKnown && !staffConfigured && !setPinHintDismissed ? (
        <div
          className="shrink-0 flex items-center justify-between gap-3 border-b border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-950"
          role="status"
        >
          <p>{t('webPosSetPinHint')}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800"
              onClick={openSetStaffPin}
            >
              {t('webPosSetPinAction')}
            </button>
            <button
              type="button"
              className="text-xs font-medium text-teal-800 underline"
              onClick={dismissSetPinHint}
            >
              {t('webPosSetPinDismiss')}
            </button>
          </div>
        </div>
      ) : null}
      <WebPosTopBar
        activeTab={posTab}
        posView={posView}
        onTabChange={onPosTabChange}
        merchantName={merchant?.name || t('webPosStore')}
        agentOk={agentOk}
        printerMissing={printerMissing}
        agentOutdated={agentOutdated}
        isLocalPrintStation={isLocalPrint}
        mainTillOnline={mainTillOnline}
        mainTillPrintAgentOnline={mainTillPrintAgentOnline}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => {
          const product = findProductByScanCode(search);
          if (product) {
            onProductClick(product);
            setSearch('');
          }
        }}
        showSearch={posView === 'register'}
        onlinePendingCount={onlinePendingCount}
        notificationCount={notificationCount}
        orderAlertRing={orderAlertRing}
        reservationPendingCount={reservationPendingCount}
        reservationAlertRing={reservationAlertRing}
        staffName={webposStaff?.name || (jwtIsOwner ? authUser?.name : undefined)}
        canDrawer={canDrawer}
        appMode={appMode}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onCloseSettings={() => setSettingsOpen(false)}
        settingsRef={settingsRef}
        onOnlineOrders={() => openOnlineOrdersInTab()}
        notificationsOpen={notificationsOpen}
        onToggleNotifications={() => {
          setNotificationsOpen((open) => {
            const next = !open;
            if (next && settingsOpen) setSettingsOpen(false);
            return next;
          });
        }}
        onCloseNotifications={() => setNotificationsOpen(false)}
        notificationsRef={notificationsRef}
        notificationsPanel={
          <WebPosNotificationsPanel
            orders={notificationOrders}
            reservations={pendingReservationAlerts}
            showBookings={reservationsPosUiEnabled}
            onOpenOrder={(orderId) => {
              setNotificationsOpen(false);
              const isLocalPosOrder = localPosOrderIdsRef.current.has(orderId);
              openOnlineOrdersInTab(orderId, isLocalPosOrder ? 'all' : 'online');
              markOnlineOrderActioned(orderId);
            }}
            onOpenBookings={() => {
              setNotificationsOpen(false);
              markReservationActioned();
              setPosTab('bookings');
              setPosView('bookings');
            }}
            onViewAllOrders={() => {
              setNotificationsOpen(false);
              openOnlineOrdersInTab();
            }}
          />
        }
        onSwitchUser={openSwitchUserPin}
        onOpenDrawer={() => void openCashDrawer()}
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
        hideBookingsTab={!reservationsPosUiEnabled}
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
            canShowPanel={canShowBackOffice}
            appMode={appMode}
            onShowPanel={() => {
              setSettingsOpen(false);
              showPanelMenus();
            }}
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
            locale={locale}
            onLanguageChange={(lang) => void changePosLanguage(lang)}
            canManageChannels={canManageOnlineShop}
            shopEnabled={!!merchant?.shopEnabled}
            reservationsEnabled={!!merchant?.reservationsEnabled}
            channelsSaving={channelsSaving}
            onShopEnabledChange={
              canManageOnlineShop ? (enabled) => void toggleShopEnabled(enabled) : undefined
            }
            onReservationsEnabledChange={
              canManageOnlineShop && !isRetail
                ? (enabled) => void toggleReservationsEnabled(enabled)
                : undefined
            }
            onSendLogs={() => {
              setSettingsOpen(false);
              void sendWebPosLogsToSupport({
                locale,
                staffName: webposStaff?.name,
                staffRole: webposStaff?.roleName,
                merchantName: merchant?.name || merchant?.businessName,
              }).catch(() => undefined);
            }}
            terminalEnabled={enabledMethods.terminal}
            terminals={activeTerminals}
            selectedTerminalId={selectedTerminalId}
            onTerminalChange={(id) => void changePosTerminal(id)}
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
            orderRef={checkoutOrderRef || null}
            splitLabel={collectOrderRef ? null : activeSale.label}
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
              invoice: !collectOrderRef && enabledMethods.invoice,
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
              if (postSuccessTarget === 'tables') setTablesRefreshToken((n) => n + 1);
              setPosTab(postSuccessTarget);
              setPosView(postSuccessTarget);
            }}
          />
        ) : posView === 'tables' ? (
          <WebPosTablesView
            selectedTableId={tableId}
            draftTableIds={draftTableIds}
            tableHeldInfo={heldTableInfo}
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
            kitchenEnabled={kitchenEnabled}
            autoPrintReceipt={shouldAutoPrintReceipt(printSettings)}
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
              const meta = parseHeldCartJson(held.cartJson);
              const table = meta.tableId
                ? { id: meta.tableId, label: meta.tableLabel || '' }
                : undefined;
              if (
                applyHeldOrderFromRow(
                  {
                    id: held.id,
                    cartJson: held.cartJson,
                    status: held.status,
                    label: held.label,
                    updatedAt: held.updatedAt,
                    createdAt: held.createdAt,
                  },
                  table
                )
              ) {
                setOrdersRefreshToken((n) => n + 1);
                setPosTab('register');
                setPosView('register');
                requestAnimationFrame(() => blurPosInputs());
                toast.success(t('webPosOrderResumed'));
              } else {
                toast.error(t('webPosOrdersLoadFailed'));
              }
            }}
            onPrintOrder={async (order, splitLabel) => {
              try {
                await printPosOrderReceipt(order, splitLabel);
              } catch (e: any) {
                notifyPrintError(e, 'webPosPrintFailed');
              }
            }}
            onPrintRefund={async (payload) => {
              try {
                await printPosRefundReceipt(payload);
                toast.success(t('webPosSentDefaultPrinter'));
              } catch (e: any) {
                notifyPrintError(e, 'webPosPrintFailed');
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
              try {
                await printKitchenForCart(lines, ch, {
                  orderNumber: ticketDisplay,
                  cancelled: true,
                  cancelReason: reason,
                  forcePrint: true,
                  lineIds: lines.map((l) => l.lineId),
                });
              } catch (e: unknown) {
                handleKitchenPrintFailure(e, lines.map((l) => l.lineId));
              }
            }}
            onCollectPaymentCheckout={(order) => openOrderCollectCheckout(order, 'orders')}
            onLoadPosOrder={loadPosOrderToRegister}
            onOrderActioned={markOnlineOrderActioned}
            onOrderPaid={handleOrderPaidElsewhere}
            onlineOrders={onlineOrders}
            onRefreshOnline={() => void pollOnlineOrders()}
            onChannelFilterChange={(filter) => {
              if (filter === 'online') {
                setOrdersChannelPref('online');
              } else if (ordersChannelPref === 'online') {
                setOrdersChannelPref(null);
              }
            }}
            onOpenDeliveryHub={() => {
              setDeliveryHubOpen(true);
              setDeliveryHubMinimized(false);
            }}
            canSalesAdjust={canViewAllSales}
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
                onSelectCourse={handleSelectCourse}
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
                giftCardLabel={
                  attachedGiftCard
                    ? t('webPosGiftCardOnSale').replace(
                        '{amount}',
                        attachedGiftCard.balance.toFixed(2)
                      )
                    : null
                }
                onClearGiftCard={attachedGiftCard ? clearAttachedGiftCard : undefined}
                fulfillmentLabel={fulfillmentWhen?.label || null}
                fulfillmentIsLater={fulfillmentWhen?.mode === 'later'}
                busy={busy || paymentModalOpen}
                orderSent={orderSent}
                showNewOrder={showNewOrderButton}
                sendLabel={sendLabel}
                onCustomer={() => setCustomerOpen(true)}
                onSwitchToDineIn={switchToDineIn}
                onCourse={advanceCourse}
                onKitchenMessage={() => setKitchenMsgOpen(true)}
                onSetTable={() => setManualTableOpen(true)}
                onSetTab={() => setSetTabOpen(true)}
                onSend={() => void sendCoursesToKitchen()}
                onNewOrder={startNewOrder}
                onPayment={openRegisterCheckout}
                onCancelOrder={() => {
                  if (!canCancelOrders) {
                    toast.error(t('webPosCancelDenied'));
                    return;
                  }
                  if (!cart.length && !orderSent) {
                    void startNewOrder(true);
                    return;
                  }
                  if (!cart.length) return;
                  setCancelModal({ scope: 'order' });
                }}
                onCancelItem={() => {
                  if (!canCancelOrders) {
                    toast.error(t('webPosCancelDenied'));
                    return;
                  }
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
                canCancelOrder={
                  canCancelOrders && (cart.length > 0 || (!kitchenEnabled && !orderSent))
                }
                canCancelItem={
                  canCancelOrders &&
                  !!cart.find((l) => l.lineId === selectedLineId)?.sentToKitchen
                }
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
                onCashMovement={
                  shiftsEnabled && openShift
                    ? () => setCashMovementOpen(true)
                    : undefined
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
                failedPrintCount={unprintedJobCount}
                onOpenPrintIssues={() => setKitchenPrintIssuesOpen(true)}
                onOrderPrint={kitchenEnabled ? openOrderReprint : undefined}
                onLinePrint={kitchenEnabled ? openLineReprint : undefined}
                onLineCancel={
                  canCancelOrders && kitchenEnabled
                    ? (line) => setCancelModal({ scope: 'item', lineId: line.lineId })
                    : undefined
                }
                kdsReadyMap={kdsReadyMap}
                kdsTicketKeys={kdsCartTicketKeys}
                kitchenOrderLabel={
                  orderSent || cart.some((l) => l.sentToKitchen)
                    ? kitchenOrderNumber({ allowNew: false }) || null
                    : null
                }
                actionButtonSize={checkoutSettings.actionButtonSize}
              />
            </div>
            ) : null}

            {/* Products (mobile default). Hidden on narrow viewports while cart page is open. */}
            {(!isNarrowViewport || !mobileCartOpen) ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <WebPosProductArea
                categories={visibleCategories}
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
                mobileGridStep={gridMobileLayout}
                isPhoneLayout={isPhoneViewport}
                onCycleTileSize={() => {
                  if (isPhoneViewport) {
                    setGridMobileLayout((cur) => {
                      const next = ((cur + 1) % 3) as MobileGridLayoutStep;
                      try {
                        localStorage.setItem(WEBPOS_GRID_MOBILE_COLS_KEY, String(next));
                      } catch {
                        /* ignore */
                      }
                      return next;
                    });
                    return;
                  }
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
                actionButtonSize={checkoutSettings.actionButtonSize}
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
            notifyPrintError(e, 'webPosPrintFailed');
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
            notifyPrintError(e, 'webPosPrintFailed');
          } finally {
            setPrintChooserBusy(false);
          }
        }}
      />

      <WebPosKitchenPrintIssuesModal
        open={kitchenPrintIssuesOpen}
        jobs={pendingPrintJobs.filter((j) => j.exhausted || j.kind === 'kitchen')}
        lines={failedPrintLines}
        busy={kitchenPrintRetryBusy}
        money={money}
        onClose={() => {
          if (!kitchenPrintRetryBusy) setKitchenPrintIssuesOpen(false);
        }}
        onRetryJobs={async (jobIds) => {
          if (!jobIds.length) return;
          setKitchenPrintRetryBusy(true);
          try {
            const result = await reprintPrintJobs(jobIds);
            if (result.ok) toast.success(t('webPosPrintAutoRetryOk'));
            if (result.failed) notifyPrintError(t('webPosPrintFailed'), 'webPosPrintFailed');
          } finally {
            setKitchenPrintRetryBusy(false);
          }
        }}
        onDismissJobs={(jobIds) => {
          removePrintJobs(jobIds);
        }}
        onRetryLine={(line) => void retryKitchenPrint([line])}
        onRetryAll={async () => {
          setKitchenPrintRetryBusy(true);
          try {
            if (pendingPrintJobs.length) {
              const result = await reprintPrintJobs(pendingPrintJobs.map((j) => j.id));
              if (result.ok) toast.success(t('webPosPrintAutoRetryOk'));
              if (result.failed) notifyPrintError(t('webPosPrintFailed'), 'webPosPrintFailed');
            }
            const queuedLines = new Set(pendingPrintJobs.flatMap((j) => j.lineIds || []));
            const extra = failedPrintLines.filter((l) => !queuedLines.has(l.lineId));
            if (extra.length) {
              await retryKitchenPrint(extra);
            }
          } finally {
            setKitchenPrintRetryBusy(false);
          }
        }}
      />

      <WebPosReprintModal
        open={!!reprintModal}
        busy={reprintBusy}
        lineLabel={reprintModal?.lineLabel}
        onClose={() => {
          if (!reprintBusy) setReprintModal(null);
        }}
        onProvisional={async () => {
          setReprintBusy(true);
          try {
            await printProvisionalReceipt();
            setReprintModal(null);
          } catch (e: unknown) {
            notifyPrintError(e, 'webPosPrintFailed');
          } finally {
            setReprintBusy(false);
          }
        }}
        onKitchen={async () => {
          if (!reprintModal) return;
          setReprintBusy(true);
          try {
            const lines = cart.filter((l) => reprintModal.lineIds.includes(l.lineId));
            await retryKitchenPrint(lines.length ? lines : cart);
            setReprintModal(null);
          } catch {
            /* retryKitchenPrint already toasts */
          } finally {
            setReprintBusy(false);
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
          const tabChannel: Channel =
            channel === 'delivery' || channel === 'takeaway' ? channel : 'takeaway';
          const shout = tabOrderShout(tab);
          const key = openCartDraftKey({ tabNumber: tab, channel: tabChannel });
          const existing = openCartDraftsRef.current.get(key);
          if (existing) {
            applyOpenCartDraft(existing);
          } else {
            setTabNumber(tab);
            setTableId(null);
            setTableLabel(null);
            setChannel(tabChannel);
            setFulfillmentWhen(
              tabChannel === 'delivery' || tabChannel === 'takeaway'
                ? fulfillmentWhen || asapFulfillment()
                : asapFulfillment()
            );
            if (shout) {
              setTicketDisplay(shout);
              lastKitchenTicketRef.current = shout;
              if (!ticketOrderNumber) {
                setTicketOrderNumber(webPosBackendOrderId(merchant?.id));
              }
            } else if (!ticketDisplay) {
              ensureCartTicket();
            }
          }
        }}
      />
      <WebPosSetTabModal
        open={manualTableOpen}
        onClose={() => setManualTableOpen(false)}
        current={tableLabel}
        title={t('webPosSetTable')}
        onConfirm={(num) => {
          saveOpenCartDraft();
          setTableLabel(num);
          setTableId(null);
          if (channel !== 'dine_in') {
            setChannel('dine_in');
            setFulfillmentWhen(null);
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
        open={scaleFeatureEnabled && !!pendingWeighed}
        productName={pendingWeighed?.name || ''}
        pricePerKg={Number(pendingWeighed?.price) || 0}
        weightUnit={pendingWeighed?.weightUnit}
        configuredPort={printSettings?.scaleComPort}
        configuredDeviceName={printSettings?.scaleDeviceName}
        configuredDeviceId={printSettings?.scaleDeviceId}
        onPortResolved={healScalePort}
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
          const merch = merchandiseBase(fullTotals, vatIncludedInPrice);
          if (meta?.mode === 'percent') {
            setBillDiscount({ percent: Math.max(0, Math.min(100, meta.value)), amount: 0 });
          } else {
            setBillDiscount({
              percent: 0,
              amount: roundMoney2(Math.min(Math.max(0, amount), merch)),
            });
          }
          setBillDiscountOpen(false);
          if (amount > 0 || (meta?.value || 0) > 0) {
            toast.success(t('webPosBillDiscountApplied'));
          }
        }}
      />

      <WebPosPinModal
        open={pinModalOpen && (pinModalMode === 'switch' || !pinGateRequired)}
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
        acknowledgeOnly={newOrderAlertAcknowledgeOnly}
        onAcknowledge={acknowledgeNewOrderAlert}
        onAccept={newOrderAlertAcknowledgeOnly ? undefined : acceptFromNewOrderAlert}
        onReject={newOrderAlertAcknowledgeOnly ? undefined : rejectFromNewOrderAlert}
        onOpen={
          newOrderAlertAcknowledgeOnly
            ? undefined
            : (order) => openOnlineOrdersInTab(order.id)
        }
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

      {(deliveryHubOpen || deliveryHubMinimized) ? (
        <>
          <div
            className={`fixed inset-0 z-[240] flex flex-col bg-stone-100 ${
              deliveryHubMinimized ? 'pointer-events-none invisible' : ''
            }`}
            aria-hidden={deliveryHubMinimized}
          >
            <WebPosDeliveryHub
              merchant={merchant}
              printSettings={printSettings}
              hidden={deliveryHubMinimized}
              onMinimize={() => setDeliveryHubMinimized(true)}
              onClose={() => {
                setDeliveryHubOpen(false);
                setDeliveryHubMinimized(false);
              }}
            />
          </div>
          {deliveryHubMinimized ? (
            <button
              type="button"
              className="fixed bottom-4 right-4 z-[241] inline-flex items-center gap-2 rounded-full border border-teal-300 bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-teal-800"
              onClick={() => setDeliveryHubMinimized(false)}
            >
              <Truck size={18} aria-hidden />
              {t('deliveryHubRestore')}
              {onlinePendingCount > 0 ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                  {onlinePendingCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </>
      ) : null}

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

      <WebPosLogsModal
        open={logsOpen}
        autoSend={logsAutoSend}
        onClose={() => {
          setLogsOpen(false);
          setLogsAutoSend(false);
        }}
        diagnostics={{
          locale,
          staffName: webposStaff?.name,
          staffRole: webposStaff?.roleName,
          merchantName: merchant?.name || merchant?.businessName,
        }}
      />

      <WebPosOnboardingTour
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
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
          invoice: enabledMethods.invoice,
        }}
        initialMethod={checkoutSeedMethod}
        onClose={() => {
          setCheckoutOpen(false);
          setCustomerOpen(false);
          setPendingPayMethod(null);
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
        staffName={webposStaff?.name || (jwtIsOwner ? authUser?.name : undefined)}
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
        showEodPrint={canPrintEodReport}
        onPrintShift={(opts) => void printShiftReport(opts)}
        onPrintEod={(opts) => void printEodAfterShiftClose(opts)}
        onRestart={handleRestartShift}
        onStay={() => setShiftClosedOpen(false)}
        onLogout={handleStaffLogoutFromShiftClosed}
      />
    </div>
  );
}
