import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Ban,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Info,
  LayoutGrid,
  List,
  MoreHorizontal,
  Printer,
  RefreshCw,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  Undo2,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { downloadInvoicePdf, viewInvoicePdf } from '@/lib/invoice-pdf';
import { resolveOrderItemName } from '@/lib/order-item-name';
import { parseOrderMetaNotes, type PosOrderForReceipt } from '@/lib/webpos-receipt';
import {
  canAdminCollectPayment,
  canCancelPosAwaitingOrder,
  canCollectPayment,
  canMarkReadyOrder,
  canShowAwaitingPaymentBadge,
  showsKitchenFulfillmentStages,
  formatOrderPaymentDisplay,
  INVOICE_SETTLEMENT_METHOD,
  isAwaitingApproval,
  isAwaitingPaymentOrder,
  isInvoiceOrder,
  isOnlineShopOrder,
  isOpenWebPosOrder,
  isPaidOrder,
  isScheduledPosKitchenTicket,
  orderChannelBadgeClass,
  orderChannelBorderClass,
  orderChannelHeaderClass,
  orderListPrimaryLabel,
  orderStatusBadgeClass,
  orderStatusLabel,
} from '@/lib/order-management';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { collectPaymentAction } from '@/lib/order-to-cart';
import {
  localHeldRowsFromSession,
  parseHeldCartJson,
  removeLocalHeldDraft,
  resolveHeldChannel,
  sameHeldIdentity,
  ticketQueryMatches,
} from '@/lib/webpos-held';
import {
  fetchKdsBoardStatus,
  buildKdsReadyMap,
  fetchKdsTicketStatus,
  lineKitchenReady,
  type KdsBoardTicket,
} from '@/lib/kds-push';
import {
  kitchenProgressFromLines,
  kitchenTicketKeyBase,
  mergeKitchenProgress,
  resolveKitchenTicketKey,
} from '@/lib/kitchen-progress';
import type { CartLine } from '@/components/webpos/types';
import { hasTerminalPortion, parsePaymentBreakdown, paymentMethodLabel } from '@/lib/payment-breakdown';
import WebPosCancelModal from '@/components/webpos/WebPosCancelModal';
import WebPosRefundModal, {
  type RefundReasonOption,
} from '@/components/webpos/WebPosRefundModal';
import WebPosRefundPrintPromptModal from '@/components/webpos/WebPosRefundPrintPromptModal';
import OrderDetailTotals from '@/components/orders/OrderDetailTotals';
import OrderRefundHistory from '@/components/orders/OrderRefundHistory';
import WebPosOnlineOrdersView from '@/components/webpos/WebPosOnlineOrdersView';
import SecretSearchTapButton from '@/components/SecretSearchTapButton';
import GandolaPurgeToolbar from '@/components/GandolaPurgeToolbar';
import {
  isGandolaPurgeEligible,
  orderMatchesPaymentFilter,
} from '@/lib/gandola-purge';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import {
  mergeOrdersWithOnlineForAllFilter,
  onlineOrderAsPosOrder,
} from '@/lib/webpos-orders-merge';

function toMs(raw: string | number | Date | null | undefined): number {
  if (raw == null || raw === '') return 0;
  const n = new Date(raw as string | number | Date).getTime();
  return Number.isFinite(n) ? n : 0;
}

/** Newest activity first — prefer the later of created/completed. */
function orderTimeMs(o: PosOrderForReceipt & { completedAt?: string | number | Date | null; createdAt?: string | number | Date | null }) {
  return Math.max(toMs(o.completedAt), toMs(o.createdAt));
}

function heldTimeMs(h: { updatedAt?: string | null; createdAt?: string | null }) {
  return Math.max(toMs(h.updatedAt), toMs(h.createdAt));
}

function heldTicketKeys(h: HeldRow): string[] {
  const meta = parseHeldCartJson(h.cartJson);
  const keys = new Set<string>();
  const resolved = resolveKitchenTicketKey(meta);
  if (resolved) keys.add(resolved);
  const display = String(meta.ticketDisplay || '').trim();
  if (display) keys.add(kitchenTicketKeyBase(display));
  const kitchenKey = String(meta.kitchenTicketKey || '').trim();
  if (kitchenKey) keys.add(kitchenTicketKeyBase(kitchenKey));
  const tab = String(meta.tabNumber || '').trim();
  if (tab) keys.add(kitchenTicketKeyBase(tab.startsWith('#') ? tab : `#${tab}`));
  const orderNum = String(meta.ticketOrderNumber || '').trim();
  if (orderNum) keys.add(kitchenTicketKeyBase(orderNum));
  return [...keys];
}

/** Portaled menu so ⋮ actions are not clipped by the orders list scrollport. */
function PortaledActionMenu({
  anchor,
  align = 'right',
  onClose,
  children,
}: {
  anchor: HTMLElement | null;
  align?: 'left' | 'right';
  onClose: () => void;
  children: ReactNode;
}) {
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const menuH = 220;
      const openUp = r.bottom + menuH > window.innerHeight - 8;
      setStyle({
        position: 'fixed',
        top: openUp ? undefined : r.bottom + 4,
        bottom: openUp ? Math.max(8, window.innerHeight - r.top + 4) : undefined,
        left: align === 'right' ? undefined : Math.max(8, r.left),
        right: align === 'right' ? Math.max(8, window.innerWidth - r.right) : undefined,
        zIndex: 80,
        opacity: 1,
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, align]);

  if (!anchor || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] cursor-default bg-transparent"
        aria-label="close"
        onClick={onClose}
        onWheel={onClose}
        onTouchMove={onClose}
      />
      <div
        role="menu"
        style={style}
        className="min-w-[11rem] rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

function orderPublicRefs(o: PosOrderForReceipt & { notes?: string | null }) {
  const meta = parseOrderMetaNotes(o.notes);
  const ticketDisplay = o.ticketDisplay || meta.ticketDisplay || null;
  const tabNumber =
    o.tabNumber ||
    meta.tabNumber ||
    (o.guestCount != null && Number(o.guestCount) > 0 ? String(o.guestCount) : null);
  return { ticketDisplay, tabNumber };
}

type CancelReason = { id: string; en: string; fr: string; de: string };
export type PosOrder = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
  refundAmount: number;
  refundHistory?: Array<{
    id?: string;
    kind?: string;
    amount: number;
    reason?: string | null;
    staffName?: string | null;
    createdAt?: string | null;
    items?: Array<{ orderItemId?: string; productName?: string; quantity: number }>;
    allocation?: {
      giftCard?: number;
      cash?: number;
      terminal?: number;
      other?: number;
    } | null;
  }>;
  cancelReason?: string | null;
  notes?: string | null;
  masterOrderId?: string | null;
  /** pos | web_shop */
  orderType?: string | null;
  orderSource?: string | null;
  invoiceNumber?: string | null;
  scheduledFor?: string | number | Date | null;
};
export type HeldRow = {
  id: string;
  label?: string | null;
  status: string;
  channel?: string | null;
  cartJson: unknown;
  notes?: string | null;
  staffName?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};
type StatusFilter = 'active' | 'completed' | 'all' | 'held';
type ChannelFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery' | 'online';
type Props = {
  open: boolean;
  /** Full-width in-tab layout instead of slide-over overlay */
  embedded?: boolean;
  onClose: () => void;
  onResumeHeld: (held: HeldRow) => void;
  onPrintOrder?: (order: PosOrderForReceipt, splitLabel?: string | null) => Promise<void>;
  onPrintRefund?: (payload: {
    order: PosOrder;
    refunded: number;
    refundTotal: number;
    reason: string;
    allocation?: { giftCard?: number; cash?: number; terminal?: number; other?: number };
  }) => Promise<void>;
  terminalEnabled?: boolean;
  /** Print kitchen void ticket when cancelling a sent-to-kitchen held order */
  onVoidHeldKitchen?: (held: HeldRow, reason: string) => Promise<void>;
  refreshToken?: number;
  canCancel?: boolean;
  canRefund?: boolean;
  highlightOrderId?: string | null;
  /** Prefer opening on Online / Active when jumping from the bell panel */
  initialChannelFilter?: ChannelFilter | null;
  /** Open WebPOS checkout for unpaid orders instead of the quick collect modal */
  onCollectPaymentCheckout?: (order: PosOrder) => void;
  /** Load an open POS order back into the register (without opening checkout). */
  onLoadPosOrder?: (order: PosOrder) => void;
  /** Order handled (accept/reject/complete) — clear bell badge for this ticket */
  onOrderActioned?: (orderId: string) => void;
  /** Order paid/collected elsewhere — clear matching register cart */
  onOrderPaid?: (order: PosOrder) => void;
  /** Rich online order rows from /merchant/orders poll (Order Center view) */
  onlineOrders?: OnlineOrder[];
  onRefreshOnline?: () => void;
  /** Notify parent when channel filter changes (e.g. stop bell loop on online view) */
  onChannelFilterChange?: (filter: ChannelFilter) => void;
  /** Open full delivery management hub (map + drivers) */
  onOpenDeliveryHub?: () => void;
  /** Gandola role — five taps on search icon unlocks permanent cash order deletion */
  canGandolaPurge?: boolean;
  /** When true, poll KDS for per-line ready state on held kitchen tickets */
  kitchenEnabled?: boolean;
  /** Merchant Settings — auto-print receipt after collect payment */
  autoPrintReceipt?: boolean;
  /** Merchant tax mode — drives VAT breakdown in order detail */
  taxIncludedInPrice?: boolean;
  vatAfterDiscount?: boolean;
};

const PAYMENT_OPTIONS = ['cash', 'card', 'terminal', 'bank_transfer'] as const;

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}

