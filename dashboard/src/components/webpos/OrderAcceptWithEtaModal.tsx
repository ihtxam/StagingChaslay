import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CalendarClock, Loader2, X, Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { extractZipFromAddress } from '@/lib/delivery-hub-alerts';
import {
  orderPlatformBadgeClass,
  orderPlatformLabel,
  type MerchantOrder,
} from '@/lib/order-management';
import { startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/order-alert';
import { ORDER_ACCEPT_ETA_PRESETS } from '@/lib/shop-eta';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';

type Props = {
  order: OnlineOrder | null;
  queueCount?: number;
  busy?: boolean;
  onAccept: (order: OnlineOrder, prepMinutes: number) => void;
  onReject: (order: OnlineOrder) => void;
  onDismiss?: (order: OnlineOrder) => void;
};

function asMerchantOrder(o: OnlineOrder): MerchantOrder {
  return o as unknown as MerchantOrder;
}

export default function OrderAcceptWithEtaModal({
  order,
  queueCount = 1,
  busy,
  onAccept,
  onReject,
  onDismiss,
}: Props) {
  const { t, formatDateTime } = useI18n();
  const [prepMinutes, setPrepMinutes] = useState<number>(30);

  useEffect(() => {
    if (order) {
      startOrderAlertLoop(4500);
      setPrepMinutes(30);
    }
    return () => {
      if (!order) stopOrderAlertLoop();
    };
  }, [order?.id]);

  const estimatedReadyLabel = useMemo(() => {
    if (!order) return '';
    const base = order.scheduledFor ? new Date(order.scheduledFor) : new Date();
    const ready = new Date(base.getTime() + prepMinutes * 60 * 1000);
    return formatDateTime(ready.toISOString());
  }, [order, prepMinutes, formatDateTime]);

  if (!order) return null;

  const money = (n: string | number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const channelLabel = (ch?: string | null) => {
    if (ch === 'delivery') return t('delivery');
    if (ch === 'dine_in') return t('dineIn');
    return t('takeaway');
  };
  const items = order.items || [];
  const itemPreview = items.slice(0, 4);
  const platform = orderPlatformLabel(asMerchantOrder(order), t);
  const platformClass = orderPlatformBadgeClass(asMerchantOrder(order));
  const isScheduled = !!order.scheduledFor;
  const zip = extractZipFromAddress(order.shippingAddress);

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="order-accept-eta-title"
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-violet-300 bg-[var(--webpos-surface,var(--bg-elevated))] p-5 shadow-2xl ring-4 ring-violet-400/50 dark:border-violet-800">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Bell size={26} className="animate-pulse" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="order-accept-eta-title" className="text-xl font-bold text-[var(--webpos-text,var(--text))]">
                {t('webPosNewOrderAlert')}
              </h2>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${platformClass}`}
              >
                {platform}
              </span>
            </div>
            {queueCount > 1 ? (
              <p className="mt-0.5 text-xs font-semibold text-violet-700">
                {t('webPosNewOrderAlertQueue').replace('{n}', String(queueCount))}
              </p>
            ) : null}
          </div>
          {onDismiss ? (
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--webpos-text-muted,var(--text-muted))] hover:bg-[var(--webpos-surface-2,var(--bg-muted))]"
              aria-label={t('close')}
              onClick={() => onDismiss(order)}
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-violet-100 bg-violet-50/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-[var(--webpos-text,var(--text))]">
                {formatOrderNumberDisplay(order.orderNumber) || order.id.slice(0, 8)}
              </p>
              <p className="mt-0.5 text-sm text-[var(--webpos-text-muted,var(--text-muted))]">
                {channelLabel(order.fulfillmentChannel)} · {money(order.total)}
              </p>
            </div>
            <div
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                isScheduled ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {isScheduled ? <CalendarClock size={14} /> : <Zap size={14} />}
              {isScheduled ? t('orderCenterScheduled') : t('webPosAsap')}
            </div>
          </div>

          {isScheduled ? (
            <p className="text-sm font-semibold text-amber-900">
              {t('orderAcceptCustomerTime')}: {formatDateTime(order.scheduledFor!)}
            </p>
          ) : (
            <p className="text-sm text-[var(--webpos-text-muted,var(--text-muted))]">{t('orderAcceptAsapHint')}</p>
          )}

          {(order.customerName || order.customerPhone || order.shippingAddress) && (
            <div className="space-y-0.5 text-sm text-[var(--webpos-text,var(--text))]">
              {order.customerName ? <p className="font-semibold">{order.customerName}</p> : null}
              {order.customerPhone ? <p>{order.customerPhone}</p> : null}
              {order.shippingAddress ? (
                <p className="text-xs text-[var(--webpos-text-muted,var(--text-muted))]">{order.shippingAddress}</p>
              ) : null}
              {zip ? (
                <p className="text-xs font-bold text-sky-800">
                  {t('deliveryHubNewOrderZipPart').replace('{zip}', zip).replace(/^ for /, '').replace(/^ — /, '')}
                </p>
              ) : null}
            </div>
          )}

          {itemPreview.length > 0 ? (
            <ul className="space-y-0.5 border-t border-violet-100 pt-2 text-sm text-[var(--webpos-text,var(--text))] dark:border-violet-900">
              {itemPreview.map((item, idx) => (
                <li key={idx}>
                  {item.quantity}× {resolveOrderItemName(item.productName)}
                </li>
              ))}
              {items.length > itemPreview.length ? (
                <li className="text-[var(--webpos-text-muted,var(--text-muted))]">
                  {t('webPosNewOrderAlertMoreItems').replace(
                    '{n}',
                    String(items.length - itemPreview.length)
                  )}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-[var(--webpos-text,var(--text))]">{t('orderAcceptPrepTime')}</p>
          <p className="mt-0.5 text-xs text-[var(--webpos-text-muted,var(--text-muted))]">{t('orderAcceptPrepTimeHint')}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {ORDER_ACCEPT_ETA_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => setPrepMinutes(m)}
                className={`rounded-xl border-2 py-3 text-sm font-bold ${
                  prepMinutes === m
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface,var(--bg-elevated))] text-[var(--webpos-text,var(--text))] hover:border-violet-300'
                }`}
              >
                +{m} {t('minutes')}
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            {t('orderAcceptEstimatedReady')}: {estimatedReadyLabel}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl border-2 border-red-300 bg-red-50 py-3.5 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
            disabled={busy}
            onClick={() => onReject(order)}
          >
            {t('orderRejectConfirm')}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => onAccept(order, prepMinutes)}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {t('orderAcceptAndPrint')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
