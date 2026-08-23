import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  orderPlatformBadgeClass,
  orderPlatformLabel,
  orderSourceLabel,
  type MerchantOrder,
} from '@/lib/order-management';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { extractZipFromAddress } from '@/lib/delivery-hub-alerts';

export type DeliverySlipAckOrder = {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  total?: number | string | null;
  orderSource?: string | null;
  itemCount?: number | null;
};

type Props = {
  order: DeliverySlipAckOrder | null;
  queueCount?: number;
  onAcknowledge: (order: DeliverySlipAckOrder) => void;
};

export default function DeliveryPrintedSlipModal({
  order,
  queueCount = 1,
  onAcknowledge,
}: Props) {
  const { t } = useI18n();

  if (!order) return null;

  const zip = extractZipFromAddress(order.shippingAddress);
  const platform = orderPlatformLabel(order as unknown as MerchantOrder, t);
  const platformClass = orderPlatformBadgeClass(order as unknown as MerchantOrder);
  const source = orderSourceLabel(order.orderSource) || platform;
  const money = `CHF ${Number(order.total || 0).toFixed(2)}`;
  const itemLabel =
    order.itemCount != null && order.itemCount > 0
      ? t('deliveryHubItemCount').replace('{n}', String(order.itemCount))
      : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[360] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delivery-printed-slip-title"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-emerald-400 bg-white p-5 shadow-2xl ring-4 ring-emerald-400/40">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Printer size={28} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delivery-printed-slip-title" className="text-xl font-bold text-stone-900">
              {t('deliveryHubPrintedTitle')}
            </h2>
            {queueCount > 1 ? (
              <p className="mt-0.5 text-xs font-semibold text-emerald-800">
                {t('deliveryHubPrintedQueue').replace('{n}', String(queueCount))}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-stone-600">{t('deliveryHubPrintedHint')}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${platformClass}`}
            >
              {source}
            </span>
            <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900">
              {t('delivery')}
            </span>
          </div>

          <p className="text-lg font-bold text-stone-900">
            {formatOrderNumberDisplay(order.orderNumber) || order.id.slice(0, 8)}
          </p>

          <p className="font-semibold text-stone-900">{order.customerName || t('deliveryMapGuest')}</p>
          {order.shippingAddress ? (
            <p className="text-sm text-stone-700">{order.shippingAddress}</p>
          ) : null}
          {order.customerPhone ? (
            <p className="text-sm text-stone-600">{order.customerPhone}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {zip ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-900">
                {zip}
              </span>
            ) : null}
            <span className="text-sm font-extrabold tabular-nums">{money}</span>
            {itemLabel ? <span className="text-xs text-stone-600">{itemLabel}</span> : null}
          </div>
        </div>

        <button
          type="button"
          className="mt-5 w-full rounded-xl bg-emerald-600 py-4 text-base font-bold text-white hover:bg-emerald-700 active:scale-[0.99]"
          onClick={() => onAcknowledge(order)}
        >
          {t('deliveryHubTicketTaken')}
        </button>
      </div>
    </div>,
    document.body
  );
}
