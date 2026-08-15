import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CalendarClock, Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import {
  orderPlatformBadgeClass,
  orderPlatformLabel,
  type MerchantOrder,
} from '@/lib/order-management';
import { startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/order-alert';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';

type Props = {
  order: OnlineOrder | null;
  queueCount?: number;
  busy?: boolean;
  onAccept: (order: OnlineOrder) => void;
  onReject: (order: OnlineOrder) => void;
};

function asMerchantOrder(o: OnlineOrder): MerchantOrder {
  return o as unknown as MerchantOrder;
}

export default function WebPosNewOrderAlertModal({
  order,
  queueCount = 1,
  busy,
  onAccept,
  onReject,
}: Props) {
  const { t, formatDateTime } = useI18n();

  useEffect(() => {
    if (order) {
      startOrderAlertLoop(4500);
    }
    return () => {
      /* parent stops loop when queue empty */
    };
  }, [order?.id]);

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

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="webpos-new-order-alert-title"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-violet-300 bg-white p-5 shadow-2xl ring-4 ring-violet-400/50 animate-[pulse_2s_ease-in-out_3]">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Bell size={26} className="animate-pulse" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="webpos-new-order-alert-title" className="text-xl font-bold text-stone-900">
                {t('webPosNewOrderAlert')}
              </h2>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${platformClass}`}>
                {platform}
              </span>
            </div>
            {queueCount > 1 ? (
              <p className="mt-0.5 text-xs font-semibold text-violet-700">
                {t('webPosNewOrderAlertQueue').replace('{n}', String(queueCount))}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-violet-100 bg-violet-50/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-stone-900">
                {formatOrderNumberDisplay(order.orderNumber) || order.id.slice(0, 8)}
              </p>
              <p className="mt-0.5 text-sm text-stone-600">
                {channelLabel(order.fulfillmentChannel)} · {money(order.total)}
              </p>
            </div>
            <div
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                isScheduled
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {isScheduled ? <CalendarClock size={14} /> : <Zap size={14} />}
              {isScheduled ? t('orderCenterScheduled') : t('webPosAsap')}
            </div>
          </div>

          {isScheduled ? (
            <p className="text-sm font-semibold text-amber-900">
              {formatDateTime(order.scheduledFor!)}
            </p>
          ) : null}

          {(order.customerName || order.customerPhone || order.shippingAddress) && (
            <div className="space-y-0.5 text-sm text-stone-700">
              {order.customerName ? <p className="font-semibold">{order.customerName}</p> : null}
              {order.customerPhone ? <p>{order.customerPhone}</p> : null}
              {order.shippingAddress ? (
                <p className="text-xs text-stone-600">{order.shippingAddress}</p>
              ) : null}
            </div>
          )}

          {itemPreview.length > 0 ? (
            <ul className="space-y-0.5 border-t border-violet-100 pt-2 text-sm text-stone-700">
              {itemPreview.map((item, idx) => (
                <li key={idx}>
                  {item.quantity}× {resolveOrderItemName(item.productName)}
                </li>
              ))}
              {items.length > itemPreview.length ? (
                <li className="text-stone-500">
                  {t('webPosNewOrderAlertMoreItems').replace(
                    '{n}',
                    String(items.length - itemPreview.length)
                  )}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <p className="mt-3 text-center text-xs font-medium text-violet-800">
          {t('webPosNewOrderAlertActionHint')}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-xl border-2 border-red-300 bg-red-50 py-4 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              stopOrderAlertLoop();
              onReject(order);
            }}
          >
            {t('orderRejectConfirm')}
          </button>
          <button
            type="button"
            className="rounded-xl bg-emerald-600 py-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              stopOrderAlertLoop();
              onAccept(order);
            }}
          >
            {t('webPosWorkflowAccept')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