/** In-store open ticket awaiting payment — show preview + load/collect, not instant checkout. */
function isOpenPosAwaitingOrder(o: PosOrder): boolean {
  return !isOnlineShopOrder(o) && isOpenWebPosOrder(o) && isAwaitingPaymentOrder(o);
}

/** Ongoing / kitchen / unpaid — not completed sales (POS cancel rules) */
function canCancelOrder(o: PosOrder): boolean {
  if (canCancelPosAwaitingOrder(o)) return true;
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status)) return false;
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(pay)) return false;
  return true;
}

function isUnpaidInvoice(o: PosOrder): boolean {
  if (!isInvoiceOrder(o)) return false;
  const pay = (o.paymentStatus || '').toLowerCase();
  return !['completed', 'paid', 'partially_refunded', 'cancelled'].includes(pay);
}

function matchesChannelFilter(
  o: { channel?: string | null; orderType?: string | null; cartJson?: unknown; paymentMethod?: string | null; invoiceNumber?: string | null },
  filter: ChannelFilter
) {
  if (filter === 'all') return true;
  if (filter === 'online') return isOnlineShopOrder(o as PosOrder);
  const ch =
    o.cartJson != null
      ? resolveHeldChannel({ channel: o.channel, cartJson: o.cartJson })
      : o.channel || (o as { fulfillmentChannel?: string | null }).fulfillmentChannel || 'takeaway';
  return ch === filter;
}

function canEditPayment(o: PosOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status) || ['cancelled', 'refunded'].includes(pay)) {
    return false;
  }
  return (
    status === 'completed' ||
    status === 'partially_refunded' ||
    pay === 'completed' ||
    pay === 'partially_refunded'
  );
}

