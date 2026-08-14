import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Ban,
  CreditCard,
  Filter,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Undo2,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { playOrderAlertOnce, startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/order-alert';
import { resolveOrderItemName } from '@/lib/order-item-name';
import {
  canCancelOrder,
  canCollectPayment,
  canEditPayment,
  canRefundOrder,
  formatOrderPaymentDisplay,
  isAwaitingApproval,
  isOnlineShopOrder,
  orderSourceLabel,
  isProgrammedOrder,
  orderChannel,
  orderPublicRefs,
  orderSearchHaystack,
  todayIso,
  type MerchantOrder,
} from '@/lib/order-management';
import { printMerchantOrderReceipt, printRefundReceipt } from '@/lib/print-order-receipt';
import { hasTerminalPortion, parsePaymentBreakdown } from '@/lib/payment-breakdown';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
} from '@/components/settings/SettingsReportUi';
import WebPosCancelModal from '@/components/webpos/WebPosCancelModal';
import WebPosRefundModal, {
  type RefundReasonOption,
} from '@/components/webpos/WebPosRefundModal';

type BoardTab = 'new' | 'kitchen' | 'ready' | 'programmed' | 'all';
type ChannelFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery' | 'online';
type CancelReason = { id: string; en: string; fr: string; de: string };

const CHANNEL_STYLE: Record<string, string> = {
  takeaway:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  dine_in:
    'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
  delivery:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
};

const CHANNEL_BORDER: Record<string, string> = {
  takeaway: 'border-l-amber-500',
  dine_in: 'border-l-sky-500',
  delivery: 'border-l-emerald-500',
};

const PAYMENT_OPTIONS = ['cash', 'card', 'terminal'] as const;

function orderItemName(item: NonNullable<MerchantOrder['items']>[number]) {
  return resolveOrderItemName(item.productName, item.name, item.product?.name);
}

function statusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    pending: t('orderStatusPending'),
    pending_approval: t('orderStatusPending'),
    accepted: t('orderStatusAccepted'),
    preparing: t('orderStatusPreparing'),
    ready: t('orderStatusReady'),
    out_for_delivery: t('orderStatusOutForDelivery'),
    completed: t('orderStatusCompleted'),
    cancelled: t('orderStatusCancelled'),
    refunded: t('webPosStatusRefunded'),
    partially_refunded: t('webPosStatusPartialRefund'),
  };
  return map[status] || status;
}

function paymentLabel(method: string | null | undefined, t: (k: string) => string) {
  const m = (method || '').toLowerCase();
  if (m === 'cash') return t('webPosCash');
  if (m === 'card') return t('webPosCard');
  if (m === 'terminal') return t('webPosTerminal');
  if (m === 'gift_card') return t('giftCard');
  if (m === 'mixed') return t('webPosMixedPayment');
  if (m === 'express') return t('webPosExpress');
  if (m === 'pay_later' || m === 'pay-later') return t('webPosPayLater');
  return method || '—';
}

function matchesChannelFilter(o: MerchantOrder, filter: ChannelFilter) {
  if (filter === 'all') return true;
  if (filter === 'online') return isOnlineShopOrder(o);
  return orderChannel(o) === filter;
}

