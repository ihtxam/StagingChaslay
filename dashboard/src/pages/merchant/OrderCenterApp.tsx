/**
 * Order Center — installable PWA for Sunmi / handheld PDAs.
 * Live orders, print-on-tap (Print Bridge / built-in BT printer), history, daily report,
 * shop open/close toggles.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChefHat,
  History,
  Loader2,
  LogOut,
  Printer,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import AcceptingMenu from '@/components/AcceptingMenu';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import {
  isAwaitingApproval,
  isOnlineShopOrder,
} from '@/lib/order-management';
import {
  playOrderAlertOnce,
  startOrderAlertLoop,
  stopOrderAlertLoop,
} from '@/lib/order-alert';
import OrderAcceptWithEtaModal from '@/components/webpos/OrderAcceptWithEtaModal';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import {
  extractZipFromAddress,
  onlineShopOrderSpeechLine,
  speakDeliveryAlert,
} from '@/lib/delivery-hub-alerts';
import { useTillPrintHub } from '@/hooks/useTillPrintHub';
import { getPrintAgentHealth, isPrintAgentAvailable } from '@/lib/print-agent';
import { printOrderCenterTickets } from '@/lib/order-center-print';
import {
  generateEodReportText,
  logoUrlToEscPos,
  printersForRole,
  resolveReceiptLanguage,
  resolveReceiptLogoWidthPx,
  textToEscPos,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';
import { toastPrintError } from '@/lib/webpos-print-toast';

type CenterTab = 'live' | 'history' | 'daily';

type CenterOrder = {
  id: string;
  orderNumber: string;
  status: string;
  orderSource?: string | null;
  orderType?: string | null;
  fulfillmentChannel?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  scheduledFor?: string | null;
  total: number | string;
  createdAt: string;
  printCount?: number | null;
  items?: Array<{ productName?: string; name?: string; quantity: number }>;
};

type EodReport = {
  range: { label: string; from: string; to: string };
  salesCount: number;
  revenue: number;
  subtotal?: number;
  taxTotal: number;
  netTotal?: number;
  tipsTotal?: number;
  grandTotal: number;
  refundTotal: number;
  refundCount?: number;
  cancelledCount: number;
  cancelledTotal: number;
  cashTotal: number;
  cardTotal: number;
  terminalTotal: number;
  coversServed?: number | null;
  vatRows?: Array<{ label: string; net: number; tva: number; brut: number }>;
  paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
  refundRows?: Array<{ method: string; total: number }>;
  channelRows?: Array<{ channel: string; count: number; total: number }>;
  orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
  productsSold: Array<{ name: string; quantity: number; total: number }>;
  refundedOrders?: Array<{
    orderNumber: string;
    refundAmount: number;
    refundReason?: string | null;
  }>;
};

function isCenterOrder(o: CenterOrder, includeKiosk: boolean): boolean {
  if (String(o.orderSource || '').toLowerCase() === 'qr_table') return true;
  if (String(o.orderSource || '').toLowerCase() === 'kiosk') return includeKiosk;
  return isOnlineShopOrder(o);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function orderDay(iso: string): string {
  return iso.slice(0, 10);
}

export default function OrderCenterApp() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [tab, setTab] = useState<CenterTab>('live');
  const [orders, setOrders] = useState<CenterOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printBridgeOk, setPrintBridgeOk] = useState<boolean | null>(null);
  const [eod, setEod] = useState<EodReport | null>(null);
  const [eodLoading, setEodLoading] = useState(false);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [kioskLicensed, setKioskLicensed] = useState(false);
  const knownRef = useState<Set<string>>(() => new Set())[0];
  const [alertQueue, setAlertQueue] = useState<CenterOrder[]>([]);
  const [alertBusy, setAlertBusy] = useState(false);
  const unactionedAlertRef = useState<Set<string>>(() => new Set())[0];

  useTillPrintHub({ enabled: true });

  useEffect(() => {
    const unlock = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const markAlertDone = useCallback(
    (orderId: string) => {
      unactionedAlertRef.delete(orderId);
      setAlertQueue((prev) => {
        const next = prev.filter((o) => o.id !== orderId);
        if (next.length === 0) stopOrderAlertLoop();
        return next;
      });
    },
    [unactionedAlertRef]
  );

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"][data-order-center]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/order-center.webmanifest';
      link.dataset.orderCenter = '1';
      document.head.appendChild(link);
    }
    document.documentElement.classList.add('webpos-lock');
    return () => {
      link?.remove();
    };
  }, []);

  const checkPrintBridge = useCallback(async () => {
    try {
      const h = await getPrintAgentHealth();
      setPrintBridgeOk(h.ok);
    } catch {
      setPrintBridgeOk(false);
    }
  }, []);

  useEffect(() => {
    void checkPrintBridge();
    const id = window.setInterval(() => void checkPrintBridge(), 20_000);
    return () => window.clearInterval(id);
  }, [checkPrintBridge]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get('/merchant/settings');
        const s = res.data?.settings || {};
        setPrintSettings((s.posPrintSettings as PosPrintSettingsClient) || null);
        setShopName(String(s.name || user?.name || ''));
        setShopLogoUrl(s.shopLogoUrl || null);
        setKioskLicensed(!!(s.kioskAddonEnabled || s.kioskEnabled));
      } catch {
        /* optional */
      }
    })();
  }, [user?.name]);

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get('/merchant/orders', {
        params: {
          limit: 120,
          statuses:
            'pending_approval,pending,preparing,ready,out_for_delivery,completed,cancelled,rejected',
        },
      });
      const rows: CenterOrder[] = res.data?.orders || res.data?.data || [];
      const filtered = rows.filter((o) => isCenterOrder(o, kioskLicensed));
      setOrders(filtered);

      if (knownRef.size === 0) {
        for (const o of filtered) knownRef.add(o.id);
        return;
      }

      const freshPending = filtered.filter(
        (o) => !knownRef.has(o.id) && isAwaitingApproval(o.status)
      );
      for (const o of filtered) knownRef.add(o.id);

      if (freshPending.length > 0) {
        for (const o of freshPending) {
          unactionedAlertRef.add(o.id);
          const zip = extractZipFromAddress(o.shippingAddress);
          speakDeliveryAlert(onlineShopOrderSpeechLine(t, zip));
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(t('webPosNewOrderAlert'), {
                body: `#${formatOrderNumberDisplay(o.orderNumber)} · ${Number(o.total).toFixed(2)} CHF`,
                tag: `order-center-${o.id}`,
              });
            } catch {
              /* ignore */
            }
          }
        }
        setAlertQueue((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...freshPending.filter((o) => !seen.has(o.id))];
        });
        playOrderAlertOnce();
        startOrderAlertLoop(4500);
        if (document.hidden) {
          document.title = `🔔 ${t('webPosNewOrderAlert')} — Reborn`;
        }
      }

      setAlertQueue((prev) =>
        prev.filter((o) => unactionedAlertRef.has(o.id) && isAwaitingApproval(o.status))
      );
    } catch {
      toast.error(t('orderCenterLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [knownRef, t, unactionedAlertRef, kioskLicensed]);

  const loadEod = useCallback(async () => {
    setEodLoading(true);
    try {
      const res = await api.get('/merchant/reports/eod', { params: { preset: 'today' } });
      setEod(res.data?.report || res.data || null);
    } catch {
      toast.error(t('orderCenterDailyFailed'));
    } finally {
      setEodLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadOrders();
    const id = window.setInterval(() => void loadOrders(), 10_000);
    return () => window.clearInterval(id);
  }, [loadOrders]);

  useEffect(() => {
    if (tab === 'daily') void loadEod();
  }, [tab, loadEod]);

  const today = todayIso();

  const pending = useMemo(
    () => orders.filter((o) => isAwaitingApproval(o.status)),
    [orders]
  );

  const active = useMemo(
    () =>
      orders.filter(
        (o) =>
          !isAwaitingApproval(o.status) &&
          !['completed', 'cancelled', 'rejected'].includes(String(o.status).toLowerCase())
      ),
    [orders]
  );

  const history = useMemo(
    () =>
      orders
        .filter((o) => {
          const st = String(o.status).toLowerCase();
          return (
            (st === 'completed' || st === 'cancelled' || st === 'rejected') &&
            orderDay(o.createdAt) === today
          );
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [orders, today]
  );

  const runAction = async (
    orderId: string,
    action: string,
    opts?: {
      printAfterAccept?: boolean;
      orderSource?: string | null;
      etaAdjustMinutes?: number;
    }
  ) => {
    setBusyId(orderId);
    try {
      const body: Record<string, unknown> = { action };
      if (action === 'accept' && opts?.etaAdjustMinutes != null) {
        body.etaAdjustMinutes = opts.etaAdjustMinutes;
      }
      await api.post(`/merchant/orders/${orderId}/action`, body);
      if (action === 'accept') {
        toast.success(t('orderAccepted'));
        if (opts?.printAfterAccept !== false) {
          try {
            await printOrderCenterTickets(orderId, opts?.orderSource);
            toast.success(t('orderCenterPrinted'));
          } catch (e: unknown) {
            toastPrintError(e, t, 'orderCenterPrintFailed');
          }
        }
      } else if (action === 'reject') {
        toast.success(t('orderRejected'));
      } else if (action === 'mark_ready') {
        toast.success(t('orderCenterMarkedReady'));
      } else if (action === 'complete') {
        toast.success(t('orderCenterCompleted'));
      }
      await loadOrders();
      if (action === 'accept' || action === 'reject') {
        markAlertDone(orderId);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const acceptFromAlert = async (order: OnlineOrder, prepMinutes: number) => {
    setAlertBusy(true);
    try {
      await runAction(order.id, 'accept', {
        orderSource: order.orderSource,
        etaAdjustMinutes: prepMinutes,
      });
    } finally {
      setAlertBusy(false);
    }
  };

  const rejectFromAlert = async (order: OnlineOrder) => {
    setAlertBusy(true);
    try {
      await runAction(order.id, 'reject');
    } finally {
      setAlertBusy(false);
    }
  };

  const currentAlert = alertQueue[0] ?? null;

  const printOrder = async (o: CenterOrder) => {
    setBusyId(o.id);
    try {
      await printOrderCenterTickets(o.id, o.orderSource);
      toast.success(t('orderCenterPrinted'));
    } catch (e: unknown) {
      toastPrintError(e, t, 'orderCenterPrintFailed');
    } finally {
      setBusyId(null);
    }
  };

  const printDaily = async () => {
    if (!eod) return;
    try {
      const lang = resolveReceiptLanguage(printSettings, locale);
      const targets = printersForRole(printSettings, 'eod');
      const paperWidthMm = targets[0]?.paperWidthMm || printSettings?.paperWidthMm || 80;
      const text = generateEodReportText({
        label: eod.range.label,
        periodFrom: eod.range.from,
        periodTo: eod.range.to,
        salesCount: eod.salesCount,
        revenue: eod.revenue,
        subtotal: eod.subtotal ?? eod.revenue,
        taxTotal: eod.taxTotal,
        netTotal: eod.netTotal,
        tipsTotal: eod.tipsTotal,
        grandTotal: eod.grandTotal,
        refundTotal: eod.refundTotal,
        refundCount: eod.refundedOrders?.length ?? eod.refundCount,
        refundedOrders: eod.refundedOrders?.map((r) => ({
          orderNumber: r.orderNumber,
          refundAmount: r.refundAmount,
          refundReason: r.refundReason,
        })),
        refundRows: eod.refundRows,
        cancelledCount: eod.cancelledCount,
        cancelledTotal: eod.cancelledTotal,
        cashTotal: eod.cashTotal,
        cardTotal: eod.cardTotal,
        terminalTotal: eod.terminalTotal,
        coversServed: eod.coversServed,
        vatRows: eod.vatRows,
        productsSold: eod.productsSold,
        paymentRows: eod.paymentRows,
        orderTypeRows: eod.orderTypeRows,
        channelRows: eod.channelRows,
        businessName: shopName,
        language: lang,
        paperWidthMm,
        reportKind: 'eod',
        includeProductsSold: false,
      });
      const ok = await isPrintAgentAvailable();
      if (!ok) {
        toast.error(t('orderCenterPrintBridgeRequired'));
        return;
      }
      const names =
        targets.length > 0
          ? targets.map((x) => x.name)
          : [localStorage.getItem('manupos_webpos_printer') || ''];
      const logoUrl = printSettings?.receiptLogoUrl || shopLogoUrl;
      const logoWidth = resolveReceiptLogoWidthPx(printSettings, paperWidthMm === 58 ? 58 : 80);
      const logo = logoUrl ? await logoUrlToEscPos(logoUrl, logoWidth) : null;
      const escpos = textToEscPos(text, undefined, logo);
      const dataBase64 = uint8ToBase64(escpos);
      for (const name of names) {
        await printViaAgentOrQueue({
          printerName: (name || '').trim() || undefined,
          dataBase64,
          retryLocally: true,
        });
      }
      toast.success(t('orderCenterPrinted'));
    } catch (e: unknown) {
      toastPrintError(e, t, 'orderCenterPrintFailed');
    }
  };

  const sourceLabel = (o: CenterOrder) => {
    const src = String(o.orderSource || '').toLowerCase();
    if (src === 'qr_table') return t('catalogChannel_qr_table');
    if (src === 'kiosk') return t('catalogChannel_kiosk');
    if (o.fulfillmentChannel === 'delivery') return t('delivery');
    return t('shop');
  };

  const OrderCard = ({
    o,
    mode,
  }: {
    o: CenterOrder;
    mode: 'pending' | 'active' | 'history';
  }) => (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">{sourceLabel(o)}</p>
          <h2 className="text-lg font-bold">#{formatOrderNumberDisplay(o.orderNumber)}</h2>
          <p className="truncate text-sm">{o.customerName || '—'}</p>
          <p className="mt-0.5 text-xs uppercase text-[var(--text-muted)]">{o.status.replace(/_/g, ' ')}</p>
        </div>
        <p className="shrink-0 text-lg font-bold tabular-nums">{Number(o.total).toFixed(2)}</p>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm text-[var(--text-muted)]">
        {(o.items || []).slice(0, 5).map((item, idx) => (
          <li key={idx}>
            {item.quantity}× {item.productName || item.name}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {mode === 'pending' ? (
          <>
            <button
              type="button"
              disabled={busyId === o.id}
              className="btn-primary inline-flex flex-1 min-w-[7rem] items-center justify-center gap-2 py-3"
              onClick={() => void runAction(o.id, 'accept', { orderSource: o.orderSource, etaAdjustMinutes: 30 })}
            >
              <Check className="h-5 w-5" />
              {t('accept')}
            </button>
            <button
              type="button"
              disabled={busyId === o.id}
              className="btn-secondary inline-flex flex-1 min-w-[7rem] items-center justify-center gap-2 py-3"
              onClick={() => void runAction(o.id, 'reject')}
            >
              <X className="h-5 w-5" />
              {t('reject')}
            </button>
          </>
        ) : null}
        {mode === 'active' && o.status === 'preparing' ? (
          <button
            type="button"
            disabled={busyId === o.id}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 py-3"
            onClick={() => void runAction(o.id, 'mark_ready')}
          >
            <ChefHat className="h-5 w-5" />
            {t('orderCenterMarkReady')}
          </button>
        ) : null}
        {mode === 'active' && (o.status === 'ready' || o.status === 'out_for_delivery') ? (
          <button
            type="button"
            disabled={busyId === o.id}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 py-3"
            onClick={() => void runAction(o.id, 'complete')}
          >
            <Check className="h-5 w-5" />
            {t('orderCenterComplete')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busyId === o.id}
          className="btn-secondary inline-flex min-w-[7rem] flex-1 items-center justify-center gap-2 py-3"
          onClick={() => void printOrder(o)}
        >
          {busyId === o.id ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Printer className="h-5 w-5" />
          )}
          {t('orderCenterPrint')}
        </button>
      </div>
    </article>
  );

  return (
    <div className="order-center-app flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {t('orderCenterTitle')}
            </p>
            <h1 className="truncate text-lg font-bold">{shopName || user?.name || t('merchant')}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                printBridgeOk === true
                  ? 'bg-emerald-500'
                  : printBridgeOk === false
                    ? 'bg-red-500'
                    : 'bg-stone-400'
              }`}
              title={
                printBridgeOk
                  ? t('orderCenterPrinterReady')
                  : t('orderCenterPrintBridgeRequired')
              }
            />
            <AcceptingMenu />
            <button
              type="button"
              className="btn-secondary p-2"
              onClick={() => {
                void loadOrders();
                if (tab === 'daily') void loadEod();
              }}
              aria-label={t('refresh')}
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="btn-secondary p-2"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              aria-label={t('logout')}
              title={t('logout')}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--text-muted)]">{t('orderCenterHint')}</p>

        <nav className="mx-auto mt-3 flex max-w-lg gap-1 rounded-lg bg-[var(--bg-muted)] p-1">
          {(
            [
              ['live', t('orderCenterTabLive'), null],
              ['history', t('orderCenterTabHistory'), History],
              ['daily', t('orderCenterTabDaily'), TrendingUp],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold ${
                tab === id
                  ? 'bg-[var(--bg-elevated)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {label}
              {id === 'live' && pending.length > 0 ? (
                <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pending.length}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {tab === 'live' ? (
          loading ? (
            <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
          ) : (
            <>
              {pending.length === 0 && active.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] p-8 text-center">
                  <p className="font-medium">{t('orderCenterEmpty')}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{t('orderCenterEmptyHint')}</p>
                </div>
              ) : null}
              {pending.map((o) => (
                <OrderCard key={o.id} o={o} mode="pending" />
              ))}
              {active.length > 0 ? (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
                    {t('orderCenterInProgress')}
                  </h2>
                  <div className="space-y-3">
                    {active.map((o) => (
                      <OrderCard key={o.id} o={o} mode="active" />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )
        ) : null}

        {tab === 'history' ? (
          history.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] p-8 text-center">
              <History className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
              <p className="font-medium">{t('orderCenterHistoryEmpty')}</p>
            </div>
          ) : (
            history.map((o) => <OrderCard key={o.id} o={o} mode="history" />)
          )
        ) : null}

        {tab === 'daily' ? (
          eodLoading ? (
            <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
          ) : eod ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <h2 className="text-lg font-bold">{eod.range.label || t('orderCenterToday')}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">{t('orderCenterSalesCount')}</dt>
                  <dd className="font-semibold tabular-nums">{eod.salesCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">{t('reportsRevenue')}</dt>
                  <dd className="font-semibold tabular-nums">CHF {Number(eod.revenue).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">{t('reportsGrandTotal')}</dt>
                  <dd className="text-lg font-bold tabular-nums">
                    CHF {Number(eod.grandTotal).toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">{t('reportsCash')}</dt>
                  <dd className="tabular-nums">CHF {Number(eod.cashTotal).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">{t('reportsCard')}</dt>
                  <dd className="tabular-nums">CHF {Number(eod.cardTotal).toFixed(2)}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 py-3"
                onClick={() => void printDaily()}
              >
                <Printer className="h-5 w-5" />
                {t('orderCenterPrintDaily')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">{t('orderCenterDailyFailed')}</p>
          )
        ) : null}
      </main>

      <OrderAcceptWithEtaModal
        order={currentAlert as OnlineOrder | null}
        queueCount={alertQueue.length}
        busy={alertBusy || busyId === currentAlert?.id}
        onAccept={(o, mins) => void acceptFromAlert(o, mins)}
        onReject={(o) => void rejectFromAlert(o)}
      />
    </div>
  );
}
