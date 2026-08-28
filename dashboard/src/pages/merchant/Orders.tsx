import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, FileText, Printer, RefreshCw, ShoppingBag, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { downloadInvoicePdf, viewInvoicePdf } from '@/lib/invoice-pdf';
import { resolveOrderItemName } from '@/lib/order-item-name';
import {
  canAdminCollectPayment,
  canCancelOrder,
  canCollectPayment,
  canMarkReadyOrder,
  showsKitchenFulfillmentStages,
  formatOrderPaymentDisplay,
  INVOICE_SETTLEMENT_METHOD,
  isAwaitingApproval,
  isAwaitingPaymentOrder,
  isInvoiceOrder,
  isKitchenTypeOrder,
  isDeliveryOrder,
  isOnlineShopOrder,
  isPaidOrder,
  isProgrammedOrder,
  orderSourceLabel,
  orderChannel,
  ONLINE_CHANNEL_BORDER,
  ONLINE_CHANNEL_STYLE,
  orderMatchesSearchQuery,
  orderListPrimaryLabel,
  orderStatusBadgeClass,
  resolveOrderCustomerDisplay,
  todayIso,
  type MerchantOrder,
} from '@/lib/order-management';
import { collectPaymentAction } from '@/lib/order-to-cart';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { parseHeldCartJson, resolveHeldChannel } from '@/lib/webpos-held';
import { printMerchantOrderReceipt, printRefundReceipt } from '@/lib/print-order-receipt';
import { toastPrintError } from '@/lib/webpos-print-toast';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';
import { parsePaymentBreakdown, hasTerminalPortion } from '@/lib/payment-breakdown';
import WebPosRefundModal, { type RefundReasonOption } from '@/components/webpos/WebPosRefundModal';
import WebPosRefundPrintPromptModal from '@/components/webpos/WebPosRefundPrintPromptModal';
import OrderRefundHistory from '@/components/orders/OrderRefundHistory';
import {
  settingsDash,
} from '@/components/settings/SettingsReportUi';
import SalesAdjustmentModal from '@/components/webpos/SalesAdjustmentModal';
import SecretSearchTapButton from '@/components/SecretSearchTapButton';
import DeliveryLiveMap from '@/components/delivery/DeliveryLiveMap';
import { useAuthStore } from '@/store/auth';
import { hasPermission, type Permission } from '@/lib/permissions';

type ChannelFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery' | 'online';
type TypeFilter = 'all' | 'kitchen' | 'delivery' | 'takeaway' | 'dine_in' | 'online' | 'invoice' | 'programmed';

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

type HeldRow = {
  id: string;
  label?: string | null;
  status: string;
  channel?: string | null;
  cartJson: unknown;
  staffName?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

function isHeldListRow(order: MerchantOrder): boolean {
  return String(order.id).startsWith('held:');
}

function heldToMerchantOrder(h: HeldRow): MerchantOrder {
  const meta = parseHeldCartJson(h.cartJson);
  const lines = meta.cart || [];
  const total = lines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
  const ch = resolveHeldChannel({ channel: h.channel, cartJson: h.cartJson });
  const tabShout = meta.tabNumber ? `#${String(meta.tabNumber).replace(/^#/, '')}` : null;
  return {
    id: `held:${h.id}`,
    orderNumber: meta.ticketOrderNumber || '',
    ticketDisplay: meta.ticketDisplay || tabShout,
    tabNumber: meta.tabNumber,
    channel: ch,
    fulfillmentChannel: ch,
    orderType: 'pos',
    status: h.status === 'sent_to_kitchen' ? 'preparing' : 'pending',
    paymentStatus: 'awaiting_payment',
    paymentMethod: 'pay_later',
    total,
    subtotal: total,
    taxAmount: 0,
    refundAmount: 0,
    staffName: h.staffName || null,
    tableLabel: meta.tableLabel,
    customerId: meta.customerId || null,
    customerName: meta.customerName || null,
    customerPhone: meta.customerPhone || null,
    customerEmail: meta.customerEmail || null,
    shippingAddress: meta.shippingAddress || null,
    createdAt: h.createdAt || h.updatedAt || new Date().toISOString(),
    items: lines.map((l, i) => ({
      id: l.lineId || `held-line-${i}`,
      name: l.name,
      productName: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalPrice: l.lineTotal,
    })),
  } as MerchantOrder;
}

function heldMatchesStatusFilter(h: HeldRow, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'cancelled' || filter === 'completed' || filter === 'refunded') return false;
  if (filter === 'pending') return h.status === 'held';
  if (filter === 'preparing' || filter === 'accepted' || filter === 'sent_to_kitchen') {
    return h.status === 'sent_to_kitchen';
  }
  return true;
}

