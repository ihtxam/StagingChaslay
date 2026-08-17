import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Filter, Printer, RefreshCw, Search, ShoppingBag, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';
import {
  formatOrderPaymentDisplay,
  isOnlineShopOrder,
  orderSourceLabel,
  orderChannel,
  ONLINE_CHANNEL_BORDER,
  ONLINE_CHANNEL_STYLE,
  orderPublicRefs,
  orderSearchHaystack,
  todayIso,
  type MerchantOrder,
} from '@/lib/order-management';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { printMerchantOrderReceipt } from '@/lib/print-order-receipt';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
} from '@/components/settings/SettingsReportUi';
import SalesAdjustmentModal from '@/components/webpos/SalesAdjustmentModal';
import { useSecretTap } from '@/lib/use-secret-tap';

type ChannelFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery' | 'online';

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

function matchesChannelFilter(o: MerchantOrder, filter: ChannelFilter) {
  if (filter === 'all') return true;
  if (filter === 'online') return isOnlineShopOrder(o);
  return orderChannel(o) === filter;
}

export default function Orders() {
  const { t, formatDateTime, locale } = useI18n();
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MerchantOrder | null>(null);

  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [search, setSearch] = useState('');

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
  const [printing, setPrinting] = useState(false);
  const [salesAdjOpen, setSalesAdjOpen] = useState(false);
  const registerSalesAdjTap = useSecretTap(5);

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
      setOrders((response.data.orders || []) as MerchantOrder[]);
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
  }, [load]);

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

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
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
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, paymentFilter, channelFilter, staffFilter, staffList, search]);

  const openDetail = async (order: MerchantOrder) => {
    try {
      const res = await api.get(`/merchant/orders/${order.id}`);
      setSelected((res.data.order as MerchantOrder) || order);
    } catch {
      setSelected(order);
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
              <button
                type="button"
                className="absolute left-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                onClick={() => registerSalesAdjTap(() => setSalesAdjOpen(true))}
              >
                <Search size={14} />
              </button>
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
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> {t('webPosOnlineOrders')}
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
          const online = isOnlineShopOrder(order);
          const title =
            refs.ticketDisplay ||
            (refs.tabNumber ? `#${refs.tabNumber}` : null) ||
            formatOrderNumberDisplay(order.orderNumber) ||
            order.id.slice(0, 8);
          return (
            <article
              key={order.id}
              className={`cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] border-l-[3px] bg-[var(--bg-elevated)] p-3.5 shadow-sm transition hover:shadow-md ${
                online ? ONLINE_CHANNEL_BORDER : CHANNEL_BORDER[ch] || 'border-l-slate-400'
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
                    online ? ONLINE_CHANNEL_STYLE : CHANNEL_STYLE[ch] || 'bg-[var(--bg-muted)]'
                  }`}
                >
                  {online
                    ? orderSourceLabel((order as { orderSource?: string | null }).orderSource) ||
                      t('ordersOnlineShop')
                    : channelLabel(ch)}
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
            </article>
          );
        })}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-[var(--bg-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold">
                  {formatOrderNumberDisplay(selected.orderNumber) || selected.id.slice(0, 8)}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">{statusLabel(selected.status, t)}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                onClick={() => setSelected(null)}
              >
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

              <SettingsReportCard icon={ShoppingBag} accent={settingsDash.accent} title={t('ordersActionsTitle')}>
                <button
                  type="button"
                  disabled={printing}
                  onClick={() => void doPrint(selected)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bg-muted)] disabled:opacity-50"
                >
                  <Printer size={16} />
                  {t('webPosPrintReceipt')}
                </button>
              </SettingsReportCard>
            </div>
          </div>
        </div>
      ) : null}
      <SalesAdjustmentModal
        open={salesAdjOpen}
        onClose={() => setSalesAdjOpen(false)}
        onApplied={() => void load()}
      />
    </div>
  );
}
