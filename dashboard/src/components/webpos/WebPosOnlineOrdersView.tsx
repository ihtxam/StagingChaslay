import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Minus, Plus, Printer, Settings2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import {
  canCollectPayment,
  isAwaitingApproval,
  isAwaitingPaymentOrder,
  isActiveOnlineOrder,
  isDeliveryOrPickupShopOrder,
  isPaidOrder,
  orderPlatformBadgeClass,
  orderPlatformBorderClass,
  orderPlatformKey,
  orderPlatformLabel,
  orderStatusBadgeClass,
  orderStatusLabel,
  type MerchantOrder,
} from '@/lib/order-management';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import WebPosRejectOrderModal from '@/components/webpos/WebPosRejectOrderModal';
import WebPosPrepTimeSettingsModal from '@/components/webpos/WebPosPrepTimeSettingsModal';
import OrderAcceptWithEtaModal from '@/components/webpos/OrderAcceptWithEtaModal';

type OnlineStatusTab = 'active' | 'completed' | 'archives';
type PlatformFilter = 'all' | 'shop' | 'justeat' | 'ubereats';

type CenterOrder = OnlineOrder & {
  orderSource?: string | null;
  customerEmail?: string | null;
  estimatedReadyAt?: string | null;
  printCount?: number | null;
  paymentStatus?: string | null;
  items?: Array<{
    productName?: string | null;
    quantity: string | number;
    totalPrice?: string | number;
    categoryId?: string | null;
    product?: { categoryId?: string | null; category?: { name?: string } | null } | null;
  }>;
};

type Props = {
  orders: CenterOrder[];
  onRefresh: () => void;
  onOrderActioned?: (orderId: string) => void;
  onCollectPayment?: (order: CenterOrder) => void;
  highlightOrderId?: string | null;
  search?: string;
};

function isArchiveStatus(status: string) {
  const s = status.toLowerCase();
  return s === 'cancelled' || s === 'refunded';
}

function categoryTags(order: CenterOrder): string[] {
  const tags = new Set<string>();
  for (const item of order.items || []) {
    const cat = item.product?.category?.name;
    if (cat) tags.add(cat);
  }
  return [...tags].slice(0, 4);
}

