import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PosOrderForReceipt } from '@/lib/webpos-receipt';
import WebPosCancelModal from '@/components/webpos/WebPosCancelModal';

type CancelReason = { id: string; en: string; fr: string; de: string };
export type PosOrder = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
  refundAmount: number;
  cancelReason?: string | null;
  notes?: string | null;
  masterOrderId?: string | null;
};
export type HeldRow = {
  id: string;
  label?: string | null;
  status: string;
  channel?: string | null;
  cartJson: unknown;
  notes?: string | null;
  updatedAt: string;
};
type StatusFilter = 'active' | 'completed' | 'all';
type ChannelFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery' | 'platform';
type Props = {
  open: boolean;
  /** Full-width in-tab layout instead of slide-over overlay */
  embedded?: boolean;
  onClose: () => void;
  onResumeHeld: (held: HeldRow) => void;
  onPrintOrder?: (order: PosOrderForReceipt, splitLabel?: string | null) => Promise<void>;
  /** Print kitchen void ticket when cancelling a sent-to-kitchen held order */
  onVoidHeldKitchen?: (held: HeldRow, reason: string) => Promise<void>;
  refreshToken?: number;
  canCancel?: boolean;
  canRefund?: boolean;
  highlightOrderId?: string | null;
};

const PAYMENT_OPTIONS = ['cash', 'card', 'terminal'] as const;

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}