function orderInDateWindow(order: MerchantOrder, from: string, to: string): boolean {
  const ts = new Date(order.createdAt).getTime();
  if (!Number.isFinite(ts)) return false;
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59.999`).getTime();
  return ts >= start && ts <= end;
}

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

function matchesTypeFilter(o: MerchantOrder, filter: TypeFilter) {
  if (filter === 'all') return true;
  if (filter === 'programmed') return isProgrammedOrder(o);
  if (filter === 'kitchen') return isKitchenTypeOrder(o);
  if (filter === 'online') return isOnlineShopOrder(o);
  if (filter === 'invoice') return isInvoiceOrder(o);
  return orderChannel(o) === filter;
}

function canRefundMerchantOrder(o: MerchantOrder): boolean {
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

function orderStatusNorm(status?: string | null): string {
  return String(status || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
}

function isOpenOnlineFulfillment(o: MerchantOrder): boolean {
  if (!isOnlineShopOrder(o)) return false;
  const status = orderStatusNorm(o.status);
  return !['cancelled', 'refunded', 'completed', 'partially_refunded'].includes(status);
}

function isUnpaidOnlineOrder(o: MerchantOrder): boolean {
  if (isPaidOrder(o)) return false;
  const pay = orderStatusNorm(o.paymentStatus);
  const method = String(o.paymentMethod || '')
    .toLowerCase()
    .replace(/-/g, '_');
  return (
    pay === 'awaiting_payment' ||
    method === 'pay_later' ||
    method === 'invoice' ||
    pay === 'cash'
  );
}

function canShowCollectPayment(o: MerchantOrder): boolean {
  if (isOnlineShopOrder(o)) return canCollectPayment(o);
  return canAdminCollectPayment(o);
}

function canFinalizeOnlineHandoff(o: MerchantOrder): boolean {
  if (!isOpenOnlineFulfillment(o)) return false;
  const status = orderStatusNorm(o.status);
  return status === 'ready' || status === 'out_for_delivery';
}

type InvoicePayFilter = 'all' | 'unpaid' | 'paid';

type DriverPing = {
  staffId: string;
  staffName: string;
  latitude: number | null;
  longitude: number | null;
  stale?: boolean;
  recordedAt?: string;
};

function guestTrackingUrl(slug: string, orderId: string, token: string): string {
  return `${window.location.origin}/shop/${encodeURIComponent(slug)}/order/${orderId}?track=${encodeURIComponent(token)}`;
}

function OrderDeliveryPanel({
  order,
  storeLat,
  storeLng,
  shopSlug,
  deliveryStaff,
  onDriverAssigned,
}: {
  order: MerchantOrder;
  storeLat: number | null;
  storeLng: number | null;
  shopSlug: string | null;
  deliveryStaff: Array<{ id: string; name: string }>;
  onDriverAssigned: (staffId: string | null, staffName: string | null) => void;
}) {
  const { t } = useI18n();
  const [driver, setDriver] = useState<DriverPing | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get(`/merchant/delivery/orders/${order.id}/driver`);
        if (!cancelled) setDriver(res.data.driver || null);
      } catch {
        if (!cancelled) setDriver(null);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [order.id]);

  const assignDriver = async (staffId: string) => {
    setAssignBusy(true);
    try {
      await api.post(`/merchant/delivery/orders/${order.id}/assign`, {
        staffId: staffId || null,
      });
      toast.success(t('deliveryAssignSaved'));
      const name = staffId ? deliveryStaff.find((s) => s.id === staffId)?.name || null : null;
      onDriverAssigned(staffId || null, name);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('deliveryAssignFailed'));
    } finally {
      setAssignBusy(false);
    }
  };

  const copyTrackingLink = async () => {
    if (!shopSlug || !order.deliveryTrackingToken) return;
    const url = guestTrackingUrl(shopSlug, order.id, order.deliveryTrackingToken);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('deliveryTrackingLinkCopied'));
    } catch {
      toast.error(t('actionFailed'));
    }
  };

  const destLat = order.deliveryLatitude != null ? Number(order.deliveryLatitude) : NaN;
  const destLng = order.deliveryLongitude != null ? Number(order.deliveryLongitude) : NaN;
  const destination =
    Number.isFinite(destLat) && Number.isFinite(destLng)
      ? { latitude: destLat, longitude: destLng }
      : null;
  const store =
    storeLat != null && storeLng != null && Number.isFinite(storeLat) && Number.isFinite(storeLng)
      ? { latitude: storeLat, longitude: storeLng }
      : null;
  const driverPoint =
    driver &&
    driver.latitude != null &&
    driver.longitude != null &&
    Number.isFinite(driver.latitude) &&
    Number.isFinite(driver.longitude)
      ? {
          latitude: driver.latitude,
          longitude: driver.longitude,
          name: driver.staffName,
          stale: driver.stale,
        }
      : null;

  const assignedId = order.assignedDeliveryStaffId || driver?.staffId || '';

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
        {t('deliveryLiveTracking')}
      </p>
      {deliveryStaff.length > 0 ? (
        <label className="block text-sm">
          <span className="text-[var(--text-muted)]">{t('deliveryAssignDriver')}</span>
          <select
            className="input mt-1 w-full text-sm"
            disabled={assignBusy}
            value={assignedId}
            onChange={(e) => void assignDriver(e.target.value)}
          >
            <option value="">{t('deliveryUnassigned')}</option>
            {deliveryStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-stone-800">
          <span className="text-[var(--text-muted)]">{t('deliveryAssignedDriver')}:</span>{' '}
          {driver?.staffName || order.assignedDriverName || t('deliveryUnassigned')}
        </p>
      )}
      {isOnlineShopOrder(order) && order.deliveryTrackingToken && shopSlug ? (
        <button
          type="button"
          className="text-xs font-semibold text-teal-800 underline-offset-2 hover:underline"
          onClick={() => void copyTrackingLink()}
        >
          {t('deliveryCopyTrackingLink')}
        </button>
      ) : null}
      {driverPoint && !driverPoint.stale ? (
        <p className="text-xs text-emerald-800">
          {t('deliveryDriverOnWay').replace('{name}', driverPoint.name || '')}
        </p>
      ) : (
        <p className="text-xs text-stone-500">{t('deliveryTrackingWaiting')}</p>
      )}
      <DeliveryLiveMap store={store} destination={destination} driver={driverPoint} heightClass="h-44" />
    </div>
  );
}

const compactControl =
  'h-9 min-h-9 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text)] shadow-sm';
const compactSelect = `${compactControl} w-auto min-w-[9rem] max-w-full sm:min-w-[10rem]`;
const filterPill =
  'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition-colors';

export default function Orders({ invoiceLedger = false }: { invoiceLedger?: boolean }) {
  const { t, formatDateTime, locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const jwtIsOwner = user?.role === 'merchant' && user?.isOwner !== false;
  const canSalesAdjust =
    jwtIsOwner ||
    hasPermission(user?.permissions as Permission[] | undefined, 'VIEW_ALL_SALES', false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [heldRows, setHeldRows] = useState<HeldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MerchantOrder | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    invoiceLedger || searchParams.get('type') === 'invoice' ? 'invoice' : 'all'
  );
  const [invoicePayFilter, setInvoicePayFilter] = useState<InvoicePayFilter>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const showingInvoices = invoiceLedger || typeFilter === 'invoice';

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
    latitude?: number | null;
    longitude?: number | null;
  } | null>(null);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [printing, setPrinting] = useState(false);
  const [salesAdjOpen, setSalesAdjOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [refundFor, setRefundFor] = useState<MerchantOrder | null>(null);
  const [refundReasons, setRefundReasons] = useState<RefundReasonOption[]>([]);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundPrintPrompt, setRefundPrintPrompt] = useState<{
    order: MerchantOrder;
    refunded: number;
    refundTotal: number;
    reason: string;
    allocation?: { giftCard?: number; cash?: number; terminal?: number; other?: number };
  } | null>(null);
  const [refundPrintBusy, setRefundPrintBusy] = useState(false);
  const [deliveryStaff, setDeliveryStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [shopSlug, setShopSlug] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [settingsRes, staffRes, deliveryRes] = await Promise.all([
        api.get('/merchant/settings'),
        api.get('/merchant/staff').catch(() => ({ data: { staff: [] } })),
        api.get('/merchant/delivery/live').catch(() => ({ data: { deliveryStaff: [] } })),
      ]);
      const s = settingsRes.data?.settings || settingsRes.data || {};
      setShopSlug(s.slug || s.subdomain || null);
      setDeliveryStaff(
        (deliveryRes.data?.deliveryStaff || []).map((row: { id: string; name: string }) => ({
          id: row.id,
          name: row.name,
        }))
      );
      setMerchant({
        name: s.name,
        address: s.address,
        city: s.city,
        phone: s.phone,
        vatNumber: s.vatNumber,
        vatRate: s.vatRate,
        taxIncludedInPrice: s.taxIncludedInPrice,
        shopLogoUrl: s.shopLogoUrl,
        latitude: s.latitude != null ? Number(s.latitude) : null,
        longitude: s.longitude != null ? Number(s.longitude) : null,
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
      if (showingInvoices) {
        const params = new URLSearchParams({ limit: '200' });
        if (invoicePayFilter !== 'all') params.set('status', invoicePayFilter);
        if (searchQ) params.set('q', searchQ);
        const response = await api.get(`/merchant/invoices?${params.toString()}`);
        setOrders((response.data.invoices || []) as MerchantOrder[]);
        setHeldRows([]);
      } else {
        const params = new URLSearchParams({
          limit: '200',
          from: dateFrom,
          to: dateTo,
        });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (searchQ) params.set('q', searchQ);
        const [ordersRes, heldRes] = await Promise.all([
          api.get(`/merchant/pos/orders?${params.toString()}`),
          api.get('/merchant/pos/held'),
        ]);
        setOrders((ordersRes.data.orders || []) as MerchantOrder[]);
        setHeldRows((heldRes.data.held || []) as HeldRow[]);
        setRefundReasons(ordersRes.data.refundReasons || []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ordersLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter, searchQ, showingInvoices, invoicePayFilter, t]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

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

  const heldOrders = useMemo(() => heldRows.map(heldToMerchantOrder), [heldRows]);

  const list = useMemo(() => {
    const q = searchQ.trim();
    const combined = showingInvoices
      ? orders
      : [
          ...orders,
          ...heldOrders.filter((o) => {
            if (q) return orderMatchesSearchQuery(o, q);
            return orderInDateWindow(o, dateFrom, dateTo);
          }),
        ];
    return combined
      .filter((o) => {
        if (isHeldListRow(o)) {
          const held = heldRows.find((h) => `held:${h.id}` === o.id);
          if (!held) return false;
          if (!heldMatchesStatusFilter(held, statusFilter)) return false;
        }
        if (paymentFilter === 'invoice') {
          if (!isInvoiceOrder(o)) return false;
        } else if (
          paymentFilter !== 'all' &&
          (o.paymentMethod || '').toLowerCase() !== paymentFilter
        ) {
          return false;
        }
        if (!showingInvoices && !matchesTypeFilter(o, typeFilter)) return false;
        if (!showingInvoices && !matchesChannelFilter(o, channelFilter)) return false;
        if (staffFilter !== 'all') {
          const staffRow = staffList.find((s) => s.id === staffFilter);
          const target = staffRow?.name || staffFilter;
          if ((o.staffName || '').trim() !== target) return false;
        }
        if (q && !orderMatchesSearchQuery(o, q)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    orders,
    heldOrders,
    heldRows,
    paymentFilter,
    typeFilter,
    channelFilter,
    staffFilter,
    staffList,
    searchQ,
    showingInvoices,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  const openInvoice = async (order: MerchantOrder, mode: 'view' | 'download') => {
    setPdfBusy(true);
    try {
      if (mode === 'download') {
        await downloadInvoicePdf(order.id, order.invoiceNumber ? `${order.invoiceNumber}.pdf` : undefined);
      } else {
        await viewInvoicePdf(order.id);
      }
    } catch {
      toast.error(t('webPosInvoicePdfFailed'));
    } finally {
      setPdfBusy(false);
    }
  };

  const openDetail = async (order: MerchantOrder) => {
    setCollectOpen(false);
    if (isHeldListRow(order)) {
      setSelected(order);
      return;
    }
    try {
      const res = await api.get(`/merchant/orders/${order.id}`);
      setSelected((res.data.order as MerchantOrder) || order);
    } catch {
      setSelected(order);
    }
  };

  const recordInvoicePaid = async (order: MerchantOrder) => {
    setActionBusy(true);
    try {
      const res = await api.post(`/merchant/orders/${order.id}/record-invoice-payment`, {
        paymentMethod: INVOICE_SETTLEMENT_METHOD,
      });
      const updated = (res.data?.order as MerchantOrder) || order;
      setSelected((prev) =>
        prev && prev.id === order.id
          ? { ...prev, ...updated, items: prev.items || updated.items }
          : { ...order, ...updated }
      );
      toast.success(t('webPosPaymentCollected'));
      setCollectOpen(false);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosPaymentCollectFailed'));
    } finally {
      setActionBusy(false);
    }
  };

  const runOrderAction = async (
    order: MerchantOrder,
    action: string,
    extra?: Record<string, unknown>
  ) => {
    setActionBusy(true);
    try {
      const res = await api.post(`/merchant/orders/${order.id}/action`, { action, ...extra });
      const updated = (res.data?.order as MerchantOrder) || order;
      setSelected((prev) =>
        prev && prev.id === order.id
          ? { ...prev, ...updated, items: prev.items || updated.items }
          : { ...order, ...updated }
      );
      toast.success(t('updated'));
      setCollectOpen(false);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('actionFailed'));
    } finally {
      setActionBusy(false);
    }
  };

  const doRefund = async (payload: {
    refundKind: 'referenced' | 'goodwill';
    mode: 'full' | 'items';
    reason: string;
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
          items: payload.items,
        });
        toast.success(t('webPosOrderRefunded'));
        if (res.data) {
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
      setSelected(null);
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

  const printRefundConfirmation = async (payload: {
    order: MerchantOrder;
    refunded: number;
    refundTotal: number;
    reason: string;
    allocation?: { giftCard?: number; cash?: number; terminal?: number; other?: number };
  }) => {
    if (!merchant) {
      toast.error(t('webPosPrintFailed'));
      return;
    }
    await printRefundReceipt(
      {
        orderNumber: payload.order.orderNumber,
        orderDisplay: payload.order.ticketDisplay,
        refundedAt: Date.now(),
        refundAmount: payload.refunded,
        refundTotal: payload.refundTotal,
        reason: payload.reason,
        allocation: payload.allocation,
        staffName: payload.order.staffName,
      },
      {
        merchant,
        printSettings,
        locale,
      }
    );
    toast.success(t('webPosSentDefaultPrinter'));
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
      toastPrintError(e, t, 'webPosPrintFailed');
    } finally {
      setPrinting(false);
    }
  };

  const setTypeTab = (id: TypeFilter) => {
    setTypeFilter(id);
    if (invoiceLedger) return;
    if (id === 'invoice') {
      setSearchParams({ type: 'invoice' }, { replace: true });
    } else if (searchParams.get('type')) {
      setSearchParams({}, { replace: true });
    }
  };

  const clearFilters = () => {
    setDateFrom(todayIso());
    setDateTo(todayIso());
    setStatusFilter('all');
    setPaymentFilter('all');
    setChannelFilter('all');
    setTypeFilter(invoiceLedger ? 'invoice' : 'all');
    setInvoicePayFilter('all');
    setStaffFilter('all');
    setSearch('');
    if (!invoiceLedger && searchParams.get('type')) {
      setSearchParams({}, { replace: true });
    }
  };

  const hasActiveFilters =
    paymentFilter !== 'all' ||
    (!invoiceLedger && typeFilter !== 'all') ||
    channelFilter !== 'all' ||
    staffFilter !== 'all' ||
    invoicePayFilter !== 'all' ||
    search.trim() !== '' ||
    (!showingInvoices && (dateFrom !== todayIso() || dateTo !== todayIso()));

  if (loading && orders.length === 0) {
    return <div className="text-center py-10 muted text-sm">{t('ordersLoading')}</div>;
  }

  return (
    <div className="space-y-2.5 max-w-6xl">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight text-[var(--text)]">
          {showingInvoices ? t('invoicesTitle') : t('orders')}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('ordersRefresh')}
        </button>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/60 p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2">
          {showingInvoices ? null : (
            <>
              <input
                type="date"
                className={`${compactControl} w-[8.5rem] shrink-0`}
                value={dateFrom}
                aria-label={t('ordersFilterFrom')}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <input
                type="date"
                className={`${compactControl} w-[8.5rem] shrink-0`}
                value={dateTo}
                aria-label={t('ordersFilterTo')}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </>
          )}
          {canSalesAdjust ? (
            <SecretSearchTapButton
              onUnlock={() => setSalesAdjOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--bg-elevated)] active:scale-95"
            />
          ) : null}
          <input
            type="search"
            className={`${compactControl} min-w-[10rem] flex-1 basis-[12rem] sm:max-w-[16rem]`}
            placeholder={t('webPosSearchOrders')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!showingInvoices ? (
            <>
              <select
                className={compactSelect}
                value={statusFilter}
                aria-label={t('ordersFilterStatus')}
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
              <select
                className={compactSelect}
                value={paymentFilter}
                aria-label={t('ordersFilterPayment')}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="all">{t('ordersAllPayments')}</option>
                <option value="cash">{t('webPosCash')}</option>
                <option value="card">{t('webPosCard')}</option>
                <option value="terminal">{t('webPosTerminal')}</option>
                <option value="express">{t('webPosExpress')}</option>
                <option value="pay_later">{t('webPosPayLater')}</option>
                <option value="invoice">{t('webPosInvoice')}</option>
              </select>
              <select
                className={compactSelect}
                value={staffFilter}
                aria-label={t('ordersFilterStaff')}
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
            </>
          ) : null}
        </div>

        {showingInvoices ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
            <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:w-auto">
              {t('ordersFilterPayment')}
            </span>
            {(
              [
                ['all', t('invoicesAll')],
                ['unpaid', t('invoicesUnpaid')],
                ['paid', t('invoicesPaid')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setInvoicePayFilter(id)}
                className={`${filterPill} ${
                  invoicePayFilter === id
                    ? 'border-indigo-700 bg-indigo-700 text-white'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-indigo-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
          <span className="text-xs font-medium tabular-nums text-[var(--text-muted)]">
            {t('ordersResults').replace('{n}', String(list.length))}
          </span>
          {hasActiveFilters ? (
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center rounded-md px-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30"
              onClick={clearFilters}
            >
              {t('ordersClearFilters')}
            </button>
          ) : null}
        </div>
      </div>

      {invoiceLedger ? null : (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', t('ordersTabAll')],
              ['delivery', t('delivery')],
              ['takeaway', t('takeaway')],
              ['dine_in', t('dineIn')],
              ['online', t('webPosOnlineOrders')],
              ['programmed', t('ordersProgrammed')],
              ['invoice', t('webPosInvoice')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTypeTab(id)}
              className={`${filterPill} h-8 text-[11px] ${
                typeFilter === id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {list.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-12 text-center text-sm text-[var(--text-muted)]">
            {showingInvoices ? t('invoicesEmpty') : t('ordersEmpty')}
          </div>
        )}
        {list.map((order) => {
          const ch = orderChannel(order);
          const online = isOnlineShopOrder(order);
          const title = showingInvoices
            ? order.invoiceNumber ||
              formatOrderNumberDisplay(order.orderNumber) ||
              order.id.slice(0, 8)
            : orderListPrimaryLabel(order) || order.id.slice(0, 8);
          const heldKitchen = isHeldListRow(order);
          const invoicePaid = isPaidOrder(order);
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
                    {heldKitchen
                      ? t('webPosOngoing')
                      : isOnlineShopOrder(order)
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
                {showsKitchenFulfillmentStages(order) ? (
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-bold uppercase ${orderStatusBadgeClass(order.status)}`}
                  >
                    {statusLabel(order.status, t)}
                  </span>
                ) : null}
                <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5">
                  {formatOrderPaymentDisplay(order, t, locale)}
                </span>
                {isInvoiceOrder(order) ? (
                  <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-indigo-800">
                    {showingInvoices
                      ? invoicePaid
                        ? t('invoiceStatusPaid')
                        : t('invoiceStatusUnpaid')
                      : t('webPosInvoice')}
                    {!showingInvoices && order.invoiceNumber ? ` ${order.invoiceNumber}` : ''}
                  </span>
                ) : null}
                {isAwaitingPaymentOrder(order) ? (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-900">
                    {t('webPosAwaitingPayment')}
                  </span>
                ) : null}
                {order.staffName ? (
                  <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 truncate max-w-[8rem]">
                    {order.staffName}
                  </span>
                ) : null}
                {isDeliveryOrder(order) && order.assignedDriverName ? (
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-emerald-900 truncate max-w-[8rem]">
                    🛵 {order.assignedDriverName}
                  </span>
                ) : null}
                <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 font-extrabold tabular-nums">
                  CHF {Number(order.total || 0).toFixed(2)}
                </span>
              </div>

              {(order.customerName || order.customerPhone || resolveOrderCustomerDisplay(order)) && (
                <p className="mt-1.5 truncate text-xs">
                  {resolveOrderCustomerDisplay(order) || order.customerName}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                </p>
              )}
              {isInvoiceOrder(order) ? (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold hover:bg-[var(--bg-muted)]"
                  disabled={pdfBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void openInvoice(order, 'download');
                  }}
                >
                  <Download size={12} />
                  {t('webPosDownloadInvoice')}
                </button>
              ) : null}
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
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold">
                  {formatOrderNumberDisplay(selected.orderNumber) || selected.id.slice(0, 8)}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  {showsKitchenFulfillmentStages(selected) ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${orderStatusBadgeClass(selected.status)}`}
                    >
                      {statusLabel(selected.status, t)}
                    </span>
                  ) : null}
                  {isAwaitingPaymentOrder(selected) ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                      {t('webPosAwaitingPayment')}
                    </span>
                  ) : null}
                </p>
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
                  {resolveOrderCustomerDisplay(selected) || '—'}{' '}
                  {selected.customerPhone || ''}
                </p>
                {selected.shippingAddress ? (
                  <p>
                    <span className="text-[var(--text-muted)]">{t('ordersAddress')}:</span>{' '}
                    {selected.shippingAddress}
                  </p>
                ) : null}
                {isDeliveryOrder(selected) &&
                !['cancelled', 'refunded', 'completed'].includes(selected.status) ? (
                  <OrderDeliveryPanel
                    order={selected}
                    storeLat={merchant?.latitude ?? null}
                    storeLng={merchant?.longitude ?? null}
                    shopSlug={shopSlug}
                    deliveryStaff={deliveryStaff}
                    onDriverAssigned={(staffId, staffName) => {
                      setSelected((prev) =>
                        prev
                          ? {
                              ...prev,
                              assignedDeliveryStaffId: staffId,
                              assignedDriverName: staffName,
                            }
                          : prev
                      );
                      void load();
                    }}
                  />
                ) : null}
                {isInvoiceOrder(selected) ? (
                  <p>
                    <span className="text-[var(--text-muted)]">{t('invoicesNumber')}:</span>{' '}
                    {selected.invoiceNumber || '—'}
                    {' · '}
                    {isPaidOrder(selected) ? t('invoiceStatusPaid') : t('invoiceStatusUnpaid')}
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

              <OrderRefundHistory
                history={selected.refundHistory || []}
                totalRefunded={Number(selected.refundAmount || 0)}
              />

              <ul className="space-y-2 border-t border-[var(--border)] pt-3 text-sm">
                {(selected.items || []).map((item, i) => (
                  <li key={item.id || i} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {Number(item.quantity)}× {orderItemName(item)}
                      {Number(item.refundedQuantity || 0) > 0 ? (
                        <span className="ml-1 text-xs text-rose-700">
                          ({t('orderItemRefunded').replace(
                            '{n}',
                            String(Number(item.refundedQuantity || 0))
                          )})
                        </span>
                      ) : null}
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
                {Number(selected.refundAmount || 0) > 0 ? (
                  <span className="block text-xs font-semibold text-rose-700">
                    {t('webPosRefundRemaining').replace(
                      '{amount}',
                      `CHF ${Math.max(0, Number(selected.total) - Number(selected.refundAmount || 0)).toFixed(2)}`
                    )}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5">
              <div className="mb-2.5 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${settingsDash.accent}22` }}
                >
                  <ShoppingBag className="h-4 w-4" style={{ color: settingsDash.accent }} aria-hidden />
                </div>
                <h3 className="text-sm font-extrabold tracking-tight text-[var(--text)]">
                  {t('ordersActionsTitle')}
                </h3>
              </div>
              <div className="max-h-[min(42vh,20rem)] space-y-2 overflow-y-auto">
                {!isHeldListRow(selected) && isInvoiceOrder(selected) ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={pdfBusy}
                      onClick={() => void openInvoice(selected, 'view')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bg-muted)] disabled:opacity-50"
                    >
                      <FileText size={16} />
                      {t('webPosViewInvoice')}
                    </button>
                    <button
                      type="button"
                      disabled={pdfBusy}
                      onClick={() => void openInvoice(selected, 'download')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      <Download size={16} />
                      {t('webPosDownloadInvoice')}
                    </button>
                  </div>
                ) : null}
                {!isHeldListRow(selected) &&
                isOpenOnlineFulfillment(selected) &&
                isAwaitingApproval(orderStatusNorm(selected.status)) ? (
                  <>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void runOrderAction(selected, 'accept')}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-violet-800 px-3 py-2.5 text-sm font-bold text-white hover:bg-violet-900 disabled:opacity-50"
                    >
                      {t('webPosAcceptOrder')}
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void runOrderAction(selected, 'reject')}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      {t('webPosRejectOrder')}
                    </button>
                  </>
                ) : null}
                {!isHeldListRow(selected) && canMarkReadyOrder(selected) ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void runOrderAction(selected, 'mark_ready')}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-violet-800 px-3 py-2.5 text-sm font-bold text-white hover:bg-violet-900 disabled:opacity-50"
                  >
                    {t('webPosMarkReady')}
                  </button>
                ) : null}
                {!isHeldListRow(selected) &&
                showsKitchenFulfillmentStages(selected) &&
                orderStatusNorm(selected.status) === 'ready' &&
                orderChannel(selected) === 'delivery' ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void runOrderAction(selected, 'out_for_delivery')}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bg-muted)] disabled:opacity-50"
                  >
                    {t('ordersActionSendDelivery')}
                  </button>
                ) : null}
                {!isHeldListRow(selected) && canFinalizeOnlineHandoff(selected) ? (
                  isUnpaidOnlineOrder(selected) || canCollectPayment(selected) ? (
                    <>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => setCollectOpen((v) => !v)}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {t('webPosCollectNow')} · CHF {Number(selected.total || 0).toFixed(2)}
                      </button>
                      {collectOpen ? (
                        <div className="space-y-1.5 rounded-lg border border-[var(--border)] p-2">
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {t('webPosCollectNowHint')}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(['cash', 'card', 'terminal', 'bank_transfer'] as const).map((method) => (
                              <button
                                key={method}
                                type="button"
                                disabled={actionBusy}
                                onClick={() =>
                                  void runOrderAction(selected, collectPaymentAction(selected.status), {
                                    paymentMethod: method,
                                  })
                                }
                                className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs font-semibold hover:bg-[var(--bg-muted)] disabled:opacity-50"
                              >
                                {method === 'cash'
                                  ? t('webPosCash')
                                  : method === 'card'
                                    ? t('webPosCard')
                                    : method === 'terminal'
                                      ? t('webPosTerminal')
                                      : t('webPosBankTransfer')}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void runOrderAction(selected, 'complete')}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-stone-800 px-3 py-2.5 text-sm font-bold text-white hover:bg-stone-900 disabled:opacity-50"
                    >
                      {t('webPosCompleteOrder')}
                    </button>
                  )
                ) : null}
                {!isHeldListRow(selected) && !canFinalizeOnlineHandoff(selected) && canShowCollectPayment(selected) ? (
                  isInvoiceOrder(selected) ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void recordInvoicePaid(selected)}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {t('webPosInvoiceMarkPaid')} · CHF {Number(selected.total || 0).toFixed(2)}
                      </button>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {t('webPosInvoiceMarkPaidHint')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => setCollectOpen((v) => !v)}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {t('webPosCollectNow')} · CHF {Number(selected.total || 0).toFixed(2)}
                      </button>
                      {collectOpen ? (
                        <div className="space-y-1.5 rounded-lg border border-[var(--border)] p-2">
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {t('webPosCollectNowHint')}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(['cash', 'card', 'terminal', 'bank_transfer'] as const).map((method) => (
                              <button
                                key={method}
                                type="button"
                                disabled={actionBusy}
                                onClick={() =>
                                  void runOrderAction(selected, collectPaymentAction(selected.status), {
                                    paymentMethod: method,
                                  })
                                }
                                className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs font-semibold hover:bg-[var(--bg-muted)] disabled:opacity-50"
                              >
                                {method === 'cash'
                                  ? t('webPosCash')
                                  : method === 'card'
                                    ? t('webPosCard')
                                    : method === 'terminal'
                                      ? t('webPosTerminal')
                                      : t('webPosBankTransfer')}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )
                ) : null}
                {!isHeldListRow(selected) &&
                canCancelOrder(selected) &&
                !isAwaitingApproval(orderStatusNorm(selected.status)) ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void runOrderAction(selected, 'cancel')}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    {t('webPosCancelOrder')}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={printing}
                  onClick={() => void doPrint(selected)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2.5 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
                >
                  <Printer size={16} />
                  {t('webPosPrintReceipt')}
                </button>
                {!showingInvoices && canRefundMerchantOrder(selected) ? (
                  <button
                    type="button"
                    disabled={refundBusy}
                    onClick={() => setRefundFor(selected)}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {t('webPosRefund')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <SalesAdjustmentModal
        open={salesAdjOpen}
        onClose={() => setSalesAdjOpen(false)}
        onApplied={() => void load()}
      />

      <WebPosRefundModal
        open={!!refundFor}
        orderNumber={refundFor?.orderNumber || ''}
        total={refundFor?.total || 0}
        alreadyRefunded={refundFor?.refundAmount || 0}
        items={(refundFor?.items || []).map((it) => ({
          id: String(it.id || ''),
          name: orderItemName(it),
          quantity: Number(it.quantity) || 0,
          totalPrice: Number(it.totalPrice) || 0,
          refundedQuantity: Number(it.refundedQuantity || 0),
        }))}
        reasons={refundReasons}
        busy={refundBusy}
        hasTerminalPortion={
          !!refundFor &&
          hasTerminalPortion(
            parsePaymentBreakdown(
              refundFor.paymentBreakdown,
              refundFor.paymentMethod,
              refundFor.total
            )
          )
        }
        terminalEnabled={false}
        onClose={() => setRefundFor(null)}
        onConfirm={(payload) => void doRefund(payload)}
      />
      <WebPosRefundPrintPromptModal
        open={!!refundPrintPrompt}
        amount={refundPrintPrompt?.refunded}
        busy={refundPrintBusy}
        onSkip={() => setRefundPrintPrompt(null)}
        onPrint={() => {
          if (!refundPrintPrompt) {
            setRefundPrintPrompt(null);
            return;
          }
          setRefundPrintBusy(true);
          void printRefundConfirmation(refundPrintPrompt)
            .catch((e) => toastPrintError(e, t, 'webPosPrintFailed'))
            .finally(() => {
              setRefundPrintBusy(false);
              setRefundPrintPrompt(null);
            });
        }}
      />
    </div>
  );
}