export default function WebPosOnlineOrdersView({
  orders,
  onRefresh,
  onOrderActioned,
  onCollectPayment,
  highlightOrderId,
  search = '',
}: Props) {
  const { t, formatDateTime, formatTime } = useI18n();
  const [tab, setTab] = useState<OnlineStatusTab>('active');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectOrder, setRejectOrder] = useState<CenterOrder | null>(null);
  const [etaAcceptOrder, setEtaAcceptOrder] = useState<CenterOrder | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [printedToast, setPrintedToast] = useState<string | null>(null);

  useEffect(() => {
    if (highlightOrderId) {
      setTab('active');
    }
  }, [highlightOrderId]);

  const postAction = useCallback(
    async (id: string, action: string, extra?: Record<string, unknown>) => {
      const res = await api.post(`/merchant/orders/${id}/action`, { action, ...extra });
      return (res.data?.order as CenterOrder | undefined) || null;
    },
    []
  );

  const runAction = useCallback(
    async (order: CenterOrder, action: string, extra?: Record<string, unknown>) => {
      setBusyId(order.id);
      try {
        await postAction(order.id, action, extra);
        if (action === 'accept' || action === 'reject') {
          onOrderActioned?.(order.id);
        }
        if (action === 'accept') {
          setPrintedToast(order.id);
          window.setTimeout(() => setPrintedToast(null), 3000);
        }
        toast.success(t('updated'));
        await onRefresh();
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
      } finally {
        setBusyId(null);
      }
    },
    [onCollectPayment, onOrderActioned, onRefresh, postAction, t]
  );

  const adjustEta = useCallback(
    async (order: CenterOrder, deltaMinutes: number) => {
      setBusyId(order.id);
      try {
        await postAction(order.id, 'adjust_eta', { etaAdjustMinutes: deltaMinutes });
        toast.success(t('orderCenterEtaUpdated'));
        await onRefresh();
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
      } finally {
        setBusyId(null);
      }
    },
    [onRefresh, postAction, t]
  );

  const filtered = useMemo(() => {
    let list = orders;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const hay = [
          formatOrderNumberDisplay(o.orderNumber),
          o.orderNumber,
          o.customerName,
          o.customerPhone,
          o.shippingAddress,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (tab === 'active') {
      list = list.filter((o) => isActiveOnlineOrder(o));
    } else if (tab === 'completed') {
      list = list.filter((o) => o.status?.toLowerCase().trim() === 'completed');
    } else {
      list = list.filter((o) => isArchiveStatus(o.status));
    }
    if (platform !== 'all') {
      list = list.filter((o) => orderPlatformKey(o as MerchantOrder) === platform);
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders, tab, platform, search]);

  const money = (n: string | number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const renderActions = (o: CenterOrder) => {
    const status = o.status;
    const busy = busyId === o.id;
    if (isAwaitingApproval(status)) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => {
              if (isDeliveryOrPickupShopOrder(o)) {
                setEtaAcceptOrder(o);
              } else {
                void runAction(o, 'accept');
              }
            }}
          >
            {t('webPosWorkflowAccept')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
            onClick={() => setRejectOrder(o)}
          >
            {t('orderRejectConfirm')}
          </button>
        </div>
      );
    }
    if (status === 'accepted' || status === 'preparing') {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            onClick={() => void runAction(o, 'mark_ready')}
          >
            {t('webPosWorkflowReady')}
          </button>
        </div>
      );
    }
    if (status === 'ready' || status === 'out_for_delivery') {
      if (canCollectPayment(o as MerchantOrder)) {
        return (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            onClick={() => onCollectPayment?.(o)}
          >
            {t('webPosTakePayment')}
          </button>
        );
      }
      if (!isPaidOrder(o as MerchantOrder) && isAwaitingPaymentOrder(o as MerchantOrder)) {
        return (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            onClick={() => onCollectPayment?.(o)}
          >
            {t('webPosTakePayment')}
          </button>
        );
      }
      return (
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-stone-800 px-3 py-2 text-xs font-bold text-white hover:bg-stone-900 disabled:opacity-50"
          onClick={() => void runAction(o, 'complete')}
        >
          {t('webPosWorkflowDone')}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[var(--webpos-border)] bg-[var(--webpos-surface-2)] px-2 py-2 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--webpos-text-muted)]">{t('orderCenterSubtitle')}</p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--webpos-border)] bg-[var(--webpos-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--webpos-text)] hover:bg-[var(--webpos-surface-2)]"
            onClick={() => setPrepOpen(true)}
          >
            <Settings2 size={14} />
            {t('orderCenterPrepSettings')}
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {(
            [
              ['active', t('orderCenterTabActive')],
              ['completed', t('orderCenterTabCompleted')],
              ['archives', t('orderCenterTabArchives')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold sm:px-4 sm:text-sm ${
                tab === id
                  ? 'bg-[var(--webpos-accent)] text-white'
                  : 'bg-[var(--webpos-surface)] text-[var(--webpos-text-muted)] ring-1 ring-[var(--webpos-border)] hover:bg-[var(--webpos-surface-2)]'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-0.5 hidden h-5 w-px bg-[var(--webpos-border)] sm:inline-block" aria-hidden />
          {(
            [
              ['all', t('orderCenterFilterAll')],
              ['shop', t('orderPlatformShop')],
              ['justeat', t('orderPlatformJustEat')],
              ['ubereats', t('orderPlatformUberEats')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPlatform(id)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide sm:px-2.5 sm:text-[11px] ${
                platform === id
                  ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200'
                  : 'bg-[var(--webpos-surface)] text-[var(--webpos-text-muted)] ring-1 ring-[var(--webpos-border)] hover:bg-[var(--webpos-surface-2)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--webpos-border)] bg-[var(--webpos-surface)] p-8 text-center text-sm text-[var(--webpos-text-muted)]">
            {t('webPosNoOnlineOrders')}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((o) => {
              const tags = categoryTags(o);
              const platformClass = orderPlatformBadgeClass(o as MerchantOrder);
              const borderClass = orderPlatformBorderClass(o as MerchantOrder);
              const highlighted = highlightOrderId === o.id;
              const showPrintToast = printedToast === o.id;

              return (
                <article
                  key={o.id}
                  className={`relative overflow-hidden rounded-xl border border-[var(--webpos-border)] bg-[var(--webpos-surface)] shadow-sm border-l-4 ${borderClass} ${
                    highlighted ? 'ring-2 ring-violet-400' : ''
                  }`}
                >
                  {showPrintToast ? (
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-emerald-600 px-3 py-2 text-sm font-bold text-white">
                      <Printer size={16} />
                      {t('orderCenterPrinted')}
                    </div>
                  ) : null}

                  <div className="p-4 pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${platformClass}`}
                        >
                          {orderPlatformLabel(o as MerchantOrder, t)}
                        </span>
                        <span className="text-base font-bold text-[var(--webpos-text)]">
                          {formatOrderNumberDisplay(o.orderNumber) || o.id.slice(0, 8)}
                        </span>
                        {isPaidOrder(o as MerchantOrder) ||
                        o.paymentStatus === 'completed' ||
                        o.paymentMethod === 'card' ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                            {t('orderCenterPaidBadge')}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--webpos-text-muted)]">
                        {(o.printCount ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[var(--webpos-surface-2)] px-2 py-0.5 font-semibold text-[var(--webpos-text)]">
                            <Printer size={12} />
                            {o.printCount}
                          </span>
                        ) : null}
                        <span>{formatDateTime(o.createdAt)}</span>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-1 text-sm text-[var(--webpos-text)] sm:grid-cols-2">
                      {o.customerName ? <p className="font-semibold">{o.customerName}</p> : null}
                      {o.customerPhone ? <p>{o.customerPhone}</p> : null}
                      {o.shippingAddress ? (
                        <p className="sm:col-span-2 text-xs text-[var(--webpos-text-muted)]">{o.shippingAddress}</p>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${orderStatusBadgeClass(o.status)}`}
                      >
                        {orderStatusLabel(o.status, t)}
                      </span>
                      {isAwaitingPaymentOrder(o as MerchantOrder) ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-900">
                          {t('webPosAwaitingPayment')}
                        </span>
                      ) : null}
                      <span className="text-sm font-bold text-[var(--webpos-text)]">{money(o.total)}</span>
                      {o.scheduledFor ? (
                        <span className="text-xs font-semibold text-amber-800">
                          {t('orderCenterScheduled')}: {formatDateTime(o.scheduledFor)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-800">{t('webPosAsap')}</span>
                      )}
                    </div>

                    {tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-[var(--webpos-surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--webpos-text-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {o.items && o.items.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 text-xs text-[var(--webpos-text-muted)]">
                        {o.items.slice(0, 3).map((item, idx) => (
                          <li key={idx}>
                            {item.quantity}× {resolveOrderItemName(item.productName)}
                          </li>
                        ))}
                        {o.items.length > 3 ? (
                          <li className="text-[var(--webpos-text-muted)] opacity-70">
                            +{o.items.length - 3} {t('more')}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}

                    {o.estimatedReadyAt && isActiveOnlineOrder(o) ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--webpos-surface-2)] px-3 py-2">
                        <Clock size={14} className="text-[var(--webpos-text-muted)]" />
                        <span className="text-xs font-semibold text-[var(--webpos-text)]">
                          {t('orderCenterEta')}: {formatTime(o.estimatedReadyAt)}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--webpos-border)] bg-[var(--webpos-surface)] p-2.5 hover:bg-[var(--webpos-surface-2)] disabled:opacity-50"
                            disabled={busyId === o.id}
                            onClick={() => void adjustEta(o, -5)}
                            aria-label="-5 min"
                          >
                            <Minus size={20} />
                          </button>
                          <button
                            type="button"
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--webpos-border)] bg-[var(--webpos-surface)] p-2.5 hover:bg-[var(--webpos-surface-2)] disabled:opacity-50"
                            disabled={busyId === o.id}
                            onClick={() => void adjustEta(o, 5)}
                            aria-label="+5 min"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 border-t border-[var(--webpos-border)] pt-3">{renderActions(o)}</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <WebPosRejectOrderModal
        open={!!rejectOrder}
        orderLabel={
          rejectOrder
            ? formatOrderNumberDisplay(rejectOrder.orderNumber) || rejectOrder.id.slice(0, 8)
            : undefined
        }
        busy={busyId === rejectOrder?.id}
        onClose={() => setRejectOrder(null)}
        onConfirm={(reason) => {
          if (!rejectOrder) return;
          void runAction(rejectOrder, 'reject', { rejectReason: reason }).then(() =>
            setRejectOrder(null)
          );
        }}
      />

      <WebPosPrepTimeSettingsModal open={prepOpen} onClose={() => setPrepOpen(false)} />

      <OrderAcceptWithEtaModal
        order={etaAcceptOrder}
        busy={busyId === etaAcceptOrder?.id}
        onAccept={(order, mins) => {
          void runAction(order as CenterOrder, 'accept', { etaAdjustMinutes: mins }).then(() =>
            setEtaAcceptOrder(null)
          );
        }}
        onReject={(order) => {
          setEtaAcceptOrder(null);
          setRejectOrder(order as CenterOrder);
        }}
      />
    </div>
  );
}