/** Pay-later / awaiting_payment POS orders that still need collection at pickup. */
function isOpenOnlineFulfillment(o: PosOrder): boolean {
  if (!isOnlineShopOrder(o)) return false;
  const status = (o.status || '').toLowerCase();
  return !['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status);
}

function isUnpaidOnline(o: PosOrder): boolean {
  if (isPaidOrder(o)) return false;
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase();
  return (
    pay === 'awaiting_payment' ||
    method === 'pay_later' ||
    method === 'pay-later' ||
    method === 'invoice' ||
    pay === 'cash'
  );
}

function canRefundOrder(o: PosOrder): boolean {
  if (o.status === 'cancelled' || o.paymentStatus === 'cancelled') return false;
  const remaining = Number(o.total || 0) - Number(o.refundAmount || 0);
  if (remaining <= 0.001) return false;
  return (
    o.status === 'completed' ||
    o.status === 'partially_refunded' ||
    o.paymentStatus === 'completed' ||
    o.paymentStatus === 'paid' ||
    o.paymentStatus === 'partially_refunded'
  );
}

function channelBadgeClass(ch?: string | null) {
  return orderChannelBadgeClass({ channel: ch, orderType: 'pos' } as PosOrder);
}

function channelHeaderClass(ch?: string | null): string {
  return orderChannelHeaderClass({ channel: ch, orderType: 'pos' } as PosOrder);
}

function channelBorderClass(ch?: string | null): string {
  return orderChannelBorderClass({ channel: ch, orderType: 'pos' } as PosOrder);
}

function orderBadgeClass(o: PosOrder) {
  return orderChannelBadgeClass(o);
}

function orderHeaderClass(o: PosOrder) {
  return orderChannelHeaderClass(o);
}

function orderBorderClass(o: PosOrder) {
  return orderChannelBorderClass(o);
}

function isPlatformChannel(ch?: string | null) {
  if (!ch) return false;
  const c = ch.toLowerCase();
  return (
    c.includes('uber') ||
    c.includes('doordash') ||
    c.includes('deliveroo') ||
    c.includes('platform') ||
    c === 'web_shop' ||
    c === 'online'
  );
}

type ListItem =
  | { kind: 'held'; held: HeldRow }
  | { kind: 'order'; order: PosOrder };

function listItemTimeMs(item: ListItem): number {
  return item.kind === 'held' ? heldTimeMs(item.held) : orderTimeMs(item.order);
}

const PAGE_SIZE_LIST = 10;
const PAGE_SIZE_GRID = 24;
const ORDERS_VIEW_KEY = 'webpos_orders_view_v2';

type OrdersViewMode = 'list' | 'grid';

function readOrdersView(): OrdersViewMode {
  try {
    const stored = localStorage.getItem(ORDERS_VIEW_KEY);
    if (stored === 'list') return 'list';
    // Default: block/card grid
    return 'grid';
  } catch {
    return 'grid';
  }
}

function formatOrderAge(fromMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const days = Math.floor(sec / 86400);
  if (days >= 1) return `${days}d`;
  return `${Math.floor(sec / 3600)}h`;
}

function ChannelGlyph({ ch, order }: { ch?: string | null; order?: PosOrder }) {
  if (order && isOnlineShopOrder(order)) return <Store size={14} />;
  const c = (ch || '').toLowerCase();
  if (c === 'dine_in') return <UtensilsCrossed size={14} />;
  if (c === 'delivery') return <Truck size={14} />;
  if (c === 'takeaway') return <ShoppingBag size={14} />;
  return <Store size={14} />;
}

function KitchenProgressLabel({
  progress,
  kitchenEnabled,
}: {
  progress: { sent: number; ready: number; total: number };
  kitchenEnabled?: boolean;
}) {
  if (kitchenEnabled && progress.sent > 0) {
    return (
      <span className="inline-flex items-center justify-center gap-1">
        {progress.ready > 0 ? (
          <ChefHat className="h-3.5 w-3.5 text-amber-600" aria-hidden />
        ) : null}
        <span className="tabular-nums">
          {progress.ready}/{progress.sent}
        </span>
      </span>
    );
  }
  if (progress.sent > 0) {
    return (
      <span className="tabular-nums">
        {progress.sent}/{progress.total || progress.sent}
      </span>
    );
  }
  return <span className="tabular-nums">{progress.total}</span>;
}

export default function WebPosOrdersPanel({
  open,
  embedded = false,
  onClose,
  onResumeHeld,
  onPrintOrder,
  onPrintRefund,
  onVoidHeldKitchen,
  refreshToken = 0,
  canCancel = true,
  canRefund = true,
  terminalEnabled = false,
  highlightOrderId = null,
  initialChannelFilter = null,
  onCollectPaymentCheckout,
  onLoadPosOrder,
  onOrderActioned,
  onOrderPaid,
  onlineOrders = [],
  onRefreshOnline,
  onChannelFilterChange,
  onOpenDeliveryHub,
  canGandolaPurge = false,
  kitchenEnabled = true,
  autoPrintReceipt = true,
  taxIncludedInPrice,
  vatAfterDiscount = true,
}: Props) {
  const { t, formatDateTime, locale } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(
    () => initialChannelFilter || 'all'
  );
  const [search, setSearch] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [held, setHeld] = useState<HeldRow[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [refundReasons, setRefundReasons] = useState<RefundReasonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const [selectedHeld, setSelectedHeld] = useState<HeldRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [cancelFor, setCancelFor] = useState<PosOrder | null>(null);
  const [cancelHeldFor, setCancelHeldFor] = useState<HeldRow | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [refundFor, setRefundFor] = useState<PosOrder | null>(null);
  const [refundPrintPrompt, setRefundPrintPrompt] = useState<{
    order: PosOrder;
    refunded: number;
    refundTotal: number;
    reason: string;
    allocation?: { giftCard?: number; cash?: number; terminal?: number; other?: number };
  } | null>(null);
  const [refundPrintBusy, setRefundPrintBusy] = useState(false);
  const [paymentEditFor, setPaymentEditFor] = useState<PosOrder | null>(null);
  const [collectFor, setCollectFor] = useState<PosOrder | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);
  const [onlineActionBusy, setOnlineActionBusy] = useState<string | null>(null);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState('cash');
  const [page, setPage] = useState(0);
  const [ordersView, setOrdersView] = useState<OrdersViewMode>(() => readOrdersView());
  const highlightNavRef = useRef<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** Overflow menu for selected order (side detail breadcrumb) */
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  /** Row-level overflow menu order id */
  const [rowMenuOrderId, setRowMenuOrderId] = useState<string | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [detailMenuAnchor, setDetailMenuAnchor] = useState<HTMLElement | null>(null);
  const [purgeMode, setPurgeMode] = useState(false);
  const [purgePaymentFilter, setPurgePaymentFilter] = useState('cash');
  const [selectedPurgeIds, setSelectedPurgeIds] = useState<Set<string>>(() => new Set());
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [kdsReadyMap, setKdsReadyMap] = useState<Map<string, Set<string>>>(() => new Map());
  const [kdsByTicket, setKdsByTicket] = useState<
    Record<string, { ready: number; sent: number; readyLineIds: string[] }>
  >({});

  useEffect(() => {
    if (!open || !kitchenEnabled) return;
    let cancelled = false;
    const sync = async () => {
      const board = await fetchKdsBoardStatus();
      if (cancelled) return;
      setKdsReadyMap(buildKdsReadyMap(board));
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, refreshToken, kitchenEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_VIEW_KEY, ordersView);
    } catch {
      /* ignore */
    }
  }, [ordersView]);

  useEffect(() => {
    if (ordersView !== 'grid') return;
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [ordersView]);

  const paymentLabel = (method?: string | null) =>
    paymentMethodLabel(method || '', t) || '—';

  const statusLabel = (status: string) => orderStatusLabel(status, t);

  const channelLabel = (ch?: string | null, order?: PosOrder) => {
    if (order && isOnlineShopOrder(order)) return t('webPosOnlineOrders');
    if (!ch) return '·';
    if (ch === 'dine_in') return t('dineIn');
    if (ch === 'takeaway') return t('takeaway');
    if (ch === 'delivery') return t('delivery');
    if (isPlatformChannel(ch)) return t('webPosOnlineOrders');
    return ch;
  };

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const params = new URLSearchParams({ limit: '80', from: todayIso(), to: todayIso() });
    if (searchQ) params.set('q', searchQ);
    const heldPromise = api.get('/merchant/pos/held');
    const ordersPromise = api.get(`/merchant/pos/orders?${params.toString()}`);
    const invoicePromise = api.get('/merchant/invoices?status=unpaid&limit=200');
    const [heldRes, ordersRes, invoiceRes] = await Promise.allSettled([
      heldPromise,
      ordersPromise,
      invoicePromise,
    ]);
    let nextHeld: HeldRow[] = [];
    let nextOrders: PosOrder[] = [];
    if (heldRes.status === 'fulfilled') {
      nextHeld = heldRes.value.data.held || [];
    } else {
      toast.error(t('webPosOrdersLoadFailed'));
      console.warn('[WebPOS][orders] held list failed', heldRes.reason);
    }
    if (ordersRes.status === 'fulfilled') {
      nextOrders = ordersRes.value.data.orders || [];
      setReasons(ordersRes.value.data.cancelReasons || []);
      setRefundReasons(ordersRes.value.data.refundReasons || []);
    } else if (heldRes.status === 'fulfilled') {
      toast.error(t('webPosOrdersLoadFailed'));
      console.warn('[WebPOS][orders] pos orders list failed', ordersRes.reason);
    }
    if (invoiceRes.status === 'fulfilled') {
      const extra = (invoiceRes.value.data.invoices || []) as PosOrder[];
      const map = new Map(nextOrders.map((o) => [o.id, o]));
      for (const o of extra) {
        if (o?.id && !map.has(o.id)) map.set(o.id, o);
      }
      nextOrders = [...map.values()];
    }
    const localRows = localHeldRowsFromSession().filter((row): row is NonNullable<typeof row> => !!row);
    for (const local of localRows) {
      const ident = {
        ticketDisplay: local.cartJson.ticketDisplay,
        tableId: local.cartJson.tableId,
        tabNumber: local.cartJson.tabNumber,
      };
      const already = nextHeld.some((h) => {
        const meta = parseHeldCartJson(h.cartJson);
        return sameHeldIdentity(ident, {
          ticketDisplay: meta.ticketDisplay,
          tableId: meta.tableId,
          tabNumber: meta.tabNumber,
        });
      });
      if (!already) nextHeld.push(local as HeldRow);
    }
    console.info('[WebPOS][orders] loaded', {
      held: nextHeld.length,
      localAdded: localRows.length,
      posOrders: nextOrders.length,
      openPos: nextOrders.filter((o) => isOpenWebPosOrder(o)).length,
    });
    setHeld(nextHeld);
    setOrders(nextOrders);
    if (!opts?.silent) setLoading(false);
  }, [t, searchQ, channelFilter]);

  useEffect(() => {
    if (open) void load();
  }, [open, load, refreshToken]);

  /** Refresh held / active list while open so waiter tablet orders appear without manual reload. */
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => void load({ silent: true }), 5000);
    return () => window.clearInterval(timer);
  }, [open, load]);

  useEffect(() => {
    if (!open || !initialChannelFilter) return;
    setChannelFilter(initialChannelFilter);
    setStatusFilter('active');
    setPage(0);
  }, [open, initialChannelFilter]);

  useEffect(() => {
    onChannelFilterChange?.(channelFilter);
  }, [channelFilter, onChannelFilterChange]);

  useEffect(() => {
    if (!open || !highlightOrderId) {
      highlightNavRef.current = null;
      return;
    }
    if (highlightNavRef.current === highlightOrderId) return;
    const match =
      orders.find((o) => o.id === highlightOrderId || o.clientId === highlightOrderId) ||
      onlineOrders.find((o) => o.id === highlightOrderId);
    if (!match) return;
    const asPos =
      'refundAmount' in match ? (match as PosOrder) : onlineOrderAsPosOrder(match as OnlineOrder);
    highlightNavRef.current = highlightOrderId;
    setStatusFilter(isOpenWebPosOrder(asPos) ? 'active' : 'completed');
    if (isOnlineShopOrder(asPos)) setChannelFilter('online');
    setSelectedOrder(asPos);
    setSelectedHeld(null);
    setOrdersView('list');
  }, [open, highlightOrderId, orders, onlineOrders]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, channelFilter, search]);

  const splitCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (o.masterOrderId) {
        map.set(o.masterOrderId, (map.get(o.masterOrderId) || 0) + 1);
      }
    }
    return map;
  }, [orders]);

  const ordersForList = useMemo(
    () => mergeOrdersWithOnlineForAllFilter(orders, onlineOrders, channelFilter) as PosOrder[],
    [orders, onlineOrders, channelFilter]
  );

  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    const q = search.trim().toLowerCase();
    const view = q ? 'all' : statusFilter;
    const heldBucket: HeldRow[] = [];
    const activeBucket: PosOrder[] = [];
    const doneBucket: PosOrder[] = [];

    if (view === 'active' || view === 'all' || view === 'held') {
      for (const h of held) {
        // Held / kitchen-sent tickets are POS register work — hide only on Online shop.
        if (channelFilter === 'online') continue;
        if (!matchesChannelFilter(h, channelFilter)) continue;
        if (q) {
          const meta = parseHeldCartJson(h.cartJson);
          if (
            !ticketQueryMatches(
              q,
              h.label,
              h.channel,
              meta.ticketDisplay,
              meta.tabNumber,
              meta.tableLabel,
              meta.ticketOrderNumber
            )
          ) {
            continue;
          }
        }
        heldBucket.push(h);
      }
      if (view !== 'held') {
      for (const o of ordersForList) {
        const showOnActive =
          isOpenWebPosOrder(o) ||
          (view === 'active' && isScheduledPosKitchenTicket(o)) ||
          (view === 'active' && isUnpaidInvoice(o));
        if (!showOnActive) continue;
        if (!matchesChannelFilter(o, channelFilter)) continue;
        if (q) {
          const refs = orderPublicRefs(o);
          if (
            !ticketQueryMatches(
              q,
              formatOrderNumberDisplay(o.orderNumber),
              o.orderNumber,
              o.clientId,
              o.customerName,
              o.tableLabel,
              o.orderType,
              o.paymentMethod,
              o.invoiceNumber,
              refs.ticketDisplay,
              refs.tabNumber
            )
          ) {
            continue;
          }
        }
        activeBucket.push(o);
      }
      }
    }
    if (view === 'completed' || view === 'all') {
      for (const o of ordersForList) {
        // Ongoing orders already listed under Active; skip them here (including "All").
        // Invoice sales stay in history even when unpaid / still "preparing".
        const listedInActive =
          isOpenWebPosOrder(o) || (view === 'all' && isUnpaidInvoice(o));
        if (listedInActive && view === 'all') continue;
        if (isOpenWebPosOrder(o) && !isInvoiceOrder(o)) continue;
        if (!matchesChannelFilter(o, channelFilter)) continue;
        if (q) {
          const refs = orderPublicRefs(o);
          if (
            !ticketQueryMatches(
              q,
              formatOrderNumberDisplay(o.orderNumber),
              o.orderNumber,
              o.clientId,
              o.customerName,
              o.tableLabel,
              o.orderType,
              o.paymentMethod,
              o.invoiceNumber,
              refs.ticketDisplay,
              refs.tabNumber
            )
          ) {
            continue;
          }
        }
        doneBucket.push(o);
      }
    }

    for (const h of heldBucket) items.push({ kind: 'held', held: h });
    for (const o of activeBucket) items.push({ kind: 'order', order: o });
    for (const o of doneBucket) items.push({ kind: 'order', order: o });
    // Single chronology: newest activity at the top (held / open / completed interleaved).
    items.sort((a, b) => listItemTimeMs(b) - listItemTimeMs(a));
    return items;
  }, [held, ordersForList, statusFilter, channelFilter, search]);

  const displayItems = useMemo(() => {
    if (!purgeMode) return listItems;
    return listItems.filter((item) => {
      if (item.kind !== 'order') return false;
      if (!isGandolaPurgeEligible(item.order)) return false;
      return orderMatchesPaymentFilter(item.order, purgePaymentFilter);
    });
  }, [listItems, purgeMode, purgePaymentFilter]);

  const pageSize = ordersView === 'grid' ? PAGE_SIZE_GRID : PAGE_SIZE_LIST;
  const pageCount = Math.max(1, Math.ceil(displayItems.length / pageSize));
  const pageItems = displayItems.slice(page * pageSize, page * pageSize + pageSize);
  const rangeStart = displayItems.length === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(displayItems.length, (page + 1) * pageSize);
  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const heldCartLines = (h: HeldRow) => parseHeldCartJson(h.cartJson).cart as CartLine[];

  const refreshKdsHeld = useCallback(
    async (rows: HeldRow[]) => {
      if (!kitchenEnabled) {
        setKdsByTicket({});
        return;
      }
      const keys = new Set<string>();
      for (const h of rows) {
        if (h.status !== 'sent_to_kitchen') continue;
        const meta = parseHeldCartJson(h.cartJson);
        const key = resolveKitchenTicketKey(meta);
        if (key) keys.add(key);
      }
      if (!keys.size) {
        setKdsByTicket({});
        return;
      }
      const next: Record<string, { ready: number; sent: number; readyLineIds: string[] }> = {};
      await Promise.all(
        [...keys].map(async (key) => {
          const status = await fetchKdsTicketStatus(key);
          if (status) {
            next[key] = {
              ready: status.ready,
              sent: status.sent || status.total,
              readyLineIds: status.readyLineIds || [],
            };
          }
        })
      );
      setKdsByTicket(next);
    },
    [kitchenEnabled]
  );

  const heldKitchenProgress = useCallback(
    (h: HeldRow) => {
      const lines = heldCartLines(h);
      const meta = parseHeldCartJson(h.cartJson);
      const key = resolveKitchenTicketKey(meta);
      const local = kitchenProgressFromLines(lines);
      return mergeKitchenProgress(local, key ? kdsByTicket[key] : null);
    },
    [kdsByTicket]
  );

  const heldLineReady = useCallback(
    (h: HeldRow, line: CartLine) => {
      if (line.kitchenReadyAt) return true;
      const meta = parseHeldCartJson(h.cartJson);
      const key = resolveKitchenTicketKey(meta);
      const ids = key ? kdsByTicket[key]?.readyLineIds : null;
      return !!ids?.includes(line.lineId);
    },
    [kdsByTicket]
  );

  useEffect(() => {
    if (!open || !kitchenEnabled) return;
    void refreshKdsHeld(held);
    const timer = window.setInterval(() => void refreshKdsHeld(held), 8000);
    return () => window.clearInterval(timer);
  }, [open, kitchenEnabled, held, refreshKdsHeld]);

  const heldTotal = (h: HeldRow) =>
    heldCartLines(h).reduce((s, l) => s + Number(l.lineTotal || 0), 0);

  const doCancelOrder = async (reason: string, reasonId: string) => {
    if (!cancelFor || cancelBusy) return;
    const orderSnapshot = cancelFor;
    setCancelBusy(true);
    try {
      await api.post(`/merchant/pos/orders/${orderSnapshot.id}/cancel`, {
        reason: reasonId || reason,
      });
      toast.success(t('webPosOrderCancelled'));
      setCancelFor(null);
      setSelectedOrder(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosCancelFailed'));
    } finally {
      setCancelBusy(false);
    }
  };

  const doCancelHeld = async (reason: string, reasonId: string) => {
    if (!cancelHeldFor || cancelBusy) return;
    const heldRow = cancelHeldFor;
    setCancelBusy(true);
    try {
      if (heldRow.status === 'sent_to_kitchen' && onVoidHeldKitchen) {
        try {
          await onVoidHeldKitchen(heldRow, reasonId || reason);
        } catch {
          /* kitchen print is best-effort */
        }
      }
      if (String(heldRow.id).startsWith('local:')) {
        const meta = parseHeldCartJson(heldRow.cartJson);
        removeLocalHeldDraft({
          localId: heldRow.id,
          ticketDisplay: meta.ticketDisplay,
          tableId: meta.tableId,
          tabNumber: meta.tabNumber,
        });
      } else {
        await api.post(`/merchant/pos/held/${heldRow.id}/cancel`, {
          reason: reasonId || reason,
        });
      }
      toast.success(t('webPosOrderCancelled'));
      setCancelHeldFor(null);
      if (selectedHeld?.id === heldRow.id) setSelectedHeld(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosCancelFailed'));
    } finally {
      setCancelBusy(false);
    }
  };

  const doRefund = async (payload: {
    refundKind: 'referenced' | 'goodwill';
    mode: 'full' | 'items';
    reason: string;
    reasonId: string;
    items?: Array<{ orderItemId: string; quantity: number }>;
    goodwillAmount?: number;
    goodwillMethod?: 'cash' | 'terminal';
  }) => {
    if (!refundFor) return;
    const orderSnapshot = refundFor;
    setRefundBusy(true);
    try {
      if (payload.refundKind === 'goodwill') {
        await api.post(`/merchant/pos/orders/${orderSnapshot.id}/goodwill`, {
          amount: payload.goodwillAmount,
          reason: payload.reason,
          method: payload.goodwillMethod || 'cash',
        });
        toast.success(t('webPosGoodwillSubmitted'));
      } else {
        const res = await api.post(`/merchant/pos/orders/${orderSnapshot.id}/refund`, {
          reason: payload.reason,
          fullTicket: payload.mode === 'full',
          items: payload.mode === 'items' ? payload.items : undefined,
        });
        toast.success(t('webPosOrderRefunded'));
        if (onPrintRefund && res.data) {
          setRefundPrintPrompt({
            order: orderSnapshot,
            refunded: Number(res.data.refunded || 0),
            refundTotal: Number(res.data.refundTotal || 0),
            reason: payload.reason,
            allocation: res.data.allocation,
          });
        }
      }
      setRefundFor(null);
      setSelectedOrder(null);
      void load();
    } catch (e: any) {
      toast.error(
        e.response?.data?.error ||
          (payload.refundKind === 'goodwill' ? t('webPosGoodwillFailed') : t('webPosRefundFailed'))
      );
    } finally {
      setRefundBusy(false);
    }
  };

  const doUpdatePayment = async () => {
    if (!paymentEditFor) return;
    const orderId = paymentEditFor.id;
    const method = paymentMethodDraft;
    const paymentPatch = {
      paymentMethod: method,
      paymentBreakdown: [{ method, amount: Number(paymentEditFor.total) || 0 }],
    };
    try {
      await api.patch(`/merchant/pos/orders/${orderId}/payment-method`, {
        paymentMethod: method,
      });
      toast.success(t('webPosPaymentUpdated'));
      setPaymentEditFor(null);
      setSelectedOrder((prev) =>
        prev && prev.id === orderId ? { ...prev, ...paymentPatch } : prev
      );
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...paymentPatch } : o))
      );
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentUpdateFailed'));
    }
  };

  const doCollectPayment = async () => {
    if (!collectFor) return;
    setCollectBusy(true);
    try {
      const invoiceOrder = isInvoiceOrder(collectFor);
      const counterTender = ['cash', 'card', 'terminal'].includes(paymentMethodDraft);
      const res = invoiceOrder && !counterTender
        ? await api.post(`/merchant/orders/${collectFor.id}/record-invoice-payment`, {
            paymentMethod: INVOICE_SETTLEMENT_METHOD,
          })
        : await api.post(`/merchant/orders/${collectFor.id}/action`, {
            action: collectPaymentAction(collectFor.status),
            paymentMethod: paymentMethodDraft,
            skipReceiptPrint: true,
          });
      toast.success(t('webPosPaymentCollected'));
      const updated = (res.data?.order as PosOrder | undefined) || null;
      if (updated) onOrderPaid?.(updated);
      if (updated && autoPrintReceipt && (!invoiceOrder || counterTender)) {
        try {
          await onPrintOrder?.(updated);
        } catch (e: unknown) {
          console.warn('[orders] receipt print after collect failed', e);
        }
      }
      setCollectFor(null);
      setSelectedOrder(updated || null);
      onOrderActioned?.(collectFor.id);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentCollectFailed'));
    } finally {
      setCollectBusy(false);
    }
  };

  const postOnlineAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    const res = await api.post(`/merchant/orders/${id}/action`, { action, ...extra });
    return (res.data?.order as PosOrder | undefined) || null;
  };

  const finalizeOnlineWhenReady = async (order: PosOrder) => {
    if (isUnpaidOnline(order)) {
      onOrderActioned?.(order.id);
      startCollectPayment(order);
      return;
    }
    setOnlineActionBusy(order.id);
    try {
      await postOnlineAction(order.id, 'complete');
      toast.success(t('webPosOrderCompleted'));
      onOrderActioned?.(order.id);
      setSelectedOrder(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('actionFailed'));
    } finally {
      setOnlineActionBusy(null);
    }
  };

  const runOnlineAction = async (order: PosOrder, action: string) => {
    setOnlineActionBusy(order.id);
    try {
      const updated = await postOnlineAction(order.id, action);
      toast.success(t('updated'));
      if (action === 'accept' || action === 'reject') {
        onOrderActioned?.(order.id);
      }
      const fresh = updated || order;
      setSelectedOrder((prev) =>
        prev && prev.id === order.id
          ? ({ ...prev, ...fresh, items: prev.items } as PosOrder)
          : ({ ...order, ...fresh } as PosOrder)
      );
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('actionFailed'));
    } finally {
      setOnlineActionBusy(null);
    }
  };

  const printOne = async (order: PosOrder, splitLabel?: string | null) => {
    if (!onPrintOrder) return;
    setPrinting(true);
    try {
      await onPrintOrder(order, splitLabel);
    } finally {
      setPrinting(false);
    }
  };

  const startRefund = (order: PosOrder) => {
    setRefundFor(order);
    setPaymentEditFor(null);
    closeMenus();
  };

  const startEditPayment = (order: PosOrder) => {
    setPaymentEditFor(order);
    setPaymentMethodDraft(
      (order.paymentMethod || 'cash').toLowerCase() === 'card'
        ? 'card'
        : (order.paymentMethod || 'cash').toLowerCase() === 'terminal'
          ? 'terminal'
          : 'cash'
    );
    setRefundFor(null);
  };

  const startCollectPayment = (order: PosOrder) => {
    setPaymentEditFor(null);
    if (isInvoiceOrder(order)) {
      setPaymentMethodDraft('cash');
      setCollectFor(order);
      setSelectedOrder(order);
      return;
    }
    if (onCollectPaymentCheckout) {
      onCollectPaymentCheckout(order);
      return;
    }
    setPaymentMethodDraft('cash');
    setCollectFor(order);
  };

  const closeMenus = () => {
    setDetailMenuOpen(false);
    setRowMenuOrderId(null);
    setRowMenuAnchor(null);
    setDetailMenuAnchor(null);
  };

  const openHeldInCart = (h: HeldRow) => {
    onResumeHeld(h);
    onClose();
  };

  const selectHeld = (h: HeldRow) => {
    setSelectedHeld(h);
    setSelectedOrder(null);
    closeMenus();
  };

  const selectOrder = (o: PosOrder) => {
    setSelectedOrder(o);
    setSelectedHeld(null);
    closeMenus();
  };

  /** Unpaid collectable orders show detail first; collect from the side panel. */
  const openOrderClick = (o: PosOrder) => {
    if (purgeMode) {
      if (!isGandolaPurgeEligible(o)) return;
      setSelectedPurgeIds((prev) => {
        const next = new Set(prev);
        if (next.has(o.id)) next.delete(o.id);
        else next.add(o.id);
        return next;
      });
      return;
    }
    setCollectFor(null);
    selectOrder(o);
  };

  const enterPurgeMode = () => {
    setPurgeMode(true);
    setStatusFilter('completed');
    setPurgePaymentFilter('cash');
    setSelectedPurgeIds(new Set());
    setSelectedOrder(null);
    setSelectedHeld(null);
    setPage(0);
    toast.success(t('gandolaPurgeMode'), { duration: 4000 });
  };

  const exitPurgeMode = () => {
    setPurgeMode(false);
    setSelectedPurgeIds(new Set());
  };

  const selectAllPurgeVisible = () => {
    const ids = displayItems
      .filter((item): item is { kind: 'order'; order: PosOrder } => item.kind === 'order')
      .map((item) => item.order.id);
    setSelectedPurgeIds(new Set(ids));
  };

  const purgeSelectedOrders = async () => {
    const ids = [...selectedPurgeIds];
    if (!ids.length) return;
    const ok = window.confirm(t('gandolaPurgeConfirm').replace('{n}', String(ids.length)));
    if (!ok) return;
    setPurgeBusy(true);
    try {
      const res = await api.post('/merchant/pos/orders/purge', { orderIds: ids });
      const result = res.data?.result as {
        deletedCount?: number;
        skippedIds?: string[];
      };
      const deleted = Number(result?.deletedCount || 0);
      const skipped = result?.skippedIds?.length || 0;
      if (skipped > 0) {
        toast.success(
          t('gandolaPurgeSkipped')
            .replace('{deleted}', String(deleted))
            .replace('{skipped}', String(skipped))
        );
      } else {
        toast.success(t('gandolaPurgeSuccess').replace('{n}', String(deleted)));
      }
      setSelectedPurgeIds(new Set());
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('gandolaPurgeFailed'));
    } finally {
      setPurgeBusy(false);
    }
  };

  const orderActionMenu = (
    order: PosOrder,
    opts: { onClose: () => void; align?: 'left' | 'right'; anchor: HTMLElement | null }
  ) => {
    const showPrint = !!onPrintOrder;
    const showCancel = !!(canCancel && canCancelOrder(order));
    const showRefund = !!(canRefund && canRefundOrder(order));
    const showEditPay = canEditPayment(order) && !isInvoiceOrder(order);
    const showInvoice = isInvoiceOrder(order);
    if (!showPrint && !showCancel && !showRefund && !showEditPay && !showInvoice) return null;
    if (!opts.anchor) return null;
    return (
      <PortaledActionMenu
        anchor={opts.anchor}
        align={opts.align}
        onClose={opts.onClose}
      >
        {showInvoice ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={() => {
              opts.onClose();
              void downloadInvoicePdf(order.id, order.invoiceNumber ? `${order.invoiceNumber}.pdf` : undefined).catch(
                () => toast.error(t('webPosInvoicePdfFailed'))
              );
            }}
          >
            <FileText size={14} className="shrink-0 text-stone-500" />
            {t('webPosDownloadInvoice')}
            {order.invoiceNumber ? ` · ${order.invoiceNumber}` : ''}
          </button>
        ) : null}
        {showPrint ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            disabled={printing}
            onClick={() => {
              opts.onClose();
              void printOne(order);
            }}
          >
            <Printer size={14} className="shrink-0 text-stone-500" />
            {t('webPosPrintReceipt')}
          </button>
        ) : null}
        {showRefund ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={() => {
              opts.onClose();
              selectOrder(order);
              startRefund(order);
            }}
          >
            <Undo2 size={14} className="shrink-0 text-stone-500" />
            {t('webPosRefund')}
          </button>
        ) : null}
        {showEditPay ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
            onClick={() => {
              opts.onClose();
              selectOrder(order);
              startEditPayment(order);
            }}
          >
            <CreditCard size={14} className="shrink-0 text-stone-500" />
            {t('webPosEditPayment')}
          </button>
        ) : null}
        {showCancel ? (
          <>
            <div className="my-1 border-t border-stone-100" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
              onClick={() => {
                opts.onClose();
                setCancelFor(order);
              }}
            >
              <Ban size={14} className="shrink-0" />
              {t('webPosCancelOrder')}
            </button>
          </>
        ) : null}
      </PortaledActionMenu>
    );
  };

  const refundModalItems = useMemo(
    () =>
      (refundFor?.items || []).map((it) => ({
        id: String((it as { id?: string }).id || ''),
        name: it.name,
        quantity: Number(it.quantity) || 0,
        totalPrice: Number(it.totalPrice) || 0,
        refundedQuantity: Number((it as { refundedQuantity?: number }).refundedQuantity || 0),
      })),
    [refundFor]
  );

  if (!open) return null;

  const isOnlineMode = channelFilter === 'online';

  const channelFilters: Array<{ id: ChannelFilter; label: string }> = [
    { id: 'all', label: t('webPosAllOrders') },
    { id: 'dine_in', label: t('dineIn') },
    { id: 'takeaway', label: t('takeaway') },
    { id: 'delivery', label: t('delivery') },
    { id: 'online', label: t('webPosOnlineOrders') },
  ];

  const cancelModalOpen = !!(cancelFor || cancelHeldFor);
  const detailOpen = !!(selectedHeld || selectedOrder);

  return (
    <div
      className={
        embedded
          ? 'flex min-h-0 min-w-0 flex-1 flex-col bg-white'
          : 'fixed inset-0 z-50 flex justify-end bg-black/40'
      }
    >
      <div
        className={
          embedded
            ? 'flex min-h-0 flex-1 flex-col bg-white'
            : 'flex h-full w-full max-w-5xl flex-col bg-white shadow-xl'
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-2 py-2 sm:px-3 sm:py-2.5">
          {embedded ? (
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"
              onClick={onClose}
              aria-label={t('webPosBack')}
            >
              <ChevronLeft size={16} aria-hidden />
              <span className="hidden sm:inline">{t('webPosBack')}</span>
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 basis-full items-center gap-1.5 sm:min-w-[14rem] sm:basis-auto">
            {canGandolaPurge ? (
              <SecretSearchTapButton onUnlock={enterPurgeMode} />
            ) : null}
            <input
              type="search"
              className="min-w-0 w-full rounded-lg border border-stone-200 bg-stone-50 py-2 px-3 text-sm"
              placeholder={t('webPosSearchOrders')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!isOnlineMode ? (
            <select
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="active">{t('webPosActive')}</option>
              <option value="held">{t('webPosOnHold')}</option>
              <option value="completed">{t('webPosCompletedOrders')}</option>
              <option value="all">{t('webPosAllOrders')}</option>
            </select>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {channelFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setChannelFilter(f.id);
                  setPage(0);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  channelFilter === f.id
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {f.label}
              </button>
            ))}
            {onOpenDeliveryHub ? (
              <button
                type="button"
                onClick={onOpenDeliveryHub}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-900 hover:bg-teal-100"
              >
                <Truck size={14} aria-hidden />
                {t('ordersFilterPortal')}
              </button>
            ) : null}
          </div>
          {!isOnlineMode ? (
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
              <button
                type="button"
                title={t('webPosOrdersViewList')}
                aria-label={t('webPosOrdersViewList')}
                aria-pressed={ordersView === 'list'}
                onClick={() => {
                  setOrdersView('list');
                  setPage(0);
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                  ordersView === 'list' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                title={t('webPosOrdersViewGrid')}
                aria-label={t('webPosOrdersViewGrid')}
                aria-pressed={ordersView === 'grid'}
                onClick={() => {
                  setOrdersView('grid');
                  if (highlightOrderId) highlightNavRef.current = highlightOrderId;
                  setPage(0);
                  setSelectedHeld(null);
                  setSelectedOrder(null);
                  closeMenus();
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                  ordersView === 'grid' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-1 text-xs text-stone-500">
            {!isOnlineMode ? (
              <>
            <span className="tabular-nums">
              {rangeStart}-{rangeEnd} / {displayItems.length}
            </span>
            <button
              type="button"
              className="rounded p-1.5 hover:bg-stone-100 disabled:opacity-30"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="rounded p-1.5 hover:bg-stone-100 disabled:opacity-30"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
              </>
            ) : null}
            <button
              type="button"
              className="rounded p-1.5 hover:bg-stone-100"
              onClick={() => {
                void load();
                if ((channelFilter === 'all' || isOnlineMode) && onRefreshOnline) void onRefreshOnline();
              }}
              disabled={loading}
              aria-label={t('webPosRefreshOrders')}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {!embedded ? (
              <button type="button" className="rounded p-1.5 hover:bg-stone-100" onClick={onClose}>
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
        {purgeMode ? (
          <GandolaPurgeToolbar
            selectedCount={selectedPurgeIds.size}
            visibleCount={displayItems.length}
            paymentFilter={purgePaymentFilter}
            onPaymentFilterChange={(value) => {
              setPurgePaymentFilter(value);
              setSelectedPurgeIds(new Set());
              setPage(0);
            }}
            onSelectAll={selectAllPurgeVisible}
            onClearSelection={() => setSelectedPurgeIds(new Set())}
            onDelete={() => void purgeSelectedOrders()}
            onExit={exitPurgeMode}
            deleting={purgeBusy}
          />
        ) : null}
        <div
          className={`relative flex min-h-0 flex-1 flex-col lg:flex-row ${
            detailOpen ? 'overflow-hidden lg:overflow-visible' : ''
          }`}
        >
          {isOnlineMode ? (
            <WebPosOnlineOrdersView
              orders={onlineOrders}
              search={search}
              highlightOrderId={highlightOrderId}
              onRefresh={() => {
                void load();
                onRefreshOnline?.();
              }}
              onOrderActioned={onOrderActioned}
              onCollectPayment={(order) => {
                onOrderActioned?.(order.id);
                startCollectPayment(order as PosOrder);
              }}
            />
          ) : (
          <div
            className={
              detailOpen
                ? 'hidden min-h-0 min-w-0 flex-1 overflow-y-auto lg:block'
                : 'min-h-0 min-w-0 w-full flex-1 overflow-y-auto'
            }
          >
            {loading ? (
              <p className="p-4 text-sm text-stone-400">{t('loading')}</p>
            ) : pageItems.length === 0 ? (
              <div className="space-y-1 p-4 text-sm text-stone-400">
                <p>{t('webPosNoOrders')}</p>
                <p className="text-xs text-stone-400">{t('webPosNoOrdersHint')}</p>
              </div>
            ) : ordersView === 'grid' ? (
              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {pageItems.map((item) => {
                  if (item.kind === 'held') {
                    const h = item.held;
                    const total = heldTotal(h);
                    const lines = heldCartLines(h);
                    const sentCount = lines.filter((l: any) => l.sentToKitchen).length;
                    const ticketKeys = heldTicketKeys(h);
                    const readyCount = lines.filter(
                      (l: any) =>
                        l.sentToKitchen &&
                        (!!l.kitchenReadyAt ||
                          lineKitchenReady(String(l.lineId || ''), ticketKeys, kdsReadyMap))
                    ).length;
                    const heldMeta = parseHeldCartJson(h.cartJson);
                    const idLabel =
                      heldMeta.tableLabel ||
                      (heldMeta.tabNumber ? `#${heldMeta.tabNumber}` : null) ||
                      heldMeta.ticketDisplay ||
                      h.label ||
                      '—';
                    const age = formatOrderAge(heldTimeMs(h) || nowMs, nowMs);
                    const heldCh = resolveHeldChannel({ channel: h.channel, cartJson: h.cartJson });
                    return (
                      <button
                        key={`hg-${h.id}`}
                        type="button"
                        onClick={() => openHeldInCart(h)}
                        className={`flex min-h-[9.5rem] flex-col overflow-hidden rounded-xl border-2 bg-white text-left text-stone-900 shadow-sm transition hover:ring-2 hover:ring-teal-400 ${channelBorderClass(heldCh)}`}
                      >
                        <div
                          className={`flex items-center justify-between gap-1 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white ${channelHeaderClass(heldCh)}`}
                        >
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <ChannelGlyph ch={heldCh} />
                            <span className="truncate">{channelLabel(heldCh)}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">{idLabel}</span>
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">
                          <p className="text-[11px] text-stone-500">
                            {sentCount > 0 ? `${readyCount}/${sentCount}` : `${sentCount}/${lines.length || 0}`}
                          </p>
                          <p className="text-lg font-bold tabular-nums tracking-tight">
                            <span className="text-sm font-semibold text-stone-500">CHF </span>
                            <span className="text-teal-700">{Number(total).toFixed(2)}</span>
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-2.5 py-1.5 text-[10px] text-stone-500">
                          <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <User size={11} />
                            <span className="truncate">
                              {h.staffName?.trim() || t('webPosOngoing')}
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                            <Clock size={11} />
                            {age}
                          </span>
                        </div>
                      </button>
                    );
                  }
                  const o = item.order;
                  const refs = orderPublicRefs(o);
                  const idLabel = orderListPrimaryLabel(o);
                  const age = formatOrderAge(orderTimeMs(o) || nowMs, nowMs);
                  const itemCount = Array.isArray(o.items) ? o.items.length : 0;
                  const purgeSelected = purgeMode && selectedPurgeIds.has(o.id);
                  return (
                    <button
                      key={`og-${o.id}`}
                      type="button"
                        onClick={() => openOrderClick(o)}
                        className={`relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-xl border-2 bg-white text-left text-stone-900 shadow-sm transition hover:ring-2 ${
                          purgeSelected ? 'ring-2 ring-red-500 border-red-300' : 'hover:ring-teal-400'
                        } ${orderBorderClass(o)}`}
                    >
                      {purgeMode ? (
                        <span
                          className={`absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border-2 text-[11px] font-bold ${
                            purgeSelected
                              ? 'border-red-600 bg-red-600 text-white'
                              : 'border-stone-300 bg-white text-transparent'
                          }`}
                          aria-hidden
                        >
                          ✓
                        </span>
                      ) : null}
                      <div
                        className={`flex items-center justify-between gap-1 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white ${orderHeaderClass(o)}`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <ChannelGlyph ch={o.channel} order={o} />
                          <span className="truncate">{channelLabel(o.channel, o)}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{idLabel}</span>
                      </div>
                      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">
                        <p className="text-[11px] text-stone-500">{itemCount}</p>
                        <p className="text-lg font-bold tabular-nums tracking-tight">
                          <span className="text-sm font-semibold text-stone-500">CHF </span>
                          <span className="text-teal-700">{Number(o.total).toFixed(2)}</span>
                        </p>
                        {showsKitchenFulfillmentStages(o) ? (
                          <p className="flex flex-wrap items-center justify-center gap-1">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${orderStatusBadgeClass(o.status)}`}
                            >
                              {statusLabel(o.status)}
                            </span>
                          </p>
                        ) : null}
                        {canShowAwaitingPaymentBadge(o) ? (
                          <p className="text-[10px] font-bold uppercase text-amber-700">
                            {t('webPosAwaitingPayment')}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-2.5 py-1.5 text-[10px] text-stone-500">
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                          <User size={11} />
                          <span className="truncate">{o.customerName || o.staffName || '—'}</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                          <Clock size={11} />
                          {age}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {pageItems.map((item) => {
                  if (item.kind === 'held') {
                    const h = item.held;
                    const selected = selectedHeld?.id === h.id;
                    const total = heldTotal(h);
                    const kitchenProgress = heldKitchenProgress(h);
                    const heldMeta = parseHeldCartJson(h.cartJson);
                    return (
                      <li key={`h-${h.id}`}>
                        <button
                          type="button"
                          onClick={() => selectHeld(h)}
                          className={`flex w-full items-start gap-2 px-3 py-3.5 text-left hover:bg-stone-50 sm:items-center sm:gap-3 sm:px-4 ${
                            selected ? 'bg-teal-50' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                  {h.label || t('webPosHeldOrder')}
                                </p>
                                <p className="mt-0.5 text-xs text-stone-500">
                                  {h.staffName?.trim()
                                    ? `${h.staffName.trim()} · ${formatDateTime(h.updatedAt || h.createdAt || Date.now())}`
                                    : formatDateTime(h.updatedAt || h.createdAt || Date.now())}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">
                                {money(total)}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${channelBadgeClass(resolveHeldChannel({ channel: h.channel, cartJson: h.cartJson }))}`}
                              >
                                {channelLabel(resolveHeldChannel({ channel: h.channel, cartJson: h.cartJson }))}
                              </span>
                              {heldMeta.ticketDisplay ? (
                                <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-900">
                                  {t('webPosTicket')} {heldMeta.ticketDisplay}
                                </span>
                              ) : null}
                              {heldMeta.tabNumber ? (
                                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-900">
                                  {t('webPosTab')} {heldMeta.tabNumber}
                                </span>
                              ) : null}
                              {heldMeta.tableLabel ? (
                                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                                  {t('table')} {heldMeta.tableLabel}
                                </span>
                              ) : null}
                              {kitchenProgress.sent > 0 ? (
                                <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                  <KitchenProgressLabel
                                    progress={kitchenProgress}
                                    kitchenEnabled={kitchenEnabled}
                                  />
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <Info size={16} className="mt-1 shrink-0 text-stone-400 sm:mt-0" />
                          {canCancel ? (
                            <span
                              role="button"
                              tabIndex={0}
                              className="mt-0.5 shrink-0 rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 sm:mt-0"
                              aria-label={t('webPosCancelOrder')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelHeldFor(h);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  setCancelHeldFor(h);
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  }
                  const o = item.order;
                  const selected = purgeMode
                    ? selectedPurgeIds.has(o.id)
                    : selectedOrder?.id === o.id;
                  const isSplitRow = o.masterOrderId && (splitCounts.get(o.masterOrderId) || 0) > 1;
                  const isCompletedSale = !canCancelOrder(o);
                  const showPosCancel = canCancel && canCancelPosAwaitingOrder(o);
                  const rowMenuOpen = rowMenuOrderId === o.id;
                  const refs = orderPublicRefs(o);
                  const primaryLabel = orderListPrimaryLabel(o);
                  const subtitleLabel =
                    refs.ticketDisplay && primaryLabel !== refs.ticketDisplay
                      ? formatOrderNumberDisplay(o.orderNumber)
                      : null;
                  return (
                    <li key={`o-${o.id}`} className="relative">
                      <button
                        type="button"
                        onClick={() => openOrderClick(o)}
                        className={`flex w-full items-start gap-2 px-3 py-3.5 text-left hover:bg-stone-50 sm:items-center sm:gap-3 sm:px-4 ${
                          selected ? (purgeMode ? 'bg-red-50' : 'bg-teal-50') : ''
                        }`}
                      >
                        {purgeMode ? (
                          <span
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[11px] font-bold sm:mt-0 ${
                              selected
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-stone-300 bg-white text-transparent'
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{primaryLabel}</p>
                              <p className="mt-0.5 text-xs text-stone-500">
                                {formatDateTime(o.completedAt || o.createdAt)}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">
                              {money(o.total)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${orderBadgeClass(o)}`}
                            >
                              {channelLabel(o.channel, o)}
                            </span>
                            {refs.ticketDisplay ? (
                              <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-900">
                                {t('webPosTicket')} {refs.ticketDisplay}
                              </span>
                            ) : null}
                            {refs.tabNumber ? (
                              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-900">
                                {t('webPosTab')} {refs.tabNumber}
                              </span>
                            ) : null}
                            {o.tableLabel ? (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                                {t('table')} {o.tableLabel}
                              </span>
                            ) : null}
                            {isSplitRow ? (
                              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-800">
                                {t('webPosSplitBadge')}
                              </span>
                            ) : null}
                            {showsKitchenFulfillmentStages(o) ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${orderStatusBadgeClass(o.status)}`}
                              >
                                {statusLabel(o.status)}
                              </span>
                            ) : null}
                            {canShowAwaitingPaymentBadge(o) ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                                {t('webPosAwaitingPayment')}
                              </span>
                            ) : null}
                          </div>
                          {subtitleLabel ? (
                            <p className="mt-0.5 text-[11px] text-stone-400">{subtitleLabel}</p>
                          ) : null}
                        </div>
                        {isCompletedSale ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="relative mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 sm:mt-0"
                            title={t('webPosMoreActions')}
                            aria-label={t('webPosMoreActions')}
                            aria-haspopup="menu"
                            aria-expanded={rowMenuOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              const el = e.currentTarget as HTMLElement;
                              setDetailMenuOpen(false);
                              setDetailMenuAnchor(null);
                              setRowMenuOrderId((id) => {
                                if (id === o.id) {
                                  setRowMenuAnchor(null);
                                  return null;
                                }
                                setRowMenuAnchor(el);
                                return o.id;
                              });
                              setSelectedOrder(o);
                              setSelectedHeld(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                const el = e.currentTarget as HTMLElement;
                                setDetailMenuOpen(false);
                                setDetailMenuAnchor(null);
                                setRowMenuOrderId((id) => {
                                  if (id === o.id) {
                                    setRowMenuAnchor(null);
                                    return null;
                                  }
                                  setRowMenuAnchor(el);
                                  return o.id;
                                });
                                setSelectedOrder(o);
                                setSelectedHeld(null);
                              }
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </span>
                        ) : (
                          <>
                            <Info size={16} className="mt-1 shrink-0 text-stone-400 sm:mt-0" />
                            {showPosCancel ? (
                              <span
                                role="button"
                                tabIndex={0}
                                className="mt-0.5 shrink-0 rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 sm:mt-0"
                                aria-label={t('webPosCancelOrder')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelFor(o);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    setCancelFor(o);
                                  }
                                }}
                              >
                                <Trash2 size={16} />
                              </span>
                            ) : null}
                          </>
                        )}
                      </button>
                      {rowMenuOpen
                        ? orderActionMenu(o, {
                            align: 'right',
                            anchor: rowMenuAnchor,
                            onClose: () => {
                              setRowMenuOrderId(null);
                              setRowMenuAnchor(null);
                            },
                          })
                        : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          )}
          {/* Detail panel — full-screen overlay on phone; side column from lg up */}
          {!isOnlineMode ? (
          <aside
            className={
              purgeMode
                ? 'hidden'
                : detailOpen
                  ? 'fixed inset-0 z-[45] flex min-h-0 w-full flex-col bg-stone-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:static lg:z-auto lg:max-w-sm lg:shrink-0 lg:border-l lg:border-stone-200 lg:pt-0 lg:pb-0'
                  : 'hidden min-h-0 w-full flex-col bg-stone-50 lg:flex lg:max-w-sm lg:shrink-0 lg:border-l lg:border-stone-200'
            }
          >
            {selectedHeld ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <button
                    type="button"
                    className="mb-3 inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 lg:hidden"
                    onClick={() => setSelectedHeld(null)}
                  >
                    <ChevronLeft size={16} />
                    {t('back')}
                  </button>
                  <p className="text-sm font-semibold">{selectedHeld.label || t('webPosHeldOrder')}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {selectedHeld.staffName?.trim()
                      ? `${selectedHeld.staffName.trim()} · ${channelLabel(selectedHeld.channel)}`
                      : channelLabel(selectedHeld.channel)}
                  </p>
                  {(() => {
                    const progress = heldKitchenProgress(selectedHeld);
                    return progress.sent > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                        <KitchenProgressLabel
                          progress={progress}
                          kitchenEnabled={kitchenEnabled}
                        />
                      </p>
                    ) : null;
                  })()}
                  <ul className="mt-4 space-y-2 text-sm">
                    {heldCartLines(selectedHeld).map((l, idx) => {
                      const ready =
                        !!l.kitchenReadyAt ||
                        lineKitchenReady(
                          String(l.lineId || ''),
                          heldTicketKeys(selectedHeld),
                          kdsReadyMap
                        );
                      return (
                        <li key={idx} className="flex justify-between gap-2">
                          <span className="inline-flex min-w-0 items-start gap-1">
                            {ready ? (
                              <ChefHat
                                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                                aria-label={t('webPosReadyBadge')}
                              />
                            ) : null}
                            <span>
                              {l.quantity}× {resolveOrderItemName(l.name)}
                            </span>
                          </span>
                          <span className="tabular-nums">{money(l.lineTotal)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 flex justify-between border-t border-stone-200 pt-3 text-base font-bold">
                    <span>{t('webPosTotal')}</span>
                    <span className="tabular-nums">{money(heldTotal(selectedHeld))}</span>
                  </div>
                </div>
                <div className="space-y-2 border-t border-stone-200 p-3">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-violet-800 py-3.5 text-sm font-bold text-white hover:bg-violet-900"
                    onClick={() => {
                      onResumeHeld(selectedHeld);
                      onClose();
                    }}
                  >
                    {t('webPosLoadOrder')}
                  </button>
                  {canCancel ? (
                    <button
                      type="button"
                      className="w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
                      onClick={() => setCancelHeldFor(selectedHeld)}
                    >
                      {t('webPosCancelOrder')}
                    </button>
                  ) : null}
                </div>
              </>
            ) : selectedOrder ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <button
                    type="button"
                    className="mb-3 inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 lg:hidden"
                    onClick={() => {
                      setSelectedOrder(null);
                      closeMenus();
                    }}
                  >
                    <ChevronLeft size={16} />
                    {t('back')}
                  </button>

                  {/* Side breadcrumb / overflow actions (print, refund, cancel) */}
                  {(() => {
                    const refs = orderPublicRefs(selectedOrder);
                    const crumb = [
                      refs.ticketDisplay,
                      refs.tabNumber ? `${t('webPosTab')} ${refs.tabNumber}` : null,
                      selectedOrder.tableLabel
                        ? `${t('table')} ${selectedOrder.tableLabel}`
                        : null,
                      channelLabel(selectedOrder.channel, selectedOrder),
                      showsKitchenFulfillmentStages(selectedOrder)
                        ? statusLabel(selectedOrder.status)
                        : null,
                    ].filter(Boolean);
                    return (
                      <>
                  <div className="relative mb-3">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-left hover:bg-stone-50"
                      onClick={(e) => {
                        setRowMenuOrderId(null);
                        setRowMenuAnchor(null);
                        const el = e.currentTarget;
                        setDetailMenuOpen((v) => {
                          if (v) {
                            setDetailMenuAnchor(null);
                            return false;
                          }
                          setDetailMenuAnchor(el);
                          return true;
                        });
                      }}
                      title={t('webPosMoreActions')}
                      aria-haspopup="menu"
                      aria-expanded={detailMenuOpen}
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-50 text-stone-600 ring-1 ring-stone-200">
                        <MoreHorizontal size={16} aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-semibold text-stone-600">
                        {crumb.map((part, i) => (
                          <span key={`${part}-${i}`} className="contents">
                            {i > 0 ? (
                              <span className="shrink-0 text-stone-300" aria-hidden>
                                /
                              </span>
                            ) : null}
                            <span className="truncate">{part}</span>
                          </span>
                        ))}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                        {t('webPosMoreShort')}
                      </span>
                    </button>
                    {detailMenuOpen
                      ? orderActionMenu(selectedOrder, {
                          anchor: detailMenuAnchor,
                          onClose: () => {
                            setDetailMenuOpen(false);
                            setDetailMenuAnchor(null);
                          },
                        })
                      : null}
                  </div>

                  <div>
                    <p className="text-sm font-semibold">{orderListPrimaryLabel(selectedOrder)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                      {showsKitchenFulfillmentStages(selectedOrder) ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${orderStatusBadgeClass(selectedOrder.status)}`}
                        >
                          {statusLabel(selectedOrder.status)}
                        </span>
                      ) : null}
                      {canShowAwaitingPaymentBadge(selectedOrder) ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                          {t('webPosAwaitingPayment')}
                        </span>
                      ) : null}
                      {refs.tabNumber && refs.ticketDisplay
                        ? ` · ${t('webPosTab')} ${refs.tabNumber}`
                        : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">{formatOrderNumberDisplay(selectedOrder.orderNumber)}</p>
                  </div>
                      </>
                    );
                  })()}
                  <ul className="mt-4 space-y-2 text-sm">
                    {selectedOrder.items.map((i, idx) => (
                      <li key={idx} className="flex justify-between gap-2">
                        <span>
                          {i.quantity}× {resolveOrderItemName(i.name)}
                        </span>
                        <span className="tabular-nums">{money(i.totalPrice)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 border-t border-stone-200 pt-3">
                    <OrderDetailTotals
                      order={selectedOrder}
                      taxIncludedInPrice={taxIncludedInPrice}
                      vatAfterDiscount={vatAfterDiscount}
                      compact
                    />
                  </div>
                  {selectedOrder.paymentMethod ? (
                    <p className="mt-2 text-sm text-stone-600">
                      {t('webPosPaymentMethod')}:{' '}
                      <span className="font-semibold">
                        {formatOrderPaymentDisplay(selectedOrder, t, locale)}
                      </span>
                      {canShowAwaitingPaymentBadge(selectedOrder) ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                          {t('webPosAwaitingPayment')}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {selectedOrder.cancelReason ? (
                    <p className="mt-2 text-sm text-rose-700">
                      {t('webPosCancelReason')}: {selectedOrder.cancelReason}
                    </p>
                  ) : null}
                  {(selectedOrder as PosOrder & { refundReason?: string | null }).refundReason ? (
                    <p className="mt-2 text-sm text-rose-700">
                      {t('webPosRefundReason')}:{' '}
                      {(selectedOrder as PosOrder & { refundReason?: string | null }).refundReason}
                    </p>
                  ) : null}
                  <OrderRefundHistory
                    className="mt-3"
                    history={(selectedOrder as PosOrder).refundHistory || []}
                    totalRefunded={Number(selectedOrder.refundAmount || 0)}
                  />
                </div>
                {isOpenWebPosOrder(selectedOrder) &&
                (showsKitchenFulfillmentStages(selectedOrder) ||
                  canCollectPayment(selectedOrder) ||
                  canAdminCollectPayment(selectedOrder)) ? (
                  <div className="space-y-2 border-t border-stone-200 p-3">
                    {isOpenOnlineFulfillment(selectedOrder) && isAwaitingApproval(selectedOrder.status) ? (
                      <>
                        <button
                          type="button"
                          className="w-full rounded-xl bg-violet-800 py-3.5 text-sm font-bold text-white hover:bg-violet-900 disabled:opacity-50"
                          disabled={onlineActionBusy === selectedOrder.id}
                          onClick={() => void runOnlineAction(selectedOrder, 'accept')}
                        >
                          {t('webPosAcceptOrder')}
                        </button>
                        <button
                          type="button"
                          className="w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          disabled={onlineActionBusy === selectedOrder.id}
                          onClick={() => void runOnlineAction(selectedOrder, 'reject')}
                        >
                          {t('webPosRejectOrder')}
                        </button>
                      </>
                    ) : null}
                    {canMarkReadyOrder(selectedOrder) ? (
                      <button
                        type="button"
                        className="w-full rounded-xl bg-violet-800 py-3.5 text-sm font-bold text-white hover:bg-violet-900 disabled:opacity-50"
                        disabled={onlineActionBusy === selectedOrder.id}
                        onClick={() => void runOnlineAction(selectedOrder, 'mark_ready')}
                      >
                        {t('webPosMarkReady')}
                      </button>
                    ) : null}
                    {showsKitchenFulfillmentStages(selectedOrder) &&
                    selectedOrder.status === 'ready' &&
                    (selectedOrder.fulfillmentChannel || selectedOrder.channel) === 'delivery' ? (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-stone-200 bg-white py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                        disabled={onlineActionBusy === selectedOrder.id}
                        onClick={() => void runOnlineAction(selectedOrder, 'out_for_delivery')}
                      >
                        {t('ordersActionSendDelivery')}
                      </button>
                    ) : null}
                    {showsKitchenFulfillmentStages(selectedOrder) &&
                    (selectedOrder.status === 'ready' ||
                      selectedOrder.status === 'out_for_delivery') &&
                    !['completed', 'cancelled'].includes(selectedOrder.status) ? (
                      <button
                        type="button"
                        className="w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                        disabled={onlineActionBusy === selectedOrder.id}
                        onClick={() => void finalizeOnlineWhenReady(selectedOrder)}
                      >
                        {isUnpaidOnline(selectedOrder) || canCollectPayment(selectedOrder)
                          ? `${t('webPosTakePayment')} · ${money(selectedOrder.total)}`
                          : t('webPosCompleteOrder')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {isOpenPosAwaitingOrder(selectedOrder) ? (
                  <div className="space-y-2 border-t border-stone-200 p-3">
                    {onLoadPosOrder ? (
                      <button
                        type="button"
                        className="w-full rounded-xl bg-violet-800 py-3.5 text-sm font-bold text-white hover:bg-violet-900"
                        onClick={() => {
                          onLoadPosOrder(selectedOrder);
                          onClose();
                        }}
                      >
                        {t('webPosLoadOrder')}
                      </button>
                    ) : null}
                    {(canCollectPayment(selectedOrder) || canAdminCollectPayment(selectedOrder)) ? (
                      <button
                        type="button"
                        className="w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white hover:bg-emerald-800"
                        onClick={() => startCollectPayment(selectedOrder)}
                      >
                        {t('webPosTakePayment')} · {money(selectedOrder.total)}
                      </button>
                    ) : null}
                    {canCancel && canCancelPosAwaitingOrder(selectedOrder) ? (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
                        onClick={() => setCancelFor(selectedOrder)}
                      >
                        {t('webPosCancelOrder')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {isInvoiceOrder(selectedOrder) ? (
                  <div className="space-y-2 border-t border-stone-200 p-3">
                    {selectedOrder.invoiceNumber ? (
                      <p className="text-xs font-semibold text-stone-600">
                        {t('invoicesNumber')}: {selectedOrder.invoiceNumber}
                        {' · '}
                        {isPaidOrder(selectedOrder) ? t('invoiceStatusPaid') : t('invoiceStatusUnpaid')}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                      onClick={() => {
                        void viewInvoicePdf(selectedOrder.id).catch(() =>
                          toast.error(t('webPosInvoicePdfFailed'))
                        );
                      }}
                    >
                      <FileText size={16} />
                      {t('webPosViewInvoice')}
                      {selectedOrder.invoiceNumber ? ` · ${selectedOrder.invoiceNumber}` : ''}
                    </button>
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100"
                      onClick={() => {
                        void downloadInvoicePdf(
                          selectedOrder.id,
                          selectedOrder.invoiceNumber ? `${selectedOrder.invoiceNumber}.pdf` : undefined
                        ).catch(() => toast.error(t('webPosInvoicePdfFailed')));
                      }}
                    >
                      <FileText size={16} />
                      {t('webPosDownloadInvoice')}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-stone-400">
                {t('webPosSelectOrderHint')}
              </div>
            )}
          </aside>
          ) : null}
        </div>
        {collectFor && (!isOnlineMode || isInvoiceOrder(collectFor)) ? (
          <div className="border-t border-stone-200 bg-white p-4 space-y-3">
            {isInvoiceOrder(collectFor) ? (
              <>
                <p className="text-sm font-medium">
                  {t('webPosTakePayment')} · {money(collectFor.total)}
                </p>
                <p className="text-xs text-stone-500">
                  {t('webPosInvoiceMarkPaidHint')}
                  {collectFor.invoiceNumber ? ` · ${collectFor.invoiceNumber}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethodDraft(m)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                        paymentMethodDraft === m
                          ? 'bg-emerald-700 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {paymentLabel(m)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPaymentMethodDraft(INVOICE_SETTLEMENT_METHOD)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                      paymentMethodDraft === INVOICE_SETTLEMENT_METHOD
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {t('webPosBankTransfer')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {t('webPosTakePayment')} · {money(collectFor.total)}
                </p>
                <p className="text-xs text-stone-500">{t('webPosTakePaymentHint')}</p>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethodDraft(m)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                        paymentMethodDraft === m
                          ? 'bg-emerald-700 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {paymentLabel(m)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={collectBusy}
                onClick={() => setCollectFor(null)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={collectBusy}
                onClick={() => void doCollectPayment()}
              >
                {collectBusy ? t('saving') : t('webPosConfirmPayment')}
              </button>
            </div>
          </div>
        ) : !isOnlineMode && paymentEditFor ? (
          <div className="border-t border-stone-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium">
              {t('webPosEditPayment')} · {paymentEditFor.orderNumber}
            </p>
            <p className="text-xs text-stone-500">{t('webPosEditPaymentHint')}</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethodDraft(m)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                    paymentMethodDraft === m
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {paymentLabel(m)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setPaymentEditFor(null)}
              >
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void doUpdatePayment()}>
                {t('confirm')}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <WebPosCancelModal
        open={cancelModalOpen}
        scope="order"
        reasons={reasons}
        busy={cancelBusy}
        onClose={() => {
          if (cancelBusy) return;
          setCancelFor(null);
          setCancelHeldFor(null);
        }}
        onConfirm={(reason, reasonId) => {
          if (cancelHeldFor) void doCancelHeld(reason, reasonId);
          else void doCancelOrder(reason, reasonId);
        }}
      />

      <WebPosRefundModal
        open={!!refundFor}
        orderNumber={refundFor?.orderNumber || ''}
        total={refundFor?.total || 0}
        alreadyRefunded={refundFor?.refundAmount || 0}
        items={refundModalItems}
        reasons={refundReasons}
        busy={refundBusy}
        hasTerminalPortion={hasTerminalPortion(
          parsePaymentBreakdown(
            refundFor?.paymentBreakdown,
            refundFor?.paymentMethod,
            refundFor?.total
          )
        )}
        terminalEnabled={terminalEnabled}
        onClose={() => setRefundFor(null)}
        onConfirm={(payload) => void doRefund(payload)}
      />
      <WebPosRefundPrintPromptModal
        open={!!refundPrintPrompt}
        amount={refundPrintPrompt?.refunded}
        busy={refundPrintBusy}
        onSkip={() => setRefundPrintPrompt(null)}
        onPrint={() => {
          if (!refundPrintPrompt || !onPrintRefund) {
            setRefundPrintPrompt(null);
            return;
          }
          setRefundPrintBusy(true);
          void onPrintRefund(refundPrintPrompt)
            .catch(() => {
              toast.error(t('webPosPrintFailed'));
            })
            .finally(() => {
              setRefundPrintBusy(false);
              setRefundPrintPrompt(null);
            });
        }}
      />
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