export default function Orders() {
  const { t, formatDateTime, locale } = useI18n();
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BoardTab>('new');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<MerchantOrder | null>(null);
  const knownNewIdsRef = useRef<Set<string> | null>(null);

  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([]);
  const [refundReasons, setRefundReasons] = useState<RefundReasonOption[]>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string }>>([]);
  const [merchant, setMerchant] = useState<{
    name?: string;
    address?: string;
    city?: string;
    phone?: string;
    vatNumber?: string;
    vatRate?: string;
    taxIncludedInPrice?: boolean;
    shopLogoUrl?: string;
  } | null>(null);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);

  const [cancelFor, setCancelFor] = useState<MerchantOrder | null>(null);
  const [refundFor, setRefundFor] = useState<MerchantOrder | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [paymentEditFor, setPaymentEditFor] = useState<MerchantOrder | null>(null);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState('cash');
  const [collectFor, setCollectFor] = useState<MerchantOrder | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const [settingsRes, staffRes] = await Promise.all([
        api.get('/merchant/settings'),
        api.get('/merchant/staff').catch(() => ({ data: { staff: [] } })),
      ]);
      const s = settingsRes.data?.settings || settingsRes.data || {};
      setMerchant({
        name: s.name,
        address: s.address,
        city: s.city,
        phone: s.phone,
        vatNumber: s.vatNumber,
        vatRate: s.vatRate,
        taxIncludedInPrice: s.taxIncludedInPrice,
        shopLogoUrl: s.shopLogoUrl,
      });
      setPrintSettings(s.posPrintSettings || null);
      setStaffList(
        (staffRes.data?.staff || []).map((row: { id: string; name: string }) => ({
          id: row.id,
          name: row.name,
        }))
      );
    } catch {
      /* optional meta */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: '200',
        from: dateFrom,
        to: dateTo,
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await api.get(`/merchant/pos/orders?${params.toString()}`);
      const next = (response.data.orders || []) as MerchantOrder[];
      setOrders(next);
      setCancelReasons(response.data.cancelReasons || []);
      setRefundReasons(response.data.refundReasons || []);

      const newIds = next
        .filter(
          (o) =>
            isOnlineShopOrder(o) &&
            (o.status === 'pending' || o.status === 'pending_approval')
        )
        .map((o) => o.id);

      if (knownNewIdsRef.current == null) {
        knownNewIdsRef.current = new Set(newIds);
      } else {
        const fresh = newIds.filter((id) => !knownNewIdsRef.current!.has(id));
        for (const id of newIds) knownNewIdsRef.current.add(id);
        if (fresh.length > 0) {
          playOrderAlertOnce();
          startOrderAlertLoop(5000);
          toast(t('webPosNewOrderAlert'), { icon: '🔔', duration: 5000 });
        }
        if (newIds.length === 0) stopOrderAlertLoop();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ordersLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter, t]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10000);
    return () => {
      clearInterval(id);
      stopOrderAlertLoop();
    };
  }, [load]);

  useEffect(() => {
    if (tab === 'new') stopOrderAlertLoop();
  }, [tab]);

  const channelLabel = (channel?: string | null) => {
    if (channel === 'dine_in') return t('dineIn');
    if (channel === 'delivery') return t('delivery');
    if (channel === 'takeaway') return t('takeaway');
    if (isOnlineShopOrder({ orderType: 'web_shop', channel } as MerchantOrder)) {
      return t('webPosOnlineOrders');
    }
    return channel || '-';
  };

  const staffNamesInOrders = useMemo(() => {
    const names = new Set<string>();
    for (const o of orders) {
      if (o.staffName?.trim()) names.add(o.staffName.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (paymentFilter !== 'all' && (o.paymentMethod || '').toLowerCase() !== paymentFilter) {
        return false;
      }
      if (!matchesChannelFilter(o, channelFilter)) return false;
      if (staffFilter !== 'all') {
        const staffRow = staffList.find((s) => s.id === staffFilter);
        const target = staffRow?.name || staffFilter;
        if ((o.staffName || '').trim() !== target) return false;
      }
      if (q && !orderSearchHaystack(o).includes(q)) return false;
      return true;
    });
  }, [orders, paymentFilter, channelFilter, staffFilter, staffList, search]);

  const board = useMemo(() => {
    const byNewest = (a: MerchantOrder, b: MerchantOrder) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    const online = filteredOrders.filter(isOnlineShopOrder);
    return {
      new: online.filter((o) => isAwaitingApproval(o.status)).sort(byNewest),
      kitchen: online
        .filter((o) => o.status === 'accepted' || o.status === 'preparing')
        .sort(byNewest),
      ready: online
        .filter((o) => o.status === 'ready' || o.status === 'out_for_delivery')
        .sort(byNewest),
      programmed: filteredOrders.filter(isProgrammedOrder).sort(byNewest),
      all: [...filteredOrders].sort(byNewest),
    };
  }, [filteredOrders]);

  const list =
    tab === 'new'
      ? board.new
      : tab === 'kitchen'
        ? board.kitchen
        : tab === 'ready'
          ? board.ready
          : tab === 'programmed'
            ? board.programmed
            : board.all;

  const syncSelected = useCallback(
    (next: MerchantOrder[]) => {
      if (!selected) return;
      const fresh = next.find((o) => o.id === selected.id);
      if (fresh) setSelected(fresh);
    },
    [selected]
  );

  const runAction = async (orderId: string, action: string, extra?: Record<string, unknown>) => {
    setBusyId(orderId);
    try {
      await api.post(`/merchant/orders/${orderId}/action`, { action, ...extra });
      toast.success(t('updated'));
      await load();
      if (selected?.id === orderId) {
        try {
          const refreshed = await api.get(`/merchant/orders/${orderId}`);
          if (refreshed.data?.order) setSelected(refreshed.data.order);
        } catch {
          syncSelected(orders);
        }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('actionFailed'));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (order: MerchantOrder) => {
    try {
      const res = await api.get(`/merchant/orders/${order.id}`);
      setSelected((res.data.order as MerchantOrder) || order);
    } catch {
      setSelected(order);
    }
  };

  const doCancelOrder = async (reason: string) => {
    if (!cancelFor) return;
    try {
      await api.post(`/merchant/pos/orders/${cancelFor.id}/cancel`, { reason });
      toast.success(t('webPosOrderCancelled'));
      setCancelFor(null);
      if (selected?.id === cancelFor.id) setSelected(null);
      await load();
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
        if (merchant && res.data) {
          try {
            await printRefundReceipt(
              {
                businessName: merchant.name || '',
                orderNumber: refundFor.orderNumber,
                orderDisplay: orderPublicRefs(refundFor).ticketDisplay,
                refundedAt: Date.now(),
                refundAmount: Number(res.data.refunded || 0),
                refundTotal: Number(res.data.refundTotal || 0),
                reason: payload.reason,
                allocation: res.data.allocation,
              },
              { merchant, printSettings, locale }
            );
            toast.success(t('webPosSentDefaultPrinter'));
          } catch {
            /* print best-effort */
          }
        }
      }
      setRefundFor(null);
      await load();
      if (selected?.id === refundFor.id) {
        try {
          const refreshed = await api.get(`/merchant/orders/${refundFor.id}`);
          if (refreshed.data?.order) setSelected(refreshed.data.order);
          else setSelected(null);
        } catch {
          setSelected(null);
        }
      }
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
      await load();
      if (selected?.id === paymentEditFor.id) {
        setSelected((prev) =>
          prev && prev.id === paymentEditFor.id
            ? { ...prev, paymentMethod: paymentMethodDraft }
            : prev
        );
      }
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
      const updated = res.data?.order as MerchantOrder | undefined;
      if (updated) setSelected(updated);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentCollectFailed'));
    } finally {
      setCollectBusy(false);
    }
  };

  const doPrint = async (order: MerchantOrder) => {
    if (!merchant) {
      toast.error(t('webPosPrintFailed'));
      return;
    }
    setPrinting(true);
    try {
      await printMerchantOrderReceipt(order, {
        merchant,
        printSettings,
        locale,
      });
      toast.success(t('webPosSentDefaultPrinter'));
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    } finally {
      setPrinting(false);
    }
  };

  const startEditPayment = (order: MerchantOrder) => {
    setPaymentEditFor(order);
    setRefundFor(null);
    const m = (order.paymentMethod || 'cash').toLowerCase();
    setPaymentMethodDraft(m === 'card' ? 'card' : m === 'terminal' ? 'terminal' : 'cash');
  };

  const actionsFor = (order: MerchantOrder) => {
    const s = order.status;
    const ch = orderChannel(order);
    const paid = order.paymentStatus === 'completed' || order.paymentStatus === 'paid';
    const cash =
      order.paymentMethod === 'cash' ||
      order.paymentMethod === 'pay_later' ||
      order.paymentMethod === 'pay-later' ||
      order.paymentStatus === 'cash' ||
      order.paymentStatus === 'awaiting_payment';
    const btns: { action: string; label: string; style: string }[] = [];

    if (isProgrammedOrder(order)) {
      if (s === 'accepted') {
        btns.push({ action: 'start_preparing', label: t('webPosStartKitchen'), style: 'bg-slate-900' });
      }
      if (s === 'preparing' || s === 'accepted') {
        btns.push({ action: 'mark_ready', label: t('webPosMarkReady'), style: 'bg-teal-600' });
      }
      btns.push({
        action: 'complete_and_collect',
        label: t('ordersCollectCash'),
        style: 'bg-emerald-700',
      });
      return btns;
    }

    if (!isOnlineShopOrder(order)) return btns;

    if (isAwaitingApproval(s)) {
      btns.push({ action: 'accept', label: t('webPosAcceptOrder'), style: 'bg-emerald-600' });
      btns.push({ action: 'reject', label: t('webPosRejectOrder'), style: 'bg-red-600' });
      return btns;
    }
    if (s === 'accepted') {
      btns.push({ action: 'start_preparing', label: t('webPosStartKitchen'), style: 'bg-slate-900' });
    }
    if (s === 'preparing' || s === 'accepted') {
      btns.push({ action: 'mark_ready', label: t('webPosMarkReady'), style: 'bg-teal-600' });
    }
    if (s === 'ready' && ch === 'delivery') {
      btns.push({
        action: 'out_for_delivery',
        label: t('ordersActionSendDelivery'),
        style: 'bg-emerald-600',
      });
    }
    if ((s === 'ready' || s === 'out_for_delivery') && !paid && cash) {
      if (!(ch === 'delivery' && s === 'ready')) {
        btns.push({
          action: 'complete_and_collect',
          label: t('ordersCollectCash'),
          style: 'bg-emerald-700',
        });
      }
    }
    if (s === 'out_for_delivery') {
      btns.push({
        action: paid ? 'complete' : 'complete_and_collect',
        label: paid ? t('ordersActionMarkDelivered') : t('ordersActionDeliveredCollect'),
        style: 'bg-emerald-700',
      });
    }
    if (s === 'ready' && ch !== 'delivery' && paid) {
      btns.push({
        action: 'complete',
        label: t('ordersActionCompleteHandover'),
        style: 'bg-emerald-700',
      });
    }
    return btns;
  };

  const clearFilters = () => {
    setDateFrom(todayIso());
    setDateTo(todayIso());
    setStatusFilter('all');
    setPaymentFilter('all');
    setChannelFilter('all');
    setStaffFilter('all');
    setSearch('');
  };

  const hasActiveFilters =
    paymentFilter !== 'all' ||
    channelFilter !== 'all' ||
    staffFilter !== 'all' ||
    search.trim() !== '' ||
    dateFrom !== todayIso() ||
    dateTo !== todayIso();

  const refundModalItems = useMemo(
    () =>
      (refundFor?.items || []).map((it) => ({
        id: String(it.id || ''),
        name: orderItemName(it),
        quantity: Number(it.quantity) || 0,
        totalPrice: Number(it.totalPrice) || 0,
        refundedQuantity: Number(it.refundedQuantity || 0),
      })),
    [refundFor]
  );

  if (loading && orders.length === 0) {
    return <div className="text-center py-10 muted text-sm">{t('ordersLoading')}</div>;
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <SettingsPageHeader
        title={t('orders')}
        subtitle={t('ordersManageHint')}
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary inline-flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('ordersRefresh')}
          </button>
        }
      />

      <SettingsReportCard
        icon={Filter}
        accent={settingsDash.info}
        title={t('ordersFilterTitle')}
        description={t('ordersFilterHint')}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsField label={t('ordersFilterFrom')}>
            <input
              type="date"
              className="input w-full"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </SettingsField>
          <SettingsField label={t('ordersFilterTo')}>
            <input
              type="date"
              className="input w-full"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </SettingsField>
          <SettingsField label={t('webPosSearchOrders')}>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="search"
                className="input w-full pl-8"
                placeholder={t('webPosSearchOrders')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </SettingsField>
          <SettingsField label={t('ordersFilterStatus')}>
            <select
              className="input w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">{t('ordersAllStatuses')}</option>
              <option value="pending">{t('orderStatusPending')}</option>
              <option value="accepted">{t('orderStatusAccepted')}</option>
              <option value="preparing">{t('orderStatusPreparing')}</option>
              <option value="ready">{t('orderStatusReady')}</option>
              <option value="out_for_delivery">{t('orderStatusOutForDelivery')}</option>
              <option value="completed">{t('orderStatusCompleted')}</option>
              <option value="cancelled">{t('orderStatusCancelled')}</option>
              <option value="refunded">{t('webPosStatusRefunded')}</option>
              <option value="partially_refunded">{t('webPosStatusPartialRefund')}</option>
            </select>
          </SettingsField>
          <SettingsField label={t('ordersFilterPayment')}>
            <select
              className="input w-full"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="all">{t('ordersAllPayments')}</option>
              <option value="cash">{t('webPosCash')}</option>
              <option value="card">{t('webPosCard')}</option>
              <option value="terminal">{t('webPosTerminal')}</option>
              <option value="express">{t('webPosExpress')}</option>
              <option value="pay_later">{t('webPosPayLater')}</option>
            </select>
          </SettingsField>
          <SettingsField label={t('ordersFilterChannel')}>
            <select
              className="input w-full"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
            >
              <option value="all">{t('ordersAllChannels')}</option>
              <option value="dine_in">{t('dineIn')}</option>
              <option value="takeaway">{t('takeaway')}</option>
              <option value="delivery">{t('delivery')}</option>
              <option value="online">{t('webPosOnlineOrders')}</option>
            </select>
          </SettingsField>
          <SettingsField label={t('ordersFilterStaff')}>
            <select
              className="input w-full"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
            >
              <option value="all">{t('ordersAllStaff')}</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {staffNamesInOrders
                .filter((n) => !staffList.some((s) => s.name === n))
                .map((n) => (
                  <option key={`name-${n}`} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </SettingsField>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            {t('ordersResults').replace('{n}', String(list.length))}
          </p>
          {hasActiveFilters ? (
            <button type="button" className="text-xs font-semibold text-teal-700" onClick={clearFilters}>
              {t('ordersClearFilters')}
            </button>
          ) : null}
        </div>
      </SettingsReportCard>

      <div className="flex flex-wrap gap-1.5 table-scroll pb-0.5">
        {(
          [
            ['new', `${t('ordersTabToApprove')} (${board.new.length})`],
            ['kitchen', `${t('ordersTabKitchen')} (${board.kitchen.length})`],
            ['ready', `${t('ordersTabReady')} (${board.ready.length})`],
            ['programmed', `${t('ordersProgrammed')} (${board.programmed.length})`],
            ['all', `${t('ordersTabAll')} (${board.all.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
              tab === id
                ? 'border-transparent text-white shadow-sm'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-muted)]'
            }`}
            style={tab === id ? { backgroundColor: settingsDash.accent } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5 text-[11px] font-medium text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> {t('takeaway')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> {t('dineIn')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('delivery')}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {list.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-12 text-center text-sm text-[var(--text-muted)]">
            {t('ordersEmpty')}
          </div>
        )}
        {list.map((order) => {
          const ch = orderChannel(order);
          const refs = orderPublicRefs(order);
          const title =
            refs.ticketDisplay ||
            (refs.tabNumber ? `#${refs.tabNumber}` : null) ||
            order.orderNumber ||
            order.id.slice(0, 8);
          return (
            <article
              key={order.id}
              className={`cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] border-l-[3px] bg-[var(--bg-elevated)] p-3.5 shadow-sm transition hover:shadow-md ${
                CHANNEL_BORDER[ch] || 'border-l-slate-400'
              }`}
              onClick={() => void openDetail(order)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void openDetail(order);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-extrabold">{title}</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {isOnlineShopOrder(order)
                      ? orderSourceLabel((order as { orderSource?: string | null }).orderSource) ||
                        t('ordersOnlineShop')
                      : t('ordersPos')}{' '}
                    · {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                    CHANNEL_STYLE[ch] || 'bg-[var(--bg-muted)]'
                  }`}
                >
                  {channelLabel(ch)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold">
                <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5">
                  {statusLabel(order.status, t)}
                </span>
                <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5">
                  {formatOrderPaymentDisplay(order, t, locale)}
                </span>
                {order.staffName ? (
                  <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 truncate max-w-[8rem]">
                    {order.staffName}
                  </span>
                ) : null}
                <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 font-extrabold tabular-nums">
                  CHF {Number(order.total || 0).toFixed(2)}
                </span>
              </div>

              {(order.customerName || order.customerPhone) && (
                <p className="mt-1.5 truncate text-xs">
                  {order.customerName}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                {actionsFor(order).map((btn) => (
                  <button
                    key={btn.action}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => void runAction(order.id, btn.action)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50 ${btn.style}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col bg-[var(--bg-elevated)] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold">
                  {selected.orderNumber || selected.id.slice(0, 8)}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">{statusLabel(selected.status, t)}</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-1.5 text-sm">
                <p>
                  <span className="text-[var(--text-muted)]">{t('ordersCustomer')}:</span>{' '}
                  {selected.customerName || '—'} {selected.customerPhone || ''}
                </p>
                {selected.shippingAddress ? (
                  <p>
                    <span className="text-[var(--text-muted)]">{t('ordersAddress')}:</span>{' '}
                    {selected.shippingAddress}
                  </p>
                ) : null}
                <p>
                  <span className="text-[var(--text-muted)]">{t('ordersPayment')}:</span>{' '}
                  {formatOrderPaymentDisplay(selected, t, locale)} / {selected.paymentStatus || '—'}
                </p>
                {selected.staffName ? (
                  <p>
                    <span className="text-[var(--text-muted)]">{t('ordersFilterStaff')}:</span>{' '}
                    {selected.staffName}
                  </p>
                ) : null}
                {selected.scheduledFor ? (
                  <p>
                    <span className="text-[var(--text-muted)]">{t('ordersScheduled')}:</span>{' '}
                    {formatDateTime(selected.scheduledFor)}
                  </p>
                ) : null}
                {selected.notes ? (
                  <p>
                    <span className="text-[var(--text-muted)]">{t('ordersNotes')}:</span> {selected.notes}
                  </p>
                ) : null}
                {selected.cancelReason ? (
                  <p className="text-rose-700">
                    {t('webPosCancelReason')}: {selected.cancelReason}
                  </p>
                ) : null}
                {selected.refundReason ? (
                  <p className="text-rose-700">
                    {t('webPosRefundReason')}: {selected.refundReason}
                  </p>
                ) : null}
              </div>

              <ul className="space-y-2 border-t border-[var(--border)] pt-3 text-sm">
                {(selected.items || []).map((item, i) => (
                  <li key={item.id || i} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {Number(item.quantity)}× {orderItemName(item)}
                      {!!item.comboSelections?.length && (
                        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                          {item.comboSelections
                            .map((c) => {
                              const name = resolveOrderItemName(c.productName);
                              return c.selectedExtras?.length
                                ? `${name} (${c.selectedExtras.map((e) => e.name).join(', ')})`
                                : name;
                            })
                            .join(' · ')}
                        </span>
                      )}
                      {!item.comboSelections?.length && !!item.selectedExtras?.length && (
                        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                          {item.selectedExtras.map((e) => e.name).join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      CHF {Number(item.totalPrice).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-right text-sm font-extrabold tabular-nums">
                Total CHF {Number(selected.total).toFixed(2)}
              </p>

              {actionsFor(selected).length > 0 ? (
                <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
                  {actionsFor(selected).map((btn) => (
                    <button
                      key={btn.action}
                      type="button"
                      disabled={busyId === selected.id}
                      onClick={() => void runAction(selected.id, btn.action)}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${btn.style}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <SettingsReportCard
                icon={ShoppingBag}
                accent={settingsDash.accent}
                title={t('ordersActionsTitle')}
              >
                <div className="grid gap-2">
                  <button
                    type="button"
                    disabled={printing}
                    onClick={() => void doPrint(selected)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bg-muted)] disabled:opacity-50"
                  >
                    <Printer size={16} />
                    {t('webPosPrintReceipt')}
                  </button>
                  {canRefundOrder(selected) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRefundFor(selected);
                        setPaymentEditFor(null);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bg-muted)]"
                    >
                      <Undo2 size={16} />
                      {t('webPosRefund')}
                    </button>
                  ) : null}
                  {canEditPayment(selected) ? (
                    <button
                      type="button"
                      onClick={() => startEditPayment(selected)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bg-muted)]"
                    >
                      <CreditCard size={16} />
                      {t('webPosEditPayment')}
                    </button>
                  ) : null}
                  {canCollectPayment(selected) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCollectFor(selected);
                        setPaymentMethodDraft('cash');
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                    >
                      {t('webPosTakePayment')} · CHF {Number(selected.total).toFixed(2)}
                    </button>
                  ) : null}
                  {canCancelOrder(selected) ? (
                    <button
                      type="button"
                      onClick={() => setCancelFor(selected)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Ban size={16} />
                      {t('webPosCancelOrder')}
                    </button>
                  ) : null}
                </div>
              </SettingsReportCard>
            </div>
          </div>
        </div>
      ) : null}

      {paymentEditFor ? (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl space-y-3">
            <p className="text-sm font-semibold">
              {t('webPosEditPayment')} · {paymentEditFor.orderNumber}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{t('webPosEditPaymentHint')}</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethodDraft(m)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                    paymentMethodDraft === m
                      ? 'bg-[var(--text)] text-[var(--bg-elevated)]'
                      : 'bg-[var(--bg-muted)] text-[var(--text)] hover:opacity-90'
                  }`}
                >
                  {paymentLabel(m, t)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setPaymentEditFor(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void doUpdatePayment()}>
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {collectFor ? (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl space-y-3">
            <p className="text-sm font-semibold">
              {t('webPosTakePayment')} · CHF {Number(collectFor.total).toFixed(2)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{t('webPosTakePaymentHint')}</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethodDraft(m)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                    paymentMethodDraft === m
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[var(--bg-muted)] text-[var(--text)]'
                  }`}
                >
                  {paymentLabel(m, t)}
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
        </div>
      ) : null}

      <WebPosCancelModal
        open={!!cancelFor}
        scope="order"
        reasons={cancelReasons}
        onClose={() => setCancelFor(null)}
        onConfirm={(reason) => void doCancelOrder(reason)}
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
        terminalEnabled={!!printSettings}
        onClose={() => setRefundFor(null)}
        onConfirm={(payload) => void doRefund(payload)}
      />
    </div>
  );
}
