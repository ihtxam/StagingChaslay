import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Info,
  LayoutGrid,
  List,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Search,
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
import { resolveOrderItemName } from '@/lib/order-item-name';
import { parseOrderMetaNotes, type PosOrderForReceipt } from '@/lib/webpos-receipt';
import { formatOrderPaymentDisplay } from '@/lib/order-management';
import { hasTerminalPortion, parsePaymentBreakdown } from '@/lib/payment-breakdown';
import WebPosCancelModal from '@/components/webpos/WebPosCancelModal';
import WebPosRefundModal, {
  type RefundReasonOption,
} from '@/components/webpos/WebPosRefundModal';

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
  cancelReason?: string | null;
  notes?: string | null;
  masterOrderId?: string | null;
  /** pos | web_shop */
  orderType?: string | null;
};
export type HeldRow = {
  id: string;
  label?: string | null;
  status: string;
  channel?: string | null;
  cartJson: unknown;
  notes?: string | null;
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
};

const PAYMENT_OPTIONS = ['cash', 'card', 'terminal'] as const;

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}

/** Ongoing / kitchen / unpaid — not completed sales (POS cancel rules) */
function canCancelOrder(o: PosOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status)) return false;
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(pay)) return false;
  return true;
}

/** Still in kitchen / fulfillment — includes paid online shop orders */
function isOpenFulfillmentOrder(o: PosOrder): boolean {
  const status = (o.status || '').toLowerCase();
  return !['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status);
}

function isOnlineShopOrder(o: PosOrder): boolean {
  const t = (o.orderType || '').toLowerCase();
  return t === 'web_shop' || t === 'online' || isPlatformChannel(o.channel);
}

function matchesChannelFilter(o: { channel?: string | null; orderType?: string | null }, filter: ChannelFilter) {
  if (filter === 'all') return true;
  if (filter === 'online') return isOnlineShopOrder(o as PosOrder);
  return (o.channel || 'takeaway') === filter;
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
function canCollectPayment(o: PosOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase();
  if (['cancelled', 'refunded'].includes(status)) return false;
  if (pay === 'completed' || pay === 'paid' || pay === 'partially_refunded') return false;
  if (Number(o.total || 0) <= 0.001) return false;
  if (pay === 'awaiting_payment') return true;
  if (method === 'pay_later' || method === 'pay-later') {
    return ['preparing', 'accepted', 'ready', 'out_for_delivery', 'pending', 'confirmed'].includes(
      status
    );
  }
  return false;
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
  switch (ch) {
    case 'dine_in':
      return 'bg-sky-100 text-sky-800';
    case 'takeaway':
      return 'bg-amber-100 text-amber-900';
    case 'delivery':
      return 'bg-orange-100 text-orange-900';
    default:
      return 'bg-violet-100 text-violet-800';
  }
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

function channelHeaderClass(ch?: string | null): string {
  switch ((ch || '').toLowerCase()) {
    case 'dine_in':
      return 'bg-emerald-600';
    case 'delivery':
      return 'bg-orange-500';
    case 'takeaway':
      return 'bg-sky-600';
    default:
      return 'bg-violet-600';
  }
}

function ChannelGlyph({ ch }: { ch?: string | null }) {
  const c = (ch || '').toLowerCase();
  if (c === 'dine_in') return <UtensilsCrossed size={14} />;
  if (c === 'delivery') return <Truck size={14} />;
  if (c === 'takeaway') return <ShoppingBag size={14} />;
  return <Store size={14} />;
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
}: Props) {
  const { t, formatDateTime, locale } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(
    () => initialChannelFilter || 'all'
  );
  const [search, setSearch] = useState('');
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
  const [refundFor, setRefundFor] = useState<PosOrder | null>(null);
  const [paymentEditFor, setPaymentEditFor] = useState<PosOrder | null>(null);
  const [collectFor, setCollectFor] = useState<PosOrder | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState('cash');
  const [page, setPage] = useState(0);
  const [ordersView, setOrdersView] = useState<OrdersViewMode>(() => readOrdersView());
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** Overflow menu for selected order (side detail breadcrumb) */
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  /** Row-level overflow menu order id */
  const [rowMenuOrderId, setRowMenuOrderId] = useState<string | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [detailMenuAnchor, setDetailMenuAnchor] = useState<HTMLElement | null>(null);

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

  const paymentLabel = (method?: string | null) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash') return t('webPosCash');
    if (m === 'card') return t('webPosCard');
    if (m === 'terminal') return t('webPosTerminal');
    if (m === 'express') return t('webPosExpress');
    if (m === 'pay_later' || m === 'pay-later') return t('webPosPayLater');
    return method || '—';
  };

  const statusLabel = (status: string) => {
    const key = status?.toLowerCase().replace(/-/g, '_');
    const map: Record<string, string> = {
      completed: t('webPosStatusCompleted'),
      cancelled: t('webPosStatusCancelled'),
      refunded: t('webPosStatusRefunded'),
      partially_refunded: t('webPosStatusPartialRefund'),
      preparing: t('webPosStatusPreparing'),
      accepted: t('webPosStatusAccepted'),
      held: t('webPosOngoing'),
      sent_to_kitchen: t('webPosOngoing'),
    };
    return map[key] || status;
  };

  const channelLabel = (ch?: string | null) => {
    if (!ch) return '·';
    if (ch === 'dine_in') return t('dineIn');
    if (ch === 'takeaway') return t('takeaway');
    if (ch === 'delivery') return t('delivery');
    if (isPlatformChannel(ch)) return t('webPosOnlineOrders');
    return ch;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '80', from: todayIso(), to: todayIso() });
      const [h, o] = await Promise.all([
        api.get('/merchant/pos/held'),
        api.get(`/merchant/pos/orders?${params.toString()}`),
      ]);
      setHeld(h.data.held || []);
      setOrders(o.data.orders || []);
      setReasons(o.data.cancelReasons || []);
      setRefundReasons(o.data.refundReasons || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosOrdersLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load, refreshToken]);

  useEffect(() => {
    if (!open || !initialChannelFilter) return;
    setChannelFilter(initialChannelFilter);
    setStatusFilter('active');
    setPage(0);
  }, [open, initialChannelFilter, refreshToken]);

  useEffect(() => {
    if (!open || !highlightOrderId || orders.length === 0) return;
    const match = orders.find((o) => o.id === highlightOrderId || o.clientId === highlightOrderId);
    if (match) {
      setStatusFilter(isOpenFulfillmentOrder(match) ? 'active' : 'completed');
      if (isOnlineShopOrder(match)) setChannelFilter('online');
      setSelectedOrder(match);
      setSelectedHeld(null);
      setOrdersView('list');
    }
  }, [open, highlightOrderId, orders]);

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

  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    const q = search.trim().toLowerCase();
    const heldBucket: HeldRow[] = [];
    const activeBucket: PosOrder[] = [];
    const doneBucket: PosOrder[] = [];

    if (statusFilter === 'active' || statusFilter === 'all' || statusFilter === 'held') {
      for (const h of held) {
        // Held tickets are POS-only; hide when filtering Online shop.
        if (channelFilter === 'online') continue;
        if (!matchesChannelFilter(h, channelFilter)) continue;
        if (q) {
          const label = (h.label || '').toLowerCase();
          const cj = h.cartJson as
            | { ticketDisplay?: string | null; tabNumber?: string | null; tableLabel?: string | null }
            | null;
          const hay = [
            label,
            h.channel || '',
            cj && !Array.isArray(cj) ? cj.ticketDisplay || '' : '',
            cj && !Array.isArray(cj) ? cj.tabNumber || '' : '',
            cj && !Array.isArray(cj) ? cj.tableLabel || '' : '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) continue;
        }
        heldBucket.push(h);
      }
      if (statusFilter !== 'held') {
      for (const o of orders) {
        if (!isOpenFulfillmentOrder(o)) continue;
        if (!matchesChannelFilter(o, channelFilter)) continue;
        if (q) {
          const refs = orderPublicRefs(o);
          const hay =
            `${o.orderNumber} ${o.clientId || ''} ${o.customerName || ''} ${o.tableLabel || ''} ${o.orderType || ''} ${refs.ticketDisplay || ''} ${refs.tabNumber || ''}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        activeBucket.push(o);
      }
      }
    }
    if (statusFilter === 'completed' || statusFilter === 'all') {
      for (const o of orders) {
        // Ongoing orders already listed under Active; skip them here (including "All").
        if (isOpenFulfillmentOrder(o)) continue;
        if (!matchesChannelFilter(o, channelFilter)) continue;
        if (q) {
          const refs = orderPublicRefs(o);
          const hay =
            `${o.orderNumber} ${o.clientId || ''} ${o.customerName || ''} ${o.tableLabel || ''} ${o.orderType || ''} ${refs.ticketDisplay || ''} ${refs.tabNumber || ''}`.toLowerCase();
          if (!hay.includes(q)) continue;
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
  }, [held, orders, statusFilter, channelFilter, search]);

  const pageSize = ordersView === 'grid' ? PAGE_SIZE_GRID : PAGE_SIZE_LIST;
  const pageCount = Math.max(1, Math.ceil(listItems.length / pageSize));
  const pageItems = listItems.slice(page * pageSize, page * pageSize + pageSize);
  const rangeStart = listItems.length === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(listItems.length, (page + 1) * pageSize);
  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const heldCartLines = (h: HeldRow) => {
    const data = h.cartJson as
      | { cart?: Array<{ name: string; quantity: number; lineTotal: number }> }
      | Array<{ name: string; quantity: number; lineTotal: number }>;
    if (Array.isArray(data)) return data;
    return data?.cart || [];
  };

  const heldTotal = (h: HeldRow) =>
    heldCartLines(h).reduce((s, l) => s + Number(l.lineTotal || 0), 0);

  const doCancelOrder = async (reason: string) => {
    if (!cancelFor) return;
    try {
      await api.post(`/merchant/pos/orders/${cancelFor.id}/cancel`, { reason });
      toast.success(t('webPosOrderCancelled'));
      setCancelFor(null);
      setSelectedOrder(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosCancelFailed'));
    }
  };

  const doCancelHeld = async (reason: string) => {
    if (!cancelHeldFor) return;
    const heldRow = cancelHeldFor;
    try {
      if (heldRow.status === 'sent_to_kitchen' && onVoidHeldKitchen) {
        try {
          await onVoidHeldKitchen(heldRow, reason);
        } catch {
          /* kitchen print is best-effort */
        }
      }
      await api.post(`/merchant/pos/held/${heldRow.id}/cancel`, { reason });
      toast.success(t('webPosOrderCancelled'));
      setCancelHeldFor(null);
      if (selectedHeld?.id === heldRow.id) setSelectedHeld(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosCancelFailed'));
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
    setRefundBusy(true);
    try {
      if (payload.refundKind === 'goodwill') {
        await api.post(`/merchant/pos/orders/${refundFor.id}/goodwill`, {
          amount: payload.goodwillAmount,
          reason: payload.reason,
          method: payload.goodwillMethod || 'cash',
        });
        toast.success(t('webPosGoodwillSubmitted'));
      } else {
        const res = await api.post(`/merchant/pos/orders/${refundFor.id}/refund`, {
          reason: payload.reason,
          fullTicket: payload.mode === 'full',
          items: payload.mode === 'items' ? payload.items : undefined,
        });
        toast.success(t('webPosOrderRefunded'));
        if (onPrintRefund && res.data) {
          try {
            await onPrintRefund({
              order: refundFor,
              refunded: Number(res.data.refunded || 0),
              refundTotal: Number(res.data.refundTotal || 0),
              reason: payload.reason,
              allocation: res.data.allocation,
            });
          } catch {
            /* print is best-effort */
          }
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
    try {
      await api.patch(`/merchant/pos/orders/${paymentEditFor.id}/payment-method`, {
        paymentMethod: paymentMethodDraft,
      });
      toast.success(t('webPosPaymentUpdated'));
      setPaymentEditFor(null);
      void load();
      setSelectedOrder((prev) =>
        prev && prev.id === paymentEditFor.id
          ? { ...prev, paymentMethod: paymentMethodDraft }
          : prev
      );
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentUpdateFailed'));
    }
  };

  const doCollectPayment = async () => {
    if (!collectFor) return;
    setCollectBusy(true);
    try {
      const res = await api.post(`/merchant/orders/${collectFor.id}/action`, {
        action: 'complete_and_collect',
        paymentMethod: paymentMethodDraft,
      });
      toast.success(t('webPosPaymentCollected'));
      setCollectFor(null);
      const updated = res.data?.order as PosOrder | undefined;
      setSelectedOrder(updated || null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentCollectFailed'));
    } finally {
      setCollectBusy(false);
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

  const orderActionMenu = (
    order: PosOrder,
    opts: { onClose: () => void; align?: 'left' | 'right'; anchor: HTMLElement | null }
  ) => {
    const showPrint = !!onPrintOrder;
    const showCancel = !!(canCancel && canCancelOrder(order));
    const showRefund = !!(canRefund && canRefundOrder(order));
    const showEditPay = canEditPayment(order);
    if (!showPrint && !showCancel && !showRefund && !showEditPay) return null;
    if (!opts.anchor) return null;
    return (
      <PortaledActionMenu
        anchor={opts.anchor}
        align={opts.align}
        onClose={opts.onClose}
      >
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

  const channelFilters: Array<{ id: ChannelFilter; label: string }> = [
    { id: 'all', label: t('webPosAllOrders') },
    { id: 'dine_in', label: t('dineIn') },
    { id: 'takeaway', label: t('takeaway') },
    { id: 'delivery', label: t('delivery') },
    { id: 'online', label: t('webPosOnlineOrders') },
  ];

  const cancelModalOpen = !!(cancelFor || cancelHeldFor);

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
          <div className="relative min-w-0 flex-1 basis-full sm:min-w-[12rem] sm:basis-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-8 pr-3 text-sm"
              placeholder={t('webPosSearchOrders')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
          </div>
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
          <div className="ml-auto flex items-center gap-1 text-xs text-stone-500">
            <span className="tabular-nums">
              {rangeStart}-{rangeEnd} / {listItems.length}
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
            <button
              type="button"
              className="rounded p-1.5 hover:bg-stone-100"
              onClick={() => void load()}
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
        <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            className={
              ordersView === 'grid'
                ? 'min-h-0 min-w-0 w-full flex-1 overflow-y-auto'
                : selectedHeld || selectedOrder
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
                    const heldMeta =
                      h.cartJson && typeof h.cartJson === 'object' && !Array.isArray(h.cartJson)
                        ? (h.cartJson as {
                            tabNumber?: string | null;
                            ticketDisplay?: string | null;
                            tableLabel?: string | null;
                          })
                        : {};
                    const idLabel =
                      heldMeta.tableLabel ||
                      (heldMeta.tabNumber ? `#${heldMeta.tabNumber}` : null) ||
                      heldMeta.ticketDisplay ||
                      h.label ||
                      '—';
                    const age = formatOrderAge(heldTimeMs(h) || nowMs, nowMs);
                    return (
                      <button
                        key={`hg-${h.id}`}
                        type="button"
                        onClick={() => openHeldInCart(h)}
                        className="flex min-h-[9.5rem] flex-col overflow-hidden rounded-xl border border-stone-200 bg-stone-900 text-left text-white shadow-sm transition hover:ring-2 hover:ring-teal-400"
                      >
                        <div
                          className={`flex items-center justify-between gap-1 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white ${channelHeaderClass(h.channel)}`}
                        >
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <ChannelGlyph ch={h.channel} />
                            <span className="truncate">{channelLabel(h.channel)}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">{idLabel}</span>
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">
                          <p className="text-[11px] text-stone-400">
                            {sentCount}/{lines.length || 0}
                          </p>
                          <p className="text-lg font-bold tabular-nums tracking-tight">
                            <span className="text-stone-300 text-sm font-semibold">CHF </span>
                            <span className="text-amber-300">{Number(total).toFixed(2)}</span>
                          </p>
                          <p className="text-[11px] font-semibold uppercase text-stone-300">
                            {statusLabel(h.status)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-stone-700 px-2.5 py-1.5 text-[10px] text-stone-400">
                          <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <User size={11} />
                            <span className="truncate">{t('webPosOngoing')}</span>
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
                  const idLabel =
                    o.tableLabel ||
                    (refs.tabNumber ? `#${refs.tabNumber}` : null) ||
                    refs.ticketDisplay ||
                    o.orderNumber;
                  const age = formatOrderAge(orderTimeMs(o) || nowMs, nowMs);
                  const itemCount = Array.isArray(o.items) ? o.items.length : 0;
                  return (
                    <button
                      key={`og-${o.id}`}
                      type="button"
                      onClick={() => selectOrder(o)}
                      className="flex min-h-[9.5rem] flex-col overflow-hidden rounded-xl border border-stone-200 bg-stone-900 text-left text-white shadow-sm transition hover:ring-2 hover:ring-teal-400"
                    >
                      <div
                        className={`flex items-center justify-between gap-1 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white ${channelHeaderClass(o.channel)}`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <ChannelGlyph ch={o.channel} />
                          <span className="truncate">{channelLabel(o.channel)}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{idLabel}</span>
                      </div>
                      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">
                        <p className="text-[11px] text-stone-400">{itemCount}</p>
                        <p className="text-lg font-bold tabular-nums tracking-tight">
                          <span className="text-stone-300 text-sm font-semibold">CHF </span>
                          <span className="text-amber-300">{Number(o.total).toFixed(2)}</span>
                        </p>
                        <p className="text-[11px] font-semibold uppercase text-stone-300">
                          {canCollectPayment(o)
                            ? t('webPosAwaitingPayment')
                            : statusLabel(o.status)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-stone-700 px-2.5 py-1.5 text-[10px] text-stone-400">
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
                    const heldMeta =
                      h.cartJson && typeof h.cartJson === 'object' && !Array.isArray(h.cartJson)
                        ? (h.cartJson as {
                            tabNumber?: string | null;
                            ticketDisplay?: string | null;
                            tableLabel?: string | null;
                          })
                        : {};
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
                                  {formatDateTime(h.updatedAt || h.createdAt || Date.now())}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">
                                {money(total)}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${channelBadgeClass(h.channel)}`}
                              >
                                {channelLabel(h.channel)}
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
                              <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-800">
                                {t('webPosOngoing')}
                              </span>
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
                  const selected = selectedOrder?.id === o.id;
                  const isSplitRow = o.masterOrderId && (splitCounts.get(o.masterOrderId) || 0) > 1;
                  const isCompletedSale = !canCancelOrder(o);
                  const rowMenuOpen = rowMenuOrderId === o.id;
                  const refs = orderPublicRefs(o);
                  const titleParts = [
                    refs.ticketDisplay,
                    refs.tabNumber ? `${t('webPosTab')} ${refs.tabNumber}` : null,
                    o.tableLabel ? `${t('table')} ${o.tableLabel}` : null,
                    o.customerName || null,
                  ].filter(Boolean);
                  return (
                    <li key={`o-${o.id}`} className="relative">
                      <button
                        type="button"
                        onClick={() => selectOrder(o)}
                        className={`flex w-full items-start gap-2 px-3 py-3.5 text-left hover:bg-stone-50 sm:items-center sm:gap-3 sm:px-4 ${
                          selected ? 'bg-teal-50' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {titleParts.length
                                  ? titleParts.join(' · ')
                                  : o.orderNumber}
                              </p>
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
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${channelBadgeClass(o.channel)}`}
                            >
                              {channelLabel(o.channel)}
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
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                o.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : o.status === 'cancelled'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {statusLabel(o.status)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-stone-400">{o.orderNumber}</p>
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
                          <Info size={16} className="mt-1 shrink-0 text-stone-400 sm:mt-0" />
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
          {/* Detail panel — full-screen overlay on phone; side column from lg up */}
          <aside
            className={
              selectedHeld || selectedOrder
                ? 'absolute inset-0 z-10 flex min-h-0 w-full flex-col bg-stone-50 lg:static lg:max-w-sm lg:shrink-0 lg:border-l lg:border-stone-200'
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
                    {channelLabel(selectedHeld.channel)} · {statusLabel(selectedHeld.status)}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {heldCartLines(selectedHeld).map((l, idx) => (
                      <li key={idx} className="flex justify-between gap-2">
                        <span>
                          {l.quantity}× {resolveOrderItemName(l.name)}
                        </span>
                        <span className="tabular-nums">{money(l.lineTotal)}</span>
                      </li>
                    ))}
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
                      channelLabel(selectedOrder.channel),
                      statusLabel(selectedOrder.status),
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
                    <p className="text-sm font-semibold">
                      {refs.ticketDisplay ||
                        (refs.tabNumber
                          ? `${t('webPosTab')} ${refs.tabNumber}`
                          : selectedOrder.orderNumber)}
                    </p>
                    <p className="text-xs text-stone-500">
                      {statusLabel(selectedOrder.status)}
                      {refs.tabNumber && refs.ticketDisplay
                        ? ` · ${t('webPosTab')} ${refs.tabNumber}`
                        : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">{selectedOrder.orderNumber}</p>
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
                  <div className="mt-4 flex justify-between border-t border-stone-200 pt-3 text-base font-bold">
                    <span>{t('webPosTotal')}</span>
                    <span className="tabular-nums">{money(selectedOrder.total)}</span>
                  </div>
                  {selectedOrder.paymentMethod ? (
                    <p className="mt-2 text-sm text-stone-600">
                      {t('webPosPaymentMethod')}:{' '}
                      <span className="font-semibold">
                        {formatOrderPaymentDisplay(selectedOrder, t, locale)}
                      </span>
                      {canCollectPayment(selectedOrder) ? (
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
                </div>
                {canCollectPayment(selectedOrder) ? (
                  <div className="space-y-2 border-t border-stone-200 p-3">
                    <button
                      type="button"
                      className="w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white hover:bg-emerald-800"
                      onClick={() => {
                        setPaymentEditFor(null);
                        setPaymentMethodDraft('cash');
                        setCollectFor(selectedOrder);
                      }}
                    >
                      {t('webPosTakePayment')} · {money(selectedOrder.total)}
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
        </div>
        {collectFor ? (
          <div className="border-t border-stone-200 bg-white p-4 space-y-3">
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
        ) : paymentEditFor ? (
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
        onClose={() => {
          setCancelFor(null);
          setCancelHeldFor(null);
        }}
        onConfirm={(reason) => {
          if (cancelHeldFor) void doCancelHeld(reason);
          else void doCancelOrder(reason);
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
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
