import { createPortal } from 'react-dom';
import { Bell, ShoppingBag } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';

type Props = {
  order: OnlineOrder | null;
  queueCount?: number;
  onOpen: () => void;
  onOk: () => void;
};

export default function WebPosNewOrderAlertModal({
  order,
  queueCount = 1,
  onOpen,
  onOk,
}: Props) {
  const { t, formatDateTime } = useI18n();
  if (!order) return null;

  const money = (n: string | number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const channelLabel = (ch?: string | null) => {
    if (ch === 'delivery') return t('delivery');
    if (ch === 'dine_in') return t('dineIn');
    return t('takeaway');
  };
  const items = order.items || [];
  const itemPreview = items.slice(0, 4);

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="webpos-new-order-alert-title"
      aria-describedby="webpos-new-order-alert-body"
    >
      <div className="w-full max-w-md rounded-2xl border border-violet-200 bg-white p-5 shadow-2xl ring-4 ring-violet-400/40">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Bell size={22} className="animate-pulse" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="webpos-new-order-alert-title" className="text-lg font-bold text-stone-900">
              {t('webPosNewOrderAlert')}
            </h2>
            {queueCount > 1 ? (
              <p className="mt-0.5 text-xs font-semibold text-violet-700">
                {t('webPosNewOrderAlertQueue').replace('{n}', String(queueCount))}
              </p>
            ) : null}
          </div>
        </div>

        <div id="webpos-new-order-alert-body" className="mt-4 space-y-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">
                {formatOrderNumberDisplay(order.orderNumber) || order.id.slice(0, 8)}
              </p>
              <p className="mt-0.5 text-xs text-stone-600">
                {channelLabel(order.fulfillmentChannel)} · {money(order.total)}
              </p>
              {(order.customerName || order.customerPhone) && (
                <p className="mt-1 text-xs text-stone-700">
                  {[order.customerName, order.customerPhone].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="mt-1 text-[11px] text-stone-500">
                {order.scheduledFor
                  ? formatDateTime(order.scheduledFor)
                  : t('webPosAsap')}
              </p>
            </div>
            <ShoppingBag size={18} className="shrink-0 text-violet-600" aria-hidden />
          </div>
          {itemPreview.length > 0 ? (
            <ul className="space-y-0.5 border-t border-violet-100 pt-2 text-xs text-stone-700">
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

        <p className="mt-3 text-xs text-stone-500">{t('webPosNewOrderAlertHint')}</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn-secondary flex-1 py-3 text-sm font-bold"
            onClick={onOk}
          >
            {t('webPosNewOrderAlertOk')}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-3 text-sm font-bold"
            onClick={onOpen}
          >
            {t('webPosNewOrderAlertOpen')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