/** Ongoing / kitchen / unpaid — not completed sales */
function canCancelOrder(o: PosOrder): boolean {
  const status = (o.status || '').toLowerCase();
  const pay = (o.paymentStatus || '').toLowerCase();
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status)) return false;
  if (['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(pay)) return false;
  return true;
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

function canRefundOrder(o: PosOrder): boolean {
  if (o.status === 'cancelled' || o.paymentStatus === 'cancelled') return false;
  const remaining = Number(o.total || 0) - Number(o.refundAmount || 0);
  if (remaining <= 0.001) return false;
  return (
    o.status === 'completed' ||
    o.status === 'partially_refunded' ||
    o.paymentStatus === 'completed' ||
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

const PAGE_SIZE = 10;

export default function WebPosOrdersPanel({
  open,
  embedded = false,
  onClose,
  onResumeHeld,
  onPrintOrder,
  onVoidHeldKitchen,
  refreshToken = 0,
  canCancel = true,
  canRefund = true,
  highlightOrderId = null,
}: Props) {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [search, setSearch] = useState('');
  const [held, setHeld] = useState<HeldRow[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [selectedHeld, setSelectedHeld] = useState<HeldRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [cancelFor, setCancelFor] = useState<PosOrder | null>(null);
  const [cancelHeldFor, setCancelHeldFor] = useState<HeldRow | null>(null);
  const [refundFor, setRefundFor] = useState<PosOrder | null>(null);
  const [refundPartial, setRefundPartial] = useState(false);
  const [refundAmountText, setRefundAmountText] = useState('');
  const [paymentEditFor, setPaymentEditFor] = useState<PosOrder | null>(null);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState('cash');
  const [page, setPage] = useState(0);

  const paymentLabel = (method?: string | null) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash') return t('webPosCash');
    if (m === 'card') return t('webPosCard');
    if (m === 'terminal') return t('webPosTerminal');
    if (m === 'express') return t('webPosExpress');
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
    if (isPlatformChannel(ch)) return t('webPosFoodPlatform');
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
    if (!open || !highlightOrderId || orders.length === 0) return;
    const match = orders.find((o) => o.id === highlightOrderId || o.clientId === highlightOrderId);
    if (match) {
      setStatusFilter('completed');
      setSelectedOrder(match);
      setSelectedHeld(null);
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
    if (statusFilter === 'active' || statusFilter === 'all') {
      for (const h of held) {
        if (channelFilter !== 'all') {
          if (channelFilter === 'platform') {
            if (!isPlatformChannel(h.channel)) continue;
          } else if ((h.channel || 'takeaway') !== channelFilter) {
            continue;
          }
        }
        if (q) {
          const label = (h.label || '').toLowerCase();
          if (!label.includes(q) && !(h.channel || '').toLowerCase().includes(q)) continue;
        }
        items.push({ kind: 'held', held: h });
      }
      for (const o of orders) {
        if (!canCancelOrder(o)) continue;
        if (channelFilter !== 'all') {
          if (channelFilter === 'platform') {
            if (!isPlatformChannel(o.channel)) continue;
          } else if ((o.channel || 'takeaway') !== channelFilter) {
            continue;
          }
        }
        if (q) {
          const hay = `${o.orderNumber} ${o.clientId || ''} ${o.customerName || ''} ${o.tableLabel || ''}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        items.push({ kind: 'order', order: o });
      }
    }
    if (statusFilter === 'completed' || statusFilter === 'all') {
      for (const o of orders) {
        // Ongoing orders already listed under Active; skip them here (including "All").
        if (canCancelOrder(o)) continue;
        if (channelFilter !== 'all') {
          if (channelFilter === 'platform') {
            if (!isPlatformChannel(o.channel)) continue;
          } else if ((o.channel || 'takeaway') !== channelFilter) {
            continue;
          }
        }
        if (q) {
          const hay = `${o.orderNumber} ${o.clientId || ''} ${o.customerName || ''} ${o.tableLabel || ''}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        items.push({ kind: 'order', order: o });
      }
    }
    return items;
  }, [held, orders, statusFilter, channelFilter, search]);

  const pageCount = Math.max(1, Math.ceil(listItems.length / PAGE_SIZE));
  const pageItems = listItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = listItems.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(listItems.length, (page + 1) * PAGE_SIZE);
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

  const doRefund = async () => {
    if (!refundFor) return;
    const remaining = round2(refundFor.total - refundFor.refundAmount);
    let amount: number | undefined;
    if (refundPartial) {
      amount = round2(Number(refundAmountText));
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.001) {
        toast.error(t('webPosRefundInvalidAmount'));
        return;
      }
    }
    try {
      await api.post(`/merchant/pos/orders/${refundFor.id}/refund`, { amount });
      toast.success(t('webPosOrderRefunded'));
      setRefundFor(null);
      setRefundPartial(false);
      setRefundAmountText('');
      setSelectedOrder(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosRefundFailed'));
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

  const printOne = async (order: PosOrder, splitLabel?: string | null) => {
    if (!onPrintOrder) return;
    setPrinting(true);
    try {
      await onPrintOrder(order, splitLabel);
    } finally {
      setPrinting(false);
    }
  };

  const selectHeld = (h: HeldRow) => {
    setSelectedHeld(h);
    setSelectedOrder(null);
  };

  const selectOrder = (o: PosOrder) => {
    setSelectedOrder(o);
    setSelectedHeld(null);
  };

  if (!open) return null;

  const channelFilters: Array<{ id: ChannelFilter; label: string }> = [
    { id: 'dine_in', label: t('dineIn') },
    { id: 'takeaway', label: t('takeaway') },
    { id: 'delivery', label: t('delivery') },
    { id: 'platform', label: t('webPosFoodPlatform') },
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
            <option value="completed">{t('webPosCompletedOrders')}</option>
            <option value="all">{t('webPosAllOrders')}</option>
          </select>
          <div className="flex flex-wrap gap-1">
            {channelFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setChannelFilter(channelFilter === f.id ? 'all' : f.id)}
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
              selectedHeld || selectedOrder
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
            ) : (
              <ul className="divide-y divide-stone-100">
                {pageItems.map((item) => {
                  if (item.kind === 'held') {
                    const h = item.held;
                    const selected = selectedHeld?.id === h.id;
                    const total = heldTotal(h);
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
                                  {new Date(h.updatedAt).toLocaleString()}
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
                  return (
                    <li key={`o-${o.id}`}>
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
                                {o.tableLabel ? `T ${o.tableLabel}` : o.orderNumber}
                                {o.customerName ? ` · ${o.customerName}` : ''}
                              </p>
                              <p className="mt-0.5 text-xs text-stone-500">
                                {new Date(o.completedAt || o.createdAt).toLocaleString()}
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
                        <Info size={16} className="mt-1 shrink-0 text-stone-400 sm:mt-0" />
                      </button>
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
                          {l.quantity}× {l.name || 'Item'}
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
                    onClick={() => setSelectedOrder(null)}
                  >
                    <ChevronLeft size={16} />
                    {t('back')}
                  </button>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{selectedOrder.orderNumber}</p>
                      <p className="text-xs text-stone-500">{statusLabel(selectedOrder.status)}</p>
                    </div>
                    {onPrintOrder ? (
                      <button
                        type="button"
                        className="rounded-lg p-2 hover:bg-white"
                        disabled={printing}
                        onClick={() => void printOne(selectedOrder)}
                      >
                        <Printer size={18} />
                      </button>
                    ) : null}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {selectedOrder.items.map((i, idx) => (
                      <li key={idx} className="flex justify-between gap-2">
                        <span>
                          {i.quantity}× {i.name || 'Item'}
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
                      <span className="font-semibold">{paymentLabel(selectedOrder.paymentMethod)}</span>
                    </p>
                  ) : null}
                  {selectedOrder.cancelReason ? (
                    <p className="mt-2 text-sm text-rose-700">
                      {t('webPosCancelReason')}: {selectedOrder.cancelReason}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCancel && canCancelOrder(selectedOrder) ? (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => setCancelFor(selectedOrder)}
                      >
                        {t('webPosCancelOrder')}
                      </button>
                    ) : null}
                    {canEditPayment(selectedOrder) ? (
                      <button
                        type="button"
                        className="btn-secondary inline-flex items-center gap-1 text-xs"
                        onClick={() => {
                          setPaymentEditFor(selectedOrder);
                          setPaymentMethodDraft(
                            (selectedOrder.paymentMethod || 'cash').toLowerCase() === 'card'
                              ? 'card'
                              : (selectedOrder.paymentMethod || 'cash').toLowerCase() === 'terminal'
                                ? 'terminal'
                                : 'cash'
                          );
                        }}
                      >
                        <CreditCard size={14} />
                        {t('webPosEditPayment')}
                      </button>
                    ) : null}
                    {canRefund && canRefundOrder(selectedOrder) ? (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => {
                          const remaining = round2(selectedOrder.total - selectedOrder.refundAmount);
                          setRefundFor(selectedOrder);
                          setRefundPartial(false);
                          setRefundAmountText(remaining.toFixed(2));
                        }}
                      >
                        {t('webPosRefund')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-stone-400">
                {t('webPosSelectOrderHint')}
              </div>
            )}
          </aside>
        </div>
        {refundFor ? (
          <div className="border-t border-stone-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium">
              {t('webPosRefund')} · {refundFor.orderNumber}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!refundPartial}
                onChange={() => setRefundPartial(false)}
              />
              {t('webPosRefundFull').replace(
                '{amount}',
                money(round2(refundFor.total - refundFor.refundAmount))
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={refundPartial}
                onChange={() => setRefundPartial(true)}
              />
              {t('webPosRefundPartial')}
            </label>
            {refundPartial ? (
              <input
                type="number"
                step="0.05"
                min="0.05"
                className="input"
                value={refundAmountText}
                onChange={(e) => setRefundAmountText(e.target.value)}
              />
            ) : null}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setRefundFor(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void doRefund()}>
                {t('webPosRefund')}
              </button>
            </div>
          </div>
        ) : null}
        {paymentEditFor ? (
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
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
